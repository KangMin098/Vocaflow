import { createRoot } from 'react-dom/client'
import { GoalRecordBar } from '@/components/csat/diagnosis/map/GoalRecordBar'
import { ranksOf } from '@/lib/csat/map/v62/rank'
import '@/components/csat/diagnosis/map/unified.module.css'
import m from '@/components/csat/diagnosis/map/map.module.css'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

const task = 'r.central_meaning', ws = 'ws.central-meaning'
const q = new URLSearchParams(location.search)
const row = { task, name: '중심 의미', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '문항', available: 0, planned: null, done: 0, remaining: null }, achievement: 'not_checked', unresolved: ['material_needed'], next: null }
const view = { taskPlans: [row], plans: { [ws]: { workspace: ws, core: [task], tasks: [row], progress: null } }, asIs: { asOf: '2026-10-21T00:00:00Z', tasks: { [task]: { basis: 'none', status: 'unmeasured', check: null } }, sessions: [] }, toBe: { needs: [{ task, type: 'CONFIRM', relevance: { items: 3, pointsPerExam: 6 }, evidence: 'unmeasured' }], relevanceUnknown: [] } }
const saved = { status: 'installed', goalVersionId: 10, byTemplate: {} }
if(q.get('case')==='direct'){view.asIs.tasks[task].basis='direct_check';view.asIs.tasks[task].status='checking';}
if(q.get('case')==='start'){row.quantity={...row.quantity,available:2,planned:2,remaining:2};row.next={href:'/csat/learn/cm-ind-1?d=11111111-2222-4333-8444-555555555555',label:'first check'};row.unresolved=[];saved.byTemplate[ws]={template:ws,workspaceId:'11111111-2222-4333-8444-555555555555',history:[],latest:{version:1,canon:CANON_VERSION,goalVersionId:10,reason:'initial',createdAt:'2026-10-21T00:00:00Z',asOf:'2026-10-21T00:00:00Z',plan:{order:[task],tasks:[{task,stage:'check',planned:2,available:2}]}}};}
const w = window as unknown as { __opened: unknown[] }
w.__opened = []
createRoot(document.getElementById('root')!).render(
  <div className={m.root} style={{ padding: 16 }}>
    <GoalRecordBar data={{ records: [], v4: { saved } } as never} g={{ goal: 80 } as never} goalSet={q.get('goal') !== '0'} asIs={view.asIs as never} view={view as never} ranks={ranksOf(view as never)} recordHref="/csat/diagnosis?tab=record" past={q.get('past') === '1'} onSelect={() => undefined} onOpenWs={(id, tab) => { w.__opened.push([id, tab]) }} />
  </div>,
)
