import { ranksOf } from '@/lib/csat/map/v62/rank'
// verification/reviews/FINAL-MAIN-0649f8c0b/goal-version.test.ts
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { goalPlanRows } from '@/lib/csat/map/v62/goal-plan'
import { nextActionOf } from '@/lib/csat/map/v62/next-action'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'
import { GoalRecordBar } from '@/components/csat/diagnosis/map/GoalRecordBar'
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
function validShortage(current=11){const x=fixture(current);const row=x.view.taskPlans[0];row.next=null;row.unresolved=['material_needed'];row.quantity={...row.quantity,available:0,planned:null,remaining:null};x.saved.byTemplate['ws.central-meaning'].latest.plan.tasks[0].available=0;x.saved.byTemplate['ws.central-meaning'].latest.plan.tasks[0].planned=null;x.view.toBe.needs[0].evidence='unmeasured';return {...x,ranks:ranksOf(x.view)};}

function cold(goalSet=true,past=false){const x=validShortage(10);x.saved.byTemplate={};x.view.asIs.asOf='2026-10-21T00:00:00Z';const ranks=ranksOf(x.view);const html=renderToStaticMarkup(createElement(GoalRecordBar,{data:{records:[],v4:{saved:x.saved}},g:{goal:80},goalSet,asIs:x.view.asIs,view:x.view,ranks,recordHref:'/csat/diagnosis?tab=record',past,onSelect(){},onOpenWs(){}}));return {html,next:nextActionOf(x.view,ranks,x.saved)};}
describe('No exam record first direct-check entry on merged main',()=>{
 it('gap: goal and zero records must retain unknown state but offer existing plan CTA',()=>{const {html,next}=cold();expect(next.kind).toBe('plan');expect(html).toContain('data-state="no_record"');expect(html).toContain('data-testid="umap-top-next"');});
 it('control: no goal does not invent executable next action',()=>{expect(cold(false).html).not.toContain('data-testid="umap-top-next"');});
 it('control: past view offers no executable plan/activity action',()=>{const {html}=cold(true,true);expect(html).toContain('data-past="true"');expect(html).not.toContain('data-testid="umap-top-next"');});
});
