// apps/web/scripts/final-independent/probe-authored-supply.ts
// Frozen owner SQL at b4fbf4d5c; actual PGlite only. No remote DB/env use.
import { PGlite } from '@electric-sql/pglite'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { canonicalDemand } from '../../src/lib/csat/map/v62/persist-contract'
import { AXES, B_SQL, C_SQL, STUB, as, revOf } from '../../src/lib/csat/map/v62/__tests__/supply-sql-harness'

const root = path.resolve(__dirname,'../../../..')
const owner='b4fbf4d5c'
const au=execFileSync('git',['show',`${owner}:supabase/migrations/_pending_authored_supply.sql`],{cwd:root,encoding:'utf8'})
const admin='00000000-0000-4000-8000-0000000000a1',uid='00000000-0000-4000-8000-0000000000b1'
const task='r.central_meaning',tkey='authored-central-meaning'
let seq=0
const key=()=>`00000000-0000-4000-9000-${String(++seq).padStart(12,'0')}`
const body={title:'Original isolated fixture',sentences:['A town changed its opening hours.','Visitors could use the hall after work.','Later opening made the hall more accessible.'],stem:'Main point?',choices:['a','b','c','d','e']}
const gold={answer:0,claim:2,claimRestated:[],support:[1],supportDisputed:[],opposed:[],relationProbe:{sentence:1,relation:'reason'}}
async function main(){const db=new PGlite();try{
  const one=async<T=Record<string,unknown>>(sql:string,params:unknown[]=[]) => (await db.query<T>(sql,params)).rows[0]!
  await db.exec(STUB)
  await db.exec(fs.readFileSync(path.join(root,'apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql'),'utf8'))
  await db.exec(`alter table learning_task_attempts add column activity text,add column help_level text,add column content_hash text,add column received_at timestamptz default now();alter table learning_sessions add column stage text;`)
  await db.exec(C_SQL);await db.exec(B_SQL)
  for(const file of ['_pending_workspace_supply_i1_safety.sql','20261018120000_workspace_supply_c_annotation_binding.sql','20261018120100_r5_delivery_g2_binding.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))
  await db.exec(au)
  await db.query(`insert into auth.users values ($1),($2)`,[admin,uid]);await db.query(`insert into admins values ($1,'admin')`,[admin])
  const ws=(await one<{id:string}>(`insert into learner_workspace(user_id) values ($1) returning id`,[uid])).id
  await db.query(`insert into learner_workspace_plan(workspace_id,user_id,plan_version) values($1,$2,1)`,[ws,uid])
  const register=async(ref:string,role:string,group:string)=>{await as(db,admin);return(await one<{ref:string}>(`select authored_item_register($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb) ref`,[ref,task,tkey,['independent_check','transfer','delayed_check'].includes(role)?'assessment':'instruction',role,group,JSON.stringify(body),JSON.stringify(gold),`${tkey}-${ref.slice(9)}.v1`,JSON.stringify({author:'isolated',method:'fixture',derivedFrom:[]})])).ref}
  const qualify=async(ref:string,role:string,rights:string[],basis='self_authored_original')=>{await as(db,admin);const rev=await revOf(db,'authored_item',ref);const hash=(await one<{h:string}>(`select authored_item_gold_hash($1) h`,[ref])).h
    await one(`select content_human_decision_record('rights','authored_item',$1,$2,$2,$4,$3::text[],'isolated-evidence','human-reviewed') id`,[ref,rev,rights,basis])
    await one(`select content_human_decision_record('gold','authored_item',$1,$2,$3,'human_gold_review','{assess}','isolated-evidence','human-reviewed') id`,[ref,rev,hash])
    const q=(await one<{id:string}>(`select content_qualification_record('FQ1.1','authored_item',$1,$2,$3,$4,$5::jsonb,'self',$2,null,'gold',$6,$7,$6,'{}','{ev}','isolated',null) id`,[ref,rev,task,role,JSON.stringify(AXES()),hash,`${tkey}-${ref.slice(9)}.v1`])).id
    await one(`select content_release_approve($1,'public') id`,[q]);const approval=(await one<{id:string}>(`select content_release_approve($1,'assessment') id`,[q])).id
    return{q,approval,hash}}
  const deliver=async(ref:string,role:string,rights:string[],basis='self_authored_original')=>{const{q,approval,hash}=await qualify(ref,role,rights,basis);await as(db,uid)
    const demand={key:'k',template:'ws.reading',workspaceId:ws,goalVersion:null,planVersion:1,definitionVersion:`probe-${++seq}`,asOf:'2026-10-18T00:00:00Z',core:task,support:[],purpose:{need:null,evidence:'probe',independentItems:null,unknowns:[]},lines:[{role,task,quantity:{n:1},csatTypes:['R-TOPIC'],taskKeys:[],requires:[],reason:'need'}]}
    const did=(await one<{id:string}>(`select workspace_demand_record($1) id`,[canonicalDemand(uid,demand as never)])).id
    const line=(await one<{id:string}>(`select id from workspace_content_demand_line where demand_id=$1`,[did])).id
    const delivery=(await one<{id:string}>(`select workspace_delivery_record($1,null,$2,$3,$4) id`,[line,q,approval,key()])).id
    return{delivery,hash}}
  const observations:Record<string,unknown>[]=[]
  // Instruction artifact itself is requalified for assessment, bypassing immutable role_class/intended_role.
  const roleRef=await register('authored:role-mismatch','guided_practice','group-role')
  const roleResult=await deliver(roleRef,'independent_check',['store','display','transmit','assess'])
  observations.push({id:'AS01',scenario:'instruction/guided_practice artifact qualified and delivered as independent_check',registeredRole:'guided_practice',deliveryRole:'independent_check',allowed:Boolean(roleResult.delivery),deliveryValid:(await one<{ok:boolean}>(`select supply_delivery_valid($1) ok`,[roleResult.delivery])).ok})
  // Rights permission omits store and assess while independent assessment is delivered.
  const rightsRef=await register('authored:scope-mismatch','independent_check','group-scope')
  const rightsResult=await deliver(rightsRef,'independent_check',['display','transmit'],'licensed')
  observations.push({id:'AS02',scenario:'rights scope display+transmit only; independent assessment delivered',rightsBasis:'licensed',rightsScope:['display','transmit'],allowed:Boolean(rightsResult.delivery),deliveryValid:(await one<{ok:boolean}>(`select supply_delivery_valid($1) ok`,[rightsResult.delivery])).ok})
  // Exact same body + gold registered in different passage groups; instruction exposure is invisible.
  const teach=await register('authored:shared-teach','guided_practice','group-teach')
  const assess=await register('authored:shared-assess','independent_check','group-assess')
  await db.query(`insert into learning_sessions(user_id,item_ref,task_key,help_level,revealed_at) values($1,$2,$3,'viewed_first',now())`,[uid,teach,tkey])
  const exposure=(await one<{state:string}>(`select supply_learner_exposure('authored_item',$1,$2) state`,[assess,uid])).state
  const shared=await deliver(assess,'independent_check',['store','display','transmit','assess'])
  const session=(await one<{id:string}>(`insert into learning_sessions(user_id,item_ref,task_key,help_level,revealed_at) values($1,$2,$3,'independent',now()) returning id`,[uid,assess,tkey])).id
  const att=(await one<{id:number}>(`insert into learning_task_attempts(user_id,item_ref,task_key,session_id,activity,phase,help_level,content_hash,response) values($1,$2,$3,$4,'theater','practice','independent',$5,$6::jsonb) returning id`,[uid,assess,tkey,session,shared.hash,JSON.stringify({annotation:`${tkey}-${assess.slice(9)}.v1`,grade:{isCorrect:true}})])).id
  const bound=(await one<{id:string}>(`select workspace_delivery_attempt_record($1,$2,$3) id`,[shared.delivery,att,key()])).id
  const evidence=await one(`select first_exposure,evidence,non_evidence_reason from workspace_delivery_attempt where id=$1`,[bound])
  observations.push({id:'AS03',scenario:'exact same body in instruction and assessment under different group labels; teacher text already exposed',exposure,allowed:Boolean(shared.delivery),binding:evidence})
  console.log(JSON.stringify({scope:'ISOLATED_PGLITE_ONLY',ownerCommit:owner,remoteDbWrites:0,observations},null,2))
  if(observations.length!==3)throw new Error('Probe incomplete')
}finally{await db.close()}}
main().catch(e=>{console.error(e);process.exitCode=1})
