// apps/web/src/lib/textfit/__tests__/reading-trial-goal.test.tsx
// @vitest-environment node
// /fit 체험의 잠정 첫 목표 — 메모리 토글만 · 저장/기록 0 · 토글이 DcpPlayer 의 key · items · grade 를 바꾸지 않음 · 기본 꺼짐 유지
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  seeded: [] as unknown[],
  dcp: [] as Array<Record<string, unknown>>,
  actions: { gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() },
}))
vi.mock('@/lib/learner/dcp-actions', () => h.actions)
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    // ReadingTrial 의 open · goal 상태를 심어 열린 패널을 서버 렌더로 그린다
    useState: (init: unknown) => (h.seeded.length > 0 ? [h.seeded.shift(), () => {}] : actual.useState(init)),
  }
})
vi.mock('@/components/practice/DcpPlayer', () => ({
  DcpPlayer: (p: Record<string, unknown>) => {
    h.dcp.push(p)
    return null
  },
}))

import { ReadingTrial, TRIAL_GOAL_LABEL, TRIAL_GOAL_NOTES, TRIAL_GOAL_REASON } from '@/components/textfit/ReadingTrial'
import { READING_TRIAL_ENABLED, gradeTrial, inertCause } from '../reading-trial'

const render = (open: boolean, goal: boolean) => {
  h.seeded = [open, goal]
  return renderToString(<ReadingTrial />)
}

beforeEach(() => {
  h.dcp = []
  h.actions.gradeDcpItem.mockClear()
  h.actions.recordDcpErrorCause.mockClear()
})

describe('잠정 첫 목표 토글', () => {
  it('미선택: 기존 자유 진입(예시로 해 보기) · aria-pressed=false · 이유 없음 · 짧은 한계 두 줄', () => {
    const html = render(false, false)
    expect(html).toContain(TRIAL_GOAL_LABEL)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('예시로 해 보기')
    expect(html).not.toContain(TRIAL_GOAL_REASON)
    for (const n of TRIAL_GOAL_NOTES) expect(html).toContain(n)
    expect(html).toContain('min-h-[44px]')
    expect(html).not.toMatch(/부족|낮은|실패/)
  })
  it('선택: aria-pressed=true · 목표→첫 연습 이유 · 열기 문구만 바뀜', () => {
    const html = render(false, true)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain(TRIAL_GOAL_REASON)
    expect(html).toContain('이 목표로 첫 연습 열기')
  })
  it('열린 상태에서 토글해도 DcpPlayer 의 key · items · grade · 기록 · 원인 칩 계약이 같다', () => {
    render(true, false)
    render(true, true)
    expect(h.dcp).toHaveLength(2)
    const [a, b] = h.dcp
    expect(a.items).toBe(b.items)
    expect(a.grade).toBe(gradeTrial)
    expect(b.grade).toBe(gradeTrial)
    expect(a.recordCause).toBe(inertCause)
    expect(b.recordCause).toBe(inertCause)
    expect(a.causeChips).toBe(false)
    expect(b.causeChips).toBe(false)
    expect((a as { key?: unknown }).key).toBeUndefined()
  })
  it('토글 · 렌더는 서버 채점 · 원인 기록을 부르지 않는다', () => {
    render(true, true)
    render(false, true)
    expect(h.actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(h.actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
  it('저장소를 쓰지 않는다(localStorage · sessionStorage · cookie · learning_goal 없음)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../components/textfit/ReadingTrial.tsx'), 'utf8')
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie|learning_goal|supabase/)
  })
  it('기본 꺼짐 유지', () => {
    expect(READING_TRIAL_ENABLED).toBe(false)
  })
})
