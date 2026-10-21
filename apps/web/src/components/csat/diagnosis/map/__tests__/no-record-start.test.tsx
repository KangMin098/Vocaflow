// apps/web/src/components/csat/diagnosis/map/__tests__/no-record-start.test.tsx
// T-0073 — 목표 있음 · 시험 기록 0 · 직접 근거 0: 상태는 미측정(no_record) 그대로, 상단은 실제 다음 행동(계획 확정 등) + 기출 기록은 보조.
//   Codex FINAL-MAIN-65c8ef6ae no-record-start 반례 1 · 목표 없음 / 과거 대조 2 이식 + 목표 변경 재확정 보호 유지
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

import { CANON_VERSION } from '@/lib/csat/map/v4/definition'
import { nextActionOf } from '@/lib/csat/map/v62/next-action'
import { ranksOf } from '@/lib/csat/map/v62/rank'

import { GoalRecordBar } from '../GoalRecordBar'

const task = 'r.central_meaning', ws = 'ws.central-meaning'
function cold(o: { goalSet?: boolean; past?: boolean; savedGoal?: number | null } = {}) {
  const row = { task, name: 'core', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '문항', available: 0, planned: null, done: 0, remaining: null }, achievement: 'not_checked', unresolved: ['material_needed'], next: null }
  const view = { taskPlans: [row], plans: { [ws]: { workspace: ws, core: [task], tasks: [row], progress: null } }, asIs: { asOf: '2026-10-21T00:00:00Z', tasks: { [task]: { basis: 'none', status: 'unmeasured', check: null } }, sessions: [] }, toBe: { needs: [{ task, type: 'CONFIRM', relevance: { items: 3, pointsPerExam: 6 }, evidence: 'unmeasured' }], relevanceUnknown: [] } }
  const latest = { version: 1, canon: CANON_VERSION, goalVersionId: o.savedGoal ?? 10, reason: 'initial', createdAt: '2026-10-20T00:00:00Z', asOf: '2026-10-20T00:00:00Z', note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage: 'check', planned: null, available: 0 }] } }
  const saved = { status: 'installed', goalVersionId: 10, byTemplate: o.savedGoal === undefined ? {} : { [ws]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: ws, latest, history: [latest] } } }
  const ranks = ranksOf(view as never)
  const html = renderToStaticMarkup(<GoalRecordBar data={{ records: [], v4: { saved } } as never} g={{ goal: 80 } as never} goalSet={o.goalSet ?? true} asIs={view.asIs as never} view={view as never} ranks={ranks} recordHref="/csat/diagnosis?tab=record" past={o.past ?? false} onSelect={() => undefined} onOpenWs={() => undefined} />)
  return { html, next: nextActionOf(view as never, ranks, saved as never) }
}

describe('시험 기록 없는 학습자의 첫 행동', () => {
  it('목표 + 기록 0 = 미측정 상태 유지 · 상단에 실제 다음 행동(저장 전 → 계획 확정) · 기출 기록은 보조', () => {
    const { html, next } = cold()
    expect(next?.kind).toBe('plan')
    expect(html).toContain('data-state="no_record"')
    expect(html).toContain('data-testid="umap-no-record-note"')
    expect(html).toContain('약점으로 정한 것은 없어요')
    expect(html).toContain('data-testid="umap-top-next"')
    expect(html).toContain('data-kind="plan"')
    expect(html).toContain('또는 기출 한 회 기록하기')
  })
  it('저장 후 같은 목표 · 자료 0 = 자료 받기(정직한 부족) · 숙달/부족 확정 문구 없음', () => {
    const { html, next } = cold({ savedGoal: 10 })
    expect(next?.kind).toBe('supply')
    expect(html).toContain('data-kind="supply"')
    expect(html).not.toMatch(/보완 필요|숙달|약점으로 정했/)
  })
  it('목표 변경 재확정 보호(T-0072) 유지 — 다른 목표에 저장된 계획이면 자료 받기 대신 다시 확정', () => {
    expect(cold({ savedGoal: 9 }).next).toMatchObject({ kind: 'plan', replan: true, replanWhy: 'goal' })
  })
  it('대조 — 목표 없음은 실행 행동을 만들지 않는다', () => {
    expect(cold({ goalSet: false }).html).not.toContain('data-testid="umap-top-next"')
  })
  it('대조 — 과거 보기는 실행 행동 없이 보기 전용', () => {
    const { html } = cold({ past: true })
    expect(html).toContain('data-past="true"')
    expect(html).not.toContain('data-testid="umap-top-next"')
  })
})
