// docs/csat-learner/skeleton-v4/s1-v6/selection/run.mjs
// Reuse the hash-bound T-0134 builder only; never rerun or overwrite its 24 cases/14 captures.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {features,alternatives,recommended,reportedProposition,qualificationRecords,choicesForMeaning,meaningsForChoice} from './model.mjs'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(dir,'../../../../..')
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const baselineDir=path.join(dir,'../goal-fit'),oldManifest=JSON.parse(fs.readFileSync(path.join(baselineDir,'MANIFEST.json'),'utf8'))
assert.equal(hash(path.join(baselineDir,'compare.mjs')),oldManifest.harness.sha256)
const preserved=execFileSync('git',['-C',wt,'ls-tree','-r','--name-only','b7fa848fd','--','docs/csat-learner/skeleton-v4/s1-v6/goal-fit'],{encoding:'utf8'}).trim().split('\n')
const baselineHashes=Object.fromEntries(preserved.map(p=>[p,hash(path.join(wt,p))]))
for(const p of preserved)assert.equal(crypto.createHash('sha256').update(execFileSync('git',['-C',wt,'show',`b7fa848fd:${p}`],{maxBuffer:20e6})).digest('hex'),baselineHashes[p])
const original=fs.readFileSync(path.join(baselineDir,'compare.mjs'),'utf8')
const prefix=original.slice(0,original.indexOf('\ntry{')).replace(/^import .*\r?\n/gm,'').replace('const dir=path.dirname(fileURLToPath(import.meta.url))',`const dir=${JSON.stringify(dir)}`)
assert.ok(!prefix.includes('import.meta'))
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
const setup=new AsyncFunction('fs','path','http','crypto','assert','createRequire','execFileSync',prefix+'\nreturn {browser,server,base,samples,lectures,originalHashes};')
const {browser,server,base,samples,lectures,originalHashes}=await setup(fs,path,http,crypto,assert,createRequire,execFileSync)
const results=[],errors=[],captures=[],network=[]
const out=path.join(dir,'evidence');fs.mkdirSync(out,{recursive:true})
const checks=[]
function check(name,fn){fn();checks.push({name,result:'PASS'})}
check('reported propositions and qualification substrings are exact stored text, not constructed full choices',()=>{
 const s=samples.find(s=>s.itemId==='2026#34')
 for(const n of [1,3]){const c=s.inquiry.v3.choices.find(c=>c.n===n),p=reportedProposition(c);assert.ok(p&&c.decisive.includes(p.text));assert.equal(p.fullOfficialChoice,false)}
 const q=qualificationRecords(s);assert.ok(q[0].text.startsWith('Ideally'));assert.ok(q[1].text.startsWith('If such laws forbid'));assert.equal(q[2].text,'then the law cannot be')
})
const runtimeIndex=process.argv.indexOf('--runtime-root'),runtime=process.argv[runtimeIndex+1]
assert.equal(hash(path.join(runtime,'tmp/csat-item-review-20261023/samples.json')),oldManifest.samples.sha256,'preserved samples changed')
const playerRel='apps/web/src/lib/csat/lecture/player.ts',playerHash=hash(path.join(wt,playerRel))
let context
try{
 context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})
 await context.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(req.method()!=='GET'||u.origin!==base){network.push({method:req.method(),path:u.pathname,blocked:true});return r.abort()}if(u.pathname.startsWith('/api/')){network.push({method:req.method(),path:u.pathname,blocked:true});return r.fulfill({status:404,json:{}})}return r.continue()})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 async function go(item,feature,candidate,width=1280){await page.setViewportSize({width,height:1000});await page.goto(`${base}/?item=${item}&feature=${feature}&candidate=${candidate}`,{waitUntil:'domcontentloaded'});await page.getByTestId('selection-root').waitFor();await page.waitForFunction(()=>!!window.__selection?.getState)}
 async function shot(name,meta){await page.screenshot({path:path.join(out,name),animations:'disabled'});captures.push({file:'evidence/'+name,sha256:hash(path.join(out,name)),...meta,normalAuth:false,pdf:false,realTTS:false})}
 async function playerProbe(){
  if(!await page.getByTestId('player').count())await page.getByTestId('open-player').click()
  await page.getByTestId('scene-evidence').click();await page.getByTestId('play').focus();await page.keyboard.press('Enter')
  await page.waitForFunction(()=>document.querySelector('[data-testid="selection-root"]').getAttribute('data-status')==='playing')
  const before=await page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')}))
  await page.evaluate(()=>window.__selection.advance())
  await page.waitForFunction(()=>document.querySelector('main').dataset.cue==='1')
  const after=await page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')}))
  assert.deepEqual(after,before,'engine cue transition must not take scene/scroll/focus')
  await page.getByTestId('scene-principle').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'playing')
  await page.getByTestId('pause').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'paused')
  await page.getByTestId('resume').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'playing')
  for(const injection of ['fail','reject']){
   const beforeError=await page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,cue:document.querySelector('main').dataset.cue,pick:document.querySelector('main').dataset.pick,scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')}))
   await page.evaluate(method=>window.__selection[method](),injection);await page.waitForFunction(()=>document.querySelector('main').dataset.status==='error')
   assert.deepEqual(await page.evaluate(()=>({scene:document.querySelector('main').dataset.scene,cue:document.querySelector('main').dataset.cue,pick:document.querySelector('main').dataset.pick,scroll:scrollY,focus:document.activeElement?.getAttribute('data-testid')})),beforeError)
   await page.getByTestId('play').click();await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing')
  }
  await page.getByTestId('media-SILENT').click();assert.equal(await page.getByTestId('cue-text').count(),0)
  await page.getByTestId('media-READ').click();assert.equal(await page.getByTestId('cue-text').count(),1)
  await page.getByTestId('off').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'off')
  assert.equal(await page.getByTestId('cue-text').count(),0)
  for(const action of ['play','pause','resume','next'])assert.equal(await page.getByTestId(action).isDisabled(),true,`OFF disables ${action}`)
  await page.getByTestId('media-SILENT').click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-status'),'off','choosing media must not start playback')
  await page.getByTestId('play').click();await page.waitForFunction(()=>document.querySelector('main').dataset.status==='playing')
  assert.equal(await page.getByTestId('cue-text').count(),0)
  await page.getByTestId('off').click()
  await page.getByTestId('scene-judgment').click()
  return {engine:'actual LecturePlayer',adapter:'manual promise completion, silent kind, injected clock; not actual audio',transition:'PASS',userSceneWhilePlaying:'PASS',pauseResume:'PASS',adapterOutcomeErrorAndRejectionToNewShellBoundary:'PASS',nativeEngineOrTTSErrorHandling:'UNVERIFIED',readSilentOffAndExplicitRestart:'PASS',events:await page.evaluate(()=>window.__selection.events)}
 }
 async function inspect(item,feature,candidate){
  const sample=samples.find(s=>s.currentSlug===item),v3=sample.inquiry.v3
  if(candidate==='REUSE'&&['F07','F08'].includes(feature))return {result:'ELIMINATED_STATIC',basis:'preserved T0134 automatic selectScene/scrollIntoView source witness; no fake engine reproduction'}
  const record={result:'PASS',scope:'specified isolated affordance only'}
  if(feature==='F01'&&candidate!=='REUSE'){
   for(const q of qualificationRecords(sample)){await page.getByTestId(`qual-${q.id}`).click();assert.ok((await page.getByTestId('qualification-text').innerText()).includes(q.text));}
   record.qualificationSourceTrace=true
  }
  if(['F03','F04'].includes(feature)&&candidate!=='REUSE'){
   const c=v3.choices.find(c=>c.n===(item==='2026-38'?4:item==='2026-22'?3:1)),mid=meaningsForChoice(v3,c.n)[0]
   assert.ok(mid,'missing actual source mapping is a data gap')
   if(feature==='F04')await page.getByTestId(`trace-${c.n}`).click();else await page.getByTestId('forward').click()
   await page.getByTestId(`meaning-${mid}`).click();const back=choicesForMeaning(v3,mid).find(n=>n!==c.n)??c.n
   await page.getByTestId(`reverse-choice-${back}`).click();assert.equal(await page.getByTestId('selection-root').getAttribute('data-pick'),String(back))
   record.bidirectional={meaning:mid,backChoice:back,actualLinks:choicesForMeaning(v3,mid)}
   if(feature==='F03'){
    const unlinked=v3.meanings.find(m=>!choicesForMeaning(v3,m.id).includes(back))
    assert.ok(unlinked,'need real unregistered pair to test no inferred link')
    await page.getByTestId(`meaning-${unlinked.id}`).click();assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'UNREGISTERED')
    assert.equal(await page.getByTestId(`reverse-choice-${back}`).count(),0)
    record.unregisteredPair={meaning:unlinked.id,choice:back,display:'UNREGISTERED',inferredLink:false}
    await page.getByTestId('forward').click();assert.equal(await page.getByTestId('link-status').getAttribute('data-link-state'),'REGISTERED')
   }
   if(feature==='F04'&&candidate==='REPLACE'){
    const primary=item==='2026-34'?1:item==='2026-22'?3:4,peer=item==='2026-34'?3:item==='2026-22'?1:5
    await page.getByTestId(`pick-${primary}`).click();await page.getByTestId(`peer-${peer}`).click()
    if(item==='2026-34')for(const n of [1,3])assert.equal((await page.getByTestId(`proposition-${n}`).innerText()).split('\n').slice(1).join('\n').trim(),reportedProposition(v3.choices.find(c=>c.n===n)).text)
    if(item==='2026-22'){assert.equal(await page.getByTestId('axes-3').locator('[data-truth]').getAttribute('data-truth'),'true');assert.equal(await page.getByTestId('axes-3').locator('[data-fit]').getAttribute('data-fit'),'fails')}
    if(item==='2026-38'){assert.equal(await page.getByTestId('axes-4').locator('[data-truth]').getAttribute('data-truth'),'n_a');assert.equal(await page.getByTestId('axes-5').locator('[data-fit]').getAttribute('data-fit'),'satisfies')}
    record.pair=[primary,peer]
   }
  }
  if(feature==='F04'&&item==='2026-34'){
   record.sameCases=[]
   for(const n of [1,3,2]){
    const originalChoice=v3.choices.find(c=>c.n===n)
    if(candidate==='REUSE'){
     await page.getByTestId('v3-judgment').locator(`[data-choice="${n}"]`).click()
     assert.ok((await page.getByTestId('v3-judgment').innerText()).includes(originalChoice.decisive))
    }else{
     await page.getByTestId(`pick-${n}`).click()
     if(candidate==='REPLACE')await page.getByTestId(`peer-${n===1?3:1}`).click()
     assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-truth]').getAttribute('data-truth'),originalChoice.content_truth)
     assert.equal(await page.getByTestId(`axes-${n}`).locator('[data-fit]').getAttribute('data-fit'),originalChoice.requirement_fit)
     if([1,3].includes(n))assert.ok((await page.getByTestId(`proposition-${n}`).innerText()).includes(reportedProposition(originalChoice).text))
    }
    await shot(`34-F04-${candidate.toLowerCase()}-${n}-1280.png`,{item,feature,candidate,width:1280,selected:n,peer:candidate==='REPLACE'?(n===1?3:1):null})
    record.sameCases.push({choice:n,truth:originalChoice.content_truth,fit:originalChoice.requirement_fit,reportedProposition:reportedProposition(originalChoice),source:'same saved v3 choice record for all alternatives'})
   }
  }
  if(feature==='F05'){
   if(candidate==='NEW'){assert.ok((await page.getByTestId('unavailable-counterexample').innerText()).includes('없습니다'));record.actualCounterexample='MISSING_NOT_GENERATED'}
   else if(candidate!=='REUSE'){await page.getByTestId('boundary-toggle').click();assert.ok((await page.getByTestId('boundary-text').innerText()).includes(v3.design.limitation));record.sourceLimitationPreserved=true}
  }
  if(feature==='F07')record.player=await playerProbe()
  if(feature==='F08'){
   await page.getByTestId('scene-evidence').focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('selection-root').getAttribute('data-scene'),'evidence')
   await page.getByTestId('scene-judgment').click()
   record.layout=await page.getByTestId('judge-scroll').evaluate(el=>({width:el.getBoundingClientRect().width,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,columns:getComputedStyle(el.parentElement).gridTemplateColumns}))
  }
  record.metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),scene:document.querySelector('main').dataset.scene,pick:document.querySelector('main').dataset.pick}))
  assert.ok(record.metrics.overflow<=1,`${feature}/${candidate} overflow`);assert.ok(record.metrics.buttons.every(b=>b.width>=44&&b.height>=44))
  return record
 }
 for(const feature of features)for(const candidate of alternatives){await go('2026-34',feature,candidate);const r=await inspect('2026-34',feature,candidate);results.push({item:'2026-34',feature,candidate,width:1280,...r})}
 for(const item of ['2026-22','2026-38'])for(const feature of features){const candidate=recommended[feature];await go(item,feature,candidate);results.push({item,feature,candidate,width:1280,...await inspect(item,feature,candidate)})}
 for(const width of [1280,1440])for(const item of ['2026-34','2026-22','2026-38']){
  await go(item,'COMPOSED','REPLACE',width)
  if(item==='2026-34'){await page.getByTestId('qual-If').click();assert.ok((await page.getByTestId('qualification-text').innerText()).includes('If such laws forbid'));}
  await page.getByTestId('scene-evidence').click();await page.getByTestId('forward').click();await page.getByTestId('scene-judgment').click()
  assert.equal(await page.getByTestId('selection-root').getAttribute('data-pick'),item==='2026-34'?'1':item==='2026-22'?'3':'4')
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1)
  await shot(`${item}-composed-${width}.png`,{item,feature:'COMPOSED',candidate:'FEATURE_SPECIFIC_SELECTION',width})
  results.push({item,feature:'COMPOSED',candidate:'FEATURE_SPECIFIC_SELECTION',width,result:'PASS',scope:'retained selection and source navigation; not full product',overflow})
 }
}finally{await context?.close();await browser.close();await new Promise(r=>server.close(r))}
assert.deepEqual(errors,[])
for(const[p,h]of Object.entries(baselineHashes))assert.equal(hash(path.join(wt,p)),h,'prior artifact changed: '+p)
for(const[p,h]of Object.entries(originalHashes))assert.equal(hash(path.join(wt,p)),h)
assert.equal(hash(path.join(wt,playerRel)),playerHash)
const report={task:'T-0135',observedAt:new Date().toISOString(),base:'b7fa848fdfdf2fd34c77ab42c1e3bd9483e7c572',checks,results,captures,errors,network,baselineHashes,originalHashes:{...originalHashes,[playerRel]:playerHash},reuse:{oldTests:98,oldCases:24,oldCaptures:14,rerun:false},samplePath:path.join(runtime,'tmp/csat-item-review-20261023/samples.json'),sampleHash:oldManifest.samples.sha256,scope:'S1 design affordances and real-engine/manual-adapter integration only',unverified:['actual student judgment outcomes','official full choices/PDF','content validation','normal authenticated route/RLS','real TTS/assessment audio','learning/transfer/grade effects'],notAuthorized:['main integration','S2 full implementation']}
fs.writeFileSync(path.join(dir,'RESULTS.json'),JSON.stringify(report,null,2)+'\n')
const artifactFiles=['fixture.tsx','model.mjs','run.mjs','RESULTS.json',...captures.map(c=>c.file)]
fs.writeFileSync(path.join(dir,'MANIFEST.json'),JSON.stringify({files:artifactFiles.map(file=>({file,sha256:hash(path.join(dir,file))})),oldBuilder:{file:'../goal-fit/compare.mjs',sha256:oldManifest.harness.sha256}},null,2)+'\n')
console.log(JSON.stringify({cases:results.length,pass:results.filter(r=>r.result==='PASS').length,eliminated:results.filter(r=>r.result==='ELIMINATED_STATIC').length,captures:captures.length,errors,preserved:preserved.length,playerHash,oldTestsRerun:false}))
