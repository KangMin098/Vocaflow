// apps/web/scripts/final-independent/probe-authored-formats7e.mjs
// Actual frozen Runner + grader in isolated Chromium; synthetic transport; no live DB.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),head='7e638e63d28791dcc4f886431c0205743dc3310a'
const run=fs.mkdtempSync(path.join(root,'.agent-logs/final-independent/formats7e-')),snapshot=path.join(run,'snapshot');fs.mkdirSync(snapshot)
execFileSync('git',['archive',head,'--format=tar','--output='+path.join(run,'source.tar'),'apps/web/src','apps/web/package.json','apps/web/tsconfig.json','packages','tsconfig.base.json'],{cwd:root,windowsHide:true})
execFileSync('tar.exe',['-xf',path.join(run,'source.tar'),'-C',snapshot],{windowsHide:true})
for(const dir of ['node_modules','apps/web/node_modules'])fs.symlinkSync(path.join(root,dir),path.join(snapshot,dir),'junction')
const req=createRequire(path.join(root,'apps/web/package.json')),{build}=createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild'),{chromium}=req('@playwright/test')
const builtGrade=await build({stdin:{contents:"export {FORMAT_SPECS} from './apps/web/src/lib/knowledge/authored/formats'",resolveDir:snapshot,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',tsconfig:path.join(snapshot,'apps/web/tsconfig.json')})
const mod={exports:{}};new Function('module','exports',builtGrade.outputFiles[0].text)(mod,mod.exports)
const spec=mod.exports.FORMAT_SPECS.choice_evidence,rows=[],submissions=[],errors=[],external=[]
const record=(id,ok,detail)=>{rows.push({id,ok,detail});console.log((ok?'PASS ':'FAIL ')+id);assert.equal(ok,true,id)}
const ds=[0,1,3,4].map(choice=>({choice,design:'distorted',why:'This option is unsupported by the displayed passage.'}))
const synthetic={id:'synthetic-complete-alt',body:{format:'choice_evidence',sentences:['The library closes at six.','The last bus leaves at six.','The library closes exactly when the last bus leaves.','A library card is required.','Parking is free on Sundays.'],stem:'When does the library close?',choices:['Four','Five','Six','Seven','Eight']},gold:{answer:2,decisive:0,evidence:[0],evidenceAlt:[1,2,3],decisiveAlt:[[1,2]],rationale:'The first sentence gives the time; the bus time and matching closure together give an equivalent proof.',distractors:ds}}
const full=JSON.parse(fs.readFileSync(path.join(snapshot,'apps/web/src/lib/knowledge/authored/r-inference.v1.json'),'utf8')),actual=full.items.find(i=>i.id==='inf-guided-1')
const sealed=JSON.parse(fs.readFileSync(path.join(root,'docs/research/final-independent-20261018/expansion-codex-reading.json'),'utf8')).items.find(i=>i.id===actual.id)
assert.ok(sealed);assert.equal(sealed.response.choice,actual.gold.answer)
record('actual-inf-guided-equivalent-evidence',spec.grade(actual.body,actual.gold,sealed.response,'v1').grade.isCorrect,{response:sealed.response})
record('synthetic-gold-valid',spec.validate(synthetic.body,synthetic.gold).length===0,null)
for(const [name,evidence,choice,expected] of [['primary',[0],2,true],['complete-alternative',[1,2],2,true],['incomplete-alternative',[1],2,false],['auxiliary-only',[3],2,false],['unrelated-extra',[1,2,4],2,false],['wrong-choice',[1,2],1,false],['primary-with-auxiliary',[0,3],2,true]]){
 const grade=spec.grade(synthetic.body,synthetic.gold,{choice,evidence},'v1').grade
 record(name,grade.isCorrect===expected,{grade,expected})
}
for(const bad of [[],[[]],[[4]]]){const valid=spec.validate(synthetic.body,{...synthetic.gold,decisiveAlt:bad}).length===0;record('alternative-validation-'+JSON.stringify(bad),valid===(bad.length===0),{valid,expectedValid:bad.length===0})}
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {AuthoredRunner} from './apps/web/src/components/csat/authored/AuthoredRunner';const root=createRoot(document.getElementById('root'));window.mount=(p)=>root.render(<AuthoredRunner key={p.id} {...p}/>);"
const built=await build({stdin:{contents:entry,resolveDir:snapshot,loader:'tsx'},bundle:true,write:false,outdir:'out',metafile:true,platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'apps/web/node_modules')],tsconfig:path.join(snapshot,'apps/web/tsconfig.json'),define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'link-only',setup(b){b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:"import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}",loader:'tsx',resolveDir:snapshot}))}}]})
assert.equal(Object.keys(built.metafile.inputs).some(x=>/authored\/.*\.json$/.test(x.replace(/\\/g,'/'))),false)
const js=built.outputFiles.find(f=>f.path.endsWith('.js')).contents,css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'',tokens=fs.readFileSync(path.join(snapshot,'packages/design-tokens/src/tokens.css'),'utf8')
const server=http.createServer((q,s)=>{s.setHeader('content-type',q.url==='/bundle.js'?'application/javascript':'text/html; charset=utf-8');s.end(q.url==='/bundle.js'?js:`<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;--bg:#fff;--bg2:#f8f8fa;--t1:#18181b;--t2:#71717a;--bd:#e4e4e7;--p:#18181b;--on-p:#fff;font-family:Arial,sans-serif}*{box-sizing:border-box}button{font:inherit}#root{width:672px;max-width:calc(100% - 48px);margin:24px auto}</style><div id="root"></div><script src="/bundle.js"></script></html>`)})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch()
const out=path.join(root,'docs/research/final-independent-20261018/formats7e');fs.mkdirSync(out,{recursive:true})
try{for(const width of [1280,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-18T10:00:00Z')});let active,failOnce=false
 await page.route('**/*',async route=>{const r=route.request();if(!r.url().startsWith(base)){external.push(r.url());return route.abort()}if(!r.url().includes('/api/'))return route.continue();const payload=r.postDataJSON();if(active.retry)submissions.push(payload);const graded=spec.grade(active.body,active.gold,payload.response,'v1');if(failOnce){failOnce=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic response loss after accepted submission'})})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({grade:graded.grade,reveal:{format:'choice_evidence',...spec.reveal(active.gold)},binding:{status:'bound',evidence:false}})})})
 await page.goto(base)
 const cases=[{...actual,id:'actual-inf-alternative',response:sealed.response,expected:true},{...synthetic,id:'complete-alt',response:{choice:2,evidence:[1,2]},expected:true},{...synthetic,id:'partial-alt',response:{choice:2,evidence:[1]},expected:false},{...synthetic,id:'retry',response:{choice:2,evidence:[1,2]},expected:true,retry:true}]
 for(const c of cases){active=c;failOnce=!!c.retry
  const p={id:c.id,deliveryId:'00000000-0000-4000-8000-000000000001',sessionId:'00000000-0000-4000-8000-000000000002',role:'independent_check',format:'choice_evidence',sentences:c.body.sentences,stem:c.body.stem,choices:c.body.choices,teach:null,hints:null,extra:{},probe:null,done:null,returnHref:'/csat/diagnosis?tab=map&view=full'}
  await page.evaluate(p=>window.mount(p),p);await page.getByTestId('authored-runner').waitFor()
  const bars=page.locator('[aria-labelledby="passage-h"] ol li button');for(const k of c.response.evidence)await bars.nth(k).click()
  await page.locator('fieldset').last().locator('button').nth(c.response.choice).click();const submit=page.getByRole('button',{name:'맞춰 보기',exact:true});await submit.click()
  if(c.retry){await page.getByRole('alert').waitFor();await page.clock.runFor(2000);await submit.click();const [a,b]=submissions.slice(-2);record(width+'-retry-identical-semantic-payload',JSON.stringify(a)===JSON.stringify(b),{sameId:a.clientMutationId===b.clientMutationId,sameSession:a.clientSessionId===b.clientSessionId,sameAnsweredAt:a.answeredAt===b.answeredAt})}
  await page.getByTestId('authored-result').waitFor();const text=await page.getByTestId('authored-result').textContent();record(width+'-'+c.id,text.includes(c.expected?'정확히 해냈어요':'이번에는 어긋났어요'),{expected:c.expected})
  record(width+'-'+c.id+'-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),null)
  if(c.id==='actual-inf-alternative')await page.screenshot({path:path.join(out,width+'-equivalent-evidence-fixed.png'),fullPage:true})
 }
 await page.close()
}record('no-runtime-errors-or-external-network',errors.length===0&&external.length===0,{errors,external})
}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({frozenCommit:head,scope:'Actual format grader and Runner, synthetic API response loss. No real shell, route auth, DB, human approval or full product E2E.',rows,submissions},null,2)+'\n')}