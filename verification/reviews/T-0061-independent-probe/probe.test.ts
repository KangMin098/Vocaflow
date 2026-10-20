// verification/reviews/T-0061-independent-probe/probe.test.ts
import { it, expect } from 'D:/workspace/Vocaflow-final-product/apps/web/node_modules/vitest'
import { build } from 'D:/workspace/Vocaflow-final-product/apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-fixture'
import { nextActionOf, wsForTask } from 'D:/workspace/Vocaflow-final-product/apps/web/src/lib/csat/map/v62/next-action'
import { ranksOf } from 'D:/workspace/Vocaflow-final-product/apps/web/src/lib/csat/map/v62/rank'
import { applySaved } from 'D:/workspace/Vocaflow-final-product/apps/web/src/lib/csat/map/v4/plan-commit'

const {view}=build({goalSet:true,attempts:[],activity:[],asOfDay:12,saved:false,fq:{status:'installed',eligible:[]}})
const ranks=ranksOf(view), first=ranks.actionRank[0]
const ws=wsForTask(first.task,view)!
const plan=view.taskPlans.find(p=>p.task===first.task)!
const savedRow=(stage:string|null,planned:number|null)=>({version:2,plan:{order:[first.task],tasks:[{task:first.task,stage,planned,available:plan.quantity.available,rule:plan.quantity.rule}]},reason:'initial' as const,note:null,restoredFrom:null,canon:'fixture',asOf:view.asIs.asOf,createdAt:view.asIs.asOf})

it('control: unsaved recommendation is proposed and opens plan',()=>{
 const a=nextActionOf(view,ranks,{byTemplate:{}})!
 expect(a.kind).toBe('plan');expect(a.quantity?.source).toBe('proposed')
})
it('control: unchanged persisted quantity is saved and opens activity',()=>{
 const a=nextActionOf(view,ranks,{byTemplate:{[ws]:{latest:savedRow(plan.stage,plan.quantity.planned)}}})!
 expect(a.kind).toBe('start');expect(a.quantity?.planned).toBe(plan.quantity.planned)
})
it('saved custom quantity agrees with the existing PLAN editor',()=>{
 const row=savedRow(plan.stage,2)
 const editor=applySaved(view.plans[ws],row).tasks.find(p=>p.task===first.task)!
 const a=nextActionOf(view,ranks,{byTemplate:{[ws]:{latest:row}}})!
 console.log('CUSTOM',JSON.stringify({task:first.task,stage:plan.stage,persisted:2,editor:editor.quantity.planned,top:a.quantity}))
 expect(editor.quantity.planned).toBe(2)
 expect(a.quantity?.planned).toBe(editor.quantity.planned)
})
it('a saved prior stage does not make the current proposal a saved plan',()=>{
 const row=savedRow(plan.stage==='check'?'repair':'check',2)
 const a=nextActionOf(view,ranks,{byTemplate:{[ws]:{latest:row}}})!
 console.log('STAGE_DRIFT',JSON.stringify({savedStage:row.plan.tasks[0].stage,currentStage:plan.stage,top:a.quantity}))
 expect(a.quantity?.source).toBe('proposed')
})
