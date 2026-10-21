// scripts/design/fit-reference-check.mjs — live public diagnosis states; no stored learning writes.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {installFreezeMotion,freezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test'),browser=await chromium.launch()
const phase=process.argv[2]??'after',out=process.env.CAPTURE_OUT??`tmp/s15/${phase}`;fs.mkdirSync(out,{recursive:true})
const rows=[],blocked=[]
const hydrate=page=>page.waitForFunction(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='지우기');const k=e&&Object.keys(e).find(k=>k.startsWith('__reactProps'));return k&&typeof e[k].onClick==='function'})
try{for(const width of [1440,1280])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});await blockLearningWrites(context,blocked)
 await context.addInitScript(t=>{localStorage.setItem('vocaflow-theme',t);document.documentElement.setAttribute('data-theme',t)},theme)
 const page=await context.newPage();await installFreezeMotion(page)
 async function shot(state,route){
  try{
   await page.evaluate(()=>document.fonts.ready);await settleImages(page);await freezeMotion(page)
   const info=await page.evaluate(()=>({pathname:location.pathname,headings:[...document.querySelectorAll('h1')].filter(e=>e.getClientRects().length>0).map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.getAttribute('data-theme'),scenes:[...document.querySelectorAll('.fit-reference img.reference-scene')].map(i=>({loaded:i.complete&&i.naturalWidth>0}))}))
   await page.screenshot({path:`${out}/${state}@${width}-${theme}.png`});if(width===1440&&theme==='light')await page.screenshot({path:`${out}/${state}@1440-light-full.png`,fullPage:true})
   if(info.pathname!==route||info.headings.length!==1||info.overflow||info.theme!==theme)throw Error(JSON.stringify(info))
   if(phase==='after'&&(info.scenes.length!==1||!info.scenes[0].loaded))throw Error('approved scene not loaded')
   rows.push({state,width,theme,ok:true,...info});console.log(`PASS ${state}@${width}-${theme}`)
  }catch(e){rows.push({state,width,theme,ok:false,reason:e.name==='TimeoutError'?'timeout':e.message});console.log(`FAIL ${state}@${width}-${theme}`)}
 }
 try{
  await page.goto('http://localhost:3041/fit',{waitUntil:'domcontentloaded',timeout:45000});await page.getByRole('region',{name:'레벨 프로파일'}).waitFor();await hydrate(page)
  await shot('fit','/fit')
  await page.getByRole('button',{name:'학급에 나눠 줄 한 장으로',exact:true}).click();await page.locator('#fit-class-sheet').waitFor();await page.evaluate(()=>scrollTo(0,0));await shot('sheet','/fit')
  await page.getByRole('button',{name:'결과 링크 복사',exact:true}).click();await page.waitForURL(u=>u.pathname.startsWith('/fit/s/'));const shareRoute=new URL(page.url()).pathname
  if(width===1440&&theme==='light')fs.writeFileSync('tmp/s15/share-path.txt',shareRoute)
  await page.goto('http://localhost:3041'+shareRoute,{waitUntil:'domcontentloaded'});await page.getByRole('region',{name:'레벨 프로파일'}).waitFor();await shot('shared',shareRoute)
  await page.goto('http://localhost:3041/fit',{waitUntil:'domcontentloaded'});await hydrate(page);await page.getByRole('button',{name:'지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#fit-input')?.value==='');await page.evaluate(()=>scrollTo(0,0));await shot('empty','/fit')
 }catch(e){rows.push({state:'flow',width,theme,ok:false,reason:String(e.message).slice(0,130)});console.log(`FAIL flow@${width}-${theme}`)}
 await context.close()
}}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({rows,blockedWrites:blocked.length,note:'Actual server sample and locally shared profile. No synthetic result fixture.'},null,2))}
console.log(`Renders ${rows.filter(r=>r.ok).length}/${rows.length}`);if(rows.some(r=>!r.ok))process.exitCode=1
