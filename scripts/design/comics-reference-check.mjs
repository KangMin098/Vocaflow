// scripts/design/comics-reference-check.mjs — actual public comics catalogue, no learning writes.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {installFreezeMotion,freezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test'),browser=await chromium.launch()
const phase=process.argv[2]??'after',out=process.env.CAPTURE_OUT??`tmp/s14/${phase}`;fs.mkdirSync(out,{recursive:true})
const renders=[],blocked=[],routes=['/comics/adapted','/comics/restored']
try{
 for(const width of [1440,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});await blockLearningWrites(context,blocked)
  await context.addInitScript(t=>{localStorage.setItem('vocaflow-theme',t);document.documentElement.setAttribute('data-theme',t)},theme)
  const page=await context.newPage();await installFreezeMotion(page)
  for(let ri=0;ri<routes.length;ri++){
   const route=routes[ri],slug=route.slice(1).replaceAll('/','_').replace(/[?=&]/g,'_'),key=`${slug}@${width}-${theme}`
   try{
    const res=await page.goto('http://localhost:3041'+route,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('h1').first().waitFor({timeout:15000});await page.evaluate(()=>document.fonts.ready);await settleImages(page);await freezeMotion(page)
    if(phase==='after')await page.waitForFunction(()=>[...document.querySelectorAll('[data-reference-cover]')].every(e=>{const i=e.querySelector('img'),f=e.querySelector('[data-cover-fallback]');return (i?.complete&&i.naturalWidth>0)||(f&&getComputedStyle(f).display!=='none')}),{},{timeout:20000})
    const info=await page.evaluate(()=>({pathname:location.pathname,search:location.search,headings:[...document.querySelectorAll('h1')].map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.getAttribute('data-theme'),scenes:[...document.querySelectorAll('.reference-scene')].map(i=>({loaded:i.complete&&i.naturalWidth>0})),links:[...document.querySelectorAll('main a')].map(a=>({text:a.textContent?.trim().slice(0,65),href:a.getAttribute('href')})),buttons:[...document.querySelectorAll('main button')].slice(0,30).map(b=>({text:b.textContent?.trim().slice(0,60),label:b.getAttribute('aria-label')})),failedMedia:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,visibleFailedMedia:[...document.querySelectorAll('[data-reference-cover] img')].filter(i=>i.complete&&i.naturalWidth===0&&getComputedStyle(i).visibility!=='hidden').length,fallbacks:document.querySelectorAll('[data-cover-fallback]').length}))
    if(res.status()!==200||info.pathname+info.search!==route||info.headings.length!==1||info.overflow||info.theme!==theme)throw Error('HTTP / route / title / overflow / theme assertion')
    if(phase==='after'&&(info.scenes.length!==1||!info.scenes[0].loaded||info.visibleFailedMedia))throw Error('Comics scene or failed media display')
    if(width===1440&&theme==='light'){
     if(route==='/comics/adapted'){const detail=info.links.find(l=>/^\/comics\/adapted\//.test(l.href??''))?.href;if(detail&&!routes.includes(detail))routes.push(detail)}
     if(route==='/comics/restored'){const series=info.links.find(l=>l.href?.startsWith('/comics/restored?series='))?.href;if(series&&!routes.includes(series))routes.splice(2,0,series)}
    }
    await page.screenshot({path:`${out}/${key}.png`});if(width===1440&&theme==='light')await page.screenshot({path:`${out}/${key}-full.png`,fullPage:true})
    renders.push({route,width,theme,ok:true,...info});console.log(`PASS ${key}`)
   }catch(e){renders.push({route,width,theme,ok:false,reason:e.name==='TimeoutError'?'timeout':e.message});console.log(`FAIL ${key}`)}
  }
  await context.close()
 }
}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({scope:'actual anonymous public comic routes; writes blocked',routes,renders,blockedWrites:blocked.length},null,2))}
console.log(`Public comics renders ${renders.filter(r=>r.ok).length}/${renders.length}`)
if(renders.some(r=>!r.ok))process.exitCode=1
