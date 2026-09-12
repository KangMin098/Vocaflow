// packages/library-pipeline/src/compose/activities.test.ts
// ACP §20 — 가공(활동 파생) 회귀.
//
// 지키는 것: 기계 변환은 **멱등이고 무료**여야 한다. 그래야 지문을 고칠 때마다
// 활동을 통째로 다시 만들 수 있고, 그게 이 파이프라인의 단가 구조다.

import { describe, expect, it } from 'vitest'

import {
  COMPOSE_ACTIVITIES,
  GAPFILL_DEFAULTS,
  buildGapFill,
  buildSpellingItems,
  mechanicalActivities,
  planActivities,
} from './activities'

const TEXT = [
  'Two school districts sent their students home on Tuesday.',
  'Their buildings had to be checked first.',
  'Earlier that morning, the ground moved under the coast.',
  'Scientists measured the quake at magnitude 5.2.',
  'Three people went to a hospital with small injuries.',
  'Engineers looked at the bridges and found no damage.',
].join(' ')

describe('활동 레지스트리', () => {
  it('키와 spec.key 가 일치한다', () => {
    for (const [k, v] of Object.entries(COMPOSE_ACTIVITIES)) expect(v.key).toBe(k)
  })

  it('LLM 이 필요한 활동은 둘뿐 — 나머지는 재생성 무료', () => {
    const llm = Object.values(COMPOSE_ACTIVITIES).filter((a) => a.cost === 'llm')
    expect(llm.map((a) => a.key).sort()).toEqual(['comprehension', 'discussion'])
    expect(mechanicalActivities().length).toBeGreaterThan(llm.length)
  })

  it('문장 순서·삽입은 DCP 소관으로 표시된다 (중복 구현 금지)', () => {
    expect(COMPOSE_ACTIVITIES['order']!.module).toBe('DCP')
    expect(COMPOSE_ACTIVITIES['insert']!.module).toBe('DCP')
    expect(COMPOSE_ACTIVITIES['order']!.note).toContain('다시 만들지 않는다')
  })
})

describe('planActivities', () => {
  it('오디오가 없으면 듣기 계열이 잠긴다', () => {
    const plan = planActivities({ text: true, vocab: true, audio: false })
    const byKey = Object.fromEntries(plan.map((p) => [p.spec.key, p]))
    expect(byKey['dictation']!.available).toBe(false)
    expect(byKey['dictation']!.missing).toEqual(['audio'])
    expect(byKey['shadowing']!.available).toBe(false)
    expect(byKey['gapfill']!.available).toBe(true)
  })

  it('TTS 를 붙이면 듣기 계열까지 전부 열린다 — 재저작만 가능한 자리', () => {
    const plan = planActivities({ text: true, vocab: true, audio: true })
    expect(plan.every((p) => p.available)).toBe(true)
  })

  it('어휘 추출 전이면 단어장·빈칸·철자가 잠긴다', () => {
    const plan = planActivities({ text: true, vocab: false, audio: false })
    const locked = plan.filter((p) => !p.available).map((p) => p.spec.key).sort()
    expect(locked).toEqual(['dictation', 'gapfill', 'shadowing', 'spelling', 'word_set'])
  })
})

describe('buildGapFill', () => {
  it('목표 어휘를 빈칸으로 바꾸고 정답 키를 돌려준다', () => {
    const r = buildGapFill(TEXT, ['measured', 'injuries', 'damage'])
    expect(r.blanks.map((b) => b.answer)).toEqual(['measured', 'injuries', 'damage'])
    expect(r.rendered).toContain('____(1)')
    expect(r.rendered).toContain('____(3)')
    expect(r.rendered).not.toContain('measured')
    expect(r.unmatched).toEqual([])
  })

  it('첫 문장은 비우지 않는다 — 맥락을 세우는 자리다', () => {
    const r = buildGapFill(TEXT, ['districts'])
    expect(r.blanks).toEqual([])
    expect(r.unmatched).toEqual(['districts'])
    expect(r.rendered).toContain('Two school districts')
  })

  it('한 문장에 빈칸은 하나 — 두 개면 추론이 아니라 추측이 된다', () => {
    // 같은 문장에 있는 두 단어를 목표로 준다.
    const r = buildGapFill(TEXT, ['bridges', 'damage'])
    expect(r.blanks).toHaveLength(1)
    expect(r.unmatched).toHaveLength(1)
  })

  it('같은 단어를 여러 번 비우지 않는다', () => {
    const repeated = 'Alpha starts here. The storm grew. The storm grew again.'
    const r = buildGapFill(repeated, ['storm', 'storm'])
    expect(r.blanks).toHaveLength(1)
    expect(r.rendered).toContain('The storm grew again.')
  })

  it('상한을 넘는 목표는 unmatched 로 돌려준다 (조용히 버리지 않는다)', () => {
    const r = buildGapFill(TEXT, ['buildings', 'ground', 'measured', 'hospital', 'bridges'], {
      maxBlanks: 2,
    })
    expect(r.blanks).toHaveLength(2)
    expect(r.unmatched).toHaveLength(3)
  })

  it('본문에 없는 목표는 unmatched', () => {
    const r = buildGapFill(TEXT, ['volcano'])
    expect(r.unmatched).toEqual(['volcano'])
  })

  it('부분 문자열에 걸리지 않는다 (단어 경계)', () => {
    const r = buildGapFill('Alpha starts. He was engineering the plan.', ['engineer'])
    expect(r.unmatched).toEqual(['engineer'])
  })

  it('대소문자가 달라도 찾고, 정답은 본문 표면형 그대로 남긴다', () => {
    const r = buildGapFill('Alpha starts. Scientists measured it.', ['scientists'])
    expect(r.blanks[0]!.answer).toBe('Scientists')
  })

  it('멱등 — 같은 입력이면 같은 결과', () => {
    const a = buildGapFill(TEXT, ['measured', 'injuries'])
    const b = buildGapFill(TEXT, ['measured', 'injuries'])
    expect(a).toEqual(b)
  })

  it('기본 상한이 지나치게 크지 않다 (읽기가 퍼즐이 되지 않도록)', () => {
    expect(GAPFILL_DEFAULTS.maxBlanks).toBeLessThanOrEqual(12)
    expect(GAPFILL_DEFAULTS.maxPerSentence).toBe(1)
  })
})

describe('buildSpellingItems', () => {
  it('가운데 모음만 지우고 첫·끝 글자는 남긴다', () => {
    expect(buildSpellingItems(['damage'])).toEqual([
      { answer: 'damage', prompt: 'd_m_ge', removed: 2 },
    ])
  })

  it('3글자 이하는 제외 — 남는 단서가 없다', () => {
    expect(buildSpellingItems(['sun', 'it', 'a'])).toEqual([])
  })

  it('가운데에 모음이 없으면 문항이 성립하지 않아 제외', () => {
    expect(buildSpellingItems(['tsktsk'])).toEqual([])
  })

  it('멱등', () => {
    expect(buildSpellingItems(['injuries'])).toEqual(buildSpellingItems(['injuries']))
  })
})
