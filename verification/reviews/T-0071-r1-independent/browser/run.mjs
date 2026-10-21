// verification/reviews/T-0071-r1-independent/browser/run.mjs
// Local actual React+Chromium component protocol; mocked GET only, no auth Next/DB or full visual acceptance.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const dir=path.dirname(fileURLToPath(import.meta.url))
const wt='D:/workspace/Vocaflow-final-product'
const req=createRequire(`${wt}/apps/web/package.json`)
const vite=createRequire(req.resolve('vitest/package.json'))('vite')
const {chromium}=req('@playwright/test')
const d='11111111-1111-4111-8111-111111111111',d2='22222222-2222-4222-8222-222222222222'
const row={ref:'authored:opt-guided-1',deliveryId:d,role:'guided_practice',current:true}
const record={ok:true,record:{version:1,reasoningNotes:[{id:'n1',item:row.ref,authored:{deliveryId:d,annotationHash:'h'},statement:'SYNTHETIC_NOTE_A',grounds:'g',applicability:'a',limit:'l',at:1,updatedAt:1,pairIds:[],binding:{analysisVersion:null},evidence:[],afterExplanation:true,comparedWithModel:false}]}}
const server=await vite.createServer({configFile:false,root:dir,logLevel:'error',esbuild:{jsx:'automatic'},resolve:{alias:[{find:'@',replacement:`${wt}/apps/web/src`},{find:'next/link',replacement:path.join(dir,'link.tsx')},{find:/^react$/,replacement:req.resolve('react')},{find:/^react\/jsx-runtime$/,replacement:req.resolve('react/jsx-runtime')},{find:/^react\/jsx-dev-runtime$/,replacement:req.resolve('react/jsx-dev-runtime')},{find:/^react-dom\/client$/,replacement:req.resolve('react-dom/client')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[dir,wt]}}})
const results=[]
let browser
try {
 await server.listen();const port=server.httpServer.address().port
 browser=await chromium.launch({headless:true})
 const setup=async(deferred=false)=>{
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const requests=[];const errors=[];let release
  const ready=new Promise(r=>release=r)
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/csat/state',async route=>{requests.push(route.request().method());if(deferred)await ready;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(record)})})
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'})
  await page.waitForSelector('[data-testid="ws-notes"] summary')
  return {page,requests,errors,release}
 }
 const open=async(p)=>{await p.locator('[data-testid="ws-notes"] summary').click();await p.waitForSelector('[data-testid="ws-notes-list"]')}
 const change=async(p,patch)=>{await p.evaluate(x=>window.change(x),patch);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
 {
  const x=await setup();const lazy=x.requests.length===0;await open(x.page)
  results.push({case:'lazy GET-only normal read',passed:lazy&&x.requests.join(',')==='GET'&&await x.page.locator('[data-testid="ws-notes-open"]').count()===1,requests:x.requests,errors:x.errors})
  await x.page.close()
 }
 {
  const x=await setup();await open(x.page);await change(x.page,{rows:[{...row,current:false}]})
  const links=await x.page.locator('[data-testid="ws-notes-open"]').count()
  results.push({case:'revocation metadata update removes learning link',passed:links===0,actual_links:links});await x.page.close()
 }
 {
  const x=await setup();await open(x.page);await change(x.page,{listed:'error'})
  const unknown=await x.page.locator('[data-testid="ws-notes-unknown"]').count()
  results.push({case:'delivery read failure invalidates current links',passed:unknown===1&&await x.page.locator('[data-testid="ws-notes-open"]').count()===0,unknown,actual_links:await x.page.locator('[data-testid="ws-notes-open"]').count()});await x.page.close()
 }
 {
  const x=await setup();await open(x.page);await change(x.page,{viewer:'B',rows:[{...row,deliveryId:d2}]})
  const previous=await x.page.getByText('SYNTHETIC_NOTE_A',{exact:true}).count()
  results.push({case:'same-TASK changed viewer/delivery cannot retain prior scope note',passed:previous===0,prior_scope_note_visible:previous===1});await x.page.close()
 }
 {
  const x=await setup(true);await x.page.locator('[data-testid="ws-notes"] summary').click();await x.page.waitForSelector('[data-testid="ws-notes"]');await x.page.waitForFunction(()=>document.body.textContent.includes('불러오는 중'))
  await change(x.page,{viewer:'B',rows:[{...row,deliveryId:d2}]});x.release();await x.page.waitForSelector('[data-testid="ws-notes-list"]')
  const previous=await x.page.getByText('SYNTHETIC_NOTE_A',{exact:true}).count()
  results.push({case:'late state response after delivery scope change discarded',passed:previous===0,prior_scope_note_visible:previous===1});await x.page.close()
 }
 {
  const x=await setup(true);await x.page.locator('[data-testid="ws-notes"] summary').click();await x.page.waitForFunction(()=>document.body.textContent.includes('불러오는 중'))
  await change(x.page,{task:'r.central_meaning',rows:[{...row,deliveryId:d2}]});x.release();await x.page.waitForLoadState('networkidle')
  const previous=await x.page.getByText('SYNTHETIC_NOTE_A',{exact:true}).count()
  results.push({case:'control TASK-key remount discards prior response',passed:previous===0,prior_scope_note_visible:previous===1});await x.page.close()
 }
} finally {
 if(browser)await browser.close()
 await server.close()
 const report={head:'f573e31240eb6ea51f87cf090be46b35a86e9aeb',environment:'actual Chromium + actual React component; next/link shim; mocked GET; no actual accounts/Next/DB/full visual evidence',results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length}
 fs.writeFileSync(path.join(dir,'../browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}
