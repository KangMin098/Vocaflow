// apps/web/src/lib/csat/__tests__/reveal-verification.test.ts
import { describe,expect,it,vi,beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
const fixture=vi.hoisted(()=>({user:{id:'participant'} as {id:string}|null,held:true,fault:null as string|null,secretReads:0}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:fixture.user}})}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:async(_fn:string,args:Record<string,string[]>)=>{
  if(fixture.fault==='timeout'||fixture.fault==='reset')throw Error(fixture.fault)
  if(fixture.fault==='500')return{data:null,error:{message:'internal'}}
  if(fixture.fault==='malformed')return{data:[{secret:true}],error:null}
  return{data:fixture.held?Object.values(args)[0]:[],error:null}
}})}))
vi.mock('@/lib/csat/learner',()=>({loadCsatItemExplain:async()=>{fixture.secretReads++;return{item:{id:'2026#18',answer:3,answer_unknown:false,type_name:'fixture',type_id:null,procedure:[],evidence_reasoning:null,why_correct:'KNOWN_SECRET_CANARY_01',distractors:[],measured_ability:null,design_intent:null,required_vocab:[]},error:null}}}))
vi.mock('@/lib/csat/lecture/store',()=>({lectureMeta:()=>null}))
vi.mock('@/lib/csat/skeleton',()=>({loadItemSkeleton:()=>null,primeLearnerHakpyeongSkeletons:async()=>{}}))
import { POST } from '@/app/api/csat/session/reveal/route'
import { canRevealExam,embargoedItemIds,canRevealSession } from '../embargo-gate'
import { selectTargets } from '../ec-pilot/targets'

beforeEach(()=>{fixture.user={id:'participant'};fixture.held=true;fixture.fault=null;fixture.secretReads=0})
describe('held behavioral oracle — real route and loader, injected DB transport',()=>{
  it('all choices and extra/invalid/empty answer values yield identical held response',async()=>{
    const shapes=[]
    for(const choice of [1,2,3,4,5,'invalid','',null]) {
      const response=await POST(new Request('http://local/api/csat/session/reveal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({item:'2026-18',choice})}))
      shapes.push({status:response.status,body:await response.text(),cache:response.headers.get('cache-control'),contentType:response.headers.get('content-type')})
    }
    expect(new Set(shapes.map(s=>JSON.stringify(s))).size).toBe(1)
    expect(shapes[0]).toMatchObject({status:423,cache:'no-store',body:JSON.stringify({held:'exam_embargo'})})
    expect(fixture.secretReads).toBe(0)
  })
  it.each(['timeout','500','reset','malformed'])('gate fault %s is indistinguishable and reads no secret',async fault=>{
    fixture.fault=fault
    const response=await POST(new Request('http://local/api/csat/session/reveal',{method:'POST',body:JSON.stringify({item:'2026-18'})}))
    expect(response.status).toBe(423);expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({held:'exam_embargo'});expect(fixture.secretReads).toBe(0)
  })
  it.each(['participant-held','participant-completed','different-participant','authenticated-nonparticipant','admin'])('global embargo denies actor %s',async actor=>{
    fixture.user={id:actor}
    const response=await POST(new Request('http://local/api/csat/session/reveal',{method:'POST',body:JSON.stringify({item:'2026-18'})}))
    expect(response.status).toBe(423);expect(fixture.secretReads).toBe(0)
  })
  it('anon has no reveal payload; an open exam reaches its source',async()=>{
    fixture.user=null
    expect((await POST(new Request('http://local',{method:'POST',body:JSON.stringify({item:'2026-18'})}))).status).toBe(401)
    fixture.user={id:'participant-completed'};fixture.held=false
    const opened=await POST(new Request('http://local',{method:'POST',body:JSON.stringify({item:'2026-18'})}))
    expect(opened.status).toBe(200)
    expect(await opened.json()).toMatchObject({answer:3})
    expect(fixture.secretReads).toBe(1)
  })
})
describe('malformed gate responses cannot release data',()=>{
  it.each([null,{},[false],['wrong-exam'],[42]])('exam rejects malformed %j',async data=>{
    const db={rpc:async()=>({data,error:null})} as unknown as SupabaseClient
    expect(await canRevealExam('X',{db})).toBe(false)
    expect([...(await embargoedItemIds(['X#18'],{db}))]).toEqual(['X#18'])
    expect(await canRevealSession('s',{db})).toBe(false)
  })
})
describe('capture selection correctness independence',()=>{
  it('all 64 correctness assignments preserve targets with fixed eligibility/config/seed',()=>{
    const base=Array.from({length:6},(_,i)=>({itemNo:18+i,chosen:2,stem:'stem',passage:'passage',choices:['a','b','c','d','e'],bodyOk:true}))
    for(const sealed of [base.map(c=>c.itemNo),[18,20,22]])for(const seed of ['session-a','session-b']) {
      const target=Reflect.apply(selectTargets,undefined,[base.map(c=>({...c,isCorrect:false})),sealed,seed])
      for(let mask=0;mask<64;mask++)expect(Reflect.apply(selectTargets,undefined,[base.map((c,i)=>({...c,isCorrect:!!(mask&(1<<i))})),sealed,seed])).toEqual(target)
    }
  })
})
