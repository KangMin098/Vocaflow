// verification/reviews/T-0067-r1-independent/probe.test.ts
import {describe,it,expect,vi,beforeEach} from 'vitest'
const h=vi.hoisted(()=>({index:0,rows:[] as unknown[],messages:[] as unknown[],outcomes:[] as unknown[]}))
vi.mock('react',async importOriginal=>({...(await importOriginal<typeof import('react')>()),
 useEffect:()=>{},useCallback:(f:unknown)=>f,useState:()=>{
  const n=h.index++
  return n===0?[{status:'installed',rows:h.rows},()=>{}]:n===1?[false,()=>{}]:n===2?[null,(s:unknown)=>h.messages.push(s)]:[null,(s:unknown)=>h.outcomes.push(s)]
 }}))
import {AuthoredSupplyCard,supplyOutcome,type SupplyOutcome} from '@/components/csat/diagnosis/map/AuthoredSupplyCard'
function nodes(node:any):any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
 if(!node||typeof node!=='object')return []
 if(Array.isArray(node))return node.flatMap(nodes)
 return [node,...nodes(node.props?.children)]
}
const tree=()=>{h.index=0;return AuthoredSupplyCard({task:'e.task_demand',template:'ws.evidence-locate',planSaved:true,past:false})}
const req=async(body:unknown,status=200)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:status<400,status,json:async()=>body}).mockResolvedValueOnce({ok:true,json:async()=>({status:'installed',rows:[]})}))
 await nodes(tree()).find(x=>x.props?.['data-testid']==='ws-authored-request').props.onClick()
}
const line=(extra:Record<string,unknown>={})=>({role:'transfer',requested:2,delivered:[],rejected:[],orderOpened:false,...extra})
beforeEach(()=>{h.index=0;h.rows=[];h.messages=[];h.outcomes=[];vi.unstubAllGlobals()})
describe('Original T0067 issue rechecked semantically through actual handler',()=>{
 for(const delivered of [[],['authored:td-transfer-1']])it(`unconfirmed order delivered${delivered.length} remains unconfirmed`,async()=>{
  await req({status:'ok',lines:[line({delivered})]})
  const o=h.outcomes.at(-1) as SupplyOutcome
  expect(o).toBeTruthy();expect(o.retry).toBe(true)
  expect(o.lines[0].kind).toBe(delivered.length?'partial':'none')
  expect(o.lines[0].text).toContain('접수됐는지 확인하지 못했어요')
  expect(o.lines[0].text).not.toContain('요청을 접수했어요')
 })
 it('control: confirmed order has confirmed receipt, no invented completion',async()=>{
  await req({status:'ok',lines:[line({orderOpened:true})]})
  const o=h.outcomes.at(-1) as SupplyOutcome
  expect(o.retry).toBe(false);expect(o.lines[0].text).toContain('제작 요청을 접수했어요')
  expect(o.lines[0].text).toContain('완료 시각은 정해지지 않았어요')
 })
 it('mixed roles retain distinct result and retry for the unconfirmed one',()=>{
  const o=supplyOutcome({lines:[line({role:'guided_practice',requested:1,delivered:['g']}),line({orderOpened:true}),line({role:'delayed_check'})]})
  expect(o.lines.map(x=>x.kind)).toEqual(['full','none','none']);expect(o.retry).toBe(true)
 })
 it('malformed response explicitly unknown with retry',async()=>{
  await req({status:'ok'})
  expect(h.outcomes.at(-1)).toMatchObject({unknown:true,retry:true})
 })
})
describe('Current eligibility display boundary',()=>{
 for(const [label,current,attempted,wantLink] of [['valid',true,false,true],['revoked',false,false,false],['unknown',null,false,false],['missing',undefined,false,false],['history',false,true,true]] as const)it(`${label}: active link only with verified eligibility or prior history`,()=>{
  h.rows=[{ref:'authored:td-ind-1',deliveryId:'delivery-0001',role:'independent_check',deliveredAt:'2026-10-20T00:00:00Z',attempted,evidence:null,...(current===undefined?{}:{current})}]
  const links=nodes(tree()).filter(n=>n.props?.href?.includes('/csat/learn/td-ind-1'))
  expect(links.length>0).toBe(wantLink)
 })
})
describe('Non-content error causes',()=>{
 it('not_installed503 must mean supply preparation, not an inferred Gold/rights shortage',async()=>{
  await req({code:'not_installed',error:'자료 공급이 아직 준비되지 않았어요'},503)
  expect(String(h.messages.at(-1))).not.toMatch(/검수|승인|권리|Gold/)
 })
})
