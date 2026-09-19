// apps/web/src/components/reports/__tests__/ReportsClient.test.tsx
//
// `/reports` 「주마다 한 겹」(2026-09-19 · DD-29) 의 계약.
//   ① 조회 실패는 빈 상태와 다르게 말한다 — 이전에는 실패가 "아직 리포트가 없어요" 로 보였다
//   ② 분(分)을 쓰지 않는다 — `/dashboard` 와 같은 기준(60초 미만 세션이 0 으로 반올림되는 칸)
//   ③ 이모지 · 3칸 숫자 상자를 쓰지 않는다

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { WeeklyReport } from '@/lib/learner/weekly-report'

import { ReportsClient } from '../ReportsClient'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
vi.mock('@/lib/learner/weekly-report', () => ({ generateWeeklyReport: vi.fn() }))

const WEEK: WeeklyReport = {
  week_start: '2026-09-14',
  total_minutes: 37,
  total_words: 41,
  total_reviews: 120,
  by_module: { flashcard: 90, dictation: 30 },
  empathetic_note: '이번 주 41개의 단어를 120번 만났어요. 이 리듬이 실력이 돼요.',
  generated_at: '2026-09-19T00:00:00Z',
}

describe('ReportsClient — 주마다 한 겹', () => {
  it('조회 실패는 빈 상태가 아니라 다시 시도로 말한다', () => {
    const html = renderToString(<ReportsClient reports={[]} failed />)
    expect(html).toContain('불러오지 못했어요')
    expect(html).toContain('다시 시도')
    expect(html).not.toContain('아직 쌓인 겹이 없어요')
  })

  it('비었을 때는 첫 겹이 놓일 자리와 다음 한 걸음', () => {
    const html = renderToString(<ReportsClient reports={[]} />)
    expect(html).toContain('아직 쌓인 겹이 없어요')
    expect(html).toContain('href="/hub"')
    expect(html).not.toContain('🗓')
  })

  it('한 주 = 한 겹 — 복습·단어는 말하고 분은 말하지 않는다', () => {
    const html = renderToString(<ReportsClient reports={[WEEK]} />)
    expect(html).toContain('9월 14일 주')
    expect(html).toContain('120')
    expect(html).toContain('Flashcard 90')
    expect(html).not.toContain('37분')
    expect(html).not.toContain('grid-cols-3')
    expect((html.match(/data-week-layer=""/g) ?? []).length).toBe(1)
  })

  it('아무것도 없던 주는 0 두 개가 아니라 「쉬어 간 주」', () => {
    const html = renderToString(
      <ReportsClient reports={[{ ...WEEK, total_reviews: 0, total_words: 0, by_module: {} }]} />,
    ).replace(/<!-- -->/g, '')
    expect(html).toContain('쉬어 간 주')
    expect(html).not.toContain('복습 0')
  })
})
