// scripts/research/lm-g1/fixture.ts
// Synthetic records only. Fixed 2026-09 time; no DB, no learner claims.
import type {FindAttemptRow} from '@/lib/knowledge/find-outcome';
import type {RefItem} from '@/lib/csat/map/target';
import {asIsMap,type AxisProxyState} from '@/lib/csat/map/v4/as-is';
import type {V4View} from '@/lib/csat/map/v4/compose';
import {DOMAINS,type Domain} from '@/lib/csat/map/v4/definition';
import {allTaskPlans,workspacePlan} from '@/lib/csat/map/v4/plan';
import {toBeMap,type ConfirmLink} from '@/lib/csat/map/v4/to-be';
import {planWorkspaces} from '@/lib/csat/map/v4/workspace';
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}?check=1`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString()
export const att = (itemRef: string, ok: boolean, d: number): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: day(d), activity: 'theater' })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34), A1: REF.slice(29, 31), A8: REF.slice(28, 29) }

export function view(attempts: FindAttemptRow[], asOfDay: number): V4View {
  const asIs = asIsMap({ asOf: day(asOfDay), sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts })
  const toBe = toBeMap({ asIs, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [KEY]: 0 }, transferTargets: {} })
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, workspacePlan(w, asIs, toBe, plan, [])]))
  return { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, []) }
}
