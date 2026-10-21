// scripts/design/video-recovery-check.mjs — real React component/CSS isolation, no backend or auth.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=process.cwd(),require=createRequire(path.join(root,'apps/web/package.json')),{chromium}=require('@playwright/test'),esbuild=createRequire(require.resolve('vitest/package.json'))('esbuild')
const out=process.argv[2]||'tmp/learner-residual-20261021/isolated';fs.mkdirSync(out,{recursive:true})
const build=await esbuild.build({entryPoints:['scripts/design/fixtures/video-recovery.tsx'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:'apps/web/tsconfig.json',nodePaths:[path.join(root,'apps/web/node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'no-backend',setup(b){
 b.onResolve({filter:/^(next\/image|next\/navigation|@\/lib\/analytics\/client)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'jsx',resolveDir:path.join(root,'apps/web'),contents:a.path==='next/navigation'?'export function usePathname(){return new URLSearchParams(location.search).get("route")||"/about"}':a.path.includes('analytics')?'export function track(event){(window.videoFixtureEvents??=[]).push(event.name)}':'import React from "react";export default function Image({fill,priority,unoptimized,loader,placeholder,blurDataURL,style,...p}){return <img {...p} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...style}}/>}'}))
}}]})
const css=fs.readFileSync('apps/web/.next-dev/static/css/app/layout.css','utf8'),requests=[]
let syntheticMedia, recoveryAttempts=0
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');requests.push(u.pathname);res.setHeader('cache-control','no-store')
 if(u.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko" data-skin="tines"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><style>body{background:var(--bg);color:var(--t1);font-family:var(--font-display)}</style><body><div id="root"></div><script>document.documentElement.dataset.theme=new URLSearchParams(location.search).get("theme")||"light"</script><script src="/fixture.js"></script></body></html>')}
 if(u.pathname==='/fixture.js'){res.setHeader('content-type','application/javascript');return res.end(build.outputFiles[0].contents)}
 if(u.pathname==='/app.css'){res.setHeader('content-type','text/css');return res.end(css)}
 if(u.pathname==='/media/recovering.webm'&&++recoveryAttempts>1){res.setHeader('content-type','video/webm');res.setHeader('content-length',syntheticMedia.length);return res.end(syntheticMedia)}
 if(u.pathname==='/media/poster.svg'){res.setHeader('content-type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#e4eee7"/><text x="140" y="360" font-size="52" fill="#005d35">Synthetic poster</text></svg>')}
 if(/^\/illustrations\/tines\/[a-z0-9-]+\.(webp|png)$/.test(u.pathname)){res.setHeader('content-type',u.pathname.endsWith('.png')?'image/png':'image/webp');return fs.createReadStream(path.join(root,'apps/web/public',u.pathname)).pipe(res)}
 if(/^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2?$/.test(u.pathname)){res.setHeader('content-type','font/woff2');return fs.createReadStream(path.join(root,'apps/web/.next-dev/static/media',path.basename(u.pathname))).pipe(res)}
 res.writeHead(404);res.end()
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),results=[],blocked=[]
const check=async(name,run)=>{try{const data=await run();results.push({name,ok:true,...data});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message.slice(0,400)});console.log('FAIL '+name+' '+e.message.slice(0,130))}}
try{
 const recorderPage=await browser.newPage()
 syntheticMedia=Buffer.from(await recorderPage.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180
  const ctx=canvas.getContext('2d'),stream=canvas.captureStream(12),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[]
  recorder.ondataavailable=e=>chunks.push(e.data)
  const stopped=new Promise(r=>recorder.onstop=r);recorder.start()
  let n=0;const draw=setInterval(()=>{ctx.fillStyle=n++%2?'#e4eee7':'#fcf9f5';ctx.fillRect(0,0,320,180)},60)
  await new Promise(r=>setTimeout(r,900));recorder.stop();await stopped;clearInterval(draw);stream.getTracks().forEach(t=>t.stop())
  return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
 }));await recorderPage.close()
 for(const width of[1440,1280])for(const theme of['light','dark']){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',r=>{const q=r.request();if(q.method()==='GET'&&new URL(q.url()).origin===base)return r.continue();blocked.push({method:q.method(),path:new URL(q.url()).pathname});return r.abort()});const p=await c.newPage()
  await check(`healthy poster ${width} ${theme}`,async()=>{await p.goto(`${base}/?poster=ok&theme=${theme}`);await p.locator('img[src="/media/poster.svg"]').evaluate(e=>e.decode());assert.equal(await p.locator('[data-video-poster-fallback]').count(),0);assert.equal(await p.locator('video').count(),0);return{width,theme}})
  await check(`failure recovery ${width} ${theme}`,async()=>{
   await p.goto(`${base}/?theme=${theme}`);const fallback=p.locator('[data-video-poster-fallback="desktop"]');await fallback.waitFor();await fallback.evaluate(e=>e.decode());assert.ok((await fallback.getAttribute('src')).endsWith('scene-growth-v5.png'));await p.locator('[data-video-poster-note]').waitFor()
   await p.screenshot({path:`${out}/fallback@${width}-${theme}.png`});await p.getByRole('button',{name:/영상 재생/}).click();const alert=p.getByRole('alert');await alert.waitFor();const retry=alert.getByRole('button',{name:'다시 재생'});assert.equal(await retry.evaluate(e=>document.activeElement===e),true)
   const box=await retry.boundingBox();assert.ok(box.width>=44&&box.height>=44);await p.screenshot({path:`${out}/failure@${width}-${theme}.png`})
   const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/media/unavailable.mp4');await retry.click();assert.equal((await response).status(),404);await alert.waitFor();assert.equal(await retry.evaluate(e=>document.activeElement===e),true)
   assert.deepEqual(await p.evaluate(()=>window.videoFixtureEvents||[]),[],'Failed media must not fabricate started/completed events');return{width,theme,retried:true}
  });await c.close()
 }
 const c=await browser.newContext({viewport:{width:1440,height:950}}),p=await c.newPage()
 await check('retry recovers into decoded playback',async()=>{
  await p.goto(`${base}/?recover=1`);await p.getByRole('button',{name:/영상 재생/}).click();await p.getByRole('alert').waitFor()
  assert.deepEqual(await p.evaluate(()=>window.videoFixtureEvents||[]),[])
  await p.getByRole('button',{name:'다시 재생'}).click()
  await p.waitForFunction(()=>(window.videoFixtureEvents||[]).includes('video_completed'))
  assert.equal(await p.getByRole('alert').count(),0)
  assert.deepEqual(await p.evaluate(()=>window.videoFixtureEvents),['video_started','video_completed'])
  return{syntheticLocalWebM:true,originalMediaDeliveryVerified:false}
 })
 await check('new poster replaces a failed poster',async()=>{await p.goto(base);await p.locator('[data-video-poster-fallback="desktop"]').waitFor();await p.getByRole('button',{name:'다른 영상 보기'}).click();await p.locator('img[src="/media/poster.svg"]').evaluate(e=>e.decode());assert.equal(await p.locator('[data-video-poster-fallback]').count(),0)})
 for(const route of['/admin','/csat'])await check('3B boundary '+route,async()=>{await p.goto(`${base}/?route=${route}`);await p.locator('button[aria-label*="영상 재생"] img').waitFor();assert.equal(await p.locator('[data-video-poster-fallback]').count(),0)})
 await check('existing explicit fallback remains on 3B',async()=>{await p.goto(`${base}/?route=/admin&legacy=1`);const im=p.locator('img[src$="scene-video-v1.webp"]');await im.waitFor();await im.evaluate(e=>e.decode());assert.equal(await im.isVisible(),true);assert.equal(await p.locator('[data-video-poster-fallback]').count(),0)})
 await p.setViewportSize({width:1023,height:900});await check('PC threshold leaves original small-screen poster visible',async()=>{await p.goto(base);await p.locator('[data-video-poster-fallback]').waitFor({state:'attached'});assert.equal(await p.locator('[data-video-poster-fallback]').isVisible(),false);assert.equal(await p.locator('img[src="/media/unavailable.webp"]').isVisible(),true);assert.equal(await p.locator('[data-video-poster-note]').isVisible(),false)})
 await check('small-screen explicit fallback remains visible',async()=>{await p.goto(`${base}/?legacy=1`);const im=p.locator('img[src$="scene-video-v1.webp"]');await im.waitFor();await im.evaluate(e=>e.decode());assert.equal(await im.isVisible(),true);assert.equal(await p.locator('[data-video-poster-fallback]').isVisible(),false)})
 await c.close()
}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(`${out}/report.json`,JSON.stringify({scope:'Real ComponentVideo/app CSS isolation; synthetic URLs; no successful media/normal account acceptance',results,blocked},null,2))}
if(results.some(r=>!r.ok)||blocked.length)process.exitCode=1
