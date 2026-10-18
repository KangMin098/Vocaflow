// scripts/research/lm-g1-3a-independent/lost-response-browser.mjs
// Real committed response deliberately aborted; owned synthetic accounts only.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import {createRequire} from 'node:module';
const ROOT = path.resolve(import.meta.dirname, '../../..')
const req=createRequire(ROOT+'/apps/web/package.json'),{chromium}=req('@playwright/test'),{createClient}=req('@supabase/supabase-js');
const arg=(k,d)=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:d,BASE=arg('--base','http://localhost:3010'),WIDTH=Number(arg('--width','1280')),EVID=arg('--evidence',ROOT+'/scripts/research/lm-g1-3a-independent/local/loss-'+WIDTH);
fs.mkdirSync(EVID,{recursive:true});const users=[],results=[],requests=[],observations={};
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),browser=await chromium.launch();let fatal=null;
const rec=(name,pass)=>{results.push({name,pass});console.log('['+(pass?'PASS':'FAIL')+'] '+name)};
try {
 const email='lmg13a-loss-'+crypto.randomUUID()+'@example.com',password=crypto.randomBytes(24).toString('base64url')+'Aa1!';
 const u=await db.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;users.push(u.data.user.id);fs.writeFileSync(EVID+'/owned-accounts.local.json',JSON.stringify(users));
 const ctx=await browser.newContext({viewport:{width:WIDTH,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(90000);
 await page.goto(BASE+'/login',{waitUntil:'networkidle'});await page.waitForTimeout(700);await page.fill('input[type="email"]',email);await page.fill('input[type="password"]',password);await page.click('button[type="submit"]');await page.waitForURL(x=>!x.pathname.startsWith('/login'));
 const init=await page.request.put(BASE+'/api/csat/diagnosis/map/goal',{data:{target:80,exam:'suneung',clientKey:crypto.randomUUID()}});if(init.status()!==200)throw Error('Initial goal save failed');
 const rows=async()=>{const r=await db.from('csat_map_goal_version').select('id,target_score,target_exam').eq('user_id',users[0]).order('id');if(r.error)throw r.error;return r.data};const before=(await rows()).length;
 await page.goto(BASE+'/csat/diagnosis?tab=map&view=full');await page.waitForSelector('[data-testid="umap-canvas"]');await page.waitForTimeout(700);await page.click('[data-testid="map-goal-edit"]');await page.fill('#map-goal-input','90');await page.click('[data-testid="goal-more"] summary');await page.selectOption('[data-testid="goal-exam"]','kice6');
 let releaseCommit;const committed=new Promise(r=>{releaseCommit=r});
 const handler=async route=>{requests.push(route.request().postDataJSON());const response=await route.fetch();if(response.status()!==200)throw Error('Goal response not successful');if(requests.length===1){observations.committedResponse=await response.json();await route.abort('failed');releaseCommit()}else await route.fulfill({response})};
 await page.route('**/api/csat/diagnosis/map/goal',handler);await page.click('[data-testid="goal-apply-all"]');await committed;await page.waitForSelector('[role="group"][aria-label="목표 점수 정하기"] [role="alert"]');
 const afterRows=await rows(),after=afterRows.at(-1);observations.after=afterRows;observations.firstRequest=requests[0]?{target:requests[0].target,exam:requests[0].exam}:null;rec('response lost after actual commit',after.target_score===90&&after.target_exam==='kice6');
 rec('saved display stays on coherent previous snapshot',(await page.locator('[data-testid="goal-value"]').textContent()).includes('80'));
 rec('failed editor retains requested score and exam',(await page.inputValue('#map-goal-input'))==='90'&&(await page.inputValue('[data-testid="goal-exam"]'))==='kice6');
 await page.screenshot({path:EVID+'/lost-response.png'});await page.click('[data-testid="goal-apply-all"]');await page.waitForFunction(()=>document.querySelector('[data-testid="goal-value"]')?.textContent.includes('90'));
 rec('retry sends identical body and request key',requests.length===2&&JSON.stringify(requests[0])===JSON.stringify(requests[1]));
 const final=await rows();observations.final=final;observations.beforeCount=before;rec('retry reuses one goal version without rolling back',final.length===before+1&&final.at(-1).id===after.id&&final.at(-1).target_score===90);
 rec('refreshed goal scope and layout agree',await page.evaluate(()=>document.querySelector('[data-testid="goal-target"]')?.getAttribute('data-exam')==='kice6'&&document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:EVID+'/retry-success.png'});await page.unroute('**/api/csat/diagnosis/map/goal',handler);await ctx.close();
}catch(e){fatal=String(e.message);console.log('[FATAL]',fatal)}finally{
 for(const id of users){const d=await db.auth.admin.deleteUser(id);if(d.error)throw d.error;const r=await db.auth.admin.getUserById(id);if(r.error?.code!=='user_not_found'||r.error.status!==404)throw Error('Owned cleanup unconfirmed')}
 await browser.close();fs.writeFileSync(EVID+'/results.json',JSON.stringify({width:WIDTH,results,observations,fatal,cleanup:true},null,2));process.exitCode=fatal||results.some(r=>!r.pass)?1:0;
}
