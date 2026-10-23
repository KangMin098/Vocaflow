// docs/csat-learner/skeleton-v4/s1-v6/correction/run.mjs
// Same data, reveal, player state and tasks; only the F08 layout changes.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {choicesForMeaning,meaningsForChoice,qualificationRecords,reportedProposition,recommended} from '../selection/model.mjs'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(dir,'../../../../..')
const arg=name=>{const i=process.argv.indexOf(name);assert.ok(i>=0,`missing ${name}`);return process.argv[i+1]}
const runtime=arg('--runtime-root'),evidenceRoot=path.resolve(arg('--evidence-root')),attempt=arg('--attempt')
assert.ok(/^run-\d\d$/.test(attempt))
const out=path.join(evidenceRoot,attempt);assert.equal(fs.existsSync(out),false,'preserve earlier executions; use new attempt')
fs.mkdirSync(out,{recursive:true})
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),digest=p=>hash(fs.readFileSync(p))
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const binding=read(path.join(dir,'SOURCE_BINDINGS.json')),proposal=read(path.join(dir,'C1_CANDIDATE.json'))
assert.equal(digest(path.join(evidenceRoot,'official-2026-english.pdf')),binding.questionSha256)
assert.equal(digest(path.join(evidenceRoot,'official-2026-answers.pdf')),binding.answerSha256)
assert.equal(hash(JSON.stringify(proposal.payload)),proposal.payloadSha256)
const old=path.join(dir,'../goal-fit/compare.mjs'),oldManifest=read(path.join(dir,'../goal-fit/MANIFEST.json'))
assert.equal(digest(old),oldManifest.harness.sha256)
const baseline='a6e33d1d4580124fc1e7c1032cb21961abf4f989'
const preserved=execFileSync('git',['-C',wt,'ls-tree','-r','--name-only',baseline,'--','docs/csat-learner/skeleton-v4/s1-v6'],{encoding:'utf8'}).trim().split('\n').filter(p=>!p.endsWith('/README.md'))
const priorHashes=Object.fromEntries(preserved.map(p=>[p,digest(path.join(wt,p))]))
for(const[p,h]of Object.entries(priorHashes))assert.equal(hash(execFileSync('git',['-C',wt,'show',`${baseline}:${p}`],{maxBuffer:20e6})),h,p)
const pages=Object.fromEntries(Object.entries(binding.questionPages).map(([id,n])=>[id,'data:image/png;base64,'+fs.readFileSync(path.join(evidenceRoot,`official-page-${n}.png`)).toString('base64')]))
let prefix=fs.readFileSync(old,'utf8').split('\ntry{')[0].replace(/^import .*\r?\n/gm,'').replace('const dir=path.dirname(fileURLToPath(import.meta.url))',`const dir=${JSON.stringify(dir)}`)
const point=" p.onResolve({filter:/^review-(samples|lectures)$/}"
assert.ok(prefix.includes(point))
prefix=prefix.replace(point,` p.onResolve({filter:/^review-source-pages$/},a=>({path:a.path,namespace:'source-pages'}))\n p.onLoad({filter:/.*/,namespace:'source-pages'},()=>({contents:${JSON.stringify('export default '+JSON.stringify(pages))},loader:'js'}))\n`+point)
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
const setup=new AsyncFunction('fs','path','http','crypto','assert','createRequire','execFileSync',prefix+'\nreturn {browser,server,base,samples,lectures,originalHashes};')
const {browser,server,base,samples,lectures,originalHashes}=await setup(fs,path,http,crypto,assert,createRequire,execFileSync)
const results=[],captures=[],errors=[],network=[],actionLog=[]
const taskContract=['compare same two choices and truth/fit','inspect qualification sources','trace registered evidence and return','leave unregistered pair unlinked','select boundary condition and inspect limitation','open official static page and restore evidence','manually play actual engine and keep viewer independent','READ/SILENT/OFF and explicit restart','collapse/restore evidence without selection loss']
let context,unhandled
function record(kind,data={}){actionLog.push({kind,...data})}
async function saveShot(page,name,meta){const file=path.join(out,name);await page.screenshot({path:file,animations:'disabled'});captures.push({path:file,sha256:digest(file),...meta,storage:'local control evidence only; contains official question page; not in Git'})}
try{
 context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})
 await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'||u.origin!==base||u.pathname.startsWith('/api/')){network.push({method:q.method(),path:u.pathname,blocked:true});return r.abort()}return r.continue()})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 for(const width of [1280,1440])for(const item of ['2026-34','2026-22','2026-38'])for(const layout of ['IMPROVE','REPLACE']){
  const caseId=`${item}-${layout.toLowerCase()}-${width}`,steps=[]
  const test=async(name,fn)=>{try{await fn();steps.push({name,result:'PASS'});record('assert-pass',{caseId,name})}catch(e){steps.push({name,result:'FAIL',error:e.message});record('assert-fail',{caseId,name,error:e.message});throw e}}
  const sample=structuredClone(samples.find(s=>s.currentSlug===item));if(item==='2026-38')sample.inquiry.v3.choices=sample.inquiry.v3.choices.map(c=>c.n===5?proposal.payload.proposed:c)
  const v3=sample.inquiry.v3,primary=item==='2026-34'?1:item==='2026-22'?3:4,peer=item==='2026-34'?3:item==='2026-22'?1:5
  let row={caseId,item,layout,width,steps,result:'RUNNING'}
  results.push(row)
  try{
   await page.setViewportSize({width,height:1000});await page.goto(`${base}/?item=${item}&layout=${layout}`,{waitUntil:'domcontentloaded'});await page.getByTestId('selection-root').waitFor();await page.waitForFunction(()=>!!window.__selection?.getState)
   if(layout==='IMPROVE')await page.locator('img').first().waitFor({state:'attached'});await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0))
   row.startState=await page.getByTestId('selection-root').evaluate(el=>Object.fromEntries(['scene','pick','peer','meaning','qualified','sourceView','reveal','media','status','cue','collapsed'].map(k=>[k,el.dataset[k]])))
   row.input={v3Sha256:hash(JSON.stringify(v3)),officialPdf:binding.questionSha256,officialImage:binding.pageCaptures.find(c=>c.page===binding.questionPages[sample.itemId]).sha256,lectureSha256:hash(JSON.stringify(lectures.lectures[sample.itemId])),taskContractSha256:hash(JSON.stringify(taskContract)),modes:recommended}
   await test('same paired choices/axes and official answer',async()=>{
    assert.equal(v3.choices.find(c=>c.selected_as_answer).n,binding.officialAnswers[sample.itemId])
    for(const n of [primary,peer]){const c=v3.choices.find(c=>c.n===n);assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-truth]').getAttribute('data-truth'),c.content_truth);assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-fit]').getAttribute('data-fit'),c.requirement_fit)}
    if(item==='2026-34')for(const n of [1,3])assert.ok((await page.getByTestId(`proposition-${n}`).innerText()).includes(reportedProposition(v3.choices.find(c=>c.n===n)).text))
    if(item==='2026-22'){assert.equal(v3.choices.find(c=>c.n===3).content_truth,'true');assert.equal(v3.choices.find(c=>c.n===3).requirement_fit,'fails')}
    if(item==='2026-38'){assert.equal(v3.choices.find(c=>c.n===4).content_truth,'n_a');assert.equal(v3.choices.find(c=>c.n===5).requirement_fit,'satisfies');assert.ok((await page.getByTestId('c1-after').innerText()).includes('4~5번'));assert.ok((await page.getByTestId('c1-before').innerText()).includes('6~7번'))}
   })
   row.comparison=await page.evaluate(()=>{const j=document.querySelector('[data-testid="judge-scroll"]'),pair=j.querySelector('.pair'),targets=[...pair.querySelectorAll('.reported,.axes')],rects=targets.map(t=>t.getBoundingClientRect()),jr=j.getBoundingClientRect(),union={top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))};return {judgeWidth:jr.width,clientHeight:j.clientHeight,scrollHeight:j.scrollHeight,pairedCoreHeight:union.bottom-union.top,pairedCoreFitsOneView:union.bottom-union.top<=j.clientHeight,pairedFullHeight:pair.getBoundingClientRect().height,fullJudgmentFitsOneView:pair.getBoundingClientRect().height<=j.clientHeight,scrollToCore:Math.max(0,union.top-jr.top),sourceOriginalAlwaysVisible:document.querySelector('main').dataset.layout==='IMPROVE',sourceAndJudgmentIndependentScroll:true}})
   await saveShot(page,caseId+'-initial.png',{caseId,stage:'identical initial state'})
   await page.getByTestId('judge-scroll').locator('.pair').scrollIntoViewIfNeeded();await saveShot(page,caseId+'-pair.png',{caseId,stage:'same paired judgment aligned by explicit inspection, not cue-driven'});await page.getByTestId('judge-scroll').evaluate(el=>{el.scrollTop=0});await page.evaluate(()=>scrollTo(0,0))
   await test('qualification-to-source traces preserve paired judgment',async()=>{for(const q of qualificationRecords(sample)){await page.getByTestId(`qual-${q.id}`).click();assert.ok((await page.getByTestId('qualification-text').innerText()).includes(q.text))}assert.equal(await page.getByTestId('selection-root').getAttribute('data-pick'),String(primary))})
   if(item==='2026-34')await test('content unknown and requirement fail remain distinct',async()=>{await page.getByTestId('pick-2').click();assert.equal(await page.getByTestId('axes-2').locator('[data-truth]').getAttribute('data-truth'),'unknown');assert.equal(await page.getByTestId('axes-2').locator('[data-fit]').getAttribute('data-fit'),'fails');await page.getByTestId('pick-1').click();await page.getByTestId('peer-3').click()})
   else steps.push({name:'34-only choice2 unknown/fails',result:'NOT_APPLICABLE',reason:'22 true/fails and38 n_a/fit are checked in the common paired-axis assertion'})
   await test('registered bidirectional source links and UNREGISTERED pair',async()=>{
    await page.getByTestId(`trace-${primary}`).click();const mid=meaningsForChoice(v3,primary)[0];assert.equal(await page.getByTestId('selection-root').getAttribute('data-meaning'),mid)
    await page.getByTestId(`reverse-choice-${primary}`).click();await page.getByTestId('scene-evidence').click()
    const unlinked=v3.meanings.find(m=>!choicesForMeaning(v3,m.id).includes(primary));assert.ok(unlinked)
    await page.getByTestId(`meaning-${unlinked.id}`).click();assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'UNREGISTERED');assert.equal(await page.getByTestId(`reverse-choice-${primary}`).count(),0)
    await page.getByTestId('forward').click();assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'REGISTERED')
    row.navigation={choice:primary,meaning:mid,unregistered:unlinked.id,spuriousLinkCreated:false}
   })
   await test('meaningful boundary condition selection, no mastery/fictional counterexample',async()=>{await page.getByTestId('scene-principle').focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('scene-principle').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.getByTestId('boundary-condition-0').click();assert.ok((await page.getByTestId('selected-boundary').innerText()).includes(v3.requirement.conditions[0]));assert.ok((await page.getByTestId('boundary-text').innerText()).includes(v3.design.limitation))})
   await test('official source selection/restoration retains judgment and independent source position',async()=>{
    await page.getByTestId('source-original').click();assert.ok(await page.getByTestId('official-paper').isVisible());await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.getByTestId('page-zoom').selectOption('150')
    await page.getByTestId('source-evidence').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-pick'),String(primary))
    await page.getByTestId('scene-judgment').click();assert.equal(await page.getByTestId('axes-'+peer).count(),1)
    row.sourceAccess={sameOriginalPage:true,sourceTabSelections:2,extraDisplaySwitchForOriginal:layout==='REPLACE',originalAlongsidePartialAndJudgment:layout==='IMPROVE'}
   })
   await test('actual player cue does not seize scene, scroll, focus, meaning or choice',async()=>{
    await page.getByTestId('scene-evidence').click();await page.getByTestId('play').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing')
    const view=()=>page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,pick:document.querySelector('main').dataset.pick,meaning:document.querySelector('main').dataset.meaning,scroll:scrollY,judgeScroll:document.querySelector('[data-testid="judge-scroll"]').scrollTop,sourceScroll:document.querySelector('.source').scrollTop,focus:document.activeElement?.getAttribute('data-testid')}))
    const before=await view();await page.evaluate(()=>window.__selection.advance());await page.waitForFunction(()=>document.querySelector('main').dataset.cue==='1');assert.deepEqual(await view(),before)
    await page.getByTestId('scene-principle').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'playing')
    await page.getByTestId('pause').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'paused');await page.getByTestId('resume').click()
    for(const method of ['fail','reject']){const beforeError=await view();await page.evaluate(m=>window.__selection[m](),method);await page.waitForFunction(()=>document.querySelector('main').dataset.status==='error');assert.deepEqual(await view(),beforeError);await page.getByTestId('play').click();await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing')}
    row.player={engine:'actual LecturePlayer',adapter:'manual silent promise completion, injected clock',cueSceneFocusIndependence:true,shellOutcomeErrorAndRejection:true,realTTS:'NOT_VERIFIED',events:await page.evaluate(()=>window.__selection.events)}
   })
   await test('READ/SILENT/OFF and explicit restart retain scene and selection',async()=>{
    await page.getByTestId('media-SILENT').click();assert.equal(await page.getByTestId('cue-text').count(),0);await page.getByTestId('media-READ').click();assert.equal(await page.getByTestId('cue-text').count(),1);await page.getByTestId('off').click()
    for(const id of ['play','pause','resume','next'])assert.ok(await page.getByTestId(id).isDisabled())
    await page.getByTestId('media-READ').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'off');await page.getByTestId('play').click();await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing');await page.getByTestId('off').click()
   })
   await test('collapse/restore without losing current pair or mean­ing',async()=>{const before=await page.getByTestId('selection-root').evaluate(el=>({pick:el.dataset.pick,peer:el.dataset.peer,meaning:el.dataset.meaning}));await page.getByTestId('collapse-evidence').click();assert.equal(await page.locator('.source').count(),0);await page.getByTestId('collapse-evidence').click();assert.deepEqual(await page.getByTestId('selection-root').evaluate(el=>({pick:el.dataset.pick,peer:el.dataset.peer,meaning:el.dataset.meaning})),before)})
   await page.getByTestId('scene-judgment').click();await page.getByTestId('judge-scroll').evaluate(el=>{el.scrollTop=0});await page.evaluate(()=>scrollTo(0,0))
   row.geometry=await page.evaluate(()=>({documentOverflow:document.documentElement.scrollWidth-innerWidth,judgeOverflow:document.querySelector('[data-testid="judge-scroll"]').scrollWidth-document.querySelector('[data-testid="judge-scroll"]').clientWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}))
   assert.ok(row.geometry.documentOverflow<=1);assert.ok(row.geometry.judgeOverflow<=1);assert.ok(row.geometry.buttons.every(b=>b.width>=44&&b.height>=44))
   row.endState=await page.getByTestId('selection-root').evaluate(el=>Object.fromEntries(['scene','pick','peer','meaning','qualified','sourceView','reveal','media','status','cue','collapsed'].map(k=>[k,el.dataset[k]])))
   await saveShot(page,caseId+'-complete.png',{caseId,stage:'same integrated task completed, OFF, judgment restored'})
   if(item==='2026-38'){await page.getByTestId('c1-review').scrollIntoViewIfNeeded();await saveShot(page,caseId+'-c1.png',{caseId,stage:'original and source-bound correction candidate both visible; approval required'})}
   row.result='PASS'
  }catch(e){row.result='FAIL';row.failure=e.message;await saveShot(page,caseId+'-failure.png',{caseId,stage:'actual failed execution'});throw e}
 }
 for(const width of [1280,1440])for(const item of ['2026-34','2026-22','2026-38']){const pair=results.filter(r=>r.item===item&&r.width===width);assert.equal(pair.length,2);assert.deepEqual(pair[0].input,pair[1].input);assert.deepEqual(pair[0].startState,pair[1].startState);assert.deepEqual(pair[0].endState,pair[1].endState)}
 assert.deepEqual(errors,[]);assert.deepEqual(network,[])
}catch(e){unhandled=e;record('run-failure',{error:e.message});console.error(e.stack)}finally{await context?.close();await browser.close();await new Promise(r=>server.close(r))}
for(const[p,h]of Object.entries({...priorHashes,...Object.fromEntries(Object.entries(originalHashes).map(([p,h])=>[p,h]))}))assert.equal(digest(path.join(wt,p)),h,p)
const report={task:'T-0136',attempt,observedAt:new Date().toISOString(),baseCommit:baseline,taskContract,results,captures,errors,network,actionLog,priorHashes,originalHashes,environment:{generatedCssSha256:digest(path.join(runtime,'apps/web/.next-dev/static/css/app/layout.css')),skinSha256:digest(path.join(wt,'packages/design-tokens/src/skins/csat-app.css')),shellCssSha256:digest(path.join(wt,'apps/web/src/components/csat/theater/theater.module.css'))},reuse:{prior98TestsRerun:false,prior24CasesRerun:false,prior42CasesRerun:false},candidate:{version:proposal.version,payloadHash:proposal.payloadSha256,approvalRequired:true,applied:false},accessibility:{button44px:'CHECKED',specifiedKeyboardFocus:'CHECKED',colorContrast:'NOT_VERIFIED',screenReader:'NOT_VERIFIED',pdfImageTextAlternative:'NOT_VERIFIED',fullKeyboardTraversal:'NOT_VERIFIED'},unverified:['learner outcomes and cognitive load','all content independently approved','normal auth/RLS','local PDF feature and anchor/crop alignment','real TTS/audio/rate/seek/visibility lifecycle','screen reader/color contrast/full accessibility','all item types'],notAuthorized:['main integration','S2 full implementation','DB/original mutation'],failure:unhandled?.message??null}
fs.writeFileSync(path.join(out,'EXECUTION.json'),JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(path.join(dir,'RESULTS.json'),JSON.stringify(report,null,2)+'\n')
const files=['fixture.tsx','run.mjs','SOURCE_BINDINGS.json','C1_CANDIDATE.json','RESULTS.json']
fs.writeFileSync(path.join(dir,'MANIFEST.json'),JSON.stringify({files:files.map(file=>({file,sha256:digest(path.join(dir,file))})),execution:{path:path.join(out,'EXECUTION.json'),sha256:digest(path.join(out,'EXECUTION.json'))},oldBuilder:{file:'../goal-fit/compare.mjs',sha256:oldManifest.harness.sha256}},null,2)+'\n')
console.log(JSON.stringify({task:'T-0136',attempt,cases:results.length,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,captures:captures.length,execution:path.join(out,'EXECUTION.json'),failure:report.failure,originalUnchanged:true,priorSuitesRerun:false}))
if(unhandled)process.exitCode=1
