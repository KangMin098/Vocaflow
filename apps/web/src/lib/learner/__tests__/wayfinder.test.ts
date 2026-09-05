// apps/web/src/lib/learner/__tests__/wayfinder.test.ts
//
// **셸 상단이 여섯 질문에 답하는가** — 목표 자체를 재는 회귀.
//
// ── 왜 이 형태인가 ──────────────────────────────────────────────────────────
// "위 공간이 좋아졌다" 는 잴 수 없다. 그래서 학습자가 셸에서 얻어야 하는 것을 **여섯 질문**
// 으로 못 박고, **학습자 국면 4종** 각각에서 여섯이 모두 답해지는지를 센다(분모 24).
//
//   Q1 위치 · Q2 단계 · Q3 방향 · Q4 가치 · Q5 동기 · Q6 성장
//   × undiagnosed · ready · moving · complete
//
// 실측 기준선(2026-09-05, 이전 `StatusRibbon`): **0.5/6** — 화면 맥락과 무관한 숫자 칩 하나.
//
// ⚠️ "필드가 존재한다" 로 세지 않는다. 빈 문자열·0·null 은 답이 아니다 —
//    그렇게 세면 타입만 맞고 화면은 그대로인 통과가 나온다.

import { describe, expect, it } from 'vitest'

import { computeReach, cumulative } from '../reach-math'
import { forecastMemory } from '../memory-forecast'
import {
  buildWayfinder,
  forecastSentence,
  pastSentence,
  reachSentence,
  surfaceForPath,
  type WayfinderBlock,
  type WayfinderModel,
  type WayfinderPhase,
} from '../wayfinder'

const DAY = 86_400_000
const NOW = new Date('2026-09-05T03:00:00.000Z')

/** 발행 도서 분포 실측 (2026-09-05 `library_books` status='published'). */
const BOOKS_BY_LEVEL = [0, 0, 10, 9, 1, 2, 15, 88, 149, 38, 0, 0]
const BOOKS_TOTAL = 312

function blocks(doneCount: number): WayfinderBlock[] {
  const names = ['복습', '듣기', '읽기', '구문', '확인']
  return names.map((name, i) => ({
    key: (['review', 'listen', 'read', 'syntax', 'check'] as const)[i],
    name,
    headline: `${name} — 오늘 할 것`,
    href: `/${name}`,
    done: i < doneCount,
    locked: false,
  }))
}

/** 복습 이력이 있는 카드 — 예보 곡선이 실제로 내려가도록 만든다. */
function reviewedCards(n: number, stabilityDays: number, agoDays: number) {
  return Array.from({ length: n }, () => ({
    stability: stabilityDays,
    last_review_at: new Date(NOW.getTime() - agoDays * DAY).toISOString(),
  }))
}

function model(phase: WayfinderPhase): WayfinderModel {
  const diagnosed = phase !== 'undiagnosed'
  const vLevel = diagnosed ? 7 : null
  return buildWayfinder({
    blocks: diagnosed ? blocks(phase === 'ready' ? 0 : phase === 'moving' ? 2 : 5) : [],
    isDiagnosed: diagnosed,
    pathname: '/library/books',
    reach: computeReach(BOOKS_BY_LEVEL, BOOKS_TOTAL, vLevel),
    // 안정 3일 · 2일 전 복습 → 오늘은 버티지만 일주일 안에 R 이 0.70 아래로 내려간다.
    forecast: forecastMemory(
      diagnosed ? reviewedCards(12, 3, 2) : reviewedCards(4, 3, 2),
      NOW,
      7,
    ),
    past: { activeDays: diagnosed ? 4 : 0, prevActiveDays: diagnosed ? 2 : 0, streak: diagnosed ? 3 : 0 },
    counts: { attention: diagnosed ? 11 : 0, fresh: 8 },
  })
}

const PHASES: WayfinderPhase[] = ['undiagnosed', 'ready', 'moving', 'complete']

