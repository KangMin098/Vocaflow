// scripts/design/learning-environment-check.mjs — real UI isolation; synthetic state; no auth/backend.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=process.cwd(),require=createRequire(path.join(root,'apps/web/package.json')),{chromium}=require('@playwright/test'),esbuild=createRequire(require.resolve('vitest/package.json'))('esbuild')
const phase=process.argv[2]||'after',out=process.argv[3]||`tmp/learning-environment/${phase}`;fs.mkdirSync(out,{recursive:true})
const bundle=await esbuild.build({entryPoints:['scripts/design/fixtures/learning-environment.tsx'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:'apps/web/tsconfig.json',nodePaths:[path.join(root,'apps/web/node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){
 if(phase==='before'&&process.env.LEARNING_VIEWS==='library')b.onLoad({filter:/VocabSeriesHeader\.tsx$/},a=>({loader:'tsx',resolveDir:path.dirname(a.path),contents:fs.readFileSync(a.path,'utf8').replace('data-learner-tone={MATERIAL_TONE.word_set.tint}','').replace('data-learner-stage','')}))
 b.onResolve({filter:/^(next\/(image|link|navigation)|@\/components\/wordvault\/hooks\/useFacetSummary|@\/lib\/(supabase\/client|analytics\/client|articles\/start-learning))$/},a=>({path:a.path,namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'jsx',resolveDir:path.join(root,'apps/web'),contents:a.path.includes('useFacetSummary')?'export function useFacetSummary(){const facet=new URLSearchParams(location.search).get("facet");return facet?{status:"ready",data:{weakest:{facet},distribution:{}}}:{status:"unavailable",data:null}}':a.path==='next/navigation'?'export function usePathname(){const q=new URLSearchParams(location.search);return q.get("route")||({practice:"/practice",library:"/library/vocab",topics:"/hub",card:"/flashcard",reader:"/text/synthetic"}[q.get("view")]||"/practice")}export function useRouter(){return{push(){throw Error("Navigation blocked")},refresh(){throw Error("Navigation blocked")}}}':a.path==='next/link'?'import React from "react";export default function Link({children,onClick,...p}){return <a {...p} onClick={e=>{e.preventDefault();onClick?.(e)}}>{children}</a>}':a.path==='next/image'?'import React from "react";export default function Image({fill,priority,unoptimized,loader,placeholder,blurDataURL,...p}){return <img {...p}/>}':a.path.includes('analytics')?'export function track(){}':a.path.includes('start-learning')?'export function startArticleLearning(){throw Error("Writes blocked")}':'export function createClient(){throw Error("DB blocked")}'}))
}}]})
const css=fs.readFileSync('apps/web/.next-dev/static/css/app/layout.css','utf8')+'\n'+['apps/web/src/components/layout/learner-reference.css','packages/design-tokens/src/skins/learner-pc.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n')
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');res.setHeader('cache-control','no-store')
 if(u.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko" data-skin="tines"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:var(--bg);color:var(--t1);font-family:var(--font-display)}a:focus-visible,button:focus-visible{outline:2px solid var(--p);outline-offset:3px}</style><body><div id="root"></div><script>document.documentElement.dataset.theme=new URLSearchParams(location.search).get("theme")||"light"</script><script src="/fixture.js"></script></body></html>')}
 if(u.pathname==='/app.css'){res.setHeader('content-type','text/css');return res.end(css)}
 if(u.pathname==='/fixture.js'){res.setHeader('content-type','application/javascript');return res.end(bundle.outputFiles[0].contents)}
 let file;if(/^\/illustrations\/tines\/[a-z0-9-]+\.(webp|png)$/.test(u.pathname))file=path.join(root,'apps/web/public',u.pathname)
 if(/^\/_next\/static\/media\/[a-z0-9._-]+\.woff2?$/i.test(u.pathname))file=path.join(root,'apps/web/.next-dev/static/media',path.basename(u.pathname))
 if(file&&fs.existsSync(file)){res.setHeader('content-type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'font/woff2');return fs.createReadStream(file).pipe(res)}res.writeHead(404);res.end()
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),results=[],blocked=[]
try{for(const width of[1440,1280])for(const theme of['light','dark']){
 const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await c.route('**/*',r=>{const q=r.request();if(q.method()==='GET'&&new URL(q.url()).origin===base)return r.continue();blocked.push(q.method()+' '+new URL(q.url()).pathname);return r.abort()});const p=await c.newPage()
 for(const view of['practice','library','topics','card','reader'].filter(v=>!process.env.LEARNING_VIEWS||process.env.LEARNING_VIEWS.split(',').includes(v))){
 for(const facet of process.env.IMAGE_QUALITY==='1'&&view==='practice'?['recognize','spell','sound','build','use','fluency']:['']){
 const row={view,width,theme,facet,ok:false};try{
 await p.goto(`${base}/?view=${view}&theme=${theme}&facet=${facet}`,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);await p.locator('main').waitFor()
 if(view==='card'){
  const card=p.getByRole('button',{name:'카드 뒤집어 정답 확인',exact:true});await card.waitFor()
  if(phase==='after'){
   await p.waitForFunction(()=>document.querySelector('[data-card-face="back"]')?.inert===true)
   assert.equal(await card.locator('[data-card-face="front"] img').count(),0)
   assert.equal(await p.getByRole('img',{name:'understanding',exact:true}).count(),0,'Answer illustration must not be exposed before reveal')
   const mark=p.getByRole('button',{name:'북마크 추가'});await mark.focus();assert.equal(await mark.evaluate(e=>e===document.activeElement),true)
  }
  await p.screenshot({path:`${out}/card-front@${width}-${theme}.png`,fullPage:true});await p.locator('#reveal').click();await p.waitForTimeout(500)
  row.clipped=await p.getByRole('button',{name:'카드 앞면 보기',exact:true}).locator(':scope > div').evaluateAll(xs=>xs.map(e=>({client:e.clientHeight,scroll:e.scrollHeight,clipped:e.scrollHeight>e.clientHeight+1})))
  if(phase==='after')assert.ok(row.clipped.every(r=>!r.clipped),'Card explanation clipped')
  if(phase==='after'){
   assert.equal(await p.getByRole('button',{name:'북마크 추가'}).count(),0,'Hidden front must not remain in keyboard/accessibility order')
   await p.getByRole('img',{name:'understanding',exact:true}).waitFor()
   const enlarge=p.getByRole('button',{name:'삽화 확대',exact:true});await enlarge.focus();await enlarge.press('Enter')
   const dialog=p.getByRole('dialog',{name:'삽화 확대',exact:true});await dialog.waitFor()
   await p.keyboard.press('1');await p.keyboard.press('r')
   assert.ok(await dialog.getByRole('img',{name:'understanding',exact:true}).count())
   await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'})
   assert.equal(await enlarge.evaluate(e=>e===document.activeElement),true,'Illustration closes back to its trigger')
   assert.equal(await p.locator('#shortcut-count').textContent(),'합성 단축키 기록: 0/0','Modal input must not rate/exit the learning session')
   await p.keyboard.press('1');assert.equal(await p.locator('#shortcut-count').textContent(),'합성 단축키 기록: 1/0','Normal rating shortcut must resume after closing')
   assert.equal(await p.getByRole('button',{name:'카드 앞면 보기',exact:true}).count(),1,'Illustration click must not flip the card')
   await p.screenshot({path:`${out}/card-default@${width}-${theme}.png`,fullPage:true})
   await p.evaluate(()=>{const entries=[...document.querySelectorAll('[data-learner-flashcard] :is(h2,h3,p,span,button,kbd)')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const[e,size]of entries)e.style.fontSize=size*2+'px';for(const e of document.querySelectorAll('[data-card-face]')){e.style.lineHeight='1.5';e.style.letterSpacing='0.12em';e.style.wordSpacing='0.16em'}})
   row.expanded=await p.locator('[data-card-face="back"]').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth}))
   assert.ok(row.expanded.scroll<=row.expanded.client+1&&row.expanded.scrollWidth<=row.expanded.width+1,'Expanded text clipped')
   await p.screenshot({path:`${out}/card-expanded@${width}-${theme}.png`,fullPage:true})
  }
 }
 if(view==='reader'){await p.locator('#type').click();await p.getByRole('button',{name:'글자 크기 아주 크게',exact:true}).click();await p.getByRole('button',{name:'줄 간격 넓게',exact:true}).click();await p.keyboard.press('Escape');assert.equal(await p.locator('article').evaluate(e=>getComputedStyle(e).fontSize),'22px');assert.equal(await p.locator('#type').evaluate(e=>e===document.activeElement),true)}
 if(phase==='after'&&view==='practice'){
  if(process.env.IMAGE_QUALITY==='1'){
   const images=await p.locator('[data-learner-facet] img').evaluateAll(xs=>xs.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0,width:e.getBoundingClientRect().width,alt:e.getAttribute('alt')})))
   assert.equal(images.length,6);assert.equal(new Set(images.map(e=>e.src)).size,6);assert.ok(images.every(e=>e.loaded&&e.alt===''&&e.src.endsWith('-v5.png')))
   assert.equal(await p.locator('[data-learner-lead]').getAttribute('data-learner-facet'),facet)
   const lead=await p.locator('.practice-editorial-lead').boundingBox();assert.ok(lead.width>=380&&lead.height>=250,'Lead detail must remain readable')
   row.art=images
  }
  const expected={recognize:'lavender',spell:'yellow',sound:'teal',build:'yellow',use:'peach',fluency:'lavender'}
  row.tones=await p.locator('[data-learner-facet]').evaluateAll(xs=>xs.map(e=>({facet:e.dataset.learnerFacet,tone:e.dataset.learnerTone,bg:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color})))
  for(const x of row.tones)assert.equal(x.tone,expected[x.facet])
 }
 if(phase==='after'&&view==='topics')assert.deepEqual(await p.locator('[data-learner-tone]').evaluateAll(xs=>[...new Set(xs.map(e=>e.dataset.learnerTone))]),['peach'])
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 await p.screenshot({path:`${out}/${view}${facet?"-"+facet:""}@${width}-${theme}.png`,fullPage:true});row.ok=true;console.log(`PASS ${view} ${width} ${theme}`)
 }catch(e){row.error=e.message.slice(0,400);console.log(`FAIL ${view} ${width} ${theme}: ${row.error.slice(0,180)}`)}results.push(row)
 }}await c.close()
 }
 if(phase==='after')for(const{route,width}of[{route:'/admin',width:1440},{route:'/csat',width:1440},{route:'/flashcard',width:1023}]){
 const row={view:'boundary',route,width,ok:false},c=await browser.newContext({viewport:{width,height:1000}}),p=await c.newPage()
 try{await p.goto(`${base}/?view=card&route=${route}`,{waitUntil:'networkidle'});const card=p.getByRole('button',{name:'카드 뒤집어 정답 확인',exact:true});assert.equal(await card.evaluate(e=>getComputedStyle(e).height),'380px');assert.equal(await p.locator('[data-card-face="back"]').evaluate(e=>e.inert),false);row.ok=true;console.log('PASS boundary '+route+' '+width)}catch(e){row.error=e.message;console.log('FAIL boundary '+route+' '+width)}results.push(row);await c.close()
 }
 if(process.env.IMAGE_QUALITY==='1')for(const item of [{view:'practice',route:'/practice',width:1023},{view:'banner',route:'/flashcard',width:1023},{view:'banner',route:'/flashcard',width:1440},{view:'banner',route:'/dictate',width:1440},{view:'banner',route:'/spellforge',width:1440},{view:'banner',route:'/scriptquiz',width:1440},{view:'banner',route:'/csat/words',width:1440}]){
  const row={...item,view:'art-boundary',ok:false},c=await browser.newContext({viewport:{width:item.width,height:1000}}),p=await c.newPage()
  try{await p.goto(`${base}/?view=${item.view}&route=${encodeURIComponent(item.route)}`,{waitUntil:'networkidle'});await p.locator('main').waitFor();const art=await p.locator('img').evaluateAll(xs=>xs.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>e.getAttribute('src')));const updated=item.width>=1024&&!item.route.startsWith('/csat');assert.equal(art.some(s=>s.endsWith('-v5.png')),updated);assert.ok(art.length>0);row.sources=art;row.ok=true;console.log('PASS art boundary '+item.route+' '+item.width);await p.screenshot({path:`${out}/boundary-${item.view}-${item.route.replaceAll('/','-')}-${item.width}.png`,fullPage:true})}catch(e){row.error=e.message;console.log('FAIL art boundary '+item.route+' '+e.message)}results.push(row);await c.close()
 }
}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(`${out}/report.json`,JSON.stringify({phase,scope:'Real components, synthetic data, not account or human acceptance',results,blocked},null,2))}
if(results.some(r=>!r.ok)||blocked.length)process.exitCode=1
