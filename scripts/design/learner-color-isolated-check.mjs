// scripts/design/learner-color-isolated-check.mjs — real components/CSS, synthetic props; no DB/auth.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=process.cwd(),require=createRequire(path.join(root,'apps/web/package.json')),{chromium}=require('@playwright/test'),esbuild=createRequire(require.resolve('vitest/package.json'))('esbuild')
const out=process.argv[2]||'tmp/color-redesign/isolated';fs.mkdirSync(out,{recursive:true})
const built=await esbuild.build({entryPoints:['scripts/design/fixtures/learner-colors.tsx'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:'apps/web/tsconfig.json',nodePaths:[path.join(root,'apps/web/node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'no-server-fixture',setup(build){
 build.onResolve({filter:/^(next\/link|next\/image|next\/navigation)$/},args=>({path:args.path,namespace:'fixture'}))
 build.onResolve({filter:/^@\/lib\/(articles\/start-learning|supabase\/client|analytics\/client)$/},args=>({path:args.path,namespace:'fixture'}))
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:path.join(root,'apps/web'),contents:
  args.path==='next/navigation'?'export function usePathname(){const q=new URLSearchParams(location.search);return q.get("route")||({hub:"/hub",books:"/library/books",dashboard:"/dashboard",vault:"/wordvault"}[q.get("view")]||"/hub")}export function useRouter(){return{push(){throw Error("Navigation disabled")},refresh(){throw Error("Navigation disabled")}}}':
  args.path.includes('articles/start-learning')?'export function startArticleLearning(){throw Error("Learning writes disabled")}' :
  args.path.includes('supabase/client')?'export function createClient(){throw Error("Database access disabled")}' :
  args.path.includes('analytics/client')?'export function track(){}' :
  args.path==='next/link'?'import React from "react";export default function Link({children,href,onClick,...p}){return <a {...p} href={href} onClick={e=>{e.preventDefault();onClick?.(e)}}>{children}</a>}':'import React from "react";export default function Image({priority,fill,unoptimized,loader,placeholder,blurDataURL,...p}){return <img {...p}/>}'}))
}}]})
const css=fs.readFileSync('apps/web/.next-dev/static/css/app/layout.css','utf8')+'\n'+['apps/web/src/components/layout/learner-reference.css','packages/design-tokens/src/skins/learner-pc.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n')
const html='<!doctype html><html data-skin="tines" lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:var(--bg);color:var(--t1);font-family:var(--font-display)}a{color:inherit}a:focus-visible,button:focus-visible{outline:2px solid var(--p);outline-offset:4px}#root{min-height:100vh}</style><body><div id="root"></div><script>document.documentElement.dataset.theme=new URLSearchParams(location.search).get("theme")||"light"</script><script src="/fixture.js"></script></body></html>'
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname
 if(pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html)}
 if(pathname==='/app.css'){res.setHeader('content-type','text/css');return res.end(css)}
 if(pathname==='/fixture.js'){res.setHeader('content-type','application/javascript');return res.end(built.outputFiles[0].contents)}
 let file
 if(/^\/illustrations\/tines\/[a-z0-9-]+\.(webp|png)$/.test(pathname))file=path.join(root,'apps/web/public',pathname)
 if(/^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2?$/.test(pathname))file=path.join(root,'apps/web/.next-dev/static/media',path.basename(pathname))
 if(file&&fs.existsSync(file)){res.setHeader('content-type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'font/woff2');return fs.createReadStream(file).pipe(res)}res.writeHead(404);res.end()
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),results=[],blocked=[]
const check=async(name,run)=>{if(process.env.COLOR_CHECK_FILTER&&!process.env.COLOR_CHECK_FILTER.split(',').includes(name))return;try{const data=await run();results.push({name,ok:true,...data});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message.slice(0,500)});console.log('FAIL '+name+' '+e.message.slice(0,150))}}
const dialogsOnly=process.argv.includes('--dialogs-only')
const representativesOnly=process.argv.includes('--representatives-only')
const routesOnly=process.argv.includes('--routes-only')
try{for(const width of dialogsOnly||routesOnly?[]:[1440,1280])for(const theme of['light','dark']){
 const c=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});await c.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin===base&&req.method()==='GET')return r.continue();blocked.push(u.pathname);return r.abort('blockedbyclient')});const p=await c.newPage()
 for(const view of['hub','books','dashboard','vault'])await check(`${view} ${width} ${theme}`,async()=>{
  await p.goto(`${base}/?view=${view}&theme=${theme}`);await p.locator('h1').waitFor();await p.evaluate(()=>document.fonts.ready)
  const m=await p.evaluate(()=>{const s=getComputedStyle(document.documentElement);return{t1:s.getPropertyValue('--t1').trim(),t2:s.getPropertyValue('--t2').trim(),p:s.getPropertyValue('--p').trim(),overflow:document.documentElement.scrollWidth>innerWidth+1,colors:[...document.querySelectorAll('.book-feature-card,.vault-reference>section,.dashboard-reference__memory,.dashboard-reference__history section,.hub-reference a')].map(e=>({label:e.getAttribute('aria-label')||e.textContent.slice(0,32),bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).getPropertyValue('--t1').trim()}))}})
  assert.notEqual(m.t1,m.p);assert.notEqual(m.t2,m.p);assert.equal(m.overflow,false)
  if(view==='books'){
   assert.equal(new Set(m.colors.map(x=>x.bg)).size,1,'Same material must not change hue with card position')
   const before=await p.locator('.book-feature-card').first().evaluate(e=>getComputedStyle(e).backgroundColor)
   await p.locator('.books-reference__grid').evaluate(e=>e.append(e.firstElementChild))
   assert.equal(await p.locator('.book-feature-card').last().evaluate(e=>getComputedStyle(e).backgroundColor),before,'Reordering must preserve material color')
   await p.locator('.books-reference__grid').evaluate(e=>e.prepend(e.lastElementChild))
  }else assert.ok(new Set(m.colors.map(x=>x.bg)).size>=2,'Content roles must stay distinguishable')
  m.textContrast=await p.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')
   const lum=rgb=>{const v=rgb.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722}
   return [...document.querySelectorAll('.book-feature-card h3,.book-feature-card p,.book-feature-card__cover,.vault-reference__identity p,.vault-reference__identity>a,.dashboard-reference__memory h2,.dashboard-reference__memory p,.dashboard-reference__history p,[data-hub-benefits] a p')].filter(e=>e.getClientRects().length).map(e=>{
    ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg');ctx.fillRect(0,0,1,1)
    const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n)
    for(const n of chain){ctx.fillStyle=getComputedStyle(n).backgroundColor;ctx.fillRect(0,0,1,1)}
    const bg=lum([...ctx.getImageData(0,0,1,1).data]);ctx.fillStyle=getComputedStyle(e).color;ctx.fillRect(0,0,1,1);const fg=lum([...ctx.getImageData(0,0,1,1).data]);return{label:e.textContent.trim().slice(0,32),ratio:(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)}
   })
  });assert.ok(m.textContrast.length>0&&m.textContrast.every(r=>r.ratio>=4.5),'Content text must keep AA contrast on the quieter mixed surface')
  if(view==='books'){await p.getByRole('link',{name:'A Christmas Carol 상세 보기'}).click();await p.getByRole('status').filter({hasText:'A Christmas Carol'}).waitFor()}
  const trigger=p.getByRole('button',{name:'읽기 설정',exact:true});await trigger.click();await p.getByRole('button',{name:'글자 크기 크게',exact:true}).waitFor();await p.keyboard.press('Escape');await trigger.waitFor();assert.equal(await trigger.evaluate(e=>document.activeElement===e),true)
  await p.screenshot({path:`${out}/${view}@${width}-${theme}.png`,fullPage:true});return{view,width,theme,metrics:m}
 })
 await c.close()
}
 if(!representativesOnly){
 const c=await browser.newContext({viewport:{width:1440,height:900}}),p=await c.newPage()
 const audit=JSON.parse(fs.readFileSync(process.env.COLOR_ROUTE_AUDIT||'tmp/color-route-audit/route-colors.json','utf8'))
 for(const row of dialogsOnly?[]:audit.rows.filter(r=>!process.env.COLOR_ROUTE_FILTER||process.env.COLOR_ROUTE_FILTER.split(',').includes(r.route)))await check('route style boundary '+row.route,async()=>{
  await p.goto(`${base}/?view=roles&route=${encodeURIComponent(row.route)}`);await p.locator('h1').waitFor()
  const m=await p.evaluate(()=>{const root=document.documentElement,s=getComputedStyle(root),h=document.querySelector('h1');return{palette:document.querySelector('[data-learner-pc-palette]')?.getAttribute('data-learner-pc-palette'),area:s.getPropertyValue('--area-ink').trim(),t1:s.getPropertyValue('--t1').trim(),heading:getComputedStyle(h).color,body:getComputedStyle(document.querySelector('[data-body-copy]')).color}})
  assert.equal(m.palette,row.palette)
  if(row.attention){
   const semantics=await p.locator('[data-learner-pc-color]').evaluate(e=>({group:e.dataset.learnerPcGroup,attention:e.dataset.learnerPcAttention,cadence:e.dataset.learnerPcCadence,priority:e.dataset.learnerPcPriority}))
   assert.deepEqual(semantics,{group:row.group,attention:row.attention,cadence:row.cadence,priority:row.priority})
   if(row.cadence==='frequent'){
    const surfaces=await p.evaluate(()=>{const a=document.createElement('span'),b=document.createElement('span');a.style.background='var(--area-surface)';b.style.background='var(--area-tint)';document.body.append(a,b);const result=[getComputedStyle(a).backgroundColor,getComputedStyle(b).backgroundColor];a.remove();b.remove();return result})
    assert.notEqual(surfaces[0],surfaces[1],'Repeated work must use a quieter surface, not full category tint')
   }
  }
  const ink=await p.evaluate(palette=>{const s=getComputedStyle(document.documentElement);return s.getPropertyValue(palette==='neutral'?'--t1':`--tint-${palette}-ink`).trim()},row.palette)
  assert.equal(m.area,ink,'Area color must actually resolve to the assigned family, not neutral fallback')
  if(!row.route.startsWith('/play/')){
   const expected=await p.evaluate(focus=>{const e=document.createElement('span');e.style.color=focus?'var(--t1)':'var(--area-ink)';document.body.append(e);const color=getComputedStyle(e).color;e.remove();return color},row.attention==='focus')
   assert.equal(m.heading,expected)
  }else{
   // A native board owns its title color. Compare against its own explicit style, not a theme assumption.
   await p.locator('h1').evaluate(e=>e.style.color='#234567')
   assert.equal(await p.locator('h1').evaluate(e=>getComputedStyle(e).color),'rgb(35, 69, 103)')
  }
  return{route:row.route,palette:row.palette,metrics:m,scope:'shared marker/CSS probe only, no route navigation or normal app render'}
 })
 const representative=[...new Map(audit.rows.map(r=>[r.palette,r])).values()]
 for(const theme of routesOnly?[]:['light','dark'])for(const width of[1440,1280])for(const row of representative)await check(`palette dialog ${row.palette} ${width} ${theme}`,async()=>{
  await p.setViewportSize({width,height:900});await p.goto(`${base}/?view=roles&theme=${theme}&route=${encodeURIComponent(row.route)}`);await p.getByRole('button',{name:'팝업 확인'}).click();const d=p.getByRole('dialog');await d.waitFor()
  const m=await d.locator('[data-dialog-title]').evaluate(e=>{const probe=document.createElement('span');probe.style.color='var(--area-ink)';e.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return{heading:getComputedStyle(e).color,expected,background:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()}})
  assert.equal(m.heading,m.expected)
  await p.screenshot({path:`${out}/palette-${row.palette}@${width}-${theme}.png`,fullPage:true})
  await p.evaluate(()=>{window.fixtureUnwind=new Promise(resolve=>addEventListener('popstate',resolve,{once:true}))})
  await p.keyboard.press('Escape');await d.waitFor({state:'detached'});await p.evaluate(()=>window.fixtureUnwind);assert.equal(await p.getByRole('button',{name:'팝업 확인'}).evaluate(e=>document.activeElement===e),true)
  return{palette:row.palette,width,theme,metrics:m,scope:'real Dialog/shared CSS, synthetic content; not full app screen'}
 })
 await p.setViewportSize({width:1440,height:900})
 for(const route of['/admin','/admin/library','/csat','/csat/diagnosis'])await check('3B exclusion '+route,async()=>{await p.goto(`${base}/?view=books&route=${encodeURIComponent(route)}`);await p.locator('h1').waitFor();assert.equal(await p.locator('[data-learner-pc-color]').count(),0);const t2=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--t2').trim());assert.equal(t2,'#714bd0');return{route,t2,scope:'marker/CSS boundary; not real 3B route render'}})
 await check('memory meaning colors preserved',async()=>{
  const memory=()=>p.evaluate(()=>Object.fromEntries(['stable','shaky','risk','new'].map(key=>[key,getComputedStyle(document.documentElement).getPropertyValue(`--memory-${key}`).trim()])))
  const previous=await memory();await p.goto(`${base}/?view=vault`);await p.locator('[data-learner-pc-color]').waitFor({state:'attached'});const current=await memory();assert.deepEqual(current,previous);assert.ok(Object.values(current).every(Boolean));return{memory:current}
 })
 for(const theme of['light','dark'])await check('tint inheritance '+theme,async()=>{
  await p.goto(`${base}/?view=roles&theme=${theme}&route=/about`);await p.locator('h1').waitFor()
  const colors=await p.evaluate(()=>{
   const root=document.documentElement,s=getComputedStyle(root)
   return ['green','peach','pink','teal','yellow','lavender','deep-purple'].map(tone=>{
    const panel=document.createElement('section');panel.className=`tone-${tone}`;const text=document.createElement('p');text.textContent='Inherited surface ink';panel.append(text);document.body.append(panel)
    const expected=s.getPropertyValue(tone==='deep-purple'?'--on-deep':`--tint-${tone}-ink`).trim(),probe=document.createElement('span');probe.style.color=expected;panel.append(probe)
    const result={tone,color:getComputedStyle(text).color,expected:getComputedStyle(probe).color};panel.remove();return result
   })
  });assert.ok(colors.every(r=>r.color===r.expected),'Tint text must inherit its own ink, including light-on-deep');return{theme,colors}
 })
 await p.setViewportSize({width:1023,height:900});await check('PC media boundary',async()=>{await p.goto(`${base}/?view=books`);await p.locator('h1').waitFor();const t2=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--t2').trim());assert.equal(t2,'#714bd0');return{width:1023,t2,scope:'computed-style boundary only, no mobile redesign'}});await c.close()
 }
}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(`${out}/report.json`,JSON.stringify({scope:'real component/CSS isolation, synthetic props; not authenticated app acceptance',results,blocked},null,2))}
if(results.some(r=>!r.ok)||blocked.length)process.exitCode=1