/** 답이 **실제로 있는가** — 존재가 아니라 내용을 본다. */
const ANSWERS: Record<string, (m: WayfinderModel) => boolean> = {
  'Q1 위치': (m) => m.surface !== null && m.surface.name.length > 0,
  // 진단 전에는 계단이 없는 것이 맞다 — 그 대신 "먼저 무엇" 이 위치를 대신한다.
  'Q2 단계': (m) => (m.phase === 'undiagnosed' ? m.now.kicker === '먼저' : m.steps.length > 0),
  'Q3 방향': (m) => m.now.headline.length > 0 && m.now.cta.length > 0 && m.now.href.startsWith('/'),
  'Q4 가치': (m) => (reachSentence(m.reach) ?? '').length > 0,
  'Q5 동기': (m) => (forecastSentence(m.forecast) ?? '').length > 0,
  'Q6 성장': (m) => m.phase === 'undiagnosed' || (pastSentence(m.past) ?? '').length > 0,
}

describe('셸 상단 — 여섯 질문 × 네 국면', () => {
  it('스물넷 칸이 전부 답해진다 (기준선 0.5/6 → 6/6)', () => {
    const misses: string[] = []
    for (const phase of PHASES) {
      const m = model(phase)
      expect(m.phase, `${phase} 국면이 그대로 나와야 한다`).toBe(phase)
      for (const [q, answered] of Object.entries(ANSWERS)) {
        if (!answered(m)) misses.push(`${phase} × ${q}`)
      }
    }
    expect(misses, `답하지 못한 칸: ${misses.join(', ')}`).toEqual([])
  })

  it('CTA 는 국면마다 하나이고, 서로 다른 곳으로 보낸다', () => {
    const hrefs = PHASES.map((p) => model(p).now.href)
    expect(hrefs.every((h) => h.startsWith('/'))).toBe(true)
    // 진단 전은 진단으로, 다 마친 날은 회고로 — 같은 문을 네 번 그리면 국면 구분이 무의미하다.
    expect(model('undiagnosed').now.href).toBe('/diagnostic')
    expect(model('complete').now.href).toBe('/dashboard')
  })

  it('진행이 있으면 kicker 가 "지금" 에서 "다음" 으로 바뀐다', () => {
    expect(model('ready').now.kicker).toBe('지금')
    expect(model('moving').now.kicker).toBe('다음')
  })

  it('지금 눌러야 할 단계는 정확히 하나다', () => {
    for (const phase of ['ready', 'moving'] as const) {
      const current = model(phase).steps.filter((s) => s.current)
      expect(current, `${phase} 의 현재 단계`).toHaveLength(1)
    }
    // 다 마친 날에는 "지금" 이 없다 — 없는 것을 하나 만들어 그리지 않는다.
    expect(model('complete').steps.filter((s) => s.current)).toHaveLength(0)
  })

  it('완료 문장에 폭죽·트로피·느낌표가 없다 (철학 ③ · 모션 금지 목록)', () => {
    const h = model('complete').now.headline
    expect(h).not.toMatch(/[!🎉🏆🎊]/u)
  })

  it('진단 전에는 없는 계단을 그리지 않는다', () => {
    const m = model('undiagnosed')
    expect(m.steps).toEqual([])
    expect(m.total).toBe(0)
  })
})

describe('surfaceForPath — 지금 어디 (SURFACES.owns 가 정본)', () => {
  it.each([
    ['/hub', 'Today'],
    ['/flashcard', 'Today'],
    ['/library/books', 'Library'],
    ['/text/abc', 'Library'],
    ['/wordvault/browse', 'Vault'],
    ['/dashboard', 'Growth'],
    ['/reports', 'Growth'],
  ])('%s → %s', (path, name) => {
    expect(surfaceForPath(path)?.name).toBe(name)
  })

  it('어느 표면에도 없는 주소는 위치를 지어내지 않는다', () => {
    expect(surfaceForPath('/settings')).toBeNull()
  })
})

