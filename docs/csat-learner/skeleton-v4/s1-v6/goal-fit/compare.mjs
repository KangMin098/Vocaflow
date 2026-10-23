// docs/csat-learner/skeleton-v4/s1-v6/goal-fit/compare.mjs
// Existing csat-theater-review-browser harness isolation, same source components and saved samples.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const dir=path.dirname(fileURLToPath(import.meta.url))
const wt=path.resolve(dir,'../../../../..')
const arg=n=>process.argv[process.argv.indexOf(n)+1]
if(!process.argv.includes('--runtime-root'))throw Error('Usage: node goal-fit/compare.mjs --runtime-root D:/workspace/Vocaflow-main-serving')
const runtime=path.resolve(arg('--runtime-root'))
const require=createRequire(path.join(runtime,'apps/web/package.json'))
const {chromium}=require('@playwright/test')
const {build}=createRequire(require.resolve('vitest/package.json'))('esbuild')
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const samplePath=path.join(runtime,'tmp/csat-item-review-20261023/samples.json')
const lecturePath=path.join(wt,'apps/web/src/lib/csat/lecture-data/2026.json')
const samples=JSON.parse(fs.readFileSync(samplePath,'utf8'))
const lectures=JSON.parse(fs.readFileSync(lecturePath,'utf8'))
const originalPaths=['apps/web/src/lib/csat/inquiry-data.json','apps/web/src/lib/csat/lecture-data/2026.json','apps/web/src/components/csat/theater/AnalysisTheater.tsx','apps/web/src/components/csat/theater/InquiryV3Panels.tsx','apps/web/src/components/csat/lecture/LectureStage.tsx']
const originalHashes=Object.fromEntries(originalPaths.map(p=>[p,hash(path.join(wt,p))]))
const built=await build({entryPoints:[path.join(dir,'fixture.tsx')],bundle:true,write:false,metafile:true,outdir:path.join(dir,'.build-not-written'),platform:'browser',format:'iife',jsx:'automatic',tsconfig:path.join(wt,'apps/web/tsconfig.json'),nodePaths:[path.join(runtime,'apps/web/node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'existing-review-isolation',setup(p){
 p.onResolve({filter:/^review-(samples|lectures)$/},a=>({path:a.path,namespace:'fixture'}))
 p.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fs.readFileSync(a.path==='review-samples'?samplePath:lecturePath,'utf8'),loader:'json'}))
 p.onResolve({filter:/^(next\/(link|navigation)|@\/lib\/(supabase\/client|analytics\/client|csat\/session\/store))$/},a=>({path:a.path,namespace:'review'}))
 p.onLoad({filter:/.*/,namespace:'review'},a=>({loader:'jsx',resolveDir:path.join(runtime,'apps/web'),contents:
 a.path==='next/link'?'import React from "react";export default function Link({children,onClick,...props}){return <a {...props} onClick={e=>{e.preventDefault();onClick?.(e)}}>{children}</a>}':
 a.path==='next/navigation'?'export function useRouter(){return{refresh(){},push(){},replace(){}}}':
 a.path.includes('supabase')?'export function createClient(){return{auth:{getUser:async()=>({data:{user:null}})}}}':
 a.path.includes('analytics')?'export function track(){}':
 'import{emptyDissectionRecord}from"@/lib/csat/dissect";let r=emptyDissectionRecord(23);export async function loadSyncedDissectionRecord(){return{record:r,synced:false}}export async function updateDissectionRecord(fn){r=fn(r);return{record:r,saved:true}}export async function loadPaper(){return null}export async function savePaper(){}export async function cachedExamIds(){return[]}export async function loadRecord(){return null}export async function saveRecord(){}'}))
 p.onResolve({filter:/^@\//},a=>p.resolve('./src/'+a.path.slice(2),{kind:a.kind,resolveDir:path.join(wt,'apps/web')}))
}}]})
const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text
const css=fs.readFileSync(path.join(runtime,'apps/web/.next-dev/static/css/app/layout.css'),'utf8')+'\n'+fs.readFileSync(path.join(wt,'packages/design-tokens/src/skins/csat-app.css'),'utf8')+'\n'+built.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n')
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;res.setHeader('content-type',p==='/app.js'?'application/javascript':p==='/app.css'?'text/css':'text/html;charset=utf-8');res.end(p==='/app.js'?js:p==='/app.css'?css:'<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script>localStorage.setItem("csat-rail","closed")</script><script src="/app.js"></script></body></html>')})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch()
const results=[],errors=[],blocked=[],captures=[]
const out=path.join(dir,'evidence');fs.mkdirSync(out,{recursive:true})
try{
 for(const width of [1280,1440])for(const item of ['2026-34','2026-22','2026-38'])for(const variant of ['REUSE','IMPROVE','REPLACE','NEW']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'})
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(r.method()!=='GET'||u.origin!==base){blocked.push({method:r.method(),path:u.pathname});return route.abort()}if(u.pathname==='/api/csat/lecture'){const id=(u.searchParams.get('item')||'').replace(/-(\d+)$/,'#$1');return route.fulfill({status:lectures.lectures[id]?200:404,json:{ok:!!lectures.lectures[id],lecture:lectures.lectures[id]}})}if(u.pathname.startsWith('/api/'))return route.fulfill({status:404,json:{}});return route.continue()})
  const page=await context.newPage();page.on('pageerror',e=>errors.push({item,variant,width,error:e.message}));page.setDefaultTimeout(10000)
  await page.goto(`${base}/?item=${item}&variant=${variant}&lecture-silent=1`,{waitUntil:'networkidle'})
  const pick=item==='2026-38'?4:item==='2026-22'?3:2
  if(variant==='REUSE')await page.locator('[data-testid="dock-scene"][data-scene="judgment"]').click()
  if(['REUSE','IMPROVE'].includes(variant))await page.getByTestId('v3-judgment').locator(`button[data-choice="${pick}"]`).click()
  else await page.getByTestId(`pick-${pick}`).click()
  if(variant==='NEW')await page.getByTestId('connect').click()
  const judgment=variant==='REUSE'||variant==='IMPROVE'?page.getByTestId('v3-choice'):page.getByTestId(`axes-${pick}`)
  const text=await judgment.innerText()
  assert.ok(text.includes(item==='2026-38'?'참거짓':item==='2026-22'?'내용은 원문과 맞음':variant==='REUSE'||variant==='IMPROVE'?'원문만으로 확정 불가':'진위 미확정')||item==='2026-38'&&text.includes('참·거짓'),`${item}/${variant}: ${text}`)
  assert.ok(text.includes('충족하지 못함')||text.includes('불충족'))
  let controls='CURRENT_BASELINE_NOT_CHANGED',keyboard='CURRENT_NATIVE_BUTTONS',cueNavigation='NOT_TESTED_BASELINE',sceneControl='CURRENT_AUTOMATION_STATIC_VIOLATION'
  if(variant!=='REUSE'){
   assert.equal(await page.getByTestId('full-proposition').isDisabled(),true)
   assert.ok((await page.getByTestId('qualification').innerText()).includes(item==='2026-34'?'If':item==='2026-22'?'may':'4~7'))
   const evidenceButton=variant==='IMPROVE'?page.getByTestId('v3-evidence'):variant==='REPLACE'?page.getByTestId('trace-0'):page.getByTestId('trace-evidence')
   await evidenceButton.click();assert.ok((await page.getByTestId('selected-evidence').innerText()).includes('번 문장'))
   const scene=page.getByTestId('scene-principle');await scene.focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('fit-root').getAttribute('data-scene'),'principle')
   await page.getByTestId('scene-judgment').click()
   if(variant==='IMPROVE')assert.ok((await page.getByTestId('v3-choice').innerText()).includes(item==='2026-34'?'원문만으로 확정 불가':item==='2026-22'?'내용은 원문과 맞음':'참거짓'))
   await page.getByTestId('lecture-open').click();await page.getByTestId('media-READ').click()
   const before=await page.evaluate(()=>({scene:document.querySelector('[data-testid="fit-root"]').getAttribute('data-scene'),scroll:scrollY}))
   await page.getByTestId('cue-next').focus();await page.keyboard.press('Enter')
   const after=await page.evaluate(()=>({scene:document.querySelector('[data-testid="fit-root"]').getAttribute('data-scene'),scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')}))
   assert.equal(after.scene,before.scene);assert.equal(after.scroll,before.scroll);assert.equal(after.focus,'cue-next')
   assert.equal(await page.getByTestId('fit-root').getAttribute('data-cue'),'1')
   await page.getByTestId('media-SILENT').click();assert.equal(await page.getByTestId('cue-text').count(),0)
   await page.getByTestId('media-OFF').click();assert.equal(await page.getByTestId('fit-root').getAttribute('data-media'),'OFF')
   await page.getByTestId('lecture-open').click()
   if(variant==='NEW'&&await page.getByTestId('connect').getAttribute('aria-pressed')==='false')await page.getByTestId('connect').click()
   controls=await page.locator('.fit button').evaluateAll(bs=>bs.filter(b=>b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0).map(b=>({text:b.textContent.slice(0,25),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})))
   assert.ok(controls.every(b=>b.width>=44&&b.height>=44))
   keyboard='ENTER_SCENE_AND_CUE_PASS';cueNavigation='READ_SILENT_OFF_LOCAL_STATE_PASS_TTS_NOT_RUN';sceneControl='SCENE_SCROLL_FOCUS_PRESERVED'
  }
  if(variant==='REPLACE'){
   const peer=item==='2026-38'?5:item==='2026-22'?1:3
   await page.getByTestId(`pick-${peer}`).click()
   const headings=await page.locator('.compare article h3').allTextContents();assert.equal(new Set(headings).size,2,'switching to comparison peer must not compare a choice to itself')
   await page.getByTestId(`pick-${pick}`).click();await page.getByTestId(`compare-${peer}`).click()
  }
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,bodyHeight:document.body.scrollHeight,visibleQuestion:document.querySelector('h1')?.textContent,renderedPartialQuotes:[...document.querySelectorAll('.quote')].map(x=>x.textContent),localStorageKeys:Object.keys(localStorage)}))
  assert.ok(metrics.overflow<=1,`${item}/${variant}/${width} horizontal overflow ${metrics.overflow}`)
  const capture=item==='2026-34'||width===1440&&['REUSE','REPLACE'].includes(variant)
  if(capture){const f=`${item}-${variant.toLowerCase()}-${width}.png`;await page.screenshot({path:path.join(out,f)});captures.push({file:`evidence/${f}`,sha256:hash(path.join(out,f)),item,variant,width,reveal:'OFFICIAL_ANSWER',source:'preserved sample analysis only',pdf:false,normalAuth:false})}
  if(item==='2026-34'&&variant==='REPLACE'){
   await page.getByTestId('pick-1').click();await page.getByTestId('compare-3').click()
   assert.ok((await page.getByTestId('axes-1').innerText()).includes('내용이 원문과 다름'))
   assert.ok((await page.getByTestId('axes-3').innerText()).includes('발문 충족'))
   const f=`${item}-replace-pair-1-3-${width}.png`;await page.screenshot({path:path.join(out,f)});captures.push({file:`evidence/${f}`,sha256:hash(path.join(out,f)),item,variant,width,pair:[1,3],reveal:'OFFICIAL_ANSWER',source:'preserved analysis, not complete choice propositions',pdf:false,normalAuth:false})
   await page.getByTestId('pick-2').click()
  }
  results.push({item,variant,width,truthAndFit:'PASS',controls,keyboard,cueNavigation,sceneControl,metrics,actions:await page.evaluate(()=>window.__fitActions),scope:'isolated partial analysis; no auth, PDF, content or real media validation'})
  await context.close()
 }
}finally{await browser.close();await new Promise(r=>server.close(r))}
assert.deepEqual(errors,[])
for(const[p,h]of Object.entries(originalHashes))assert.equal(hash(path.join(wt,p)),h,`source modified: ${p}`)
const sourceFailures=samples.map(s=>({id:s.itemId,choices:s.inquiry.v3.choices.map(c=>({n:c.n,truth:c.content_truth,fit:c.requirement_fit,decisive:c.decisive,sentences:c.sentences})),distractors:s.inquiry.distractors.map(d=>({n:d.n,truth:d.truth,operation:d.operation,note:d.note})),pairs:s.v3Pairs.length}))
const report={observedAt:new Date().toISOString(),task:'T-0134',baseCommit:execFileSync('git',['-C',wt,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),stage:'DRAFT / NOT_ACCEPTED',evidenceLevel:'isolated interaction and static source only',samplePath,sampleSha256:hash(samplePath),sourceHashes:originalHashes,sourceFailures,results,errors,blocked,captures,unverified:['authenticated route and RLS','local PDF and complete choices','content validation','actual TTS and assessment audio','learner observation and effectiveness','all-type generality'],guard:'Only own loopback GET allowed; no app/DB writes; original files unchanged'}
fs.writeFileSync(path.join(dir,'BROWSER_RESULTS.json'),JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(path.join(dir,'MANIFEST.json'),JSON.stringify({sourceFiles:originalHashes,samples:{sha256:hash(samplePath),path:samplePath},harness:{file:'compare.mjs',sha256:hash(path.join(dir,'compare.mjs'))},fixture:{file:'fixture.tsx',sha256:hash(path.join(dir,'fixture.tsx'))},results:{file:'BROWSER_RESULTS.json',sha256:hash(path.join(dir,'BROWSER_RESULTS.json'))},captures},null,2)+'\n')
console.log(JSON.stringify({cases:results.length,captures:captures.length,errors,blocked:blocked.length,sourceUnchanged:true,stage:report.stage}))
