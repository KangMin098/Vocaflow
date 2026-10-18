// apps/web/scripts/final-independent/probe-authored-formats.mjs
// Actual frozen format grader + Runner in isolated Chromium. Synthetic originals; no live DB.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const altOnly=process.argv.includes('--alternative-only')
const root=path.resolve(import.meta.dirname,'../../../..'),snapshot=path.join(root,'.agent-logs/final-independent/owner-de5'),head='de5065b51'
const req=createRequire(path.join(root,'apps/web/package.json'))
const {build}=createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const {chromium}=req('@playwright/test')
for(const f of ['apps/web/src/components/csat/authored/AuthoredRunner.tsx','apps/web/src/lib/knowledge/authored/formats.ts'])assert.equal(fs.readFileSync(path.join(snapshot,f),'utf8'),execFileSync('git',['show',head+':'+f],{cwd:root,encoding:'utf8'}))
const graderBuild=await build({stdin:{contents:"export {FORMAT_SPECS} from './apps/web/src/lib/knowledge/authored/formats'",resolveDir:snapshot,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',tsconfig:path.join(snapshot,'apps/web/tsconfig.json')})
const mod={exports:{}};new Function('module','exports',graderBuild.outputFiles[0].text)(mod,mod.exports)
const {FORMAT_SPECS}=mod.exports
const ds=(answer,design='distorted')=>[0,1,2,3,4].filter(choice=>choice!==answer).map(choice=>({choice,design,why:'The text does not support this alternative.'}))
const fixtures=[
 {format:'central_meaning',body:{sentences:['Later opening makes the hall more accessible.','Workers can visit after their shifts end.','The new schedule keeps it open until six.'],stem:'글의 중심은?',choices:['The hall should close.','Work must stop.','Later opening improves access.','Workers dislike halls.','The town has no hall.']},gold:{answer:2,claim:0,claimRestated:[],support:[1,2],supportDisputed:[],opposed:[],relationProbe:{sentence:1,relation:'reason'},gist:'Later opening makes the hall accessible to workers.',distractors:ds(2)},response:{choice:2,claim:0,support:[1,2],relation:'reason'}},
 {format:'choice_evidence',body:{sentences:['The reading room closes at six in the evening.','Its closing time is 6 p.m.','Books can be returned in a box.'],stem:'At what time does the reading room close?',choices:['4 p.m.','5 p.m.','6 p.m.','7 p.m.','8 p.m.']},gold:{answer:2,decisive:0,evidence:[0],evidenceAlt:[1],rationale:'The first two sentences state the same closing time directly.',distractors:ds(2)},response:{choice:2,evidence:[0]}},
 {format:'contextual_sense',body:{sentences:['The room was dark.','She switched on a light.','The lamp brightened the room.'],stem:'What does light mean here?',choices:['가벼운','조명','불붙이다','옅은','착륙하다'],target:{sentence:1,word:'light'}},gold:{answer:1,cue:[0,2],senseGloss:'A lamp that illuminates a room.',distractors:ds(1,'basic_meaning')},response:{choice:1,cue:[2]}},
 {format:'sentence_relation',body:{sentences:['The heater stopped working.','As a result, the room became cold.','Nevertheless, the team continued its work.'],stem:'문장 관계를 고르세요',pairs:[[0,1],[1,2]]},gold:{pairs:[{relation:'cause_effect',alt:[],cue:'As a result'},{relation:'contrast',alt:[],cue:'Nevertheless'}]},response:{pairs:['cause_effect','contrast']}},
 {format:'form_scope',body:{sentences:['The students is ready.','The hall opens at nine.','The books are on the shelf.','We waited for the bus.','She works near the school.'],stem:'어법상 틀린 곳은?',marks:[{sentence:0,text:'is'},{sentence:1,text:'opens'},{sentence:2,text:'are'},{sentence:3,text:'waited'},{sentence:4,text:'works'}]},gold:{answer:0,reason:'agreement',correction:'are',marks:[{reason:'agreement',why:'A plural subject requires are.'},{reason:'agreement',why:'The singular subject agrees with opens.'},{reason:'agreement',why:'The plural subject agrees with are.'},{reason:'tense_aspect',why:'The sentence uses the past form correctly.'},{reason:'agreement',why:'The singular subject agrees with works.'}]},response:{choice:0,reason:'agreement'}},
 {format:'option_correspondence',body:{sentences:['The hall opens at nine.','It closes at six.','Books can be returned in a box.','Visitors need a card.','The room is closed on Sunday.'],stem:'다음 글의 내용과 일치하지 않는 것은?',choices:['The hall opens at nine.','The hall closes at six.','The room is open on Sunday.','A box accepts returned books.','Visitors must have a card.']},gold:{answer:2,options:[{verdict:'matches',sentence:0,why:'This repeats the opening time.'},{verdict:'matches',sentence:1,why:'This repeats the closing time.'},{verdict:'reversed',sentence:4,why:'This reverses the Sunday closure.'},{verdict:'matches',sentence:2,why:'This paraphrases the return box.'},{verdict:'matches',sentence:3,why:'This paraphrases the card requirement.'}]},response:{choice:2,options:[{verdict:'matches',sentence:0},{verdict:'matches',sentence:1},{verdict:'reversed',sentence:4},{verdict:'matches',sentence:2},{verdict:'matches',sentence:3}]}}
]
for(const f of fixtures){f.body.format=f.format;assert.deepEqual(FORMAT_SPECS[f.format].validate(f.body,f.gold),[]);assert.equal(FORMAT_SPECS[f.format].grade(f.body,f.gold,f.response,'fixture-v1').grade.isCorrect,true)}
const ev=fixtures.find(f=>f.format==='choice_evidence'),spec=FORMAT_SPECS.choice_evidence
const alternative={body:ev.body,gold:ev.gold,primary:spec.grade(ev.body,ev.gold,{choice:2,evidence:[0]},'fixture-v1'),equivalentAlternative:spec.grade(ev.body,ev.gold,{choice:2,evidence:[1]},'fixture-v1'),combined:spec.grade(ev.body,ev.gold,{choice:2,evidence:[0,1]},'fixture-v1')}
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {AuthoredRunner} from './apps/web/src/components/csat/authored/AuthoredRunner';const root=createRoot(document.getElementById('root'));window.mount=(p)=>root.render(<AuthoredRunner key={p.id} {...p}/>);"
const built=await build({stdin:{contents:entry,resolveDir:snapshot,loader:'tsx'},bundle:true,write:false,outdir:'out',metafile:true,platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'apps/web/node_modules')],tsconfig:path.join(snapshot,'apps/web/tsconfig.json'),define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'link-only',setup(b){b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:"import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}",loader:'tsx',resolveDir:snapshot}))}}]})
const goldInputs=Object.keys(built.metafile.inputs).filter(x=>/authored\/.*\.json$/.test(x.replace(/\\/g,'/')))
if(goldInputs.length)throw new Error('Possible Gold bundle exposure; retain details privately before publishing')
const js=built.outputFiles.find(f=>f.path.endsWith('.js')).contents,css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''
const tokens=fs.readFileSync(path.join(snapshot,'packages/design-tokens/src/tokens.css'),'utf8')
const server=http.createServer((q,s)=>{s.setHeader('content-type',q.url==='/bundle.js'?'application/javascript':'text/html; charset=utf-8');s.end(q.url==='/bundle.js'?js:`<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;--bg:#fff;--bg2:#f8f8fa;--t1:#18181b;--t2:#71717a;--bd:#e4e4e7;--p:#18181b;--on-p:#fff;font-family:Arial,sans-serif}*{box-sizing:border-box}button{font:inherit}#root{width:672px;max-width:calc(100% - 48px);margin:24px auto}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div id="root"></div><script src="/bundle.js"></script></html>`)})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch(),rows=[],errors=[],external=[],submissions=[]
const out=path.join(root,'docs/research/final-independent-20261018/formats-de5');fs.mkdirSync(out,{recursive:true})
const pairLabel={cause_effect:'원인 → 결과',contrast:'대조 · 반전'},verdictLabel={matches:'일치',reversed:'반대'}
const record=(id,ok,detail)=>{rows.push({id,ok,detail});console.log((ok?'PASS ':'FAIL ')+id)}
try{for(const width of [1280,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));let active
 await page.route('**/*',async route=>{const request=route.request();if(!request.url().startsWith(base)){external.push(request.url());return route.abort()}if(!request.url().includes('/api/'))return route.continue();const body=request.postDataJSON();submissions.push({format:active.format,body});const result=FORMAT_SPECS[active.format].grade(active.body,active.gold,body.response,'fixture-v1');return route.fulfill({status:result?200:400,contentType:'application/json',body:JSON.stringify(result?{grade:result.grade,reveal:{format:active.format,...FORMAT_SPECS[active.format].reveal(active.gold)},binding:{status:'bound',evidence:true}}:{error:'Invalid fixture response'})})})
 await page.goto(base)
 for(const f of fixtures.filter(f=>!altOnly||f.format==='choice_evidence')){active=f;const props={id:f.format,deliveryId:'00000000-0000-4000-8000-000000000001',taskLabel:f.format,format:f.format,role:'independent_check',sentences:f.body.sentences,stem:f.body.stem,choices:f.body.choices??[],extra:{target:f.body.target,pairs:f.body.pairs,marks:f.body.marks},probe:f.format==='central_meaning'?1:null,teach:null,hints:null,done:null,returnHref:'/csat/diagnosis?tab=map&view=full'}
  await page.evaluate(p=>window.mount(p),props);await page.locator('[data-format="'+f.format+'"]').waitFor()
  const submit=page.getByRole('button',{name:'맞춰 보기',exact:true});
  if(altOnly){
   await page.locator('[aria-labelledby="passage-h"] ol li button').nth(1).click()
   await page.locator('fieldset').last().locator('button').nth(2).click()
   await submit.click();await page.getByTestId('authored-result').waitFor()
   const text=await page.getByTestId('authored-result').textContent()
   record(width+'-equivalent-evidence-rejection-observed',text.includes('이번에는 어긋났어요'),{response:submissions.at(-1).body.response,text})
   await page.screenshot({path:path.join(out,width+'-equivalent-evidence.png'),fullPage:true})
   continue
  }
  record(width+'-'+f.format+'-incomplete',await submit.isDisabled(),null)
  const bars=page.locator('[aria-labelledby="passage-h"] ol li button')
  if(f.format==='central_meaning'){await bars.nth(0).focus();await page.keyboard.press('Enter');await bars.nth(1).click();await bars.nth(2).click();await page.getByRole('button',{name:'이유 · 조건을 대며 주장을 떠받친다',exact:true}).click()}
  if(f.format==='choice_evidence')await bars.nth(0).click()
  if(f.format==='contextual_sense')await bars.nth(2).click()
  if(f.format==='sentence_relation'){const groups=page.locator('[data-testid="authored-pairs"] > div');for(let i=0;i<2;i++)await groups.nth(i).getByRole('button',{name:pairLabel[f.response.pairs[i]],exact:true}).click()}
  if(f.format==='form_scope'){await page.getByRole('button',{name:'① is',exact:true}).click();await page.getByRole('button',{name:'수 일치',exact:true}).click()}
  if(f.format==='option_correspondence'){const groups=page.locator('[data-testid="authored-verdicts"] > div');for(let i=0;i<5;i++){await groups.nth(i).getByRole('button',{name:verdictLabel[f.response.options[i].verdict],exact:true}).click();await groups.nth(i).locator('select').selectOption(String(f.response.options[i].sentence))}}
  if(f.body.choices)await page.locator('fieldset').last().locator('button').nth(f.response.choice).click()
  record(width+'-'+f.format+'-ready',await submit.isEnabled(),null);await submit.click();await page.getByTestId('authored-result').waitFor()
  record(width+'-'+f.format+'-actual-grader-correct',(await page.getByTestId('authored-result').textContent()).includes('정확히 해냈어요'),submissions.at(-1).body.response)
  const bounds=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,small:[...document.querySelectorAll('button:not(:disabled),a,select:not(:disabled)')].filter(e=>e.getBoundingClientRect().height<43.9).map(e=>e.textContent)}))
  record(width+'-'+f.format+'-layout',bounds.overflow<=0&&bounds.small.length===0,bounds)
  await page.screenshot({path:path.join(out,width+'-'+f.format+'.png'),fullPage:true})
 }
 await page.close()
}record('no-runtime-errors-or-external-requests',errors.length===0&&external.length===0,{errors,external});record('no-authored-Gold-JSON-in-browser-bundle',goldInputs.length===0,{goldInputs})}
finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,altOnly?'equivalent-evidence-ui.json':'results.json'),JSON.stringify({head,scope:'Actual frozen Runner and grader with synthetic original content, stub API persistence/binding and Link; not full shell/auth/DB/PLAN E2E.',rows,alternativeCounterexample:alternative},null,2)+'\n')}
console.log('EQUIVALENT_EVIDENCE='+JSON.stringify({primary:alternative.primary.grade.isCorrect,alternative:alternative.equivalentAlternative.grade.isCorrect,combined:alternative.combined.grade.isCorrect}))
process.exitCode=rows.some(r=>!r.ok)?1:0
