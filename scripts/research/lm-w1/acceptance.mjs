// scripts/research/lm-w1/acceptance.mjs
// Independent LM-W1 browser acceptance; temporary owned synthetic account only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {geometry} from './geometry.mjs';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../../..');
const req=createRequire(path.join(root,'apps/web/package.json'));
const {chromium}=req('@playwright/test');
const {createClient}=req('@supabase/supabase-js');
const arg=(k,d)=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:d;
const base=arg('--base','http://localhost:3000');
const out=path.resolve(root,arg('--out','docs/research/lm-w1-design-review/evidence/pinned-independent'));
fs.mkdirSync(out,{recursive:true});
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const results=[];let user=null;let activePage=null;const ownedUsers=[];
const record=(id,ok,detail)=>{results.push({id,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${id} ${JSON.stringify(detail)}`);};
const must=async(q)=>{const r=await q;if(r.error)throw r.error;return r.data;};
const browser=await chromium.launch();
try{
 console.log('setup temporary synthetic account');
 const email=`lm-w1-review-${crypto.randomUUID()}@example.com`,password=`Lmw1-${crypto.randomBytes(16).toString('base64url')}`;
 const u=await db.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;user=u.data.user.id;ownedUsers.push(user);
 const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const page=await ctx.newPage();activePage=page;page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 await page.goto(base+'/login',{waitUntil:'networkidle'});await page.waitForTimeout(700);console.log('login hydrated');await page.fill('input[type=email]',email);await page.fill('input[type=password]',password);await page.click('button[type=submit]');await page.waitForURL(x=>!x.pathname.startsWith('/login'));
 await page.goto(base+'/csat/diagnosis?tab=map&view=full',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=umap-top]');
 record('legacy-no-goal',await page.locator('[data-testid=umap-top]').getAttribute('data-state')==='no_goal'&&await page.locator('[data-testid=map-goal-edit]').count()===1,{});
 const initialGoal=await page.request.put(base+'/api/csat/diagnosis/map/goal',{data:{target:80}});if(initialGoal.status()!==200)throw new Error('initial goal HTTP '+initialGoal.status());
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=focus-record]');
 record('legacy-no-record',await page.locator('[data-testid=umap-top]').getAttribute('data-state')==='no_record'&&(await page.locator('[data-testid=umap-state]').textContent()).includes('약점으로 정한 것은 없어요'),{});
 console.log('seed owned exam/goal through existing APIs');
 const key=await must(db.from('csat_dx_answer_key').select('no,answers').eq('exam_id','M2409'));
 const wrong=new Set([20,23,29,30,32,33,35,36,37,38,39,43,44]);const choices=Object.fromEntries(key.map(k=>[k.no,wrong.has(k.no)?k.answers[0]%5+1:k.answers[0]]));
 const session=await page.request.post(base+'/api/csat/diagnosis/sessions',{data:{examId:'M2409',mode:'live',takenAt:'2026-10-15',totalMinutes:70,clientKey:crypto.randomUUID(),choices,flags:{}}});if(session.status()!==200)throw new Error('session HTTP '+session.status());
 const goal=await page.request.put(base+'/api/csat/diagnosis/map/goal',{data:{target:80}});if(goal.status()!==200)throw new Error('goal HTTP '+goal.status());
 for(let i=0;i<60;i++){if((await must(db.from('csat_dx_snapshot').select('id').eq('user_id',user).limit(1))).length)break;await new Promise(r=>setTimeout(r,1000));}
 for(const width of [1280,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/csat/diagnosis?tab=map&view=full',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=ws-list]');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
  await page.screenshot({path:path.join(out,`${width}-initial.png`)});
  const first=await page.evaluate(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};return {ws:b('[data-testid=ws-list]'),canvas:b('[data-testid=umap-canvas]'),help:b('[data-testid=umap-dock-help]'),legend:b('[data-testid=umap-legend]'),jump:b('[data-testid=umap-ws-jump]'),nodes:document.querySelectorAll('[data-testid=umap-node]').length,domains:document.querySelectorAll('[data-testid=umap-domain]').length,clippedDomains:[...document.querySelectorAll('[data-testid=umap-domain]')].filter(e=>{const n=e.children[1];return !n||n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1;}).length,overflow:document.documentElement.scrollWidth-innerWidth};});
  record(`${width}-geometry`,first.nodes===30&&first.domains===6&&first.clippedDomains===0&&first.overflow===0,first);
  const pan=await page.locator('[data-testid=umap-canvas]').evaluate(el=>{el.scrollLeft=el.scrollWidth;const result={range:el.scrollWidth-el.clientWidth,left:el.scrollLeft,pageOverflow:document.documentElement.scrollWidth-innerWidth};el.scrollLeft=0;return result;});record(`${width}-internal-horizontal-scroll`,pan.range>0&&pan.left>0&&pan.pageOverflow===0,pan);
  record(`${width}-workspace-discovery`,!!first.jump&&first.jump.y>=0&&first.jump.y+first.jump.h<=900,{wsY:first.ws?.y,visibleExplicitCue:first.jump});
  if(first.jump){await page.locator('[data-testid=umap-ws-jump]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const jumpState=await page.evaluate(()=>({focus:document.activeElement?.id,y:document.getElementById('ws-h')?.getBoundingClientRect().y}));record(`${width}-workspace-jump-action`,jumpState.focus==='ws-h'&&jumpState.y>=0&&jumpState.y<900,jumpState);await page.evaluate(()=>window.scrollTo(0,0));}
  const node=page.locator('[data-node="r.central_meaning"]');await node.click();
  record(`${width}-first-click`,await page.locator('[data-testid=task-pop]').count()===0,{lit:await page.locator('[data-testid=unified-map]').getAttribute('data-lit')});
  record(`${width}-selected-affordance`,await node.locator('[data-testid=node-more]').count()===1&&(await node.getAttribute('aria-label')).includes('다시 누르면 자세히'),{});
  await node.focus();await page.keyboard.press('Enter');await page.waitForSelector('[data-testid=task-pop]');await page.waitForTimeout(150);
  const focus=await page.evaluate(()=>({inPopup:!!document.activeElement?.closest('[data-testid=task-pop]'),node:document.activeElement?.getAttribute('data-node'),role:document.activeElement?.getAttribute('role')}));
  record(`${width}-keyboard-popup-entry`,focus.inPopup,focus);
  await page.screenshot({path:path.join(out,`${width}-popup.png`)});
  // Count real Tab presses from the actual opener focus to a popup action.
  let tabs=0;while(tabs<80&&!(await page.evaluate(()=>!!document.activeElement?.closest('[data-testid=task-pop]')))){await page.keyboard.press('Tab');tabs++;}
  record(`${width}-popup-tab-distance`,tabs<=1,{tabs});await page.keyboard.press('Tab');record(`${width}-popup-first-action`,await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'&&!!document.activeElement.closest('[data-testid=task-pop]')),{});await page.keyboard.press('Escape');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const restored=await page.evaluate(()=>document.activeElement?.getAttribute('data-node'));record(`${width}-popup-escape`,restored==='r.central_meaning',{restored});
  // Pointer route: related Workspace in the popup must lead to a perceptible result.
  await page.evaluate(()=>window.scrollTo(0,0));await node.click();await page.waitForSelector('[data-testid=task-pop]');
  const related=page.locator('[data-testid=pop-ws]').first();
  if(await related.count())await related.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const rel=await page.evaluate(()=>({selectedWs:document.querySelector('[data-testid=unified-map]')?.getAttribute('data-ws'),selectedRow:document.querySelector('[data-testid=ws-row][data-selected=true]')?.getBoundingClientRect().y,popup:!!document.querySelector('[data-testid=task-pop]')}));
  record(`${width}-task-to-workspace-perceptible`,rel.selectedRow>=0&&rel.selectedRow<900,rel);
  await page.locator('[data-testid=ws-list]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}-workspace.png`)});
  const row=page.locator('[data-testid=ws-row]').first();await row.locator('[data-testid=ws-select]').click();const linked=await page.locator('[data-testid=umap-node][data-link=core]').count();record(`${width}-workspace-to-task`,linked>0,{core:linked});
  const rowIds=await page.locator('[data-testid=ws-row]:not([data-kind=preparing])').evaluateAll(es=>es.map(e=>e.getAttribute('data-ws')));const reverses=[];for(const id of rowIds){await page.locator(`[data-testid=ws-row][data-ws="${id}"] [data-testid=ws-select]`).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const visible=await page.locator('[data-testid=umap-node][data-link=core]').evaluateAll(es=>es.some(e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight;}));reverses.push({id,visible});}record(`${width}-all-workspace-reverse-visible`,reverses.every(x=>x.visible),reverses);
  await row.locator('[data-testid=ws-open]').click();await page.waitForSelector('[data-testid=ws-modal]');const focusSelector='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';await page.locator('[data-testid=ws-modal]').evaluate((el,sel)=>{const es=[...el.querySelectorAll(sel)].filter(e=>e.getClientRects().length);es.at(-1).focus();},focusSelector);await page.keyboard.press('Tab');const wrapFirst=await page.locator('[data-testid=ws-modal]').evaluate((el,sel)=>document.activeElement===[...el.querySelectorAll(sel)].filter(e=>e.getClientRects().length)[0],focusSelector);await page.keyboard.press('Shift+Tab');const wrapLast=await page.locator('[data-testid=ws-modal]').evaluate((el,sel)=>document.activeElement===[...el.querySelectorAll(sel)].filter(e=>e.getClientRects().length).at(-1),focusSelector);record(`${width}-modal-focus-trap`,wrapFirst&&wrapLast,{wrapFirst,wrapLast});await page.screenshot({path:path.join(out,`${width}-modal.png`)});await page.locator('[data-testid=ws-tab-plan]').click();await page.screenshot({path:path.join(out,`${width}-plan.png`)});await page.keyboard.press('Escape');
  // Restore scroll and get the detailed evidence drawer as a separate disclosure.
  await node.click();if(!(await page.locator('[data-testid=task-pop]').count()))await node.click();await page.locator('[data-testid=pop-detail]').click();await page.waitForSelector('[data-testid=ins-drawer]');const order=await page.locator('[data-testid=task-inspector]').evaluate(e=>({order:[...e.querySelectorAll('#ins-now,#ins-plan,[data-testid=inspector-detail],[data-testid=inspector-coverage]')].map(x=>x.id||x.getAttribute('data-testid')),detail:e.querySelector('[data-testid=inspector-detail]')?.open}));record(`${width}-legacy-inspector-disclosure`,order.order.join(',')==='ins-now,ins-plan,inspector-detail,inspector-coverage'&&order.detail===false,order);await page.screenshot({path:path.join(out,`${width}-drawer.png`)});await page.keyboard.press('Escape');
 }
 const spec=JSON.parse(fs.readFileSync(path.join(root,'docs/design/refs/3b/access-map/spec.json'),'utf8'));await page.setViewportSize({width:spec.image.w,height:spec.image.h});await page.goto(base+'/csat/diagnosis?tab=map&view=full',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=umap-node]');await page.evaluate(()=>document.fonts.ready);const ref=await geometry(page,spec);fs.writeFileSync(path.join(out,'ref-compare.json'),JSON.stringify(ref,null,2));await page.screenshot({path:path.join(out,'ref-2094.png')});record('ref-geometry-2094',ref.pass,{rows:ref.rows});await page.setViewportSize({width:1440,height:900});
 await page.goto(base+'/csat/diagnosis?tab=map&view=full&asof=2026-10-14',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=umap-past-bar]');
 const past=await page.evaluate(()=>({edit:!!document.querySelector('[data-testid=map-goal-edit]'),add:!!document.querySelector('[data-testid=umap-record-add]'),actions:document.querySelectorAll('[data-testid=ws-next],[data-testid=umap-top-next],[data-testid=pop-next],[data-testid=inspector-next]').length,records:document.querySelector('[data-testid=umap-records]')?.textContent}));
 await page.screenshot({path:path.join(out,'past-readonly.png')});
 record('legacy-past-readonly',!past.edit&&!past.add&&past.actions===0,past);
 record('legacy-past-current-record-label',past.records.includes('전체 기록'),{records:past.records});
 await page.locator('[data-testid=ws-open]').first().click();await page.locator('[data-testid=ws-tab-plan]').click();record('legacy-past-plan-no-save',await page.locator('[data-testid=plan-save]').count()===0,{});await page.keyboard.press('Escape');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=umap-past-bar]');record('legacy-past-reload',await page.locator('[data-testid=map-goal-edit]').count()===0,{});
 await page.locator('[data-testid=umap-past-to-current]').click();await page.waitForURL(u=>!u.search.includes('asof'));await page.locator('[data-testid=map-goal-edit]').click();await page.fill('#map-goal-input','88');const put=page.waitForResponse(r=>r.url().includes('/api/csat/diagnosis/map/goal')&&r.request().method()==='PUT');await page.press('#map-goal-input','Enter');const goalResponse=await put;await page.waitForFunction(()=>document.querySelector('[data-testid=goal-value]')?.textContent.includes('88'));record('legacy-current-goal-edit',goalResponse.status()===200&&await page.locator('[data-testid=umap-record-add]').count()===1,{});
 await page.goBack({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid=umap-past-bar]');record('legacy-back-past',await page.locator('[data-testid=map-goal-edit]').count()===0,{});
 await ctx.close();
 const emailB=`lm-w1-other-${crypto.randomUUID()}@example.com`,passwordB=`Lmw1-${crypto.randomBytes(16).toString('base64url')}`;const ub=await db.auth.admin.createUser({email:emailB,password:passwordB,email_confirm:true});if(ub.error)throw ub.error;ownedUsers.push(ub.data.user.id);const ctxB=await browser.newContext({viewport:{width:1280,height:900}});const pb=await ctxB.newPage();await pb.goto(base+'/login',{waitUntil:'networkidle'});await pb.waitForTimeout(700);await pb.fill('input[type=email]',emailB);await pb.fill('input[type=password]',passwordB);await pb.click('button[type=submit]');await pb.waitForURL(x=>!x.pathname.startsWith('/login'));await pb.goto(base+'/csat/diagnosis?tab=map&view=full',{waitUntil:'domcontentloaded'});await pb.waitForSelector('[data-testid=umap-top]');const separated=await pb.evaluate(()=>({state:document.querySelector('[data-testid=umap-top]')?.getAttribute('data-state'),goal:document.querySelector('[data-testid=goal-value]')?.textContent,records:document.querySelector('[data-testid=umap-records]')?.textContent}));record('legacy-account-separation',separated.state==='no_goal'&&separated.goal.includes('아직')&&separated.records.includes('전체 0'),separated);await pb.locator('[data-testid=map-core-link]').click();await pb.waitForSelector('[data-testid=map-full-link]');await pb.goBack({waitUntil:'domcontentloaded'});await pb.waitForSelector('[data-testid=map-core-link]');await pb.reload({waitUntil:'domcontentloaded'});await pb.waitForSelector('[data-testid=map-core-link]');record('legacy-view-history',new URL(pb.url()).searchParams.get('view')==='full'&&await pb.locator('[data-testid=umap-canvas]').getAttribute('data-mode')==='full',{});await ctxB.close();
}catch(e){if(activePage)await activePage.screenshot({path:path.join(out,'execution-error.png')}).catch(()=>{});record('execution',false,{error:String(e)});}
finally{await browser.close();const cleanup=[];for(const id of ownedUsers){const r=await db.auth.admin.deleteUser(id);cleanup.push(!r.error);}record('owned-account-cleanup',cleanup.every(Boolean),{created:ownedUsers.length,left:cleanup.filter(x=>!x).length});}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'synthetic actual Chromium; no learning effect evidence',results},null,2)+'\n');
process.exitCode=results.some(x=>!x.ok)?1:0;
