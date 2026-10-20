// verification/reviews/NEXT-PRODUCT-CORE-20261021/probe.test.ts
// Desired product contracts: baseline failures are preserved, not passed evidence.
import { describe, expect, it } from 'vitest'
import { asIsMap } from '@/lib/csat/map/v4/as-is'
import { taskPlan } from '@/lib/csat/map/v4/plan'
import { planWorkspaces } from '@/lib/csat/map/v4/workspace'
import { AUTHORED_TASK_KEYS } from '@/lib/knowledge/authored/tasks'
import { mapStateOf } from '@/components/csat/diagnosis/map/GoalRecordBar'

const NOW = '2026-10-21T00:00:00.000Z'
const targets = ['r.inference', 'r.relation', 's.form_scope', 'v.contextual_sense']
function fixture(task: string) {
  const key = AUTHORED_TASK_KEYS[task]
  const ids = ['authored:probe-ind-1', 'authored:probe-ind-2']
  const asIs = asIsMap({ asOf: NOW, sessions: [], axisProxy: null, checks: [{ taskKey: key, items: ids }], attempts: [] })
  const links = { [key]: ids.map(target => ({ target, href: `/csat/learn/${target}`, label: target })) }
  const homes = planWorkspaces({ asIs, toBe: null, confirmLinks: links, transferItems: {} })
  const views = [homes.primary, ...homes.others].filter((w): w is NonNullable<typeof w> => !!w)
  const toBe = { needs: [{ task, type: 'CONFIRM', relevance: { items: 1, pointsPerExam: 2 }, priority: 1, executable: null, workspaces: [] }] } as never
  const p = taskPlan(task, asIs, toBe, views, [])
  return { asIs, p, views }
}
describe('NEXT PRODUCT CORE: canon readiness is separate from usable current-stage deliveries', () => {
  for (const task of targets) it(`${task}: actual linked check content is not missing content`, () => {
    const { p, views } = fixture(task)
    const home = views.find(w => w.core.includes(task))!
    expect(home.readiness).not.toBe('live') // canon remains unchanged
    expect(p.next).not.toBeNull()
    expect(p.quantity.available).toBe(2)
    expect(p.unresolved).not.toContain('no_content')
  })
  it('no content: preserve null quantity and no executable link', () => {
    const asIs = asIsMap({ asOf: NOW, sessions: [], axisProxy: null, checks: [], attempts: [] })
    const homes = planWorkspaces({ asIs, toBe: null, confirmLinks: {}, transferItems: {} })
    const p = taskPlan('v.contextual_sense', asIs, null, [homes.primary, ...homes.others].filter((w): w is NonNullable<typeof w> => !!w), [])
    expect(p.next).toBeNull(); expect(p.quantity.available).toBeNull(); expect(p.quantity.planned).toBeNull()
    expect(p.unresolved).toContain('no_content')
  })
  it('goal + valid independent TASK evidence without an exam session must still offer the TASK action', () => {
    const { asIs, p } = fixture('r.inference')
    // Already adjudicated As-Is status is the input to the UI; no new grading rule.
    asIs.tasks['r.inference'] = { ...asIs.tasks['r.inference'], status: 'checking', basis: 'direct_check', check: { ...asIs.tasks['r.inference'].check!, independentItems: 1, attemptedItems: 1 } }
    const ranks = { actionRank: [{ rank: 1, task: 'r.inference', needRank: 1, href: p.next!.href, label: p.next!.label }], needRank: [], notActionable: [] }
    expect(mapStateOf(true, asIs, ranks)).toBe('ready')
  })
  it('no exam and no direct TASK evidence stays no_record', () => {
    const { asIs } = fixture('r.inference')
    expect(mapStateOf(true, asIs, { actionRank: [], needRank: [], notActionable: [] })).toBe('no_record')
    expect(mapStateOf(false, asIs, null)).toBe('no_goal')
  })
})
