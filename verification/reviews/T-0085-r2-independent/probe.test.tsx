import fs from 'node:fs'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,expect,it,vi} from 'vitest'
import {opsSummary} from 'D:/workspace/Vocaflow-final-product/apps/web/src/lib/knowledge/vnext-rules'
let trials: unknown[]=[]
let readError=false
vi.mock('@/lib/auth/require-admin',()=>({requireAdmin:async()=>({id:'fixture-admin'})}))
vi.mock('@/components/admin/AdminScreenHelp',()=>({AdminScreenHelp:()=>null}))
vi.mock('@/components/admin/knowledge/VnextForms',()=>({ApplicationForm:()=>null,TrialForm:()=>null,ApplicationStatusForm:()=>null}))
vi.mock('@/lib/knowledge/server',()=>({listItems:async()=>[],listLinks:async()=>[]}))
vi.mock('@/lib/knowledge/vnext-server',()=>({listApplications:async()=>{if(readError)throw new Error('fixture unreadable');return [{id:'a',itemId:'i',surface:'item_screen',surfaceRef:'fixture',version:1,status:'active',statusReason:null,releasedAt:null,trials,attempts:{real:0,synthetic:0}}]}}))
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

it('export actual RSC mixed, empty and unreadable fixtures for Chromium',async()=>{
 for(const [screen,Page] of [['design',Design],['product',Product]] as const){
  for(const state of ['mixed','empty','error']){
   readError=state==='error';trials=state==='mixed'?[base,{...base,id:'stale',reviewRequiredAt:'2026-10-22T00:00:00Z'},{...base,id:'synthetic',synthetic:true},{...base,id:'unknown',synthetic:null}]:[]
   const html=renderToStaticMarkup(await Page())
   fs.writeFileSync('D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0085-r2-independent/browser/'+screen+'-'+state+'.html','<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/skin.js"></script></head><body data-area="admin">'+html+'</body></html>')
   if(state==='error')expect(html).toContain('불러오지 못했습니다')
  }
 } readError=false
})
