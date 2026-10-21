// scripts/design/auth-reference-check.mjs — genuine forms only; account/auth writes prohibited.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {blockLearningWrites} from './lib/read-only-context.mjs'
import {installFreezeMotion,freezeMotion,settleImages} from './lib/freeze-motion.mjs'
const require_=createRequire(path.join(process.cwd(),'apps/web/package.json'))
const {chromium}=require_('@playwright/test'),browser=await chromium.launch(),blocked=[],authBlocked=[],rows=[]
const phase=process.argv[2]??'after',out=process.env.CAPTURE_OUT??`tmp/s17/${phase}`;fs.mkdirSync(out,{recursive:true})
const routes=[['login','/login?next=%2Flibrary%2Fbooks'],['signup','/signup?next=%2Flibrary%2Fbooks'],['reset','/reset-password'],['update','/reset-password?mode=update'],['verify','/verify-email'],['verify-address','/verify-email?email=preview%40example.test&next=%2Flibrary%2Fbooks']]
try{for(const width of [1440,1280])for(const theme of ['light','dark']){
 const c=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});await blockLearningWrites(c,blocked)
 await c.route('**/auth/v1/**',async route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();authBlocked.push(route.request().method()+' '+new URL(route.request().url()).pathname);return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Auth write prohibited during design verification"}'})})
 await c.addInitScript(t=>{localStorage.setItem('vocaflow-theme',t);document.documentElement.setAttribute('data-theme',t)},theme)
 const p=await c.newPage();await installFreezeMotion(p)
 for(const [state,route] of routes){try{
  const response=await p.goto('http://localhost:3041'+route,{waitUntil:'domcontentloaded',timeout:45000});await p.locator('h1').waitFor();await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="테마 전환"]');const k=b&&Object.keys(b).find(k=>k.startsWith('__reactProps'));return k&&typeof b[k].onClick==='function'})
  await p.evaluate(()=>document.fonts.ready);await settleImages(p);await freezeMotion(p)
  const info=await p.evaluate(()=>({pathname:location.pathname,headings:[...document.querySelectorAll('h1')].map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.getAttribute('data-theme'),scenes:[...document.querySelectorAll('.auth-reference .reference-scene')].map(i=>({loaded:i.complete&&i.naturalWidth>0})),inputs:[...document.querySelectorAll('input')].map(i=>({type:i.type,autocomplete:i.autocomplete})),links:[...document.querySelectorAll('main a')].map(a=>({text:a.textContent?.trim(),href:a.getAttribute('href')})),smallTargets:[...document.querySelectorAll('.auth-reference a,.auth-reference button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')??e.textContent?.trim(),w:r.width,h:r.height}}).filter(r=>r.w<44||r.h<44)}))
  await p.screenshot({path:`${out}/${state}@${width}-${theme}.png`});if(width===1440&&theme==='light')await p.screenshot({path:`${out}/${state}@1440-light-full.png`,fullPage:true})
  let returnLinkOK=true
  if(phase==='after'&&(state==='login'||state==='signup')){
   const target=state==='login'?'/signup':'/login',link=info.links.find(l=>l.href?.startsWith(target)),url=link&&new URL(link.href,'http://localhost:3041')
   returnLinkOK=!!url&&url.pathname===target&&url.searchParams.get('next')==='/library/books'
  }
  const ok=response.status()===200&&info.pathname===new URL(route,'http://localhost:3041').pathname&&info.headings.length===1&&!info.overflow&&info.theme===theme&&returnLinkOK&&(phase==='before'||(info.scenes.length===1&&info.scenes[0].loaded&&!info.smallTargets.length))
  rows.push({state,route,width,theme,ok,...info});console.log(`${ok?'PASS':'FAIL'} ${state}@${width}-${theme}`)
 }catch(e){rows.push({state,route,width,theme,ok:false,reason:e.name==='TimeoutError'?'timeout':e.message});console.log(`FAIL ${state}@${width}-${theme}`)}}
 await c.close()
}}finally{await browser.close();fs.writeFileSync(`${out}/_report.json`,JSON.stringify({rows,blockedWrites:blocked.length,authWritesAttempted:authBlocked.length,note:'No registration, recovery email, token exchange or password update performed. Update marker renders a form, not proof of recovery authorization.'},null,2))}
console.log(`Renders ${rows.filter(r=>r.ok).length}/${rows.length}; auth writes ${authBlocked.length}`);if(rows.some(r=>!r.ok)||authBlocked.length)process.exitCode=1
