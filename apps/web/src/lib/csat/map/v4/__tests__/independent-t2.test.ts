// apps/web/src/lib/csat/map/v4/__tests__/independent-t2.test.ts
//
// LM-G1.2 — 다른 글에 적용(TRANSFER) 계약: 경험 · 진행 · 준비 · 증거를 섞지 않는다.
//   정본 workspaces.json ws.central-meaning: quantity_policy 「… + 전이 2지문 + …」(운영량) · criterion 「독립 확인」(능력 판정은 CHECK).
//   1회 경험 ≠ 2지문 계획 완료 · 2회 수행 ≠ 숙달 · 같은 문항 반복 · 다른 TASK 키는 진행에 넣지 않음 · 학습자 계획량 조정은 운영량만.
// PLAN(stageNow · quantity) · lifecycle(nextLifecycleAction · 4칸)이 같은 진행 · 계획량으로 같은 다음 행동을 낸다. 고정 시각만.

import { workspaceRows } from '../../v62/workspace-list'
import { applySaved, buildCommitPayload, planDrift, type PlanCommitRequest, type SavedPlanVersion, type PlanReason } from '../plan-commit'
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'
import { transferContract, transferTarget } from '../../lifecycle-evidence'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { savedTransferOf } from '../compose'
import { DOMAINS, type Domain } from '../definition'
import { applyDraft, transferDoneOf, workspacePlan, type PlanActivity, type PlanOpts } from '../plan'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'

const NOW = '2026-10-11T09:00:00.000Z'
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const T = 'r.central_meaning'
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const attempt = (itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater' })
const asIs = (o: Partial<AsIsInput> = {}) => asIsMap({ asOf: NOW, sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts: [], ...o })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }
const X = ['x1', 'x2', 'x3']
const build = (a: ReturnType<typeof asIs>, activity: PlanActivity[], transfer = 3, opts?: PlanOpts, passageKeys?: Record<string,string>, support = false) => {
  const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: transfer }, transferTargets: { [KEY]: X.slice(0, transfer).map((t) => ({ target: t, passageKey: passageKeys?.[t], href: `/csat/practice/claim-support?item=${t}`, label: t })) } })
  const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
  return workspacePlan(support ? {...cm,id:'ws.option-match',core:[],support:[T]} : cm, a, toBe, plan, activity, opts).tasks.find((x) => x.task === T)!
}
const VERIFIED = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')]
const act = (itemRef: string, at: string, o: Partial<PlanActivity> = {}): PlanActivity => ({ itemRef, taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: at, ...o })
const FIXED = act('i1', '2026-09-12T00:00:00Z') // 바로잡기 성공
const tr = (item: string, day: number, o: Partial<PlanActivity> = {}) => act(item, `2026-09-${String(day).padStart(2, '0')}T00:00:00Z`, { phase: 'transfer', isCorrect: null, ...o })
const SKILL = { status: 'verified', verifiedAt: '2026-09-11T00:00:00Z', verifiedItems: ['i1', 'i2'] }
describe('Independent T2 counterexamples', () => {
  it('T05 one available passage does not silently lower the default two', () => {
    expect(transferTarget(1, null, 2)).toBe(2)
    expect(build(asIs({ attempts: VERIFIED }), [FIXED, tr('x1', 13)], 1).stage).toBe('transfer')
  })
  it('T03 actual shared-passage items require a passage identity before two can be proven', () => {
    // Metadata: 2024#43 and #44 have identical full passage JSON hash.
    // Pinned function has no metadata input, so cannot implement the required distinction.
    const rows = [tr('2024#43',13), tr('2024#44',14)].map(a => Object.assign(a,{passageKey:'d79e4eeb7b5d22b2740e1e0bf7f53d4b22517178ecdca2b0a7d25b83cf87d3de'}))
    expect(transferDoneOf(T, SKILL.verifiedAt, rows)).toBe(1)
  })
  it('T04 same item in another TASK does not add progress', () => {
    expect(transferDoneOf(T,SKILL.verifiedAt,[tr('x1',13,{taskKey:'evidence-locate'})])).toBe(0)
  })
})

