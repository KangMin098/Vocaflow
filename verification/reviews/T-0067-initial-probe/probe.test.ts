// verification/reviews/T-0067-initial-probe/probe.test.ts
import {describe,it,expect,vi,beforeEach} from 'vitest'
const h=vi.hoisted(()=>({index:0,messages:[] as unknown[]}))
vi.mock('react',async importOriginal=>({...(await importOriginal<typeof import('react')>()),
 useEffect:()=>{},useCallback:(f:unknown)=>f,useState:()=>{
  const n=h.index++
  return n===0?[{status:'installed',rows:[]},()=>{}]:n===1?[false,()=>{}]:[null,(s:unknown)=>h.messages.push(s)]
 }}))
import {AuthoredSupplyCard} from '@/components/csat/diagnosis/map/AuthoredSupplyCard'
function find(node:any):any { // eslint-disable-line @typescript-eslint/no-explicit-any
 if(!node||typeof node!=='object')return null
 if(node.props?.['data-testid']==='ws-authored-request')return node
 const children=node.props?.children
 for(const c of Array.isArray(children)?children:[children]){const r=Array.isArray(c)?c.map(find).find(Boolean):find(c);if(r)return r}
 return null
}
beforeEach(()=>{h.index=0;h.messages=[];vi.unstubAllGlobals()})
describe('T0067 actual card request-handler response truthfulness',()=>{
 for(const delivered of [[],['authored:td-transfer-1']])it(`does not claim request success when orderOpened=false;delivered=${delivered.length}`,async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,status:200,json:async()=>({status:'ok',lines:[{role:'transfer',requested:2,delivered,rejected:[{ref:'authored:td-transfer-2',reason:'human_decision'}],orderOpened:false}]})}).mockResolvedValueOnce({ok:true,json:async()=>({status:'installed',rows:[]})}))
  const tree=AuthoredSupplyCard({task:'e.task_demand',template:'ws.evidence-locate',planSaved:true,past:false})
  await find(tree).props.onClick()
  const msg=String(h.messages.at(-1))
  expect(msg).not.toContain('제작을 요청해 두었어요')
 })
 it('control: confirmed order may be described as requested',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,status:200,json:async()=>({status:'ok',lines:[{role:'transfer',requested:2,delivered:[],rejected:[],orderOpened:true}]})}).mockResolvedValueOnce({ok:true,json:async()=>({status:'installed',rows:[]})}))
  await find(AuthoredSupplyCard({task:'e.task_demand',template:'ws.evidence-locate',planSaved:true,past:false})).props.onClick()
  expect(String(h.messages.at(-1))).toContain('제작을 요청해 두었어요')
 })
})