describe('사정권 — 레벨을 카탈로그로 번역한다', () => {
  it('누적은 i+1 까지 센다 (Krashen · /library 추천과 같은 기준)', () => {
    // V7 → 8레벨 이하 = 10+9+1+2+15+88+149 = 274
    expect(cumulative(BOOKS_BY_LEVEL, 8)).toBe(274)
    const r = computeReach(BOOKS_BY_LEVEL, BOOKS_TOTAL, 7)
    expect(r.open).toBe(274)
    expect(r.unlockNext).toBe(38) // V9 38권
  })

  it('진단 전이면 열린 책을 0으로 두되 카탈로그 전체를 약속으로 쓴다', () => {
    const r = computeReach(BOOKS_BY_LEVEL, BOOKS_TOTAL, null)
    expect(r.open).toBe(0)
    expect(reachSentence(r)).toContain('312')
  })

  it('레벨이 없는 책은 사정권에 세지 않는다 (어느 계단인지 모르는 것을 열렸다고 하지 않는다)', () => {
    const withUnleveled = computeReach(BOOKS_BY_LEVEL, BOOKS_TOTAL + 40, 7)
    expect(withUnleveled.open).toBe(274)
    expect(withUnleveled.total).toBe(352)
  })
})

describe('망각 예보 — R(t) 를 시간축으로', () => {
  it('오늘은 버티지만 이번 주에 흐려질 것을 센다', () => {
    // S=3일 · 2일 전 복습 → 오늘 R=0.9^(2/3)≈0.932 (shaky) · 7일 뒤 R=0.9^(9/3)=0.729 …
    // 임계 0.70 을 넘기려면 t/S > 3.39 → 10.2일. 그래서 7일 지평에서는 아직 안 넘는다.
    const near = forecastMemory(reviewedCards(5, 3, 2), NOW, 7)
    expect(near.fadedNow).toBe(0)
    expect(near.fadingSoon).toBe(0)

    // S=2일 · 4일 전 복습 → 오늘 R=0.9^2=0.81 (shaky) · 7일 뒤 R=0.9^5.5≈0.56 (risk)
    const fading = forecastMemory(reviewedCards(5, 2, 4), NOW, 7)
    expect(fading.fadedNow).toBe(0)
    expect(fading.fadingSoon).toBe(5)
  })

  it('이미 흐려진 것은 예보에 다시 세지 않는다 (같은 단어를 두 번 세지 않는다)', () => {
    const f = forecastMemory(reviewedCards(3, 1, 20), NOW, 7)
    expect(f.fadedNow).toBe(3)
    expect(f.fadingSoon).toBe(0)
  })

  it('한 번도 복습하지 않은 단어는 곡선의 분모가 아니다', () => {
    const f = forecastMemory(
      [
        { stability: null, last_review_at: null },
        { stability: 0, last_review_at: null },
      ],
      NOW,
      7,
    )
    expect(f.tracked).toBe(0)
    expect(forecastSentence(f)).toBeNull()
  })

  it('곡선은 오늘 + 지평일 수만큼 나오고, 버티는 수는 늘지 않는다', () => {
    const f = forecastMemory(reviewedCards(20, 2, 1), NOW, 7)
    expect(f.days).toHaveLength(8)
    const holding = f.days.map((d) => d.stable + d.shaky)
    for (let i = 1; i < holding.length; i++) {
      expect(holding[i], `${i}일차`).toBeLessThanOrEqual(holding[i - 1])
    }
  })
})

describe('말투 — 평가하지 않는다 (철학 ③ Empathetic Feedback)', () => {
  it('예보 문장은 얻는 쪽으로 말한다', () => {
    const s = forecastSentence(forecastMemory(reviewedCards(5, 2, 4), NOW, 7))
    expect(s).toContain('붙잡아요')
    expect(s).not.toMatch(/잃|위험|경고|실패/)
  })

  it('줄어든 주에는 비교를 말하지 않는다', () => {
    expect(pastSentence({ activeDays: 2, prevActiveDays: 5, streak: 0 })).toBe('이번 주에 2일 만났어요')
    expect(pastSentence({ activeDays: 5, prevActiveDays: 2, streak: 0 })).toBe('지난주보다 3일 더 만났어요')
  })

  it('아무 기록도 없으면 문장을 지어내지 않는다', () => {
    expect(pastSentence({ activeDays: 0, prevActiveDays: 0, streak: 0 })).toBeNull()
  })
})
