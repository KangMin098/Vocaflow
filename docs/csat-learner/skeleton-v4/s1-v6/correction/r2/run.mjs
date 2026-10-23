// docs/csat-learner/skeleton-v4/s1-v6/correction/r2/run.mjs
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {projectSamples,projectLectures,displayContext,CANDIDATE_LABEL,HELD_LABEL,LECTURE_LABEL} from './content-policy.mjs'
import {meaningsForChoice,choicesForMeaning,qualificationRecords} from '../../selection/model.mjs'
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),wt=path.resolve(dir,'../../../../..')
const arg=n=>{const i=process.argv.indexOf(n);assert.ok(i>=0,n);return process.argv[i+1]}
const runtime=arg('--runtime-root'),evidence=path.resolve(arg('--evidence-root')),attempt=arg('--attempt')
assert.match(attempt,/^run-\d\d$/u)
const out=path.join(evidence,'r2',attempt);assert.ok(!fs.existsSync(out),'preserve earlier runs');fs.mkdirSync(out,{recursive:true})
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),digest=p=>hash(fs.readFileSync(p)),read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const proposal=read(dir+'/C1_CANDIDATE.json'),binding=read(dir+'/SOURCE_BINDINGS.json'),baseline='9e73d7660bfaa03f4bb73320275525137df92df9'
const originalSamples=read(runtime+'/tmp/csat-item-review-20261023/samples.json'),originalLectures=read(wt+'/apps/web/src/lib/csat/lecture-data/2026.json')
const immutable=['C1_CANDIDATE.json','SOURCE_BINDINGS.json','RESULTS.json','MANIFEST.json']
const hashes=Object.fromEntries(immutable.map(f=>[f,digest(dir+'/'+f)]))
for(const[f,h]of Object.entries(hashes))assert.equal(hash(execFileSync('git',['-C',wt,'show',`${baseline}:docs/csat-learner/skeleton-v4/s1-v6/correction/${f}`],{maxBuffer:20e6})),h)
const pages=Object.fromEntries(Object.entries(binding.questionPages).map(([id,n])=>[id,'data:image/png;base64,'+fs.readFileSync(evidence+`/official-page-${n}.png`).toString('base64')]))
const old=path.join(dir,'../goal-fit/compare.mjs'),manifest=read(path.join(dir,'../goal-fit/MANIFEST.json'));assert.equal(digest(old),manifest.harness.sha256)
async function isolate(audience){
 let prefix=fs.readFileSync(old,'utf8').split('\ntry{')[0].replace(/^import .*\r?\n/gm,'').replace('const dir=path.dirname(fileURLToPath(import.meta.url))',`const dir=${JSON.stringify(dir)}`)
 const point=" p.onResolve({filter:/^review-(samples|lectures)$/}"
 assert.ok(prefix.includes(point))
 prefix=prefix.replace(point,` p.onResolve({filter:/^review-source-pages$/},a=>({path:a.path,namespace:'source-pages'}))\n p.onLoad({filter:/.*/,namespace:'source-pages'},()=>({contents:${JSON.stringify('export default '+JSON.stringify(pages))},loader:'js'}))\n`+point)
 const oldLoad="contents:fs.readFileSync(a.path==='review-samples'?samplePath:lecturePath,'utf8')"
 assert.ok(prefix.includes(oldLoad));prefix=prefix.replace(oldLoad,"contents:JSON.stringify(a.path==='review-samples'?projectSamples(samples,audience,proposal):projectLectures(lectures,audience))")
 const html='<script>localStorage.setItem("csat-rail","closed")</script>'
 const context=JSON.stringify(displayContext(audience,proposal,binding)).replaceAll('<','\\u003c')
 assert.ok(prefix.includes(html));prefix=prefix.replace(html,html+`<script>window.__displayContext=${context}</script>`)
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
 return new AsyncFunction('fs','path','http','crypto','assert','createRequire','execFileSync','audience','proposal','projectSamples','projectLectures',prefix+'\nreturn {browser,server,base};')(fs,path,http,crypto,assert,createRequire,execFileSync,audience,proposal,projectSamples,projectLectures)
}
const cases=[],captures=[],errors=[],network=[],assertions=[]
let failure=null
const checked=(row,name,fn)=>Promise.resolve().then(fn).then(()=>{row.checks.push({name,result:'PASS'});assertions.push({case:row.id,name,result:'PASS'})},e=>{row.checks.push({name,result:'FAIL',error:e.message});throw e})
async function capture(page,row,stage){const f=path.join(out,`${row.id}-${stage}.png`);await page.screenshot({path:f,animations:'disabled'});captures.push({path:f,sha256:digest(f),case:row.id,stage})}
try{
 for(const audience of ['learner','review']){
  const iso=await isolate(audience);let context
  try{
   context=await iso.browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})
   await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'||u.origin!==iso.base||u.pathname.startsWith('/api/')){network.push({method:q.method(),path:u.pathname});return r.abort()}return r.continue()})
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
   for(const width of [1280,1440])for(const item of audience==='learner'?['2026-34','2026-22','2026-38']:['2026-38'])for(const layout of ['IMPROVE','REPLACE']){
    const row={id:`${audience}-${item}-${layout.toLowerCase()}-${width}`,audience,item,layout,width,checks:[],result:'RUNNING'};cases.push(row)
    try{
     await page.setViewportSize({width,height:1000});await page.goto(`${iso.base}/?item=${item}&layout=${layout}`,{waitUntil:'domcontentloaded'});await page.getByTestId('selection-root').waitFor();await page.waitForFunction(()=>!!window.__selection?.getState)
     assert.equal(await page.getByTestId('selection-root').getAttribute('data-audience'),audience)
     await checked(row,'ordinary payload excludes proposal and held38 lecture; review is explicitly separate',async()=>{
      const projected=projectSamples(originalSamples,audience,proposal),ctx=await page.evaluate(()=>window.__displayContext)
      if(audience==='learner'){assert.equal(ctx.review,null);assert.ok(!JSON.stringify(projected).includes(proposal.payload.proposed.decisive));assert.equal(projectLectures(originalLectures,audience).lectures['2026#38'],undefined)}
      else{assert.equal(ctx.review.proposal.payloadSha256,proposal.payloadSha256);assert.equal(ctx.review.proposal.approval.status,'NOT_APPROVED')}
     })
     if(item!=='2026-38'){
      const sample=originalSamples.find(s=>s.currentSlug===item),v3=sample.inquiry.v3,primary=item==='2026-34'?1:3,peer=item==='2026-34'?3:1
      await checked(row,'accepted paired truth/fit and qualifier sources preserved',async()=>{for(const n of [primary,peer]){const c=v3.choices.find(c=>c.n===n);assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-truth]').getAttribute('data-truth'),c.content_truth);assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-fit]').getAttribute('data-fit'),c.requirement_fit)}for(const q of qualificationRecords(sample)){await page.getByTestId(`qual-${q.id}`).click();assert.ok((await page.getByTestId('qualification-text').innerText()).includes(q.text))}})
      await checked(row,'registered roundtrip and unregistered links remain distinct',async()=>{await page.getByTestId(`trace-${primary}`).click();await page.getByTestId(`reverse-choice-${primary}`).click();await page.getByTestId('scene-evidence').click();const m=v3.meanings.find(m=>!choicesForMeaning(v3,m.id).includes(primary));await page.getByTestId(`meaning-${m.id}`).click();assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'UNREGISTERED');assert.equal(await page.getByTestId(`reverse-choice-${primary}`).count(),0);await page.getByTestId('forward').click()})
      await checked(row,'condition comparison and player/viewer independence preserved',async()=>{await page.getByTestId('scene-principle').click();await page.getByTestId('boundary-condition-0').click();assert.ok((await page.getByTestId('boundary-text').innerText()).includes(v3.design.limitation));await page.getByTestId('play').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing');const view=()=>page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,pick:document.querySelector('main').dataset.pick,meaning:document.querySelector('main').dataset.meaning,scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')}));const before=await view();await page.evaluate(()=>window.__selection.advance());await page.waitForFunction(()=>document.querySelector('main').dataset.cue==='1');assert.deepEqual(await view(),before);await page.getByTestId('off').click()})
     }else if(audience==='learner'){
      await checked(row,'no proposed explanation, relation or archived lecture in ordinary DOM/AX',async()=>{assert.equal(await page.getByTestId('judgment-held-5').count(),1);assert.ok((await page.getByTestId('judgment-held-5').innerText()).includes(HELD_LABEL));assert.ok(await page.getByTestId('trace-5').isDisabled());assert.equal(await page.getByTestId('c1-review').count(),0);assert.equal(await page.getByTestId('cue-text').count(),0);for(const action of ['play','pause','resume','next'])assert.ok(await page.getByTestId(action).isDisabled());assert.ok(!(await page.locator('body').innerText()).includes(proposal.payload.proposed.decisive))})
      await checked(row,'held relationship is not mislabeled UNREGISTERED',async()=>{await page.getByTestId('pick-5').click();await page.getByTestId('scene-evidence').click();assert.equal(await page.getByTestId('relation-held-5').count(),1);assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'HELD_CONTENT_APPROVAL');assert.ok(await page.getByTestId('forward').isDisabled());assert.equal(await page.getByTestId('reverse-choice-5').count(),0)})
     }else{
      await checked(row,'candidate label and ARIA description are adjacent in judgment and original toggle',async()=>{const label=page.getByTestId('judgment-candidate-5-status');assert.equal(await label.innerText(),CANDIDATE_LABEL);assert.ok((await label.locator('..').innerText()).includes(proposal.payload.proposed.decisive));assert.equal(await label.locator('..').getAttribute('aria-labelledby'),'judgment-candidate-5-status');assert.equal(await label.locator('..').locator('[aria-describedby="judgment-candidate-5-status"]').count(),1);await page.getByTestId('judgment-original-toggle').click();assert.equal(await page.getByTestId('judgment-original-text').innerText(),proposal.payload.expected.decisive);assert.ok((await page.getByTestId('judgment-original-status').innerText()).includes('검수 전'))})
      await page.getByTestId('judgment-candidate-5-status').scrollIntoViewIfNeeded();await capture(page,row,'candidate-judgment')
      await checked(row,'candidate relationship display and accessible link names carry same status',async()=>{await page.getByTestId('pick-5').click();await page.getByTestId('scene-evidence').click();assert.equal(await page.getByTestId('relation-candidate-5-status').innerText(),CANDIDATE_LABEL);await page.getByTestId('forward').click();await page.getByTestId('meaning-m3').click();assert.ok((await page.getByTestId('reverse-choice-5').getAttribute('aria-label')).includes(CANDIDATE_LABEL));assert.ok((await page.getByTestId('reverse-choice-5').innerText()).includes('검수 전'));assert.ok((await page.getByTestId('relation-text-5').innerText()).includes('4~5번'));assert.ok((await page.getByTestId('relation-text-5').innerText()).includes('6~7번 사례만을 유일한 지시 대상으로 한정하지 않는다'))})
      await page.getByTestId('relation-candidate-5-status').scrollIntoViewIfNeeded();await capture(page,row,'candidate-relation')
      await checked(row,'every original38 cue display remains marked pending review, not approved narration',async()=>{const script=originalLectures.lectures['2026#38'];await page.getByTestId('play').click();for(let i=0;i<script.cues.length;i++){await page.waitForFunction(i=>document.querySelector('main').dataset.cue===String(i),i);assert.equal(await page.getByTestId('lecture-content-status').innerText(),LECTURE_LABEL);assert.equal(await page.getByTestId('cue-text').innerText(),script.cues[i].segments.map(s=>s.text).join(' '));if(i<script.cues.length-1)await page.evaluate(()=>window.__selection.advance())}await page.getByTestId('media-SILENT').click();assert.equal(await page.getByTestId('cue-text').count(),0);await page.getByTestId('media-READ').click();await page.getByTestId('lecture-content-status').scrollIntoViewIfNeeded();await capture(page,row,'lecture-status');await page.getByTestId('off').click()})
     }
     const ax=await page.locator('body').ariaSnapshot();if(audience==='learner')assert.ok(!ax.includes(proposal.payload.proposed.decisive));else assert.ok(ax.includes(CANDIDATE_LABEL))
     const axPath=path.join(out,row.id+'-aria.txt');fs.writeFileSync(axPath,ax);row.aria={path:axPath,sha256:digest(axPath),scope:'DOM accessible roles/names only; not screen reader execution'}
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1);row.documentOverflow=overflow
     await capture(page,row,'final');row.result='PASS'
    }catch(e){row.result='FAIL';row.error=e.message;await capture(page,row,'failure');throw e}
   }
  }finally{await context?.close();await iso.browser.close();await new Promise(r=>iso.server.close(r))}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[])
}catch(e){failure=e.message;console.error(e.stack)}
for(const[f,h]of Object.entries(hashes))assert.equal(digest(dir+'/'+f),h,f)
const report={task:'T-0136',runSeq:2,baseCommit:baseline,observedAt:new Date().toISOString(),cases,captures,assertions,errors,network,failure,immutableR1Hashes:hashes,approvals:{displayContractA:'AUTHOR_VERIFIED_PENDING_CLAUDE',contentApprovalB:'NOT_APPROVED'},unverified:['full color contrast','whole keyboard traversal','screen reader','normal auth/RLS','real local PDF','real TTS','learner effect'],notAuthorized:['product implementation','main integration','S2 full implementation','DB/original mutation']}
fs.writeFileSync(path.join(out,'EXECUTION.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(dir,'r2/RESULTS.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({task:'T-0136',runSeq:2,cases:cases.length,pass:cases.filter(c=>c.result==='PASS').length,fail:cases.filter(c=>c.result==='FAIL').length,assertions:assertions.length,captures:captures.length,failure,execution:path.join(out,'EXECUTION.json')}))
if(failure)process.exitCode=1
