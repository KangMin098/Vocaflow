// scripts/design/public-reference-check.mjs — actual public routes, fixtures absent, learning writes blocked.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {installFreezeMotion,freezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test'),browser=await chromium.launch()
const phase='after',out=process.env.CAPTURE_OUT??'tmp/s18/after',rows=[],blocked=[];fs.mkdirSync(out,{recursive:true})
const routes=[['home','/'],['about','/about'],['pricing','/pricing'],['privacy','/privacy'],['terms','/terms'],['video','/video'],['video-detail','/video/intro-platform'],['sitemap','/sitemap'],['join','/join/design-audit-invalid-code']]
try{for(const width of [1440,1280])for(const theme of ['light','dark']){
 const c=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});await blockLearningWrites(c,blocked)
 await c.addInitScript(t=>localStorage.setItem('vocaflow-theme',t),theme)
 const p=await c.newPage();await installFreezeMotion(p)
 for(const [state,route] of routes){try{
  const response=await p.goto('http://localhost:3041'+route,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(1200);await p.evaluate(()=>document.fonts.ready);await settleImages(p);await freezeMotion(p)
  const info=await p.evaluate(()=>({pathname:location.pathname,theme:document.documentElement.getAttribute('data-theme'),headings:[...document.querySelectorAll('h1')].filter(e=>e.getClientRects().length).map(e=>e.textContent),mainCount:document.querySelectorAll('main').length,overflow:document.documentElement.scrollWidth>innerWidth+1,errorLike:/Application error|Unhandled Runtime Error|문제가 생겼습니다/.test(document.body.innerText),images:[...document.images].map(i=>({src:new URL(i.currentSrc||i.src).pathname,loaded:i.complete&&i.naturalWidth>0})),scenes:[...document.querySelectorAll('.home-reference__scene,.video-reference__scene,.sitemap-reference__scene')].filter(i=>i.getClientRects().length).map(i=>({loaded:i.complete&&i.naturalWidth>0})),smallTargets:[...document.querySelectorAll('.home-reference a,.pricing-reference__plan a,.legal-reference nav a,.sitemap-reference a,.video-reference article h3 a,.video-detail-reference nav a,.join-reference a')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return {name:e.textContent?.trim(),width:b.width,height:b.height}}).filter(b=>b.width<44||b.height<44),bodyLength:document.body.innerText.length}))
  await p.screenshot({path:`${out}/${state}@${width}-${theme}.png`});if(width===1440&&theme==='light')await p.screenshot({path:`${out}/${state}@1440-light-full.png`,fullPage:true})
  const sceneRequired=['home','video','sitemap'].includes(state)
  const ok=response.status()===200&&info.pathname===route&&info.headings.length===1&&info.mainCount===1&&!info.overflow&&!info.errorLike&&info.theme===theme&&!info.smallTargets.length&&(!sceneRequired||(info.scenes.length===1&&info.scenes.every(i=>i.loaded)))
  rows.push({state,route,width,theme,ok,normalContent:state!=='join',status:response.status(),...info});console.log(`${ok?'PASS':'FAIL'} ${state}@${width}-${theme}`)
 }catch(e){rows.push({state,route,width,theme,ok:false,reason:e.name==='TimeoutError'?'timeout':e.message});console.log(`FAIL ${state}@${width}-${theme}`)}}await c.close()
}}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({at:new Date().toISOString(),base:'http://localhost:3041',rows,blockedWrites:blocked.length,note:'Join is the genuine invalid-code state, not a valid class invitation.'},null,2))}
console.log(`Renders ${rows.filter(r=>r.ok).length}/${rows.length}`);if(rows.some(r=>!r.ok))process.exitCode=1
