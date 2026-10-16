// scripts/research/lm-g1-3a-independent/live-race.mjs
import {execFileSync} from 'node:child_process';import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module'; import {randomUUID,randomBytes,createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),{createClient}=req('@supabase/supabase-js'),ts=req('typescript');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const file=path.join(import.meta.dirname,'local/live-race-'+(process.argv[3]??process.argv[2]??'original')+'.json');
const original=process.argv[2]==='original';const sources={};const src=n=>{const value=original?execFileSync('git',['show','305ad246863a473a8332b6e42141299c62247f13:apps/web/src/lib/csat/map/'+n],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/apps/web/src/lib/csat/map/'+n,'utf8');sources[n]=createHash('sha256').update(value).digest('hex');return value};
const run=(s,inject={})=>{s=s.replace(/^import[\s\S]*?from [^\n]+\n/gm,'').replace(/^import 'server-only'[^\n]*\n/gm,'');let js=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;let e={};new Function('exports',...Object.keys(inject),js)(e,...Object.values(inject));return e};
const target=run(src('v62/target-goal.ts'));
// Compile complete production exports, supplying only imported dependencies.
const store=run(src('v4/plan-store.ts'),{plan_commit_1:{},workspace_1:{},target_goal_1:target});
let server=src('server.ts').replace(/^import[\s\S]*?from [^\n]+\n/gm,'').replace(/^import 'server-only'[^\n]*\n/gm,'');
const js=ts.transpileModule(server,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let exports={};new Function('exports','findGoalByKey','setGoalStored','parseGoalInput','sameGoal','randomUUID','seoulToday',js)(exports,store.findGoalByKey,store.setGoal,target.parseGoalInput,target.sameGoal,randomUUID,target.seoulToday);
let uid;let results=[{case:'source',mode:original?'pinned-305ad2468':'current',hashes:sources}];
try{let u=await db.auth.admin.createUser({email:'lmg13a-independent-'+randomUUID()+'@example.com',password:randomBytes(24).toString('base64url')+'Aa1!',email_confirm:true});if(u.error)throw u.error;uid=u.data.user.id;fs.writeFileSync(path.join(import.meta.dirname,'local/race-owned.local.json'),JSON.stringify([uid]));
let n=0,release;let barrier=new Promise(r=>release=r);
// Intercept ONLY client-key SELECT results, snapshot both misses before either RPC.
const wrapped={rpc:db.rpc.bind(db),from(table){const q=db.from(table);return new Proxy(q,{get(o,k){const v=o[k];if(k==='select')return (...a)=>wrap(v.apply(o,a));return typeof v==='function'?v.bind(o):v}})}};
function wrap(q){return new Proxy(q,{get(o,k){if(k==='then')return (ok,bad)=>o.then(async r=>{if(n<2){n++;if(n===2)release();await barrier}return r}).then(ok,bad);const v=o[k];return typeof v==='function'? (...a)=>wrap(v.apply(o,a)):v}})}
let key=randomUUID();const got=await Promise.allSettled([80,90].map(target=>exports.setGoal(wrapped,uid,{target,clientKey:key},new Date('2026-10-16T01:00:00Z'))));
const rows=await db.from('csat_map_goal_version').select('id,target_score').eq('user_id',uid);if(rows.error)throw rows.error;
results.push({case:'C-forced-precheck-miss',prechecks:n,responses:got.map(x=>x.status==='fulfilled'?{status:'fulfilled',goal:x.value.goal,version:x.value.goalVersionId}:{status:'rejected',error:x.reason.message}),stored:rows.data,pass:got.filter(x=>x.status==='fulfilled').length===1});
if(process.argv[2]!=='original'){
const replayKey=randomUUID(),body={target:84,date:'2026-10-16',clientKey:replayKey};await exports.setGoal(db,uid,body,new Date('2026-10-16T01:00:00Z')); // committed result deliberately discarded
const again=await exports.setGoal(db,uid,body,new Date('2026-10-17T01:00:00Z'));const storedReplay=await db.from('csat_map_goal_version').select('id,target_score').eq('user_id',uid).eq('client_key',replayKey);if(storedReplay.error)throw storedReplay.error;
results.push({case:'E-lost-result-expired-date-replay',reused:again.reused,rows:storedReplay.data.length,pass:again.reused&&storedReplay.data.length===1&&again.goalVersionId===storedReplay.data[0].id});
await exports.setGoal(db,uid,{target:96,clientKey:randomUUID()},new Date('2026-10-17T01:00:00Z'));await exports.setGoal(db,uid,body,new Date('2026-10-17T01:00:00Z'));const current=await db.from('csat_map_goal').select('target_score').eq('user_id',uid).single();if(current.error)throw current.error;results.push({case:'F-old-key-newer-goal-preserved',current:current.data.target_score,pass:current.data.target_score===96});
}

}finally{if(uid){const d=await db.auth.admin.deleteUser(uid);if(d.error)throw d.error;const check=await db.auth.admin.getUserById(uid);if(check.error?.status!==404||check.error?.code!=='user_not_found')throw Error('Cleanup absence unconfirmed');results.push({case:'cleanup',pass:true})}fs.writeFileSync(file,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
