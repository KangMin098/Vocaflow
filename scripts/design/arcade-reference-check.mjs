// scripts/design/arcade-reference-check.mjs — public catalogue and genuine brief dialogs, writes blocked.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {installFreezeMotion,freezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test'),browser=await chromium.launch()
const phase=process.argv[2]??'after',out=process.env.CAPTURE_OUT??`tmp/s16/${phase}`;fs.mkdirSync(out,{recursive:true})
const rows=[],blocked=[],book='66b084a0-72a1-414a-98ea-3c27308772fc'
const scoped=`/arcade?book=${book}&chapter=1`
async function hydrated(page){await page.waitForFunction(()=>{const e=document.querySelector('.arc-brief');const k=e&&Object.keys(e).find(k=>k.startsWith('__reactProps'));return k&&typeof e[k].onClick==='function'})}
try{for(const width of [1440,1280])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});await blockLearningWrites(context,blocked)
 await context.addInitScript(t=>{localStorage.setItem('vocaflow-theme',t);document.documentElement.setAttribute('data-theme',t)},theme)
 const page=await context.newPage();await installFreezeMotion(page)
 async function shot(state){
  await page.evaluate(()=>document.fonts.ready);await settleImages(page);await freezeMotion(page)
  const info=await page.evaluate(()=>{
   const banner=document.querySelector('.arc-scope'),ratios=[]
   if(banner){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')
    const lum=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
    const bg=lum(getComputedStyle(banner).backgroundColor)
    for(const e of banner.querySelectorAll('.arc-scope-tag,strong,.arc-scope-sub,.arc-scope-clear')){const fg=lum(getComputedStyle(e).color);ratios.push((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05))}
   }
   return {pathname:location.pathname,theme:document.documentElement.getAttribute('data-theme'),headings:[...document.querySelectorAll('h1')].filter(e=>e.getClientRects().length).map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,dialogs:document.querySelectorAll('[role="dialog"]').length,playHrefs:[...document.querySelectorAll('.arc-grid a[href^="/play/"]')].map(a=>a.getAttribute('href')),scenes:[...document.querySelectorAll('.arc-head .reference-scene')].map(i=>({loaded:i.complete&&i.naturalWidth>0})),scope:banner?.textContent,scopeContrast:ratios}
  })
  await page.screenshot({path:`${out}/${state}@${width}-${theme}.png`});if(width===1440&&theme==='light')await page.screenshot({path:`${out}/${state}@1440-light-full.png`,fullPage:true})
  const ok=info.pathname==='/arcade'&&info.headings.length===1&&!info.overflow&&info.theme===theme&&info.playHrefs.length>0&&(phase==='before'||(info.scenes.length===1&&info.scenes[0].loaded&&info.scopeContrast.every(r=>r>=4.5)))
  rows.push({state,width,theme,ok,...info});console.log(`${ok?'PASS':'FAIL'} ${state}@${width}-${theme}`)
 }
 try{
  await page.goto('http://localhost:3041/arcade',{waitUntil:'domcontentloaded',timeout:45000});await hydrated(page);await shot('arcade')
  if(phase==='after'&&((width===1440&&theme==='light')||(width===1280&&theme==='dark'))){await page.locator('#bay-recall').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/cards@${width}-${theme}.png`})}
  await page.locator('.arc-slot:not(.arc-slot--family) .arc-brief').first().click();await page.getByRole('dialog').waitFor();await shot('brief');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state?.vocaflowOverlay)
  await page.locator('.arc-slot--family .arc-brief').first().click();await page.getByRole('dialog').waitFor();await shot('family');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state?.vocaflowOverlay)
  await page.goto('http://localhost:3041'+scoped,{waitUntil:'domcontentloaded',timeout:45000});await hydrated(page);await page.evaluate(()=>scrollTo(0,0));await shot('scoped')
 }catch(e){rows.push({state:'flow',width,theme,ok:false,reason:String(e.message).slice(0,180)});console.log(`FAIL flow@${width}-${theme}: ${String(e.message).slice(0,100)}`)}
 await context.close()
}}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({rows,blockedWrites:blocked.length,scoped,note:'Actual public catalogue, real book scope, real rule/trial component; no session writes.'},null,2))}
console.log(`Renders ${rows.filter(r=>r.ok).length}/${rows.length}`);if(rows.some(r=>!r.ok))process.exitCode=1
