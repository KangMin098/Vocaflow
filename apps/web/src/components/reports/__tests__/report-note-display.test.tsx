// apps/web/src/components/reports/__tests__/report-note-display.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock('@/lib/learner/weekly-report', () => ({ generateWeeklyReport: async () => ({ ok: true }) }))

import { ReportsClient } from '../ReportsClient'

const OLD = {
  week_start: '2026-10-19',
  total_minutes: 120,
  total_words: 40,
  total_reviews: 150,
  by_module: {},
  // 예전에 저장된 과장 문구 — 화면에 그대로 나오면 안 된다
  empathetic_note: '이번 주 120분, 150번의 복습을 쌓았어요. 꾸준함이 기억을 단단하게 만들고 있어요.',
  generated_at: '2026-10-25T00:00:00Z',
}

describe('주간 리포트 코멘트 표시', () => {
  it('저장된 옛 과장 문구 대신 저장 합계로 활동만 말한다(DB 무변경)', () => {
    const html = renderToString(<ReportsClient reports={[OLD as never]} />)
    expect(html).not.toContain('기억을 단단하게')
    expect(html).toContain('활동을 센 기록이라 기억·실력이 달라졌는지는 알 수 없어요')
    expect(html).toContain('120분')
    expect(html).toContain('복습 150번')
  })
})
