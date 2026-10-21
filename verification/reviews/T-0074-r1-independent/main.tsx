// verification/reviews/T-0074-r1-independent/main.tsx
import m from '@/components/csat/diagnosis/map/map.module.css'
import { createRoot } from 'react-dom/client'
import { GoalPlanSummary } from '@/components/csat/diagnosis/map/GoalPlanSummary'
import { taskOf } from '@/lib/csat/map/v4/definition'

const row = (task: string, o: Record<string, unknown> = {}) => ({ task, needRank: 1, need: 'MAINTAIN', evidence: 'resolved', basis: 'direct_check', independentItems: 4, relevance: { items: 7, pointsPerExam: 15 }, stage: null, workspace: 'ws.central-meaning', quantity: { unit: '문항', planned: null, done: 0, remaining: null, source: 'none' }, criterion: taskOf(task).learner_criterion, achievement: 'resolved', action: null, planGate: null, replanWhy: null, blocked: 'material_needed', unresolved: ['material_needed'], ...o })
const ev = (task: string, o: Record<string, unknown> = {}) => ({ task, taskKey: null, currentCheck: { status: 'passed', independentItems: 4, policy: 'existing' }, instructionPath: { repair: 'succeeded', transferDone: 2, transferPlanned: 2 }, newPassageTransfer: { status: 'experienced', passages: 2 }, delayedRetention: { status: 'NOT_ESTABLISHED', reason: 'no_approved_interval_or_instrument' }, learningEffect: 'NOT_EVALUATED', ledger: 'complete', attempts: [], sharedPassageGroups: [], scope: null, ...o })
const rows = [
  row('r.central_meaning'),
  row('r.inference', { needRank: 2, evidence: 'unmeasured', basis: 'none', achievement: 'not_checked', workspace: 'ws.inference' }),
  row('r.relation', { independentItems: 1, needRank: 3, evidence: 'checking', achievement: 'checking', workspace: 'ws.cohesion' }),
]
rows.push(row('e.task_demand',{needRank:4,workspace:'ws.evidence'}))
const evidence = { 'r.central_meaning': ev('r.central_meaning'), 'r.relation': ev('r.relation', { ledger: 'unknown', newPassageTransfer: {status:'unknown',passages:0}, currentCheck: { status: 'checking', independentItems: 1, policy: 'existing' } }) }
createRoot(document.getElementById('root')!).render(
  <div className={m.root} style={{ padding: 16 }}>
    <GoalPlanSummary data={{ rows, required: 4, relevanceUnknown: 0, examSessions: 0, directTasks: 3, actionable: 0 } as never} evidence={evidence as never} goalSet onSelect={() => undefined} onOpenWs={() => undefined} />
  </div>,
)
