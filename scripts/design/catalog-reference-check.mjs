// scripts/design/catalog-reference-check.mjs — real public catalogue regression captures; writes blocked.
// Run from repository root. Optional first argument: before (baseline); default: after.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {freezeMotion,installFreezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test')
const phase=process.argv[2]??'after',out=process.env.CAPTURE_OUT??`tmp/s13/${phase}`;fs.mkdirSync(out,{recursive:true})
const routes=['/library/scripts','/library/vocab','/library/textbooks','/library/textbooks/reading','/library/textbooks/vocab','/library/textbooks/syntax']
const browser=await chromium.launch(),renders=[],blocked=[]
try{
 for(const width of [1440,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'})
  await blockLearningWrites(context,blocked)
  await context.addInitScript(value=>{localStorage.setItem('vocaflow-theme',value);document.documentElement.setAttribute('data-theme',value)},theme)
  const page=await context.newPage();await installFreezeMotion(page)
  for(const route of routes){
   const key=`${route.slice(1).replaceAll('/','_')}@${width}-${theme}`
   try{
    const res=await page.goto('http://localhost:3041'+route,{waitUntil:'domcontentloaded',timeout:45000})
    await page.locator('h1').first().waitFor({timeout:15000});await page.evaluate(()=>document.fonts.ready);await settleImages(page);await freezeMotion(page)
    if(phase==='after'){
     const selector=route==='/library/vocab'?'[data-vocab-wall] [role="group"]':route==='/library/scripts'?'button[aria-label*="학습 안내 보기"]':'input[placeholder="권 이름 · 학년 · 유형으로 찾기"]'
     await page.waitForFunction(selector=>{const e=document.querySelector(selector);return e&&Object.keys(e).some(k=>k.startsWith('__reactProps'))},selector,{timeout:20000})
     await settleImages(page)
     await page.waitForFunction(()=>[...document.querySelectorAll('[data-vocab-wall] img,figure img')].every(i=>i.complete&&i.naturalWidth>0),{},{timeout:20000})
    }
    const info=await page.evaluate(()=>({route:location.pathname,theme:document.documentElement.getAttribute('data-theme'),headings:[...document.querySelectorAll('h1')].map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,scenes:[...document.querySelectorAll('img.reference-scene')].map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')})),links:[...document.querySelectorAll('main a')].map(a=>({text:a.textContent?.trim().slice(0,60),href:a.getAttribute('href')})),buttons:[...document.querySelectorAll('main button')].slice(0,40).map(b=>({text:b.textContent?.trim().slice(0,80),label:b.getAttribute('aria-label')}))}))
    if(info.route!==route||info.headings.length!==1||info.overflow||info.theme!==theme||res.status()!==200)throw Error('Route / heading / overflow / theme / HTTP assertion failed')
    if(phase==='after'&&(info.scenes.length!==1||!info.scenes.every(s=>s.loaded)))throw Error('Approved hero scene not loaded')
    if(phase==='after'&&route.endsWith('/vocab')&&route.includes('textbooks')&&!info.headings[0].includes('Vocab'))throw Error('Vocab series title differs')
    if(phase==='after'&&route.endsWith('/syntax')&&!info.headings[0].includes('Syntax'))throw Error('Syntax series title differs')
    await page.screenshot({path:`${out}/${key}.png`})
    if(width===1440&&theme==='light')await page.screenshot({path:`${out}/${key}-full.png`,fullPage:true})
    renders.push({route,width,theme,ok:true,...info});console.log(`PASS ${key}`)
   }catch(e){renders.push({route,width,theme,ok:false,reason:e.name==='TimeoutError'?'timeout':e.message});console.log(`FAIL ${key}`)}
  }
  await context.close()
 }
}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({scope:'real public routes, anonymous, learning writes blocked',renders,blockedWrites:blocked.length},null,2))}
console.log(`Public route renders ${renders.filter(r=>r.ok).length}/${renders.length}`)
if(renders.some(r=>!r.ok))process.exitCode=1
