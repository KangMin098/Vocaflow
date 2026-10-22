import fs from 'node:fs'
const base='verification/reviews/T-0085-r2-independent'
fs.mkdirSync(base+'/browser',{recursive:true})
let test=fs.readFileSync('verification/reviews/T-0085-r1-independent/probe.test.tsx','utf8')
test="import fs from 'node:fs'\n"+test
test=test.replace('let trials: unknown[]=[]','let trials: unknown[]=[]\nlet readError=false')
test=test.replace("listApplications:async()=>[{id:","listApplications:async()=>{if(readError)throw new Error('fixture unreadable');return [{id:")
test=test.replace('attempts:{real:0,synthetic:0}}]}))','attempts:{real:0,synthetic:0}}]}}))')
test+=`\nit('export actual RSC mixed, empty and unreadable fixtures for Chromium',async()=>{
 for(const [screen,Page] of [['design',Design],['product',Product]] as const){
  for(const state of ['mixed','empty','error']){
   readError=state==='error';trials=state==='mixed'?[base,{...base,id:'stale',reviewRequiredAt:'2026-10-22T00:00:00Z'},{...base,id:'synthetic',synthetic:true},{...base,id:'unknown',synthetic:null}]:[]
   const html=renderToStaticMarkup(await Page())
   fs.writeFileSync('D:/workspace/Vocaflow-AI-Control/${base}/browser/'+screen+'-'+state+'.html','<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/skin.js"></script></head><body data-area="admin">'+html+'</body></html>')
   if(state==='error')expect(html).toContain('불러오지 못했습니다')
  }
 } readError=false
})\n`
fs.writeFileSync(base+'/probe.test.tsx',test)
let config=fs.readFileSync('verification/reviews/T-0085-r1-independent/vitest.config.mjs','utf8').replaceAll('T-0085-r1-independent','T-0085-r2-independent')
fs.writeFileSync(base+'/vitest.config.mjs',config)
fs.writeFileSync(base+'/browser/skin.js',"import 'D:/workspace/Vocaflow-final-product/apps/web/src/app/globals.css'\n")
