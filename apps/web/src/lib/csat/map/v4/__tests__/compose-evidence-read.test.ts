// apps/web/src/lib/csat/map/v4/__tests__/compose-evidence-read.test.ts
// T-0078 — Codex NEXT-EVIDENCE-READ-RECOVERY 실제 compose + buildCommitPayload 반례(2 fail · 2 pass) 이식: 원장 못 읽음 ≠ 빈 첫 사용자
import{describe,it,expect}from'vitest';import{composeV4}from'@/lib/csat/map/v4/compose';import{DEFAULT_MAP_SETTINGS}from'@/lib/csat/map/load';import{buildCommitPayload}from'@/lib/csat/map/v4/plan-commit';import{templateOf}from'@/lib/csat/map/v4/definition';
const NOW='2026-10-21T00:00:00Z',key='authored-central-meaning',task='r.central_meaning',ws='ws.central-meaning';
const first=(i:number)=>({attemptId:String(i),sessionId:'s'+i,userId:'fixture',itemRef:'authored:probe-ind-'+i,taskKey:key,phase:'practice',activity:'theater',isCorrect:false,synthetic:false,helpLevel:'independent',afterViewedFirst:false,afterExplanation:false,timingUncertain:false,answeredAt:`2026-10-0${i}T00:00:00Z`,contentHash:'h',expectedContentHash:'h'});
const f=[first(1),first(2)],guide={attemptId:'3',itemRef:'authored:probe-guide',taskKey:key,phase:'practice',activity:'practice',isCorrect:true,answeredAt:'2026-10-03T00:00:00Z',receivedAt:'2026-10-03T00:00:01Z',repairRole:'guided_practice'};
const link=(ref:string)=>({target:ref,href:'/csat/learn/'+ref.slice(9)+'?d=fixture',label:ref,taskKey:key});
function data(o:Record<string,unknown>={}){return{now:NOW,settings:DEFAULT_MAP_SETTINGS,practiceLinks:{[task]:{href:'/',label:'fixture',itemId:'probe-ind-1',target:f[0].itemRef,taskKey:key,confirm:f.map(x=>link(x.itemRef))}},findAttempts:f,lifecycleActivity:[...f,guide],instrumentHashes:{},model:{goal:80,goalSet:true,lineRefItems:{},nodes:{}},v4:{sessions:[],proxyCovers:[],refItems:[],transferItems:{[key]:2},transferTargets:{[key]:[link('authored:tr-1'),link('authored:tr-2')]},repairTargets:{[key]:[{...link(guide.itemRef),role:'guided_practice'}]},saved:{status:'installed',goalVersionId:10,byTemplate:{}}},...o} as never}
const view=(d=data())=>composeV4(d,{score:80,set:true});
describe('unavailable evidence is not a fresh empty learner',()=>{
 it('positive: known completed repair advances to transfer',()=>{const v=view()!;expect(v.asIs.tasks[task].status).toBe('verified_need');expect(v.taskPlans.find(p=>p.task===task)?.stage).toBe('transfer')});
 it('missing activity must not manufacture a writable repair plan from zero activity',()=>{const v=view(data({lifecycleActivity:undefined}));if(v){const p=v.plans[ws];const tpl=templateOf(ws)!;const req={template:ws,order:[...tpl.core,...tpl.support],planned:Object.fromEntries(p.tasks.map(t=>[t.task,t.quantity.planned])),reason:'check_result',expectedVersion:1,expectedGoalVersion:10,clientKey:'11111111-2222-4333-8444-555555555555'};const b=buildCommitPayload(req as never,p,v.asIs.asOf);expect({stage:p.tasks.find(t=>t.task===task)?.stage,ledger:v.evidence?.[task]?.ledger,built:b.ok}).not.toEqual({stage:'repair',ledger:'unknown',built:true})}});
 it('missing first ledger must not emit a fresh not-checked diagnostic and plan',()=>{const v=view(data({findAttempts:undefined}));expect(v===null||!v.taskPlans.some(p=>p.task===task&&p.achievement==='not_checked')).toBe(true)});
 it('readable empty first and activity arrays remain legitimate first entry',()=>{expect(view(data({findAttempts:[],lifecycleActivity:[]}))).toBeTruthy()});
});
describe('T-0078 대조', () => {
  it('원장 못 읽음 = 계획 · 진단 자체를 만들지 않음(null) — 0건 재계획 · not_checked 없음', () => {
    expect(view(data({ lifecycleActivity: undefined }))).toBeNull()
    expect(view(data({ findAttempts: undefined }))).toBeNull()
    expect(view(data({ findAttempts: undefined, lifecycleActivity: undefined }))).toBeNull()
  })
  it('읽힌 빈 원장 = 첫 사용자 정상 계획(not_checked 는 사실)', () => {
    const v = view(data({ findAttempts: [], lifecycleActivity: [] }))!
    expect(v.plans[ws]).toBeTruthy()
  })
})
