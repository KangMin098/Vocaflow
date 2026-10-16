// scripts/research/lm-g1-2-independent/security.mjs
// Owned synthetic A/B accounts; existing PLAN APIs only; no schema/RPC changes.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {cleanupOwnedAccounts} from '../lm-g1-1-independent/cleanup.mjs';
const root=process.cwd(),req=createRequire(root+'/apps/web/package.json');const {chromium}=req('@playwright/test'),{createClient}=req('@supabase/supabase-js');
const base=process.argv[2]??'http://localhost:3007',out=root+'/scripts/research/lm-g1-2-independent/local/security';fs.mkdirSync(out,{recursive:true});const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],results=[],browser=await chromium.launch();const rec=(name,ok,detail={})=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name)};
async function account(){const email='lmg11-boundary-'+crypto.randomUUID()+'@example.com',password='G11-'+crypto.randomBytes(16).toString('base64url');const u=await db.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;users.push(u.data.user.id);fs.writeFileSync(out+'/owned-accounts.local.json',JSON.stringify(users));const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/login',{waitUntil:'networkidle'});await page.waitForTimeout(700);await page.fill('input[type=email]',email);await page.fill('input[type=password]',password);await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));await page.request.put(base+'/api/csat/diagnosis/map/goal',{data:{target:80}});return {ctx,page}}
try{const a=await account(),b=await account();const response=await b.page.request.post(base+'/api/csat/diagnosis/map/plan',{data:{template:'ws.central-meaning',order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{'r.central_meaning':1},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID()}});const saved=await response.json();if(response.status()!==200||!saved.workspaceId)throw new Error('B own plan save HTTP '+response.status());

const endpoint=base+'/api/csat/diagnosis/map/plan'
const req={template:'ws.central-meaning',order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{'r.central_meaning':1},reason:'learner_adjust',expectedVersion:1,clientKey:crypto.randomUUID()}
const c=await Promise.all([b.page.request.post(endpoint,{data:req}),b.page.request.post(endpoint,{data:{...req,clientKey:crypto.randomUUID()}})])
rec('Two devices same expected version: exactly one success',c.map(x=>x.status()).sort().join(',')==='200,409',{statuses:c.map(x=>x.status())})
const winner=c.find(x=>x.status()===200),winnerIndex=c.indexOf(winner),winnerBody=await winner.json()
const retryReq=winnerIndex===0?req:null
if(retryReq){const retry=await b.page.request.post(endpoint,{data:retryReq});const r=await retry.json();rec('Identical replay returns original version',retry.status()===200&&r.reused===true&&r.version===winnerBody.version)}
const stale=await b.page.request.post(endpoint,{data:{...req,clientKey:crypto.randomUUID()}})
rec('Stale expected version rejected',stale.status()===409)
const conflictReq={...req,clientKey:crypto.randomUUID(),expectedVersion:2}
const beforeGoal=await b.page.request.post(endpoint,{data:conflictReq})
const success=await beforeGoal.json()
if(beforeGoal.status()!==200)throw Error('initial idempotency fixture failed')
const conflict=await b.page.request.post(endpoint,{data:{...conflictReq,note:'different body'}})
rec('Same key different body rejected',conflict.status()===409)
const old=await b.page.request.get(endpoint);const oldBody=await old.json()
await b.page.request.put(base+'/api/csat/diagnosis/map/goal',{data:{target:90}})
const retried=await b.page.request.post(endpoint,{data:conflictReq});const rr=await retried.json()
rec('Goal change does not rewrite replay result',retried.status()===200&&rr.reused&&rr.version===success.version)
const afterGoal=await b.page.request.get(endpoint);const ag=await afterGoal.json()
rec('Goal version appended, PLAN history preserved',ag.goalVersionId!==oldBody.goalVersionId&&ag.byTemplate['ws.central-meaning'].history.length===oldBody.byTemplate['ws.central-meaning'].history.length)

for (const scenario of ['unmounted','same-instance']) {
await b.page.goto(base+'/csat/diagnosis?tab=map&view=full&map_task=r.central_meaning&ws=ws.central-meaning',{waitUntil:'domcontentloaded'})
await b.page.waitForSelector('[data-testid=unified-map]')
await b.page.click('[data-testid="ws-row"][data-ws="ws.central-meaning"] [data-testid=ws-open]')
await b.page.click('[data-testid=ws-tab-plan]')
await b.page.waitForSelector('[data-testid=plan-section]')
await b.page.locator('[data-testid=plan-section]').getByRole('button',{name:/계획 한 (문항|지문) 늘리기$/}).first().click()
let release,arrived,ackVersion
const waitRelease=new Promise(r=>release=r),waitArrived=new Promise(r=>arrived=r)
await b.page.route('**/api/csat/diagnosis/map/plan',async route=>{
 if(route.request().method()!=='POST')return route.continue()
 const response=await route.fetch();ackVersion=(await response.json()).version;arrived();await waitRelease;await route.fulfill({response})
})
await b.page.click('[data-testid=plan-save]')
await waitArrived
if (scenario === 'unmounted') {
await b.page.click('[data-testid=ws-tab-overview]')
await b.page.waitForSelector('[data-testid=plan-section]',{state:'detached'})
await b.page.click('[data-testid=ws-tab-plan]')
await b.page.waitForSelector('[data-testid=plan-section]')
}
await b.page.locator('[data-testid=plan-section]').getByRole('button',{name:/계획 한 (문항|지문) 늘리기$/}).first().click()
const desired=await b.page.locator('[data-testid=plan-section] [data-task="r.central_meaning"]').getAttribute('data-planned')
await b.page.fill('[data-testid=plan-note]','newer edit '+scenario)
await b.page.evaluate(()=>{window.__heldDraft=Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('map-v4-plan-draft:')).map(k=>[k,localStorage.getItem(k)]))})
release()
await b.page.waitForTimeout(1800)
const preserved=await b.page.evaluate(()=>Object.entries(window.__heldDraft).every(([k,v])=>localStorage.getItem(k)===v))
rec('Late response never clears a newer draft: '+scenario,preserved)

await b.page.screenshot({path:out+'/stale-plan-'+scenario+'.png'})
await b.page.waitForFunction(v=>document.querySelector('[data-testid=plan-section]')?.getAttribute('data-saved-version')===String(v),ackVersion,{timeout:25000}).catch(()=>{})
const visible=await b.page.locator('[data-testid=plan-section] [data-task="r.central_meaning"]').getAttribute('data-planned')
rec('Newer quantity and note remain visible after acknowledgement: '+scenario,visible===desired&&(await b.page.inputValue('[data-testid=plan-note]'))==='newer edit '+scenario)
const saveAgain=b.page.waitForResponse(r=>r.url().endsWith('/api/csat/diagnosis/map/plan')&&r.request().method()==='POST')
await b.page.click('[data-testid=plan-save]')
const followup=await saveAgain
rec('Preserved draft can be saved against acknowledged version: '+scenario,followup.status()===200,{status:followup.status()})
await b.page.waitForTimeout(1200)

await b.page.unroute('**/api/csat/diagnosis/map/plan')
}
const own=await a.page.request.get(base+'/api/csat/diagnosis/map/plan?workspaceId='+saved.workspaceId);const j=await own.json();rec('A cannot read B actual existing Workspace through PLAN GET',own.status()===200&&!JSON.stringify(j).includes(saved.workspaceId));
const bad=await a.page.request.post(base+'/api/csat/diagnosis/map/plan',{data:{template:'ws.central-meaning',order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{'r.central_meaning':1},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID(),workspaceId:saved.workspaceId}});rec('Client-selected foreign Workspace write rejected',bad.status()===400,{status:bad.status()});
for(const width of [1280,1440]){await a.page.setViewportSize({width,height:900});await a.page.goto(base+'/csat/diagnosis?tab=map&view=full&map_task=r.central_meaning&ws=ws.central-meaning&map_ws='+saved.workspaceId+'&map_plan=1',{waitUntil:'domcontentloaded'});await a.page.waitForSelector('[data-testid=unified-map]');await a.page.waitForTimeout(700);const text=await a.page.locator('[data-testid=umap-return-note]').textContent().catch(()=>null);rec('Foreign actual Workspace URL uses current own context '+width,!!text&&text.includes('계획'),{notice:text});await a.page.screenshot({path:out+'/'+width+'.png'})}
const after=await b.page.request.get(base+'/api/csat/diagnosis/map/plan');const bj=await after.json();rec('B plan stays version 7',bj.byTemplate?.['ws.central-meaning']?.workspaceId===saved.workspaceId&&bj.byTemplate?.['ws.central-meaning']?.latest?.version===7);await a.ctx.close();await b.ctx.close();
}finally{const cleanup=await cleanupOwnedAccounts(db.auth.admin,users);try{await browser.close()}catch{cleanup.ok=false;cleanup.errors.push('browser_close_failed')}fs.writeFileSync(out+'/results.json',JSON.stringify({results,created:users.length,accountsLeft:cleanup.accountsLeft,cleanup},null,2));if(!cleanup.ok)process.exitCode=1}
if(results.some(r=>!r.ok))process.exitCode=1;
