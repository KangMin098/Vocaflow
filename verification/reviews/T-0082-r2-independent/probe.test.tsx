// T-0082 independent: real scorer and compose -> ranks -> rendered top facts.
import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {composeV4} from '@/lib/csat/map/v4/compose'
import {ranksOf} from '@/lib/csat/map/v62/rank'
import {nextActionOf} from '@/lib/csat/map/v62/next-action'
import {goalPlanRows} from '@/lib/csat/map/v62/goal-plan'
import {GoalRecordBar} from '@/components/csat/diagnosis/map/GoalRecordBar'
import {GoalPlanSummary} from '@/components/csat/diagnosis/map/GoalPlanSummary'
import {workspaceRows} from '@/lib/csat/map/v62/workspace-list'
import {dataOf} from './fixture'
const task='r.central_meaning',ws='ws.central-meaning'
function setup(unseen=false){const data=dataOf(unseen);const v=composeV4(data,{score:80,set:true},data.now)!;expect(v.asIs.tasks[task].status).toBe('resolved');expect(v.taskPlans.find(p=>p.task===task)?.need).toBe('MAINTAIN');v.toBe={...v.toBe!,needs:v.toBe!.needs.filter(n=>n.task===task),relevanceUnknown:[]};const saved=data.v4.saved;saved.byTemplate[ws]={workspaceId:'11111111-2222-4333-8444-555555555555',template:ws,latest:{version:1,goalVersionId:10,plan:{order:v.plans[ws].tasks.map(p=>p.task),tasks:v.plans[ws].tasks.map(p=>({task:p.task,stage:p.stage,planned:p.quantity.planned,available:p.quantity.available}))}}};return{data,v,saved}}
function top(s:ReturnType<typeof setup>,past=false){return renderToStaticMarkup(<GoalRecordBar data={s.data} g={{goal:80} as never} goalSet asIs={s.v.asIs} view={s.v} ranks={ranksOf(s.v)} recordHref="/csat/diagnosis?tab=record" past={past} onSelect={()=>{}} onOpenWs={()=>{}}/>)}
describe('current pass / future maintenance, independent real projection',()=>{
for(const unseen of[false,true])it('only maintenance, remaining links '+unseen,()=>{const s=setup(unseen),r=ranksOf(s.v),before=JSON.stringify(s.data);expect(r.actionRank).toEqual([]);expect(nextActionOf(s.v,r,s.saved)).toMatchObject({kind:'wait',blocked:'maintain_pending',task});expect(JSON.stringify(s.data)).toBe(before);const h=top(s);expect(h).toContain('지금 확인은 통과했어요');expect(h).not.toContain('data-testid="umap-top-next"');expect(h).not.toContain('앞 단계를 마치면 열려요')})
it('summary and top share pending reason; past still hides execution',()=>{const s=setup(true),r=ranksOf(s.v),d=goalPlanRows(s.v,r,s.saved);const h=renderToStaticMarkup(<GoalPlanSummary data={d} goalSet saved={s.saved} evidence={s.v.evidence} onSelect={()=>{}} onOpenWs={()=>{}}/>);expect(h).toContain('지금 확인 통과');expect(h).not.toContain('data-testid="goal-plan-do"');expect(top(s,true)).not.toContain('data-testid="umap-top-next"')})
it('goal version mismatch and first-plan guards remain',()=>{const s=setup();s.saved.byTemplate[ws].latest.goalVersionId=9;expect(nextActionOf(s.v,ranksOf(s.v),s.saved)).toMatchObject({kind:'plan',replanWhy:'goal'});s.saved.byTemplate={};expect(nextActionOf(s.v,ranksOf(s.v),s.saved)).toMatchObject({kind:'plan'})})
it('another raw delivered-task link yields an actual action without injecting actionRank',()=>{const data=dataOf(true),other='e.option_correspondence',key='authored-option-match';data.practiceLinks[other]={taskKey:key,target:'authored:opt-probe-1',confirm:[1,2].map(i=>({target:`authored:opt-probe-${i}`,href:`/csat/learn/opt-probe-${i}?d=synthetic`,label:'probe',taskKey:key}))};const v=composeV4(data,{score:80,set:true},data.now)!;const r=ranksOf(v);expect(r.actionRank.some(x=>x.task===other)).toBe(true);expect(r.actionRank.some(x=>x.task===task)).toBe(false);expect(nextActionOf(v,r,data.v4.saved)?.task).toBe(other);const row=workspaceRows(v).find(x=>x.id==='ws.option-match')!;expect(row.next?.task).toBe(other);expect(row.state).toBe('runnable')})
it('P1: actual Workspace row cannot bypass the maintenance pending recommendation',()=>{const s=setup(true);expect(ranksOf(s.v).actionRank.some(a=>a.task===task)).toBe(false);const row=workspaceRows(s.v).find(r=>r.id===ws)!;console.log(JSON.stringify({finding:'T0082-P1-1',row}));expect(row.next).toBeNull();expect(row.state).toBe('maintain')})
})
