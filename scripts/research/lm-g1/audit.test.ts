// scripts/research/lm-g1/audit.test.ts
// Audit observations on fixed synthetic inputs. Observing a gap is a passing probe, not product acceptance.
import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { view, att } from './fixture';
import { doneOf, taskPlan } from '@/lib/csat/map/v4/plan';
import { planWorkspaces } from '@/lib/csat/map/v4/workspace';
import { lifecycleEvidence, nextLifecycleAction } from '@/lib/csat/map/lifecycle-evidence';
import { ranksOf } from '@/lib/csat/map/v62/rank';
import { targetSpecOf, unsavedTargetFields } from '@/lib/csat/map/v62/target-spec';
const id='r.central_meaning',key='claim-support';
const links=Object.fromEntries([[key,['i1','i2','i3','i4','i5','i6'].map(target=>({target,href:'/csat/item/'+target,label:target}))]]);
const at=(n:number)=>new Date(Date.UTC(2026,8,n)).toISOString();
const findings:any[]=[];
const output=new URL('../../../docs/csat-learner/v62/lm-g1/probes.json',import.meta.url);
const observe=(x:any)=>{findings.push(x);writeFileSync(output,JSON.stringify({kind:'synthetic pure-function observations; no DB/learner writes',observations:findings},null,2)+'\n');};

it('successful write-shaped evidence recomputes R5 need and ranks; engine path exists',()=>{
 const before=view([],12),after=view([att('i1',false,10),att('i2',false,11)],12);
 expect(before.asIs.tasks[id].status).not.toBe('verified_need');expect(after.asIs.tasks[id].status).toBe('verified_need');
 expect(after.toBe!.needs.find(n=>n.task===id)!.type).toBe('REPAIR');expect(ranksOf(after).needRank.find(n=>n.task===id)!.need).toBe('REPAIR');
 observe({id:'G01',stateBefore:before.asIs.tasks[id].status,stateAfter:after.asIs.tasks[id].status,need:'REPAIR',claim:'recalculation is implemented; no proof of live write/refresh here'});
});
it('PLAN action can leave repair after unsuccessful retries while legacy lifecycle still requests repair',()=>{
 const v=view([att('i1',false,10),att('i2',false,11)],12);
 const plan=planWorkspaces({asIs:v.asIs,toBe:v.toBe,confirmLinks:links,transferItems:{[key]:2},transferTargets:{[key]:['t1','t2'].map(target=>({target,href:'/csat/practice/claim-support?item='+target,label:target}))}});
 const ws=[plan.primary,...plan.others].filter(Boolean) as any[];
 const activity=['i1','i2'].map(itemRef=>({itemRef,taskKey:key,phase:'practice',isCorrect:false,answeredAt:at(13)}));
 const p=taskPlan(id,v.asIs,v.toBe,ws,activity);
 const ev=lifecycleEvidence({verifiedAt:v.asIs.tasks[id].check!.verifiedAt,verifiedItems:['i1','i2'],status:'verified'},links[key].map(l=>({itemRef:l.target,taskKey:key})),activity);
 expect(doneOf('repair',v.asIs.tasks[id],activity)).toBe(2);expect(p.stage).toBe('transfer');expect(ev.repairAt).toBeNull();expect(nextLifecycleAction('verified',ev)).toBe('repair');
 observe({id:'G02',planStage:p.stage,planNext:p.next,lifecycleNext:nextLifecycleAction('verified',ev),repairSuccess:ev.repairAt,claim:'progress remains attempts; stage readiness and successful repair must be distinguished'});
});
it('independent CHECK may resolve without recorded repair or transfer; no delay minimum',()=>{
 const v=view([att('i1',false,10),att('i2',false,11),att('i3',true,11.01),att('i4',true,11.02)],12);
 expect(v.asIs.tasks[id].status).toBe('resolved');
 observe({id:'G03',status:v.asIs.tasks[id].status,recordedRepair:0,recordedTransfer:0,claim:'current-policy recheck is not evidence of completing teaching/transfer/delayed retention'});
});
it('grade/exam/date/budget fields remain drafts even when existing version id exists',()=>{
 const s=targetSpecOf({score:80,set:true},7,{grade:2,targetDate:'2026-11-19',examKinds:['csat'],minutesPerWeek:300});
 expect(unsavedTargetFields(s)).toEqual(['examScope','grade','targetDate','timeBudget']);
 observe({id:'G04',unsaved:unsavedTargetFields(s),goalVersion:s.goalVersion});
});
