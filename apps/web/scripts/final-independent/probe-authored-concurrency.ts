// apps/web/scripts/final-independent/probe-authored-concurrency.ts
// Actual isolated PostgreSQL, separate connections, frozen owner SQL. No remote DB/env.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import net from 'node:net'
import path from 'node:path'
import { canonicalDemand } from '../../src/lib/csat/map/v62/persist-contract'
import { AXES, B_SQL, C_SQL, STUB } from '../../src/lib/csat/map/v62/__tests__/supply-sql-harness'
const root=path.resolve(__dirname,'../../../..'),owner=process.argv.includes('--owner-fix')?'7e638e63d28791dcc4f886431c0205743dc3310a':'b4fbf4d5c'
const deps=path.join(root,'.agent-logs/final-independent/pg-deps'),req=createRequire(path.join(deps,'package.json'))
const EmbeddedPostgres=req('embedded-postgres').default,{Pool}=req('pg')
const au=execFileSync('git',['show',`${owner}:supabase/migrations/_pending_authored_supply.sql`],{cwd:root,encoding:'utf8'})
const admin='00000000-0000-4000-8000-0000000000a1',uid='00000000-0000-4000-8000-0000000000b1'
const task='r.central_meaning',tkey='authored-central-meaning'
const rlsOnly=process.argv.includes('--rls-only')
const ownerFix=process.argv.includes('--owner-fix'),sameRef=process.argv.includes('--same-ref'),sharedDifferent=process.argv.includes('--shared-group-different-text')
const repairCandidate=process.argv.includes('--repair-candidate'),differentPassages=process.argv.includes('--different-passages')||sharedDifferent,aliasGroups=process.argv.includes('--alias-groups'),repeatableRead=process.argv.includes('--repeatable-read'),registrationRace=process.argv.includes('--registration-race')
const repairSql=repairCandidate?fs.readFileSync(path.join(root,'apps/web/scripts/final-independent/authored-supply-repair-candidate.sql'),'utf8'):null
const repairSha256=repairSql?createHash('sha256').update(repairSql).digest('hex'):null
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
  if(rlsOnly)await pool.query(`create role service_role nologin bypassrls;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter function public.is_admin_or_curator() security definer;
    alter function public.is_admin() security definer;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges revoke execute on functions from public;
    alter default privileges in schema public grant execute on functions to service_role;`)
  await pool.query(C_SQL);await pool.query(B_SQL)
  for(const file of ['_pending_workspace_supply_i1_safety.sql','20261018120000_workspace_supply_c_annotation_binding.sql','20261018120100_r5_delivery_g2_binding.sql'])await pool.query(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))
  await pool.query(au)
  if(repairCandidate)await pool.query(repairSql)
  await pool.query(`insert into auth.users values($1),($2);`,[admin,uid]);await pool.query(`insert into admins values($1,'admin')`,[admin])
  const body={sentences:['This is an isolated shared passage.','The same passage must not be a new independent task.','A new label is not a new text.'],stem:'q',choices:['a','b','c','d','e']}
  const gold={answer:0,claim:2,claimRestated:[],support:[1],supportDisputed:[],opposed:[],relationProbe:{sentence:1,relation:'reason'}}
  if((repairCandidate||ownerFix)&&registrationRace){
    const a=await pool.connect(),b=await pool.connect();let waiting=false,settled=false,code:string|null=null,error:string|null=null
    try{
      for(const c of[a,b]){await c.query('begin');await c.query(`select set_config('request.jwt.claim.sub',$1,true)`,[admin]);await c.query("set local statement_timeout='5000ms'")}
      const args=(name:string,role:string,group:string,variant:boolean)=>[`authored:${name}`,task,tkey,role==='guided_practice'?'instruction':'assessment',role,group,JSON.stringify(variant?{...body,sentences:body.sentences.map(s=>'  '+s.toUpperCase().replaceAll(' ','   ')+'  ')}:body),JSON.stringify(gold),`${tkey}-${name}.v1`,JSON.stringify({author:'isolated',method:'fixture',derivedFrom:[]})]
      const sql='select authored_item_register($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb)'
      await a.query(sql,args('race-teacher','guided_practice','teacher-label',false))
      const pending=b.query(sql,args('race-assessment','independent_check','assessment-label',true)).then(()=>{settled=true;return{code:null,error:null}},(e:Error&{code?:string})=>{settled=true;return{code:e.code??null,error:e.message}})
      for(let i=0;i<100;i++){const activity=await one('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[b.processID]);if(activity.wait_event_type==='Lock'&&activity.wait_event==='advisory'){waiting=true;break}if(settled)break;await new Promise(resolve=>setTimeout(resolve,10))}
      await a.query('commit');const outcome=await pending;code=outcome.code;error=outcome.error;if(error)await b.query('rollback');else await b.query('commit')
    }finally{await a.query('rollback');await b.query('rollback');a.release();b.release()}
    const count=Number((await one('select count(*)::int n from authored_item')).n),passed=waiting&&Boolean(error&&/actual passage mixes|same passage body already registered/.test(error))&&count===1
    console.log(JSON.stringify({scope:ownerFix?'ACTUAL_ISOLATED_POSTGRES_OWNER_FIX':'ACTUAL_ISOLATED_POSTGRES_REPAIR_CANDIDATE',ownerSqlSha256:createHash('sha256').update(au).digest('hex'),repairSha256,ownerCommit:owner,remoteDbWrites:0,serverVersion:(await one('show server_version')).server_version,scenario:'concurrent instruction/assessment registration; different group names; same text with case and whitespace differences',secondWaitObservedBeforeCommit:waiting,secondErrorCode:code,secondError:error,registeredRows:count,allPassed:passed,clusterDirectory:directory},null,2));if(!passed)throw new Error('Registration race failed');return
  }
  const prepared:{ref:string;line:string;qualification:string;approval:string;request:string}[]=[]
  for(const suffix of ['one','two']){
   const ref=`authored:race-${suffix}`,annotation=`${tkey}-race-${suffix}.v1`
   const raceBody=differentPassages?{...body,sentences:[body.sentences[0]+' '+suffix,...body.sentences.slice(1)]}:body
   const raceGroup=(differentPassages&&!sharedDifferent)||aliasGroups?'race-group-'+suffix:'shared-race-group'
   // Use one connected setup session because auth.uid() is session-local.
   const setup=await pool.connect()
   try{
    await setup.query(`select set_config('request.jwt.claim.sub',$1,false)`,[admin])
    await setup.query(`select authored_item_register($1,$2,$3,'assessment','independent_check',$8,$4::jsonb,$5::jsonb,$6,$7::jsonb)`,[ref,task,tkey,JSON.stringify(raceBody),JSON.stringify(gold),annotation,JSON.stringify({author:'isolated',method:'fixture',derivedFrom:[]}),raceGroup])
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
  if(rlsOnly){
    const preparedFirst=prepared[0]!,b='00000000-0000-4000-8000-0000000000c1'
    const seed=await pool.connect()
    let delivery:string
    try{await seed.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);delivery=(await seed.query(`select workspace_delivery_record($1,null,$2,$3,$4) id`,[preparedFirst.line,preparedFirst.qualification,preparedFirst.approval,key()])).rows[0].id}
    finally{seed.release()}
    await pool.query(`insert into auth.users values($1)`,[b])
    const rows:{id:string;pass:boolean;observed:unknown}[]=[]
    const run=async(id:string,role:'authenticated'|'anon'|'service_role',actor:string|null,sql:string,params:unknown[],expected:number|'deny')=>{
      const client=await pool.connect()
      try{
        await client.query('set role '+role)
        await client.query(`select set_config('request.jwt.claim.sub',$1,false)`,[actor??''])
        try{
          const value=(await client.query(sql,params)).rows[0]
          rows.push({id,pass:expected!=='deny'&&Number(value?.n)===expected,observed:value})
        }catch(e){const error=e as Error&{code?:string};rows.push({id,pass:expected==='deny'&&error.code==='42501',observed:{code:error.code,message:error.message}})}
      }finally{await client.query('reset role');client.release()}
    }
    await run('A-own-delivery-readable','authenticated',uid,'select count(*)::int n from workspace_content_delivery',[],1)
    await run('B-other-delivery-hidden','authenticated',b,'select count(*)::int n from workspace_content_delivery',[],0)
    await run('learner-gold-rows-hidden','authenticated',uid,'select count(*)::int n from authored_item',[],0)
    await run('admin-gold-rows-readable','authenticated',admin,'select count(*)::int n from authored_item',[],2)
    await run('service-gold-rows-readable','service_role',null,'select count(*)::int n from authored_item',[],2)
    await run('learner-human-decisions-hidden','authenticated',uid,'select count(*)::int n from content_human_decision',[],0)
    await run('service-human-decisions-readable','service_role',null,'select count(*)::int n from content_human_decision',[],4)
    await run('anon-gold-read-denied','anon',null,'select count(*)::int n from authored_item',[],'deny')
    await run('learner-direct-gold-write-denied','authenticated',uid,`insert into authored_item(ref) values ('authored:denied') returning 1 n`,[],'deny')
    await run('service-direct-gold-write-denied','service_role',null,`insert into authored_item(ref) values ('authored:denied') returning 1 n`,[],'deny')
    await run('learner-direct-human-decision-write-denied','authenticated',uid,`insert into content_human_decision(kind) values ('rights') returning 1 n`,[],'deny')
    await run('service-direct-human-decision-write-denied','service_role',null,`insert into content_human_decision(kind) values ('rights') returning 1 n`,[],'deny')
    const decision=`select content_human_decision_record('gold','authored_item',$1,'fixture-rev','fixture-hash','human_gold_review','{assess}','isolated','human-reviewed') n`
    await run('learner-human-decision-rpc-denied','authenticated',uid,decision,[preparedFirst.ref],'deny')
    await run('service-no-user-human-decision-rpc-denied','service_role',null,decision,[preparedFirst.ref],'deny')
    await run('anon-human-decision-rpc-denied','anon',null,decision,[preparedFirst.ref],'deny')
    await run('learner-internal-gold-hash-denied','authenticated',uid,'select authored_item_gold_hash($1) n',[preparedFirst.ref],'deny')
    await run('B-other-line-supply-rpc-denied','authenticated',b,'select workspace_delivery_record($1,null,$2,$3,$4) n',[preparedFirst.line,preparedFirst.qualification,preparedFirst.approval,key()],'deny')
    await run('B-other-delivery-binding-denied','authenticated',b,'select workspace_delivery_attempt_record($1,1,$2) n',[delivery!,key()],'deny')
    await run('learner-binding-insert-denied','authenticated',uid,`insert into workspace_delivery_attempt(user_id) values($1) returning 1 n`,[uid],'deny')
    console.log(JSON.stringify({scope:'ACTUAL_ISOLATED_POSTGRES_ROLES',ownerCommit:owner,serverVersion:(await one('show server_version')).server_version,remoteDbWrites:0,defaultPrivilegeSource:'read-only dev catalog 2026-10-18; postgres/public table grants and function grants',limits:'Minimal dependency schemas; actual pending supply functions/policies; not JWT verification, full Supabase or actual-dev E2E.',clusterDirectory:directory,rows,allPassed:rows.every(r=>r.pass)},null,2))
    if(rows.some(r=>!r.pass))throw new Error('Role boundary failed; retain details privately until classified')
    return
  }
  if(repairCandidate||ownerFix){
    const call=(f:typeof prepared[number])=>[f.line,null,f.qualification,f.approval,f.request]
    if(repeatableRead){
      const client=await pool.connect();let code:string|null=null,allowed=false
      try{await client.query('begin isolation level repeatable read');await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);try{await client.query('select workspace_delivery_record($1,$2,$3,$4,$5)',call(prepared[0]))}catch(e){code=(e as {code?:string}).code??null}await client.query('rollback');await client.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);allowed=Boolean((await client.query('select workspace_delivery_record($1,$2,$3,$4,$5) id',call(prepared[0]))).rows[0]?.id)}finally{await client.query('rollback');client.release()}
      const count=Number((await one('select count(*)::int n from workspace_content_delivery where user_id=$1',[uid])).n)
      const result={scope:ownerFix?'ACTUAL_ISOLATED_POSTGRES_OWNER_FIX':'ACTUAL_ISOLATED_POSTGRES_REPAIR_CANDIDATE',ownerSqlSha256:createHash('sha256').update(au).digest('hex'),repairSha256,scenario:'unsupported snapshot isolation fails closed; read-committed control remains legal',ownerCommit:owner,remoteDbWrites:0,serverVersion:(await one('show server_version')).server_version,repeatableReadErrorCode:code,readCommittedAllowed:allowed,committedDeliveries:count,allPassed:code==='40001'&&allowed&&count===1,clusterDirectory:directory}
      console.log(JSON.stringify(result,null,2));if(!result.allPassed)throw new Error('Repair isolation boundary failed');return
    }
    const a=await pool.connect(),b=await pool.connect();let firstId:string|null=null,secondId:string|null=null,error:string|null=null,blocked=false,settled=false
    try{
      for(const client of[a,b]){await client.query('begin');await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);await client.query("set local statement_timeout='5000ms'")}
      firstId=(await a.query('select workspace_delivery_record($1,$2,$3,$4,$5) id',call(prepared[0]))).rows[0].id
      const pending=b.query('select workspace_delivery_record($1,$2,$3,$4,$5) id',call(sameRef?{...prepared[1],qualification:prepared[0].qualification,approval:prepared[0].approval}:prepared[1])).then((r:{rows:{id:string}[]})=>{settled=true;return{id:r.rows[0].id,error:null}},(e:Error)=>{settled=true;return{id:null,error:e.message}})
      for(let i=0;i<100;i++){const activity=await one('select wait_event_type,wait_event,state from pg_stat_activity where pid=$1',[b.processID]);if(activity.wait_event_type==='Lock'&&activity.wait_event==='advisory'){blocked=true;break}if(settled)break;await new Promise(resolve=>setTimeout(resolve,10))}
      await a.query('commit');const outcome=await pending;secondId=outcome.id;error=outcome.error;if(secondId)await b.query('commit');else await b.query('rollback')
    }finally{await a.query('rollback');await b.query('rollback');a.release();b.release()}
    const count=Number((await one('select count(*)::int n from workspace_content_delivery where user_id=$1',[uid])).n)
    const passed=(ownerFix&&differentPassages&&!sharedDifferent||blocked)&&Boolean(firstId)&&(differentPassages&&!sharedDifferent?Boolean(secondId)&&count===2:!secondId&&Boolean(error&&/actual passage already delivered|exposure shared_passage_seen/.test(error))&&count===1)
    console.log(JSON.stringify({scope:ownerFix?'ACTUAL_ISOLATED_POSTGRES_OWNER_FIX':'ACTUAL_ISOLATED_POSTGRES_REPAIR_CANDIDATE',ownerSqlSha256:createHash('sha256').update(au).digest('hex'),repairSha256,ownerCommit:owner,remoteDbWrites:0,serverVersion:(await one('show server_version')).server_version,scenario:sameRef?'same artifact ref delivered through different demand lines':sharedDifferent?'same declared group with distinct text representations':differentPassages?'same learner and distinct passages remain legal after serialization':aliasGroups?'same actual text under different author group labels serializes and rejects second':'same learner and same passage group serializes and rejects second',secondWaitObservedBeforeCommit:blocked,firstAllowed:Boolean(firstId),secondAllowedAfterCommit:Boolean(secondId),secondError:error,committedDeliveries:count,allPassed:passed,clusterDirectory:directory},null,2));if(!passed)throw new Error('Repair race/control failed');return
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