describe('Independent T2 boundaries', () => {
 it('T01 same item repeats once; null passage identity is not proof', () => {
  expect(transferDoneOf(T,SKILL.verifiedAt,[tr('x1',13),tr('x1',14)])).toBe(1)
  expect(transferDoneOf(T,SKILL.verifiedAt,[Object.assign(tr('x1',13),{passageKey:null})])).toBe(0)
 })
 it('T06 zero availability is unknown, not completion', () => {
  expect(transferTarget(0,null,2)).toBeNull()
  expect(transferContract('experience',1,null).ready).toBeNull()
 })
 it('T07 explicit saved one changes operation only', () => {
  const p=build(asIs({attempts:VERIFIED}),[FIXED,tr('x1',13)],1,{savedTransfer:{[T]:1}})
  expect(p.stage).toBe('recheck')
  expect(p.achievement).toBe('need_confirmed')
 })
 it('C held items in an expired episode are not attributed to current CHECK', () => {
  const ids=['old1','old2','held','new1','new2','new3','new4']
  const checks=[{taskKey:KEY,items:ids}]
  const attempts=[attempt('old1',false,'2026-01-01T00:00:00Z'),attempt('old2',false,'2026-01-02T00:00:00Z'),
   {...attempt('held',false,'2026-01-03T00:00:00Z'),timingUncertain:true},
   attempt('new1',false,'2026-09-01T00:00:00Z'),attempt('new2',false,'2026-09-02T00:00:00Z')]
  const a=asIs({checks,attempts})
  expect(a.tasks[T].check).toMatchObject({status:'verified',verifiedItems:['new1','new2'],timingHeld:0})
  expect(asIs({checks,attempts:[...attempts,attempt('new3',true,'2026-09-05T00:00:00Z'),attempt('new4',true,'2026-09-06T00:00:00Z')]}).tasks[T].check).toMatchObject({status:'resolved',timingHeld:0})
 })
})

it('T08 saved quantity from REPAIR never becomes TRANSFER quantity in PLAN', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED])
 const saved={plan:{order:[T],tasks:[{task:T,stage:'repair',planned:1}]}}
 const shown=applySaved({workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null},saved as unknown as SavedPlanVersion)
 expect(shown.tasks[0].quantity.planned).toBe(2)
})

it('T05b saved two is not silently lowered when supply later falls to one', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED,tr('x1',13)],1,{savedTransfer:{[T]:2}})
 expect(p.stage).toBe('transfer')
 expect(p.quantity.planned).toBe(2)
 expect(p.unresolved).toContain('transfer_shortage')
})

it('T03b next link skips a sibling item from the already used passage', () => {
 const row=Object.assign(tr('x1',13),{passageKey:'shared'})
 const p=build(asIs({attempts:VERIFIED}),[FIXED,row],3,undefined,{x1:'shared',x2:'shared',x3:'other'})
 expect(p.quantity).toMatchObject({available:2,planned:2,done:1,unit:'지문'})
 expect(p.next?.href).toContain('x3')
})
it('T05c consumed sole passage blocks Workspace fallback to CHECK', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED,tr('x1',13)],1)
 expect(p.next).toBeNull()
 const w={id:'ws.central-meaning',core:[T],support:[],name:'n',goal:'g',readiness:'live',next:{href:'/csat/item/i3',label:'CHECK'},stages:{}}
 const rows=workspaceRows({plan:{primary:w,others:[],preparing:[]},plans:{[w.id]:{tasks:[p],progress:{done:1,planned:2}}}} as unknown as Parameters<typeof workspaceRows>[0])
 expect(rows[0].stage).toBe('transfer')
 expect(rows[0].next).toBeNull()
 expect(rows[0].state).toBe('locked')
})

describe('Persistent transfer policy belongs to the core Workspace', () => {
 const transferPolicy=(template:string,history:SavedPlanVersion[])=>savedTransferOf({v4:{saved:{status:'installed',byTemplate:{[template]:{template,latest:history.at(-1),history}}}}} as unknown as Parameters<typeof savedTransferOf>[0])
 const version=(v:number,stage:'transfer'|'recheck'|'repair',planned:number,reason:PlanReason='learner_adjust',restoredFrom:number|null=null):SavedPlanVersion=>({version:v,plan:{order:[T],tasks:[{task:T,stage,planned,available:3,rule:'transfer_pool'}]},reason,restoredFrom,note:null,canon:'rev4.0',asOf:NOW,createdAt:NOW})
 it('later CHECK saves preserve prior explicit transfer1; explicit restore recovers2',()=>{
  expect(transferPolicy('ws.central-meaning',[version(1,'transfer',2),version(2,'transfer',1),version(3,'recheck',2)])[T]).toBe(1)
  expect(transferPolicy('ws.central-meaning',[version(1,'transfer',2),version(2,'transfer',1),version(3,'recheck',2,'restore',1)])[T]).toBe(2)
  expect(transferPolicy('ws.central-meaning',[version(1,'transfer',1),version(2,'recheck',2),version(3,'transfer',2),version(4,'transfer',2,'restore',2)])[T]).toBe(1)
 })
 it('R5 as support in E3 Workspace cannot override its core Workspace policy',()=>{
  const saved={v4:{saved:{status:'installed',byTemplate:{
   'ws.central-meaning':{template:'ws.central-meaning',latest:version(2,'transfer',1),history:[]},
   'ws.option-match':{template:'ws.option-match',latest:version(1,'transfer',2),history:[]}
  }}}} as unknown as Parameters<typeof savedTransferOf>[0]
  expect(savedTransferOf(saved)[T]).toBe(1)
 })
})

