// scripts/research/lm-g1-2-independent/late-remount.mjs
// Owned synthetic A/B accounts; existing PLAN APIs only; no schema/RPC changes.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {cleanupOwnedAccounts} from '../lm-g1-1-independent/cleanup.mjs';
const root=process.cwd(),req=createRequire(root+'/apps/web/package.json');const {chromium}=req('@playwright/test'),{createClient}=req('@supabase/supabase-js');
const base=process.argv[2]??'http://localhost:3007',out=root+'/scripts/research/lm-g1-2-independent/local/late-remount';fs.mkdirSync(out,{recursive:true});const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],results=[],browser=await chromium.launch();const rec=(name,ok,detail={})=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name)};
async function account(){const email='lmg11-boundary-'+crypto.randomUUID()+'@example.com',password='G11-'+crypto.randomBytes(16).toString('base64url');const u=await db.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;users.push(u.data.user.id);fs.writeFileSync(out+'/owned-accounts.local.json',JSON.stringify(users));const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/login',{waitUntil:'networkidle'});await page.waitForTimeout(700);await page.fill('input[type=email]',email);await page.fill('input[type=password]',password);await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));await page.request.put(base+'/api/csat/diagnosis/map/goal',{data:{target:80}});return {ctx,page}}
try {
 const b=await account(); const seed=await b.page.request.post(base+'/api/csat/diagnosis/map/plan',{data:{template:'ws.central-meaning',order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{'r.central_meaning':1},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID()}});if(seed.status()!==200)throw Error('seed PLAN failed');
 await b.page.goto(base+'/csat/diagnosis?tab=map&view=full&map_task=r.central_meaning&ws=ws.central-meaning',{waitUntil:'domcontentloaded'});
 await b.page.waitForSelector('[data-testid=unified-map]');
 const open=async()=>{await b.page.click('[data-testid="ws-row"][data-ws="ws.central-meaning"] [data-testid=ws-open]');await b.page.click('[data-testid=ws-tab-plan]');await b.page.waitForSelector('[data-testid=plan-section]')};await open();
 const plus=()=>b.page.locator('[data-testid=plan-section]').getByRole('button',{name:/계획 한 (문항|지문) 늘리기$/}).first().click();await plus();
 let release,arrived,version;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);
 await b.page.route('**/api/csat/diagnosis/map/plan',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();version=(await response.json()).version;arrived();await hold;await route.fulfill({response})});
 await b.page.click('[data-testid=plan-save]');await seen;await plus();await b.page.fill('[data-testid=plan-note]','edit while waiting, reopen after reply');
 const desired=await b.page.locator('[data-testid=plan-section] [data-task="r.central_meaning"]').getAttribute('data-planned');
 await b.page.click('[data-testid=ws-tab-overview]');await b.page.waitForSelector('[data-testid=plan-section]',{state:'detached'});release();await b.page.waitForTimeout(1800);await b.page.unroute('**/api/csat/diagnosis/map/plan');
 await b.page.reload({waitUntil:'domcontentloaded'});await b.page.waitForSelector('[data-testid=unified-map]');await open();
 const visible=await b.page.locator('[data-testid=plan-section] [data-task="r.central_meaning"]').getAttribute('data-planned'),note=await b.page.inputValue('[data-testid=plan-note]');
 rec('Draft survives reply while editor absent and fresh-version remount',visible===desired&&note==='edit while waiting, reopen after reply',{visible,desired,note,version});await b.page.screenshot({path:out+'/late-remount.png'});await b.ctx.close();
} finally {const cleanup=await cleanupOwnedAccounts(db.auth.admin,users);await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify({results,cleanup},null,2));if(!cleanup.ok)process.exitCode=1}
if(results.some(r=>!r.ok))process.exitCode=1;
