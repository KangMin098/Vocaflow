// Independent projection checks; synthetic state, no DB connection or writes.
import { describe, it, expect } from 'vitest'
import { asIsMap } from '@/lib/csat/map/v4/as-is'
import { DOMAINS } from '@/lib/csat/map/v4/definition'
import { allTaskPlans, workspacePlan } from '@/lib/csat/map/v4/plan'
import { toBeMap } from '@/lib/csat/map/v4/to-be'
import { planWorkspaces } from '@/lib/csat/map/v4/workspace'
import { buildDemand } from '@/lib/csat/map/v62/demand'
import { ranksOf } from '@/lib/csat/map/v62/rank'
import { nextActionOf, WAIT_LABEL } from '@/lib/csat/map/v62/next-action'

const task='r.central_meaning', key='claim-support', template='ws.central-meaning'
const ctx={workspaceId:null,planVersion:1,goalVersion:1}
const items=['i1','i2','i3','i4','i5','i6']
const links={ [key]:items.map(target=>({target,href:`/csat/item/${target}`,label:target})) }
const refs=Array.from({length:45},(_,i)=>({examId:'REF',no:i+1,points:i<10?3:2,errorRate:0.1+i/100}))
function view(resolved:boolean) {
  const asIs=asIsMap({asOf:'2026-10-21T00:00:00Z',sessions:[],axisProxy:{state:Object.fromEntries(DOMAINS.map(d=>[d,'check_first'])),contributions:Object.fromEntries(DOMAINS.map(d=>[d,0]))},checks:[{taskKey:key,items}],attempts:[]} as any)
  // Fix the input state, then use the actual To-Be -> Workspace -> PLAN projection.
  asIs.tasks[task]={...asIs.tasks[task],status:resolved?'resolved':'verified_need',basis:'direct_check',check:{status:resolved?'resolved':'verified',independentItems:2,verifiedAt:'2026-10-10T00:00:00Z',verifiedItems:['i1','i2'],wrongItems:['i1','i2'],lastWrongAt:null,unseen:items.slice(2)}} as any
  const toBe=toBeMap({asIs,goal:{score:80,set:true},refItems:refs,lineRefItems:{B6:refs.slice(17,24),A5:refs.slice(28,34)},confirmLinks:links,transferredKeys:resolved?[key]:[]})
  const plan=planWorkspaces({asIs,toBe,confirmLinks:links,transferItems:{[key]:0},transferTargets:{}})
  const activity=resolved?[]:[{itemRef:'i1',taskKey:key,phase:'practice',answeredAt:'2026-10-11T00:00:00Z',isCorrect:true}]
  return {asIs,toBe,plan,plans:{},taskPlans:allTaskPlans(asIs,toBe,plan,activity)} as any
}
describe('D/G scope decision, current source projection',()=>{
  it('normal MAINTAIN becomes recheck and requests independent 2, not delayed',()=>{
    const v=view(true), p=v.taskPlans.find((p:any)=>p.task===task)
    expect(p.need).toBe('MAINTAIN');expect(p.stage).toBe('recheck')
    expect(buildDemand(v,task,template,ctx).lines.map(l=>[l.role,l.quantity.n])).toEqual([['independent_check',2]])
  })
  it('the existing delayed demand test uses a stage-null MAINTAIN input; delayed defaults to one',()=>{
    const v=view(true);v.taskPlans=v.taskPlans.map((p:any)=>p.task===task?{...p,stage:null}:p)
    expect(buildDemand(v,task,template,ctx).lines.map(l=>[l.role,l.quantity.n])).toEqual([['delayed_check',1]])
  })
  it('successful repair with transfer stock zero still demands transfer and exposes no fabricated link',()=>{
    const v=view(false), p=v.taskPlans.find((p:any)=>p.task===task)
    expect(p.stage).toBe('transfer');expect(p.unresolved).toContain('material_needed');expect(p.next).toBeNull()
    expect(buildDemand(v,task,template,ctx).lines.map(l=>[l.role,l.quantity.n])).toEqual([['transfer',2]])
  })
  it('observation: completed current check with no unseen links is incorrectly described as an unfinished earlier stage',()=>{
    const v=view(true)
    v.asIs.tasks[task].check.unseen=[]
    v.toBe={...v.toBe,needs:v.toBe.needs.filter((n:any)=>n.task===task).map((n:any)=>({...n,executable:null})),relevanceUnknown:[]}
    v.plan=planWorkspaces({asIs:v.asIs,toBe:v.toBe,confirmLinks:links,transferItems:{[key]:0},transferTargets:{}})
    v.taskPlans=allTaskPlans(v.asIs,v.toBe,v.plan,[])
    v.plans=Object.fromEntries([v.plan.primary,...v.plan.others].filter(Boolean).map((w:any)=>[w.id,workspacePlan(w,v.asIs,v.toBe,v.plan,[])]))
    const p=v.taskPlans.find((p:any)=>p.task===task)
    expect(p).toMatchObject({need:'MAINTAIN',achievement:'resolved',stage:'recheck',next:null})
    expect(p.unresolved).toContain('stage_locked')
    const rows=v.plans[template].tasks.map((t:any)=>({task:t.task,stage:t.stage,planned:t.quantity.planned,available:t.quantity.available}))
    const saved={status:'installed',goalVersionId:1,byTemplate:{[template]:{latest:{version:1,goalVersionId:1,plan:{order:rows.map((r:any)=>r.task),tasks:rows}}}}} as any
    const next=nextActionOf(v,ranksOf(v),saved)
    expect(next).toMatchObject({task,ws:template,kind:'wait',blocked:'stage_locked'})
    console.log(JSON.stringify({observation:'MAINTAIN_AFTER_CURRENT_PASS',achievement:p.achievement,need:p.need,stage:p.stage,unresolved:p.unresolved,next,waitMessage:WAIT_LABEL[next!.blocked!]}))
  })
})
