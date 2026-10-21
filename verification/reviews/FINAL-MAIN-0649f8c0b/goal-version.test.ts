// verification/reviews/FINAL-MAIN-0649f8c0b/goal-version.test.ts
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { goalPlanRows } from '@/lib/csat/map/v62/goal-plan'
import { nextActionOf } from '@/lib/csat/map/v62/next-action'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'
import { PlanSection } from '@/components/csat/diagnosis/map/PlanSection'
const task = 'r.central_meaning', ws = 'ws.central-meaning'
function fixture(currentGoal = 11) {
 const row = { task, name: 'core', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '\ubb38\ud56d', available: 3, planned: 3, done: 0, remaining: 3, rule: 'check' }, achievement: 'not_checked', unresolved: [], next: { href: '/csat/item/E-Q1?check=1', label: 'check' } }
 const pv = { workspace: ws, core: [task], tasks: [row], progress: { planned: 3, done: 0 } }
 const view = { taskPlans: [row], plans: { [ws]: pv }, asIs: { tasks: { [task]: { basis: 'none', status: 'unmeasured', check: null } }, sessions: [] }, toBe: { needs: [{ task, type: 'CONFIRM', relevance: { items: 3, pointsPerExam: 6 } }], relevanceUnknown: [] } }
 const ranks = { needRank: [{ rank: 1, task, need: 'CONFIRM', evidence: 'unmeasured' }], actionRank: [{ rank: 1, task, needRank: 1, href: row.next.href, label: 'check' }], notActionable: [] }
 const latest = { version: 2, canon: CANON_VERSION, goalVersionId: 10, reason: 'initial', createdAt: '2026-10-20T00:00:00Z', asOf: '2026-10-20T00:00:00Z', note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage: 'check', planned: 1, available: 3, rule: 'check' }] } }
 const saved = { status: 'installed', goalVersionId: currentGoal, goal: { id: currentGoal, score: 80, exam: currentGoal === 10 ? 'kice6' : 'kice9', grade: null, date: null, createdAt: latest.createdAt }, goalHistory: [], byTemplate: { [ws]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: ws, latest, history: [latest] } } }
 return { view: view as never, ranks: ranks as never, saved: saved as never, pv: pv as never }
}
describe('Latest main: changed goal with unchanged quantities and stages', () => {
 it('counterexample: top action requires re-confirming old-goal PLAN', () => {
  const x = fixture(); expect(nextActionOf(x.view, x.ranks, x.saved)).toMatchObject({ kind: 'plan', replan: true })
 })
 it('counterexample: summary cannot offer direct execution under old goal PLAN', () => {
  const x = fixture(); const row = goalPlanRows(x.view, x.ranks, x.saved).rows[0]
  expect({ gate: row.planGate, action: row.action }).toMatchObject({ gate: 'replan', action: null })
 })
 it('counterexample: editor must not label old goal PLAN current saved', () => {
  const x = fixture(); const html = renderToStaticMarkup(createElement(PlanSection, { view: x.pv, saved: x.saved, viewer: 'synthetic', goal: 80, past: false, reason: null }))
  expect(html).not.toContain('data-state="saved"')
 })
 it('normal control: matching goal permits same actual activity', () => {
  const x = fixture(10); expect(nextActionOf(x.view, x.ranks, x.saved)?.kind).toBe('start')
  expect(goalPlanRows(x.view, x.ranks, x.saved).rows[0].planGate).toBeNull()
 })
 it('normal control: matching goal editor retains saved state and quantity', () => {
  const x = fixture(10); const html = renderToStaticMarkup(createElement(PlanSection, { view: x.pv, saved: x.saved, viewer: 'synthetic', goal: 80, past: false, reason: null }))
  expect(html).toContain('data-state="saved"'); expect(html).toContain('data-planned="1"')
 })
})
