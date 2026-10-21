import fs from 'node:fs';import path from 'node:path';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
const dir=fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url))),wt='D:/workspace/Vocaflow-final-product',req=createRequire(`${wt}/apps/web/package.json`),vite=createRequire(req.resolve('vitest/package.json'))('vite'),{chromium}=req('@playwright/test');
const server=await vite.createServer({configFile:false,root:dir,logLevel:'error',define:{'process.env':'{}'},esbuild:{jsx:'automatic'},resolve:{alias:[{find:'@/lib/csat/session/store',replacement:path.join(dir,'store.ts')},{find:'@/components/csat/theater/ReasoningNoteForm',replacement:path.join(dir,'note.tsx')},{find:'@',replacement:`${wt}/apps/web/src`},{find:'next/link',replacement:path.join(dir,'link.tsx')},{find:/^react$/,replacement:req.resolve('react')},{find:/^react\/jsx-runtime$/,replacement:req.resolve('react/jsx-runtime')},{find:/^react\/jsx-dev-runtime$/,replacement:req.resolve('react/jsx-dev-runtime')},{find:/^react-dom\/client$/,replacement:req.resolve('react-dom/client')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[dir,wt]}}});
let browser; const results=[];
const B='22222222-2222-4222-8222-222222222222',D='11111111-1111-4111-8111-111111111111';
const bound={status:'bound',id:B,deliveryId:D,evidence:true,reason:null};
try{await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/`;browser=await chromium.launch({headless:true});
for(const width of [1440,1280]) for(const scenario of ['unknown','revoked','network','http','shape','recovered','lostmeta','normal']){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 let bindCalls=0;
 await page.route('**/api/csat/**',async route=>{const u=route.request().url();requests.push({url:u,body:route.request().postDataJSON()});
  if(u.endsWith('/delivery/bind')){bindCalls++;
   if(scenario==='network'&&bindCalls===1)return route.abort('failed');
   if(scenario==='http')return route.fulfill({status:500,json:{error:'x'}});
   if(scenario==='shape')return route.fulfill({json:{nope:1}});
   return route.fulfill({json:{binding:bound,attemptId:'41'}});}
  if(scenario==='lostmeta')return route.fulfill({json:{grade:{isCorrect:false},reveal:{answer:0,distractors:[]}}});
  const binding=scenario==='unknown'?{status:'bound',id:B}:scenario==='revoked'?{status:'bound',evidence:false,reason:'approval_revoked'}:scenario==='normal'?bound:{status:'error'};
  return route.fulfill({json:{grade:{isCorrect:false},reveal:{answer:0,distractors:[]},binding,attemptId:scenario==='normal'?'41':null}});});
 await page.goto(url,{waitUntil:'load',timeout:300000});await page.locator('[data-choice="0"]').waitFor({timeout:300000});await page.locator('[data-choice="0"]').click();await page.getByRole('button',{name:'맞춰 보기',exact:true}).click();await page.locator('[data-testid="authored-result"]').waitFor();
 const btn=page.locator('[data-testid="authored-rebind"]');
 const press=async()=>{await btn.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.body.textContent.includes('다시 연결하는 중'));};
 let failedShown=null;
 if(['network','http','shape','recovered','lostmeta'].includes(scenario)){await press();failedShown=await page.locator('[data-testid="authored-rebind-failed"]').count();}
 if(scenario==='network'){await press();}
 const text=await page.locator('[data-testid="authored-result"]').innerText(),returnHref=await page.getByRole('link',{name:'학습 지도로 돌아가 변화 보기'}).getAttribute('href');
 const kind=await page.locator('[data-testid="authored-binding"]').getAttribute('data-kind');
 const attemptPosts=requests.filter(r=>r.url.endsWith('/attempt')).length,bindPosts=requests.filter(r=>r.url.endsWith('/delivery/bind')).length;
 const sameCmid=requests.filter(r=>r.url.endsWith('/delivery/bind')).every(r=>r.body.clientMutationId===requests.find(x=>x.url.endsWith('/attempt')).body.clientMutationId&&r.body.deliveryId===D);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 const HELP=/연습 · 도움 받은 풀이/, at41=returnHref.includes('map_attempt=41'), noAt=!/map_attempt=/.test(returnHref);
 const ok={
  unknown:kind==='unknown'&&!HELP.test(text)&&/확인하지 못했어요/.test(text)&&noAt,
  revoked:kind==='not_evidence'&&!HELP.test(text)&&/철회/.test(text)&&noAt,
  network:failedShown===1&&bindPosts===2&&at41&&kind==='evidence'&&!text.includes('방금 다시 연결하지 못했어요'),
  http:failedShown===1&&kind==='unbound'&&noAt&&await btn.isEnabled(),
  shape:failedShown===1&&kind==='unbound'&&noAt&&await btn.isEnabled(),
  recovered:failedShown===0&&at41&&kind==='evidence',
  lostmeta:failedShown===0&&at41&&kind==='evidence',
  normal:at41&&kind==='evidence'&&bindPosts===0,
 }[scenario]&&errors.length===0&&attemptPosts===1&&sameCmid&&text.includes('이번에는 어긋났어요')&&overflow<=1;
 if(['network','lostmeta','http'].includes(scenario))await page.screenshot({path:path.join(dir,`${scenario}-${width}.png`),fullPage:true});
 results.push({width,scenario,passed:ok,kind,failedShown,returnHref,errors,attemptPosts,bindPosts,sameCmid,overflow,text}); await page.close();
}
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({environment:'actual AuthoredRunner React+Chromium with controlled synthetic HTTP responses; no authenticated Next or DB',url,results,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},null,2)+'\n');
for(const r of results)console.log(r.passed?'PASS':'FAIL',r.width,r.scenario,JSON.stringify({kind:r.kind,failedShown:r.failedShown,href:r.returnHref.split('&').pop(),errors:r.errors,a:r.attemptPosts,b:r.bindPosts,o:r.overflow}));
}finally{await browser?.close();await server.close()}
