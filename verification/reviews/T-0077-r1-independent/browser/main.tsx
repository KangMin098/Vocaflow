import { createRoot } from 'react-dom/client'
import { PlanSection } from '@/components/csat/diagnosis/map/PlanSection'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

const task = 'r.central_meaning', workspace = 'ws.central-meaning', at = '2026-10-20T00:00:00Z'
const ver = (version: number, stage: string, goal = 10) => ({ version, canon: CANON_VERSION, goalVersionId: goal, reason: version === 1 ? 'initial' : 'check_result', createdAt: at, asOf: at, note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage, planned: 2, available: 2, rule: stage === 'check' ? 'unseen_check_items' : 'blocked_items' }] } })
const props = (id: string, stage: string, versions: unknown[] | null, o: { error?: boolean; available?: number | null; goal?: number; past?: boolean } = {}) => {
  const row = { task, name: '중심 의미', goal: 'g', criterion: 'c', basis: 'direct_check', evidence: 'verified_need', need: 'REPAIR', stage, quantity: { unit: '문항', adjustable: true, available: o.available === undefined ? 2 : o.available, planned: 2, done: 0, remaining: 2, rule: 'blocked_items' }, achievement: 'need_confirmed', unresolved: [], next: null }
  const goalHistory = [{ id: 10, score: 80, exam: 'kice6', grade: null, date: null, createdAt: at }, { id: 11, score: 90, exam: 'kice6', grade: null, date: null, createdAt: at }]
  const saved = { status: 'installed', error: !!o.error, goalVersionId: o.goal ?? 10, goalHistory, byTemplate: versions ? { [workspace]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: workspace, latest: versions[0], history: versions } } : {} }
  return { id, p: { view: { workspace, core: [task], tasks: [row], progress: { planned: 2, done: 0 } } as never, saved: saved as never, viewer: `fixture-${id}`, goal: 80, past: !!o.past, reason: null } }
}
const CASES = [
  props('proposal', 'repair', [ver(2, 'repair'), ver(1, 'check')].slice(1)),
  props('saved-change', 'repair', [ver(2, 'repair'), ver(1, 'check')]),
  props('same', 'check', [ver(1, 'check')]),
  props('available-null', 'check', [ver(1, 'check')], { available: null }),
  props('goal-only', 'check', [ver(1, 'check')], { goal: 11 }),
  props('read-failed', 'repair', [ver(2, 'repair'), ver(1, 'check')], { error: true }),
  props('past', 'repair', [ver(1, 'check')], { past: true }),
]
createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16, display: 'grid', gap: 24, maxWidth: 760 }}>
    {CASES.map(({ id, p }) => <div key={id} data-case={id}><PlanSection {...p} /></div>)}
  </div>,
)
