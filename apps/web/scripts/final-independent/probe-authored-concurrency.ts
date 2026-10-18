// apps/web/scripts/final-independent/probe-authored-concurrency.ts
// Actual isolated PostgreSQL, separate connections, frozen owner SQL. No remote DB/env.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import { canonicalDemand } from '../../src/lib/csat/map/v62/persist-contract'
import { AXES, B_SQL, C_SQL, STUB } from '../../src/lib/csat/map/v62/__tests__/supply-sql-harness'
const root=path.resolve(__dirname,'../../../..'),owner='b4fbf4d5c'
const deps=path.join(root,'.agent-logs/final-independent/pg-deps'),req=createRequire(path.join(deps,'package.json'))
const EmbeddedPostgres=req('embedded-postgres').default,{Pool}=req('pg')
const au=execFileSync('git',['show',`${owner}:supabase/migrations/_pending_authored_supply.sql`],{cwd:root,encoding:'utf8'})
const admin='00000000-0000-4000-8000-0000000000a1',uid='00000000-0000-4000-8000-0000000000b1'
const task='r.central_meaning',tkey='authored-central-meaning'
let seq=0
const key=()=>`00000000-0000-4000-9000-${String(++seq).padStart(12,'0')}`
async function port(){const listener=net.createServer();await new Promise<void>((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve)});const at=listener.address();if(!at||typeof at==='string')throw new Error('No loopback port');const number=at.port;await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));return number}
async function main(){
 const directory=fs.mkdtempSync(path.join(root,'.agent-logs/final-independent/pg-authored-race-'))
 const pgPort=await port(),server=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password:'isolated',port:pgPort,persistent:true,onLog:()=>{},onError:()=>{}})
 const binary=path.join(deps,'node_modules/@embedded-postgres',`${process.platform==='win32'?'windows':process.platform}-${process.arch}`,'native/bin',process.platform==='win32'?'pg_ctl.exe':'pg_ctl')
 const control=(args:string[])=>execFileSync(binary,args,{windowsHide:true,stdio:'ignore'})
 let started=false,pool:InstanceType<typeof Pool>|undefined
 try{
  await server.initialise();control(['-D',directory,'-o',`-p ${pgPort} -h 127.0.0.1`,'-w','start']);started=true
  pool=new Pool({host:'127.0.0.1',port:pgPort,user:'postgres',password:'isolated',database:'postgres',max:6})
  const one=async(sql:string,params:unknown[]=[])=> (await pool.query(sql,params)).rows[0] as Record<string,unknown>
  await pool.query(STUB);await pool.query(fs.readFileSync(path.join(root,'apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql'),'utf8'))
  await pool.query(`alter table learning_task_attempts add column activity text,add column help_level text,add column content_hash text,add column received_at timestamptz default now();alter table learning_sessions add column stage text;alter default privileges in schema public grant all on tables to anon,authenticated;`)
  await pool.query(C_SQL);await pool.query(B_SQL)
  for(const file of ['_pending_workspace_supply_i1_safety.sql','20261018120000_workspace_supply_c_annotation_binding.sql','20261018120100_r5_delivery_g2_binding.sql'])await pool.query(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))
  await pool.query(au)
  await pool.query(`insert into auth.users values($1),($2);`,[admin,uid]);await pool.query(`insert into admins values($1,'admin')`,[admin])
  const body={sentences:['This is an isolated shared passage.','The same passage must not be a new independent task.','A new label is not a new text.'],stem:'q',choices:['a','b','c','d','e']}
  const gold={answer:0,claim:2,claimRestated:[],support:[1],supportDisputed:[],opposed:[],relationProbe:{sentence:1,relation:'reason'}}
  const prepared:{ref:string;line:string;qualification:string;approval:string;request:string}[]=[]
  for(const suffix of ['one','two']){
   const ref=`authored:race-${suffix}`,annotation=`${tkey}-race-${suffix}.v1`
   // Use one connected setup session because auth.uid() is session-local.
   const setup=await pool.connect()
   try{
    await setup.query(`select set_config('request.jwt.claim.sub',$1,false)`,[admin])
    await setup.query(`select authored_item_register($1,$2,$3,'assessment','independent_check','shared-race-group',$4::jsonb,$5::jsonb,$6,$7::jsonb)`,[ref,task,tkey,JSON.stringify(body),JSON.stringify(gold),annotation,JSON.stringify({author:'isolated',method:'fixture',derivedFrom:[]})])
    const revision=(await setup.query(`select supply_artifact_revision('authored_item',$1) revision,authored_item_gold_hash($1) hash`,[ref])).rows[0]
    await setup.query(`select content_human_decision_record('rights','authored_item',$1,$2,$2,'self_authored_original','{store,display,transmit,assess}','isolated-evidence','human-reviewed')`,[ref,revision.revision])
    await setup.query(`select content_human_decision_record('gold','authored_item',$1,$2,$3,'human_gold_review','{assess}','isolated-evidence','human-reviewed')`,[ref,revision.revision,revision.hash])
    const qualification=(await setup.query(`select content_qualification_record('FQ1.1','authored_item',$1,$2,$3,'independent_check',$4::jsonb,'self',$2,null,'gold',$5,$6,$5,'{}','{ev}','isolated',null) id`,[ref,revision.revision,task,JSON.stringify(AXES()),revision.hash,annotation])).rows[0].id
    await setup.query(`select content_release_approve($1,'public')`,[qualification]);const approval=(await setup.query(`select content_release_approve($1,'assessment') id`,[qualification])).rows[0].id
    const ws=(await setup.query(`insert into learner_workspace(user_id) values($1) returning id`,[uid])).rows[0].id
    await setup.query(`insert into learner_workspace_plan(workspace_id,user_id,plan_version) values($1,$2,1)`,[ws,uid])
    await setup.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid])
    const demand={key:'k',template:'ws.reading',workspaceId:ws,goalVersion:null,planVersion:1,definitionVersion:'race',asOf:'2026-10-18T00:00:00Z',core:task,support:[],purpose:{need:null,evidence:'probe',independentItems:null,unknowns:[]},lines:[{role:'independent_check',task,quantity:{n:1},csatTypes:['R-TOPIC'],taskKeys:[],requires:[],reason:'need'}]}
    const did=(await setup.query(`select workspace_demand_record($1) id`,[canonicalDemand(uid,demand as never)])).rows[0].id
    const line=(await setup.query(`select id from workspace_content_demand_line where demand_id=$1`,[did])).rows[0].id
    prepared.push({ref,line,qualification,approval,request:key()})
   }finally{setup.release()}
  }
  const first=await pool.connect(),second=await pool.connect()
  let firstId:unknown,secondId:unknown,secondError:string|null=null,postCommitError:string|null=null
  try{
   for(const client of [first,second]){await client.query('begin');await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);await client.query("set local statement_timeout='1500ms'")}
   const call=(f:typeof prepared[number])=>[f.line,null,f.qualification,f.approval,f.request]
   firstId=(await first.query(`select workspace_delivery_record($1,$2,$3,$4,$5) id`,call(prepared[0]))).rows[0].id
   try{secondId=(await second.query(`select workspace_delivery_record($1,$2,$3,$4,$5) id`,call(prepared[1]))).rows[0].id}catch(error){secondError=(error as Error).message;await second.query('rollback')}
   await first.query('commit')
   if(secondId)await second.query('commit')
   else{await second.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);try{await second.query(`select workspace_delivery_record($1,$2,$3,$4,$5) id`,call(prepared[1]))}catch(error){postCommitError=(error as Error).message}}
  }finally{await first.query('rollback');await second.query('rollback');first.release();second.release()}
  const count=Number((await one(`select count(*)::int n from workspace_content_delivery where user_id=$1`,[uid])).n)
  console.log(JSON.stringify({scope:'ACTUAL_ISOLATED_POSTGRES',ownerCommit:owner,serverVersion:(await one('show server_version')).server_version,remoteDbWrites:0,scenario:'same learner; different demand lines and artifact refs; same passage group; first delivery uncommitted while second connection attempts delivery',firstAllowed:Boolean(firstId),secondAllowedBeforeFirstCommit:Boolean(secondId),secondError,postCommitError,committedDeliveries:count,defectReproduced:Boolean(firstId)&&Boolean(secondId)&&count===2,clusterDirectory:directory},null,2))
 }finally{if(pool)await pool.end();if(started)control(['-D',directory,'-m','fast','-w','stop'])}
}
main().catch(error=>{console.error(error);process.exitCode=1})
