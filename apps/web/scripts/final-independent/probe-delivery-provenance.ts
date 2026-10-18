// apps/web/scripts/final-independent/probe-delivery-provenance.ts
// New cross-flow acceptance probe. PGlite only; no remote DB/client/env use.
import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { bindDeliveryAttempt } from '../../src/lib/csat/map/v62/delivery-binding'
import { canonicalDemand } from '../../src/lib/csat/map/v62/persist-contract'
import { AXES, B_SQL, C_SQL, STUB, as, revOf } from '../../src/lib/csat/map/v62/__tests__/supply-sql-harness'

const root = path.resolve(__dirname, '../../../..')
const migration = (file: string) => fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8')
const uid = '00000000-0000-4000-8000-0000000000b1'
const admin = '00000000-0000-4000-8000-0000000000a1'
const ref = 'PROVENANCE#1'
const task = 'r.central_meaning'
const ann = 'c'.repeat(64)
const annotation = 'claim-support-provenance.v1'
const sameRole = process.argv.includes('--same-role')
let seq = 0
const key = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`

async function main() {
  const db = new PGlite()
  try {
    const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!
    await db.exec(STUB)
    await db.exec(fs.readFileSync(path.join(root, 'apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql'), 'utf8'))
    await db.exec(`alter table learning_task_attempts add column activity text, add column help_level text, add column content_hash text,
      add column received_at timestamptz default now(), add column client_mutation_id uuid; alter table learning_sessions add column stage text;`)
    await db.exec(C_SQL)
    await db.exec(B_SQL)
    await db.exec(migration('_pending_workspace_supply_i1_safety.sql'))
    await db.exec(migration('20261018120000_workspace_supply_c_annotation_binding.sql'))
    await db.exec(migration('20261018120100_r5_delivery_g2_binding.sql'))
    await db.query(`insert into auth.users values ($1),($2);`, [uid, admin])
    await db.query(`insert into public.admins values ($1,'admin')`, [admin])
    await db.query(`insert into csat_items (id,exam_id,no,stem,passage,choices,answer) values ($1,'PROVENANCE',1,'s','An original isolated provenance fixture.','[1,2,3,4,5]',1)`, [ref])
    const rev = await revOf(db, 'csat_item', ref)
    await db.query(`insert into supply_current_annotation values ($1,$2,$3,$4,$5)`, [ref,task,rev,annotation,ann])
    const deliveries: { id: string; workspace: string; role: string }[] = []
    for (const role of ['independent_check', sameRole ? 'independent_check' : 'transfer']) {
      const ws = (await one<{ id: string }>(`insert into learner_workspace (user_id) values ($1) returning id`, [uid])).id
      await db.query(`insert into learner_workspace_plan (workspace_id,user_id,plan_version) values ($1,$2,1)`, [ws,uid])
      await as(db, uid)
      const demand = { key:'k',template:'ws.reading',workspaceId:ws,goalVersion:null,planVersion:1,definitionVersion:'probe',asOf:'2026-10-18T00:00:00Z',core:task,support:[],purpose:{need:null,evidence:'probe',independentItems:null,unknowns:[]},lines:[{role,task,quantity:{n:1},csatTypes:['R-TOPIC'],taskKeys:[],requires:[],reason:'need'}] }
      const demandId = (await one<{id:string}>(`select workspace_demand_record($1) id`, [canonicalDemand(uid, demand as never)])).id
      const line = (await one<{id:string}>(`select id from workspace_content_demand_line where demand_id=$1`,[demandId])).id
      await as(db, admin)
      const q = (await one<{id:string}>(`select content_qualification_record('FQ1.1','csat_item',$1,$2,$3,$4,$5::jsonb,'src',$6,null,'gold',$6,$7,$8,'{}','{ev}','isolated fixture',null) id`,[ref,rev,task,role,JSON.stringify(AXES()),'a'.repeat(64),annotation,ann])).id
      await one(`select content_release_approve($1,'public') id`,[q])
      const approval = (await one<{id:string}>(`select content_release_approve($1,'assessment') id`,[q])).id
      await as(db, uid)
      const delivery = (await one<{id:string}>(`select workspace_delivery_record($1,null,$2,$3,$4) id`,[line,q,approval,key()])).id
      deliveries.push({id:delivery,workspace:ws,role})
    }
    const sid = (await one<{id:string}>(`insert into learning_sessions (user_id,item_ref,task_key,help_level,revealed_at) values ($1,$2,'claim-support','independent',now()) returning id`,[uid,ref])).id
    const mutation = key()
    const attempt = (await one<{id:number}>(`insert into learning_task_attempts (user_id,task_key,item_ref,session_id,phase,activity,help_level,content_hash,response,client_mutation_id) values ($1,'claim-support',$2,$3,'practice','theater','independent',$4,$5::jsonb,$6) returning id`,[uid,ref,sid,ann,JSON.stringify({annotation,grade:{isCorrect:true}}),mutation])).id
    const allowedTables = new Set(['workspace_delivery_attempt','workspace_content_delivery','learning_task_attempts'])
    const from = (table: string) => {
      if (!allowedTables.has(table)) throw new Error('unexpected probe table')
      let columns='*', limit=1000, order=''
      const values: unknown[]=[]
      const conditions: string[]=[]
      const query = {
        select(c:string) { if(!/^[a-z_, ]+$/.test(c)) throw new Error('invalid columns'); columns=c;return query },
        eq(k:string,v:unknown) {if(!/^[a-z_]+$/.test(k))throw new Error('invalid field');values.push(v);conditions.push(`${k}=$${values.length}`);return query},
        order(k:string,o:{ascending:boolean}) {if(!/^[a-z_]+$/.test(k))throw new Error('invalid ordering');order=` order by ${k} ${o.ascending?'asc':'desc'}`;return query},
        limit(n:number) {if(!Number.isSafeInteger(n)||n<0)throw new Error('invalid limit');limit=n;return query},
        then(resolve:(value:unknown)=>unknown) {return db.query(`select ${columns} from ${table}${conditions.length?' where '+conditions.join(' and '):''}${order} limit ${limit}`,values).then(r=>resolve({data:r.rows,error:null}))},
      }
      return query
    }
    const client = {from, async rpc(name:string,args:Record<string,unknown>) {
      if(name!=='workspace_delivery_attempt_record')throw new Error('unexpected probe rpc')
      try {const r=await one<{id:string}>(`select workspace_delivery_attempt_record($1,$2,$3) id`,[args.p_delivery,args.p_attempt,args.p_request_key]);return {data:r.id,error:null}}
      catch(e){return {data:null,error:{code:(e as {code?:string}).code,message:(e as Error).message}}}
    }}
    await db.exec('begin; savepoint before_app_binding')
    const result = await bindDeliveryAttempt(client as never,{userId:uid,itemRef:ref,clientMutationId:mutation})
    const row = await one<{delivery_id:string;workspace_id:string;role:string;evidence:boolean;non_evidence_reason:string}>(`select delivery_id,workspace_id,role,evidence,non_evidence_reason from workspace_delivery_attempt where attempt_id=$1`,[attempt])
    const wrong = row.delivery_id !== deliveries[0].id
    await db.exec('rollback to savepoint before_app_binding')
    const controlId = (await one<{id:string}>(`select workspace_delivery_attempt_record($1,$2,$3) id`, [deliveries[0].id,attempt,key()])).id
    const control = await one(`select role,evidence,non_evidence_reason from workspace_delivery_attempt where id=$1`,[controlId])
    await db.exec('rollback')
    console.log(JSON.stringify({scope:'ISOLATED_PGLITE',remoteDbWrites:0,scenario:sameRole ? 'same learner, item and role; two Workspaces; first Workspace CHECK submission' : 'same learner and item; CHECK delivery then TRANSFER delivery; independent CHECK submission',expected:{delivery:deliveries[0],evidence:true},actual:{binding:result,row},explicitDeliveryControl:control,defectReproduced:control.evidence===true && wrong && (sameRole ? row.evidence===true : row.non_evidence_reason==='help_state_mismatch'),sqlHash:createHash('sha256').update(migration('20261018120100_r5_delivery_g2_binding.sql')).digest('hex')},null,2))
    if(control.evidence!==true || !wrong || (sameRole ? row.evidence!==true : row.non_evidence_reason!=='help_state_mismatch'))throw new Error('Baseline defect not reproduced; update acceptance assessment')
  } finally { await db.close() }
}
main().catch(e=>{console.error(e);process.exitCode=1})
