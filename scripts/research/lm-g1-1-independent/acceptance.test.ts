// scripts/research/lm-g1-1-independent/acceptance.test.ts
// Independent fixed-time boundary tests; original observations remain immutable.
import { expect, it } from 'vitest'
import { att, view } from '../lm-g1/fixture'
import { repairGate, taskPlan, doneOf } from '@/lib/csat/map/v4/plan'
import { planWorkspaces } from '@/lib/csat/map/v4/workspace'
import { repairWindow, repairAttempts, lifecycleEvidence, nextLifecycleAction } from '@/lib/csat/map/lifecycle-evidence'
import { workspaceRows } from '@/lib/csat/map/v62/workspace-list'
import type { PlanActivity } from '@/lib/csat/map/v4/plan'

const T='r.central_meaning', KEY='claim-support'
const v=view([att('i1',false,10),att('i2',false,11)],30)
const skill={status:'verified',verifiedAt:v.asIs.tasks[T].check!.verifiedAt,verifiedItems:['i1','i2']}
const at=(n:number)=>new Date(Date.UTC(2026,8,n)).toISOString()
const activity=(itemRef:string,isCorrect:boolean|null|undefined,n=16,taskKey=KEY):PlanActivity=>({itemRef,isCorrect,answeredAt:at(n),taskKey,phase:'practice'})
function build(acts:PlanActivity[],links=['i1','i2','i3','i4','i5','i6'],transfers=['x1','x2']){
 const p=planWorkspaces({asIs:v.asIs,toBe:v.toBe,confirmLinks:{[KEY]:links.map(target=>({target,href:`/csat/item/${target}?check=1`,label:target}))},transferItems:{[KEY]:transfers.length},transferTargets:{[KEY]:transfers.map(target=>({target,href:`/csat/practice/${KEY}?item=${target}`,label:target}))}})
 const ws=[p.primary,...p.others].filter((w):w is NonNullable<typeof w>=>!!w)
 const tp=taskPlan(T,v.asIs,v.toBe,ws,acts)
 return {tp,p,ws}
}
it.each([false,null,undefined])('G02: %s is not repair success; attempts and retry retained',ok=>{
 const acts=[activity('i1',ok),activity('i2',ok)]
 const {tp}=build(acts)
 expect(tp.stage).toBe('repair');expect(tp.quantity.done).toBe(2)
 expect(tp.next?.href).toBe('/csat/item/i1?check=1')
 expect(nextLifecycleAction('verified',lifecycleEvidence(skill,[{itemRef:'i1',taskKey:KEY}],acts.map(a=>({...a,isCorrect:a.isCorrect??null}))))).toBe('repair')
})
it('duplicates do not inflate progress; other TASK and nonblocked item do not succeed',()=>{
 const a=activity('i1',false)
 const acts=[a,a,activity('i1',true,16,'other'),activity('other-item',true)]
 expect(repairGate(v.asIs.tasks[T],acts)).toMatchObject({succeeded:false,tried:1})
 expect(doneOf('repair',v.asIs.tasks[T],acts)).toBe(1)
})
it('new failed CHECK round excludes previous success, wrong item and equality boundary',()=>{
 const s={...skill,status:'still_needed',check:{wrongItems:['i3'],lastWrongAt:at(18)}}
 expect(repairWindow(s)).toEqual({blocked:['i3'],since:at(18)})
 const acts=[activity('i1',true,17),activity('i1',true,19),activity('i3',true,18),activity('i3',true,19)]
 expect(repairAttempts(s,new Set([KEY]),acts)).toEqual([acts[3]])
})
it('resolved keeps the original repair window rather than inventing a stricter round',()=>{
 expect(repairWindow({...skill,status:'resolved',check:{wrongItems:['i3'],lastWrongAt:at(18)}})?.since).toBe(skill.verifiedAt)
})
it('missing repair material cannot fall back to an unseen CHECK',()=>{
 const {tp,p}=build([activity('i1',false),activity('i2',false)],['i3','i4','i5'])
 expect(tp.stage).toBe('repair');expect(tp.next).toBeNull()
 const rows=workspaceRows({plan:p,plans:{'ws.central-meaning':{tasks:[tp],progress:null}}} as never)
 expect(rows.find(r=>r.id==='ws.central-meaning')?.next).toBeNull()
})
it('actual generated REPAIR needs have no executable override',()=>{
 expect(v.toBe?.needs.find(n=>n.task===T)).toMatchObject({type:'REPAIR',executable:null})
})
it('same transfer item performed for a different TASK does not remove the real next activity',()=>{
 const {tp}=build([activity('i1',true),{...activity('x1',true,20,'evidence-locate'),phase:'transfer'},{...activity('x2',true,21,'evidence-locate'),phase:'transfer'}])
 expect(tp.stage).toBe('transfer');expect(tp.quantity.done).toBe(0)
 expect(tp.next?.href).toBe('/csat/practice/claim-support?item=x1')
})

it('blocked success only means one successful repair, not all items or mastery',()=>{
 const acts=[activity('i1',true),activity('i2',false)]
 const {tp}=build(acts);expect(tp.stage).toBe('transfer');expect(tp.achievement).toBe('need_confirmed')
 expect(repairGate(v.asIs.tasks[T],acts).retry).toEqual(['i2'])
})
it('content unavailable leaves repair blocked with no launch',()=>{
 const {tp}=build([],[],[]);expect(tp.stage).toBe('repair');expect(tp.next).toBeNull()
})
it('preserved TRANSFER policy boundary: one experience is not two planned passages',()=>{
 const acts=[activity('i1',true),{...activity('x1',true,20),phase:'transfer'}]
 const {tp}=build(acts)
 const ev=lifecycleEvidence(skill,['i1','i2','i3','i4','i5','i6'].map(itemRef=>({itemRef,taskKey:KEY})),acts.map(a=>({...a,isCorrect:a.isCorrect??null})))
 expect(nextLifecycleAction('verified',ev)).toBe('check')
 expect(tp.stage).toBe('transfer');expect(tp.quantity).toMatchObject({done:1,planned:2})
 expect(tp.next?.href).toBe('/csat/practice/claim-support?item=x2')
})
