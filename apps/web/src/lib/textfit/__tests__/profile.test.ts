// apps/web/src/lib/textfit/__tests__/profile.test.ts
//
// 레벨 프로파일 회귀. 이 파일이 지키는 계약:
//
//  1. **교사에게 거짓말하지 않는다** — 레벨 미상 질량은 감추지 않고 범위를 벌린다.
//     감추면 "고1 96%" 라고 말해 놓고 실제로는 89% 일 수 있다.
//  2. **적정 레벨은 낙관값으로 정하지 않는다** — 상한이 아니라 중앙 추정으로 판정한다.
//  3. **단조성** — 레벨이 높을수록 커버리지는 절대 내려가지 않는다. 깨지면 곡선이 뒤집혀
//     "고2보다 중3이 더 잘 읽는다" 는 화면이 나온다.

import { describe, expect, it } from 'vitest'

import { inflectionCandidates, collectCandidates } from '../inflect'
import { LEVEL_LABEL, PROFILE_LEVELS, buildLevelProfile, profileHeadline } from '../profile'
import type { PublicWord } from '../profile'

const lv = (surface: string, count: number, vLevel: number): PublicWord => ({
  surface,
  lemma: surface,
  count,
  status: 'leveled',
  vLevel,
})
const un = (surface: string, count: number): PublicWord => ({
  surface,
  lemma: surface,
  count,
  status: 'unleveled',
  vLevel: null,
})

// ── 굴절 후보 ───────────────────────────────────────────────────────────────

describe('inflectionCandidates — 후보 생성 (주장이 아니라 후보다)', () => {
  it('원형을 항상 첫 번째로 둔다 — 사전에 그대로 있는 단어가 이긴다', () => {
    expect(inflectionCandidates('news')[0]).toBe('news')
    expect(inflectionCandidates('allocated')[0]).toBe('allocated')
  })

  it('규칙 복수·3인칭을 되돌린다', () => {
    expect(inflectionCandidates('policies')).toContain('policy')
    expect(inflectionCandidates('boxes')).toContain('box')
    expect(inflectionCandidates('runs')).toContain('run')
  })

  it('과거형에서 어간 e 와 겹자음을 복원한다', () => {
    expect(inflectionCandidates('allocated')).toContain('allocate')
    expect(inflectionCandidates('stopped')).toContain('stop')
    expect(inflectionCandidates('studied')).toContain('study')
  })

  it('진행형에서 어간 e 와 겹자음을 복원한다', () => {
    expect(inflectionCandidates('running')).toContain('run')
    expect(inflectionCandidates('mitigating')).toContain('mitigate')
  })

  it('비교급·최상급·부사를 되돌린다', () => {
    expect(inflectionCandidates('happier')).toContain('happy')
    expect(inflectionCandidates('happiest')).toContain('happy')
    expect(inflectionCandidates('rapidly')).toContain('rapid')
    expect(inflectionCandidates('happily')).toContain('happy')
  })

  it('-ss/-us/-is 는 s 를 떼지 않는다 — "bus"→"bu" 같은 파편을 만들지 않는다', () => {
    expect(inflectionCandidates('pass')).not.toContain('pas')
    expect(inflectionCandidates('bus')).not.toContain('bu')
    expect(inflectionCandidates('analysis')).not.toContain('analysi')
  })

  it('ll/ss/ff/zz 는 겹자음 복원 대상이 아니다 — "smaller"→"smal" 방지', () => {
    expect(inflectionCandidates('smaller')).not.toContain('smal')
    expect(inflectionCandidates('smaller')).toContain('small')
  })

  // 실 데이터가 찾아준 갭 — 굴절 프로브 20개 중 유일하게 못 풀던 형태(2026-08-17).
  it('연쇄 굴절(-ed/-ing + -ly)을 2단까지 벗긴다', () => {
    expect(inflectionCandidates('repeatedly')).toContain('repeat')
    expect(inflectionCandidates('surprisingly')).toContain('surprise')
    expect(inflectionCandidates('unexpectedly')).toContain('unexpect')
  })

  // 부사 규칙만 과생성이 **실재하는 다른 단어**를 만든다 — 그래서 어간 4자 하한이 있다.
  it.each([
    { word: 'family', bad: 'fam' },
    { word: 'apply', bad: 'app' },
    { word: 'only', bad: 'on' },
    { word: 'reply', bad: 'rep' },
  ])('$word 를 $bad 로 접지 않는다 — 사전에 실재하는 오답이 된다', ({ word, bad }) => {
    expect(inflectionCandidates(word)).not.toContain(bad)
  })

  it('4자 이상 어간은 정상적으로 부사를 벗긴다', () => {
    expect(inflectionCandidates('rapidly')).toContain('rapid')
    expect(inflectionCandidates('largely')).toContain('large')
    expect(inflectionCandidates('happily')).toContain('happy')
  })

  it('2자 미만 조각을 만들지 않는다', () => {
    for (const w of ['is', 'as', 'es', 'ed', 'ing']) {
      expect(inflectionCandidates(w).every((c) => c.length >= 2)).toBe(true)
    }
  })

  it('중복 없이, 우선순위 순서를 유지한다', () => {
    const c = inflectionCandidates('studies')
    expect(new Set(c).size).toBe(c.length)
    expect(c[0]).toBe('studies')
  })

  it('collectCandidates 는 전량을 한 집합으로 모은다 (DB 왕복 1회용)', () => {
    const { all, bySurface } = collectCandidates(['policies', 'allocated'])
    expect(all).toContain('policy')
    expect(all).toContain('allocate')
    expect(bySurface.get('policies')?.[0]).toBe('policies')
  })
})

