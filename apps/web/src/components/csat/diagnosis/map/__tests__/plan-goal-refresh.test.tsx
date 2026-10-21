// apps/web/src/components/csat/diagnosis/map/__tests__/plan-goal-refresh.test.tsx
// T-0072 — 계획 편집기: 목표가 바뀐 저장 PLAN 은 「저장됨」이 아니다 · 어느 목표의 저장인지 · 기본 사유 goal_change · 같은 목표 정상 · 과거 보기 전용
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

import { PlanSection } from '../PlanSection'

const task = 'r.central_meaning', ws = 'ws.central-meaning'
function props(currentGoal = 11, past = false) {
  const row = { task, name: 'core', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '문항', available: 3, planned: 3, done: 0, remaining: 3, rule: 'check' }, achievement: 'not_checked', unresolved: [], next: { href: '/csat/item/E-Q1?check=1', label: 'check' } }
  const latest = { version: 2, canon: CANON_VERSION, goalVersionId: 10, reason: 'initial', createdAt: '2026-10-20T00:00:00Z', asOf: '2026-10-20T00:00:00Z', note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage: 'check', planned: 1, available: 3, rule: 'check' }] } }
  const goalHistory = [{ id: 10, score: 80, exam: 'kice6', grade: null, date: null, createdAt: latest.createdAt }, { id: 11, score: 90, exam: 'kice9', grade: null, date: null, createdAt: latest.createdAt }]
  const saved = { status: 'installed', goalVersionId: currentGoal, goal: goalHistory.find((g) => g.id === currentGoal), goalHistory, byTemplate: { [ws]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: ws, latest, history: [latest] } } }
  return { view: { workspace: ws, core: [task], tasks: [row], progress: { planned: 3, done: 0 } }, saved, viewer: 'synthetic', goal: 80, past, reason: null } as never
}
const render = (p: never) => renderToStaticMarkup(<PlanSection {...(p as Parameters<typeof PlanSection>[0])} />)

describe('PlanSection — 목표 버전', () => {
  it('목표가 바뀌면 「저장됨」이 아니다 · 그때 목표 기준임을 밝히고 다시 확정을 요청 · 기본 사유 goal_change', () => {
    const h = render(props(11))
    expect(h).not.toContain('data-state="saved"')
    expect(h).toContain('data-testid="plan-goal-changed"')
    expect(h).toContain('data-saved-goal="10"')
    expect(h).toContain('data-current-goal="11"')
    expect(h).toContain('그때 목표 80점')
    expect(h).toMatch(/<option value="goal_change" selected=""/)
  })
  it('정상 — 같은 목표면 저장됨 · 저장 계획량 그대로 · 목표 안내 없음', () => {
    const h = render(props(10))
    expect(h).toContain('data-state="saved"')
    expect(h).toContain('data-planned="1"')
    expect(h).not.toContain('plan-goal-changed')
  })
  it('과거 모드는 목표 변경 안내 · 다시 확정 없이 보기 전용', () => {
    const h = render(props(11, true))
    expect(h).not.toContain('plan-goal-changed')
  })
})
