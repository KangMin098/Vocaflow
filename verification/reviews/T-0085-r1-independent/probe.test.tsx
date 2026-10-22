import {renderToStaticMarkup} from 'react-dom/server'
import {describe,expect,it,vi} from 'vitest'
import {opsSummary} from 'D:/workspace/Vocaflow-final-product/apps/web/src/lib/knowledge/vnext-rules'
let trials: unknown[]=[]
vi.mock('@/lib/auth/require-admin',()=>({requireAdmin:async()=>({id:'fixture-admin'})}))
vi.mock('@/components/admin/AdminScreenHelp',()=>({AdminScreenHelp:()=>null}))
vi.mock('@/components/admin/knowledge/VnextForms',()=>({ApplicationForm:()=>null,TrialForm:()=>null,ApplicationStatusForm:()=>null}))
vi.mock('@/lib/knowledge/server',()=>({listItems:async()=>[],listLinks:async()=>[]}))
vi.mock('@/lib/knowledge/vnext-server',()=>({listApplications:async()=>[{id:'a',itemId:'i',surface:'item_screen',surfaceRef:'fixture',version:1,status:'active',statusReason:null,releasedAt:null,trials,attempts:{real:0,synthetic:0}}]}))
import Design from 'D:/workspace/Vocaflow-final-product/apps/web/src/app/admin/knowledge/design/page'
import Product from 'D:/workspace/Vocaflow-final-product/apps/web/src/app/admin/knowledge/product/page'
const base={id:'trial',applicationId:'a',status:'analyzed',synthetic:false,reviewRequiredAt:null,result:'supported',design:{min_n:1,measures:['fixture']}}
const verify=(row:object)=>opsSummary({items:[],evidence:[],inquiries:[],applications:[{id:'a',itemId:'i',status:'active',surfaceRef:'fixture',statusReason:null,trials:[row]}],openGaps:0}).stages.find(s=>s.key==='verification')!
describe('original independent counterexamples and controls',()=>{
  it('stale is excluded',()=>expect(verify({...base,reviewRequiredAt:'2026-10-22T00:00:00Z'}).value).toBe(0))
  it('non-synthetic metadata does not assert actual learners',()=>expect(verify(base).note).not.toContain('실제 학습자'))
  it('synthetic is excluded',()=>expect(verify({...base,synthetic:true}).value).toBe(0))
  it('current non-synthetic inconclusive is descriptive analysis count1',()=>expect(verify({...base,result:'inconclusive'}).value).toBe(1))
})
for(const [label,over] of [['synthetic',{synthetic:true}],['unknown-review',{reviewRequiredAt:undefined}],['unknown-origin',{synthetic:null}]] as const){
  for(const [name,Page] of [['design',Design],['product',Product]] as const){
    it(`${name}: ${label} does not present an unqualified positive effect result`,async()=>{
      trials=[{...base,...over}]
      const html=renderToStaticMarkup(await Page())
      expect(html).not.toContain('효과 지지')
    })
  }
}
it('normal current supported result remains visible',async()=>{
  trials=[base]
  expect(renderToStaticMarkup(await Design())).toContain('효과 지지')
  expect(renderToStaticMarkup(await Product())).toContain('효과 지지')
})
it('normal stale result is suppressed with recalculation warning',async()=>{
  trials=[{...base,reviewRequiredAt:'2026-10-22T00:00:00Z'}]
  const html=renderToStaticMarkup(await Design())
  expect(html).toContain('재계산 필요')
  expect(html).not.toContain('효과 지지')
})