// ── 프로파일 ────────────────────────────────────────────────────────────────

describe('buildLevelProfile — 레벨별 판정', () => {
  it('레벨이 높을수록 커버리지가 내려가지 않는다 (단조성)', () => {
    const words = [lv('a', 5, 4), lv('b', 5, 6), lv('c', 5, 8), lv('d', 5, 10)]
    const p = buildLevelProfile(words, 400)

    for (let i = 1; i < p.readings.length; i++) {
      expect(p.readings[i]!.coverage).toBeGreaterThanOrEqual(p.readings[i - 1]!.coverage)
      expect(p.readings[i]!.unknownWords).toBeLessThanOrEqual(p.readings[i - 1]!.unknownWords)
    }
  })

  it('모든 레벨을 빠짐없이 낸다', () => {
    const p = buildLevelProfile([lv('a', 1, 5)], 100)
    expect(p.readings.map((r) => r.level)).toEqual([...PROFILE_LEVELS])
    expect(p.readings[0]!.label).toBe(LEVEL_LABEL[3])
  })

  it('기능어는 기지어로 센다 — 분모는 러닝 워드다', () => {
    // 러닝 워드 100 중 V10 단어가 2회 → V6 학습자에게 98%
    const p = buildLevelProfile([lv('hard', 2, 10)], 100)
    const v6 = p.readings.find((r) => r.level === 6)!
    expect(v6.coverageHigh).toBeCloseTo(0.98, 10)
    expect(p.breakdown.function_word).toBe(98)
  })

  it('레벨 미상은 감추지 않고 범위를 벌린다', () => {
    const p = buildLevelProfile([lv('a', 2, 5), un('mystery', 8)], 100)
    const v9 = p.readings.find((r) => r.level === 9)!

    expect(v9.coverageHigh).toBeCloseTo(1, 10) // 미상을 다 안다고 보면 100%
    expect(v9.coverageLow).toBeCloseTo(0.92, 10) // 다 모른다고 보면 92%
    expect(v9.coverage).toBeCloseTo(0.96, 10) // 중앙
    expect(v9.coverageLow).toBeLessThan(v9.coverageHigh)
  })

  it('범위는 항상 [0,1] 안에 있고 중앙값을 감싼다', () => {
    const p = buildLevelProfile([lv('a', 60, 11), un('b', 30)], 100)
    for (const r of p.readings) {
      expect(r.coverageLow).toBeGreaterThanOrEqual(0)
      expect(r.coverageHigh).toBeLessThanOrEqual(1)
      expect(r.coverageLow).toBeLessThanOrEqual(r.coverage)
      expect(r.coverage).toBeLessThanOrEqual(r.coverageHigh)
    }
  })

  it('적정 레벨은 중앙 추정으로 정한다 — 낙관값으로 학년을 낮게 부르지 않는다', () => {
    // 상한으로 보면 V3 도 95% 를 넘지만, 미상 8% 때문에 중앙은 96% → V3 통과.
    // 미상을 20% 로 키우면 중앙이 90% 로 떨어져 V3 는 탈락해야 한다.
    const optimistic = buildLevelProfile([un('x', 8)], 100)
    expect(optimistic.fitLevel).toBe(3)

    const uncertain = buildLevelProfile([un('x', 20)], 100)
    expect(uncertain.fitLevel).toBeNull()
  })

  it('교육과정을 넘는 지문은 fitLevel 이 null 이고 문구가 그걸 말한다', () => {
    const p = buildLevelProfile([lv('a', 30, 11)], 100)
    expect(p.fitLevel).toBeNull()
    expect(profileHeadline(p)).toContain('학술 원서')
  })

  it('적정 레벨이 있으면 그 학년 이름으로 답한다', () => {
    const p = buildLevelProfile([lv('a', 6, 7)], 100)
    expect(p.fitLevel).toBe(7)
    expect(profileHeadline(p)).toContain(LEVEL_LABEL[7])
  })

  it('빈 지문은 안내 문구를 낸다 — 0% 로 겁주지 않는다', () => {
    const p = buildLevelProfile([], 0)
    expect(profileHeadline(p)).toContain('아직 없어요')
    expect(p.readings.every((r) => r.coverage === 1)).toBe(true)
  })

  // textVLevel 은 `extract_vocabulary_for_user_v2` 의 percentile_disc(0.75) 와 **같은 값**이어야
  // 한다. 다르면 같은 지문을 두고 추출 화면과 공개 화면이 서로 다른 난도를 말한다.
  // 아래 기대값은 전부 실제 Postgres 실행 결과다 (2026-08-17 대조).
  it.each([
    { levels: [2, 2, 2, 9], expected: 2 },
    { levels: [2, 2, 9, 9], expected: 9 },
    { levels: [1, 2, 3, 4, 5, 6, 7, 8], expected: 6 },
    { levels: [5], expected: 5 },
  ])('textVLevel = Postgres percentile_disc(0.75) — $levels → $expected', ({ levels, expected }) => {
    const p = buildLevelProfile(
      levels.map((n, i) => lv(`w${i}`, 1, n)),
      100,
    )
    expect(p.textVLevel).toBe(expected)
  })

  it('textVLevel 은 평균이 아니다 — 쉬운 단어가 지배하면 변별이 사라진다', () => {
    // [2,2,9,9] 평균은 5.5 지만 P75 는 9 — 어려운 쪽 꼬리를 잡아야 지문끼리 구분된다.
    const p = buildLevelProfile([lv('a', 1, 2), lv('b', 1, 2), lv('c', 1, 9), lv('d', 1, 9)], 100)
    expect(p.textVLevel).toBe(9)
    expect(p.textVLevel).not.toBe(5)
  })

  it('레벨을 아는 단어가 없으면 textVLevel 은 null — 0 으로 위조하지 않는다', () => {
    expect(buildLevelProfile([un('x', 5)], 100).textVLevel).toBeNull()
  })

  it('breakdown 합 = 러닝 워드 수 — 화면에서 검산된다', () => {
    const p = buildLevelProfile(
      [lv('a', 10, 5), un('b', 5), { surface: 'Zzz', lemma: 'zzz', count: 3, status: 'unresolved', vLevel: null }],
      200,
    )
    const sum = Object.values(p.breakdown).reduce((x, y) => x + y, 0)
    expect(sum).toBe(200)
  })

  it('resolvedShare 는 내용어 중 레벨을 안 비율이다 — 낮으면 화면이 신뢰도를 낮춰야 한다', () => {
    const p = buildLevelProfile([lv('a', 9, 5), un('b', 1)], 100)
    expect(p.resolvedShare).toBeCloseTo(0.9, 10)
  })

  it('가장 어려운 단어를 V-Level 내림차순으로 준다 (동률은 빈도순)', () => {
    const p = buildLevelProfile([lv('easy', 9, 3), lv('mid', 1, 7), lv('hard', 1, 10)], 100)
    expect(p.hardestWords.map((w) => w.surface)).toEqual(['hard', 'mid', 'easy'])
  })

  it('레벨 미상 단어는 "가장 어려운 단어" 에 넣지 않는다 — 모르는 것을 어렵다고 말하지 않는다', () => {
    const p = buildLevelProfile([un('mystery', 50), lv('known', 1, 6)], 100)
    expect(p.hardestWords.map((w) => w.surface)).toEqual(['known'])
  })
})
