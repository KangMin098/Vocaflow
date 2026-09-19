// apps/web/src/components/dashboard/__tests__/strata.test.tsx
//
// `/dashboard` 「기억의 지층」(2026-09-19 · DD-29) 의 계약.
//   ① 층 안에 **실제 낱말**이 선다 — 이전 사다리는 개수만 있었다
//   ② 이번 주에 다시 만나 맞힌 낱말에만 권점
//   ③ 빈 층은 숫자 0 을 쓰지 않는다(브리프 "0/0/0 금지") — 이름과 설명 한 줄
//   ④ `buildStrata` — 버티는 기간 긴 순 · 층당 상한 · 한 번도 복습 안 한 낱말(S=0) 제외

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { buildStrata, type Ladder } from '@/lib/learner/growth-math'

import { DurabilityLadder } from '../DurabilityLadder'

vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

const ROWS = [
  { id: 'a', word: 'sealing', meaning: '봉인', stability: 0.5 },
  { id: 'b', word: 'resilient', meaning: '회복력 있는', stability: 0.9 },
  { id: 'c', word: 'spectral', meaning: '유령의', stability: 2.1 },
  { id: 'd', word: 'unseen', meaning: '보이지 않는', stability: 0 },
  { id: 'e', word: null, meaning: null, stability: 1.5 },
]

describe('buildStrata', () => {
  it('층마다 이번 주 낱말 먼저, 그다음 버티는 기간 긴 순 · S=0·빈 낱말은 뺀다', () => {
    const s = buildStrata(ROWS, new Set(['a']))
    expect(s.day.map((w) => w.word)).toEqual(['sealing', 'resilient'])
    expect(buildStrata(ROWS, new Set()).day.map((w) => w.word)).toEqual(['resilient', 'sealing'])
    expect(s.few.map((w) => w.word)).toEqual(['spectral'])
    expect(s.week).toEqual([])
    expect(s.day.find((w) => w.word === 'sealing')?.thisWeek).toBe(true)
    expect(s.day.find((w) => w.word === 'resilient')?.thisWeek).toBe(false)
  })

  it('층당 상한을 넘기지 않는다', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, word: `w${i}`, meaning: null, stability: 0.1 + i / 100 }))
    expect(buildStrata(many, new Set(), 4).day).toHaveLength(4)
    // 권점 낱말은 S 가 가장 작아도 상한에 잘리지 않는다(첫 캡처에서 권점이 전부 사라졌다)
    expect(buildStrata(many, new Set(['w0']), 4).day.map((w) => w.word)).toContain('w0')
  })
})

function ladder(): Ladder {
  return {
    counts: { day: 2, few: 1, week: 0, month: 0, season: 0 },
    unseen: 3,
    onLadder: 3,
    medianDays: 0.9,
    topDays: 2.1,
    champion: null,
    strata: buildStrata(ROWS, new Set(['a'])),
  }
}

describe('DurabilityLadder — 기억의 지층', () => {
  it('층 안에 실제 낱말이 서고, 이번 주 낱말에만 권점 클래스', () => {
    const html = renderToString(<DurabilityLadder ladder={ladder()} />)
    expect(html).toContain('resilient')
    expect(html).toContain('spectral')
    // 권점 안내 문장은 실제로 찍힌 수로 말한다
    expect(html.replace(/<!-- -->/g, '')).toContain('맞힌 1개예요')
    expect((html.match(/data-stratum="/g) ?? []).length).toBe(5)
  })

  it('빈 층은 0 을 쓰지 않고 이름과 설명만', () => {
    const html = renderToString(<DurabilityLadder ladder={ladder()} />)
    expect(html).toContain('한 달을 건너요')
    expect(html).not.toMatch(/>0개</)
    expect(html).not.toMatch(/>0</)
  })

  it('층은 펼칠 수 있는 버튼(aria-expanded)이다 — 처음엔 모두 접힘', () => {
    const html = renderToString(<DurabilityLadder ladder={ladder()} />)
    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('aria-expanded="true"')
  })

  it('지층이 비면 문장과 다음 한 걸음(D4)', () => {
    const html = renderToString(
      <DurabilityLadder
        ladder={{ ...ladder(), counts: { day: 0, few: 0, week: 0, month: 0, season: 0 }, onLadder: 0, unseen: 5 }}
      />,
    )
    expect(html).toContain('한 번 복습하기')
    expect(html).toContain('href="/flashcard"')
  })
})