it('T11 restore replay policy outranks the rebuilt TRANSFER allocation payload', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED],3,{savedTransfer:{[T]:2}})
 const restored={plan:{order:[T],tasks:[{task:T,stage:'transfer',planned:1}]}}
 const shown=applySaved({workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null},restored as unknown as SavedPlanVersion)
 expect(shown.tasks[0].quantity.planned).toBe(2)
})

it('supporting TRANSFER quantities cannot pretend to override the core operating policy', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED],3,undefined,undefined,true)
 expect(p.quantity.adjustable).toBe(false)
 const shown=applyDraft({workspace:'ws.option-match',core:[],tasks:[p],progress:null},{order:[T],planned:{[T]:1}})
 expect(shown.tasks[0].quantity.planned).toBe(2)
})

it('server rejects supporting TRANSFER overrides and accepts a read-only reference', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED],3,undefined,undefined,true)
 const view={workspace:'ws.option-match',core:['e.option_correspondence'],tasks:[p],progress:null}
 const req={template:'ws.option-match',order:['e.option_correspondence','v.semantic_relation',T],planned:{[T]:1},reason:'initial',expectedVersion:0,clientKey:'00000000-0000-4000-8000-000000000001'} as PlanCommitRequest
 expect(buildCommitPayload(req,view,NOW)).toMatchObject({ok:false,code:'planned_not_owned'})
 expect(buildCommitPayload({...req,planned:{[T]:null}},view,NOW)).toMatchObject({ok:true,plan:{tasks:expect.arrayContaining([expect.objectContaining({task:T,planned:null})])}})
})

it('restore of CHECK allocation still checks the inherited transfer2 policy against available1', () => {
 const p=Object.assign(build(asIs({attempts:VERIFIED}),[FIXED,tr('x1',13)],1,{savedTransfer:{[T]:1}}),{transferAvailable:1})
 const view={workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null,restoreTransfer:{7:{[T]:2}}}
 const req={template:'ws.central-meaning',order:[T,'r.discourse_function','r.discourse_structure'],planned:{[T]:2},reason:'restore',restoreOf:7,expectedVersion:9,clientKey:'00000000-0000-4000-8000-000000000001'} as PlanCommitRequest
 expect(p.stage).toBe('recheck')
 expect(buildCommitPayload(req,view,NOW)).toMatchObject({ok:false,code:'transfer_restore_shortage'})
 expect(buildCommitPayload(req,{...view,tasks:[{...p,transferAvailable:2}]},NOW)).toMatchObject({ok:true})
 expect(buildCommitPayload(req,{...view,tasks:[{...p,achievement:'resolved',transferAvailable:0}]},NOW)).toMatchObject({ok:true})
})
it('TRANSFER zero is rejected rather than saved then silently discarded by replay', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED])
 const view={workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null}
 const req={template:'ws.central-meaning',order:[T,'r.discourse_function','r.discourse_structure'],planned:{[T]:0},reason:'learner_adjust',expectedVersion:1,clientKey:'00000000-0000-4000-8000-000000000001'} as PlanCommitRequest
 expect(buildCommitPayload(req,view,NOW)).toMatchObject({ok:false,code:'planned_min'})
 expect(applyDraft(view,{order:[T],planned:{[T]:0}}).tasks[0].quantity.planned).toBeGreaterThanOrEqual(1)
})

it('restoring inherited transfer2 never records a new TRANSFER allocation1', () => {
 const p=Object.assign(build(asIs({attempts:VERIFIED}),[FIXED],3,{savedTransfer:{[T]:1}}),{transferAvailable:2})
 const view={workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null,restoreTransfer:{7:{[T]:2}}}
 const req={template:'ws.central-meaning',order:[T,'r.discourse_function','r.discourse_structure'],planned:{[T]:1},reason:'restore',restoreOf:7,expectedVersion:9,clientKey:'00000000-0000-4000-8000-000000000001'} as PlanCommitRequest
 expect(buildCommitPayload(req,view,NOW)).toMatchObject({ok:false,code:'restore_transfer_policy'})
 expect(buildCommitPayload({...req,planned:{[T]:2}},view,NOW)).toMatchObject({ok:true})
})

it('a REPAIR quantity draft never becomes a TRANSFER quantity after activity returns', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED])
 const view={workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null}
 const draft={order:[T],planned:{[T]:1},stages:{[T]:'repair'}}
 expect(applyDraft(view,draft).tasks[0].quantity.planned).toBe(2)
})
it('a stage change is a replan reason even when availability stays at two', () => {
 const p=build(asIs({attempts:VERIFIED}),[FIXED])
 const view={workspace:'ws.central-meaning',core:[T],tasks:[p],progress:null}
 const saved={canon:'rev4.0',plan:{order:[T],tasks:[{task:T,stage:'repair',planned:5,available:5}]}} as SavedPlanVersion
 expect(planDrift(saved,view)).toMatchObject({stages:[T],content:[],overAvailable:[]})
})
