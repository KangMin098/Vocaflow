// scripts/csat/map/v62/supply-i1-browser.mjs
// Actual TaskInspector + supply/demand engines in isolated Chromium. No DB, accounts or external requests.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),req=createRequire(root+'/apps/web/package.json')
const {build}=createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const {chromium}=req('@playwright/test')
const out=root+'/docs/research/factory-i1-280-independent/browser'
fs.mkdirSync(out,{recursive:true})
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {TaskInspector,homeWsOf} from './apps/web/src/components/csat/diagnosis/map/TaskInspector';
import {taskInspector} from './apps/web/src/lib/csat/map/v62/graph';
import {ranksOf} from './apps/web/src/lib/csat/map/v62/rank';
import {view,att} from './scripts/research/lm-g1/fixture';
import {buildDemand} from './apps/web/src/lib/csat/map/v62/demand';
import {canonicalDemand} from './apps/web/src/lib/csat/map/v62/canonical-json';
import {ledgerKey} from './apps/web/src/lib/csat/map/v62/supply-ledger';
const r=createRoot(document.getElementById('root')),U='isolated-user',W='isolated-workspace',T='r.central_meaning';
window.renderScenario=(scenario)=>{
 const v=view(scenario==='repair'?[att('i1',false,10),att('i2',false,11)]:[],12),home=homeWsOf(T,v,null);
 const d=buildDemand(v,T,home,{workspaceId:W,planVersion:2,goalVersion:1}),old={...d,planVersion:1};
 const role=d.lines[0].role,current=canonicalDemand(U,d),past=canonicalDemand(U,old);
 const lines={};
 lines[ledgerKey(T,role,past)]={order:{state:'delivered',seq:9},delivered:2,requested:2,validDelivered:2};
 if(scenario==='partial')lines[ledgerKey(T,role,current)]={order:{state:'delivered',seq:1},delivered:5,requested:5,validDelivered:2};
 if(scenario==='full')lines[ledgerKey(T,role,current)]={order:{state:'delivered',seq:1},delivered:3,requested:3,validDelivered:3};
 const data={doneTaskIds:[],model:{},settings:{},practiceLinks:{r:{confirm:['i1','i2','i3','i4','i5','i6'].map(target=>({target,taskKey:'claim-support',href:'/csat/item/'+target+'?check=1',label:target}))}},v4:{viewer:U,transferTargets:{},saved:{status:'installed',goalVersionId:1,byTemplate:{[home]:{workspaceId:W,latest:{version:2},plan:v.plans[home]}}},supplyLedger:{[W]:scenario==='missing'?{status:'not_installed'}:{status:'installed',lines}}}};
 window.fixture={scenario,role,current,past};
 r.render(React.createElement(TaskInspector,{ins:taskInspector(T,v,ranksOf(v),null),view:v,data,past:false,restoreWs:home,planOpen:false,onTogglePlan:()=>{window.planOpened=true}}));
};window.renderScenario('old');`
const built=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},tsconfig:root+'/apps/web/tsconfig.json',nodePaths:[root+'/apps/web/node_modules'],bundle:true,write:false,outdir:'out',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolate-io',setup(b){
 b.onResolve({filter:/^(next\/link|next\/navigation)$|analytics\/client$|learner-path$|\/StepSheet$/},a=>({path:a.path,namespace:'io'}))
 b.onLoad({filter:/.*/,namespace:'io'},a=>({contents:a.path==='next/link'?`import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}`:a.path==='next/navigation'?`export const useRouter=()=>({refresh(){}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/csat/diagnosis'`:a.path.endsWith('learner-path')?`export const learnerPath=()=>({read:[],listen:[]})`:a.path.endsWith('/StepSheet')?`export const StepSheet=()=>null`:`export function track(){}`,loader:'tsx',resolveDir:root+'/apps/web'}))
}}]})
const js=built.outputFiles.find(f=>f.path.endsWith('.js')).contents,css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''
const tokens=fs.readFileSync(root+'/packages/design-tokens/src/tokens.css','utf8')
const server=http.createServer((q,s)=>{s.setHeader('content-type',q.url==='/bundle.js'?'application/javascript':'text/html; charset=utf-8');s.end(q.url==='/bundle.js'?js:`<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;background:#faf9f6}#root{width:440px;max-width:100%;margin:24px auto}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #265ac7}</style><div id="root"></div><script src="/bundle.js"></script></html>`)})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),results=[],errors=[],external=[]
const record=(id,ok,detail)=>{results.push({id,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${id}`)}
try{for(const width of [1280,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{if(route.request().url().startsWith(base))return route.continue();external.push(route.request().url());return route.abort()})
 await page.goto(base);await page.waitForSelector('[data-testid="inspector-supply"]')
 for(const scenario of ['old','partial','full','missing','repair']){
  await page.evaluate(s=>window.renderScenario(s),scenario);await page.waitForTimeout(100)
  const rows=await page.locator('[data-testid="inspector-supply"] li').evaluateAll(xs=>xs.map(x=>({role:x.dataset.role,state:x.dataset.state,step:x.dataset.step,text:x.textContent})))
  const pass=scenario==='old'?rows.every(x=>x.step!=='delivered'):scenario==='partial'?rows.some(x=>x.step==='partially_delivered'):scenario==='full'?rows.some(x=>x.step==='delivered'):scenario==='missing'?rows.every(x=>!['ordered','delivered','producing'].includes(x.step)):rows.some(x=>x.state==='readable_unreviewed'&&x.step==='read_now'&&x.text.includes('검수 전'))
  record(`${width}-${scenario}`,pass,rows)
  record(`${width}-${scenario}-no-page-overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),null)
  if(['partial','repair'].includes(scenario))await page.screenshot({path:`${out}/${width}-${scenario}.png`,fullPage:true})
 }
 const details=page.locator('details').first();if(await details.count()){const before=await details.getAttribute('open');await details.locator(':scope > summary').focus();await page.keyboard.press('Enter');record(`${width}-keyboard-disclosure`,(await details.getAttribute('open'))!==before,null)}
 await page.close()
}record('no-runtime-errors-or-external-requests',errors.length===0&&external.length===0,{errors,external})}
finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(out+'/results.json',JSON.stringify({scope:'Isolated actual TaskInspector with synthetic read-only data. Legacy StepSheet/learnerPath/navigation/analytics are IO stubs. Not live DB E2E.',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),results},null,2)+'\n')}
process.exitCode=results.some(r=>!r.ok)?1:0
