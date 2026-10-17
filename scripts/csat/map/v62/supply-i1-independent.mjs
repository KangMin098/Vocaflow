// scripts/csat/map/v62/supply-i1-independent.mjs
// PR #280 independent PostgreSQL counterexamples. Local pool only; no network/dev credentials.
import { randomUUID } from 'node:crypto'

export async function independentCases({ pool, asUser, check, newLine, ADMIN, ME, STUB, STUB_I1, LAYERS, rollback }) {
  const H = 'a'.repeat(64)
  const qual = async (task, ref, { prev = null, axes = null, kind = 'csat_item' } = {}) => {
    const rev = (await pool.query(`select public.supply_artifact_revision($1,$2) r`, [kind,ref])).rows[0].r
    return asUser(ADMIN, `select public.content_qualification_record('FQ1.1',$1,$2,$3,$4,'guided_practice',$5::jsonb,'s',$6,null,'g',$6,'{}','{e}','independent',$7) id`,
      [kind,ref,rev,task,JSON.stringify(axes ?? Object.fromEntries([... 'ABCDEFGH'].map(x=>[x,{state:'pass'}]))),H,prev])
  }
  const ready = async (task, ref, opts) => {
    const q = (await qual(task,ref,opts)).row.id
    const p = (await asUser(ADMIN, `select public.content_release_approve($1,'public') id`,[q])).row.id
    return {q,p}
  }
  const supply = (line,a,order=null,client) => asUser(ME, `select public.workspace_delivery_record($1,$2,$3,$4,$5) id`,[line,order,a.q,a.p,randomUUID()], client ? {client} : {})
  const revoke = (a,client) => asUser(ADMIN, `select public.content_release_revoke($1,'rights withdrawn')`,[a.p],client ? {client} : {})
  const valid = async id => (await pool.query(`select public.supply_delivery_valid($1) v`,[id])).rows[0].v
  const open = async (task,n,tag) => {
    const line = await newLine('guided_practice',n,tag,task)
    const order = (await asUser(ME,`select public.factory_order_open($1,'initial',$2::smallint,$3) id`,[line,n,randomUUID()])).row.id
    await asUser(ADMIN,`select public.factory_order_transition($1,'requested','stock_search',null,null,null,$2)`,[order,randomUUID()])
    return {line,order}
  }
  const close = (order,to,q,opts) => asUser(ADMIN,`select public.factory_order_transition($1,'stock_search',$2,'remaining shortfall',null,$3,$4)`,[order,to,q,randomUUID()],opts)
  const held = async () => { const c=await pool.connect(); await c.query('begin'); return c }
  const release = async c => {await c.query('commit'); c.release()}

  {
    const task='r.ind_auth',axes=JSON.stringify(Object.fromEntries([... 'ABCDEFGH'].map(x=>[x,{state:'pass'}]))),rev=(await pool.query(`select supply_artifact_revision('csat_item','C#29') r`)).rows[0].r
    const q=await asUser(ME,`select content_qualification_record('FQ1.1','csat_item','C#29',$1,$2,'guided_practice',$3::jsonb,'s',$4,null,'g',$4,'{}','{e}','no-profile',null) id`,[rev,task,axes,H])
    const qa=(await qual('r.ind_authapprove','C#28')).row.id
    const approve=await asUser(ME,`select content_release_approve($1,'public')`,[qa])
    const a=await ready('r.ind_authrevoke','C#27'),rv=await asUser(ME,`select content_release_revoke($1,'no-profile')`,[a.p])
    const {order}=await open('r.ind_authtransition',1,'ind-auth-order')
    const trans=await asUser(ME,`select factory_order_transition($1,'stock_search','failed','no-profile',null,null,$2)`,[order,randomUUID()])
    const reg=await asUser(ME,`select factory_product_order_register('NO-PROFILE',1,$1,'active',$2,'r.ind_authtransition','guided_practice',1,null,$3)`,[H,'c'.repeat(32),randomUUID()])
    await asUser(ADMIN,`select factory_product_order_register('AUTH-LINK',1,$1,'active',$2,'r.ind_authtransition','guided_practice',1,null,$3)`,[H,'c'.repeat(32),randomUUID()])
    const link=await asUser(ME,`select factory_order_link_product($1,'AUTH-LINK',1,$2,$3)`,[order,H,randomUUID()])
    const all=[q,approve,rv,trans,reg,link]
    check('actual NULL auth helper denies all six administrator RPCs',all.every(r=>!r.ok&&/Forbidden/.test(r.err)),JSON.stringify(all))
  }

  {
    const fixtures=[['attempt','attempted'],['session','item_seen'],['trap','attempted'],['review','attempted'],['deleted','explanation_seen'],['viewed','explanation_seen'],['help','explanation_seen'],['shared','shared_passage_seen']]
    for(const [ref] of fixtures)await pool.query(`insert into csat_items(id,exam_id,passage) values ($1,'IND',$1)`,['IND#'+ref])
    await pool.query(`insert into learning_task_attempts(user_id,item_ref) values ($1,'IND#attempt')`,[ME])
    await pool.query(`insert into learning_sessions(user_id,item_ref) values ($1,'IND#session')`,[ME])
    await pool.query(`insert into csat_trap_attempts(user_id,item_id) values ($1,'IND#trap')`,[ME])
    await pool.query(`insert into csat_review_queue(user_id,item_id) values ($1,'IND#review')`,[ME])
    await pool.query(`insert into learning_sessions(user_id,item_ref,deleted_at,explanation_viewed_at) values ($1,'IND#deleted',now(),now())`,[ME])
    await pool.query(`insert into learning_sessions(user_id,item_ref,help_level) values ($1,'IND#viewed','viewed_first')`,[ME])
    await pool.query(`insert into learning_sessions(user_id,item_ref,help_server_at) values ($1,'IND#help',now())`,[ME])
    await pool.query(`update csat_items set passage='same passage' where id in ('IND#trap','IND#shared')`)
    for(const [ref,expected] of fixtures){const x=(await pool.query(`select supply_learner_exposure('csat_item',$1,$2) e`,['IND#'+ref,ME])).rows[0].e;check('PG exposure '+ref,x===expected,`expected=${expected} actual=${x}`)}
    const other=(await pool.query(`select supply_learner_exposure('csat_item','IND#viewed',$1) e`,[randomUUID()])).rows[0].e
    check('PG exposure is learner specific',other==='none',other)
    await pool.query(`alter table csat_trap_attempts rename to ind_missing_ledger`)
    const unknown=(await pool.query(`select supply_learner_exposure('csat_item','IND#session',$1) e`,[ME])).rows[0].e
    await pool.query(`alter table ind_missing_ledger rename to csat_trap_attempts`)
    check('PG missing exposure ledger fails closed',unknown==='unknown',unknown)
  }

  // Sequential current-state predicates on the real engine, identical in --submitted and repaired runs.
  {
    const task='r.ind_supersede', line=await newLine('guided_practice',1,'ind-r01',task)
    const a=await ready(task,'C#0'), d=await supply(line,a)
    await qual(task,'C#0',{prev:a.q})
    check('R01 supersede: history retained, current valid=false',await valid(d.row.id)===false && (await pool.query(`select count(*)::int n from workspace_content_delivery where id=$1`,[d.row.id])).rows[0].n===1,`valid=${await valid(d.row.id)}`)
  }
  {
    const task='r.ind_source', ref=randomUUID(), src=randomUUID()
    await pool.query(`insert into csat_dcp_items(id,kind,ref_id) values ($1,'article',$2)`,[ref,src])
    const line=await newLine('guided_practice',1,'ind-r04',task), a=await ready(task,ref,{kind:'dcp_item'}),d=await supply(line,a)
    const before=(await pool.query(`select supply_artifact_revision('dcp_item',$1) r`,[ref])).rows[0].r
    await pool.query(`insert into ineligible_sources values ($1)`,[src])
    const after=(await pool.query(`select supply_artifact_revision('dcp_item',$1) r`,[ref])).rows[0].r
    check('R04 source rights withdrawn with unchanged revision',before===after && await valid(d.row.id)===false,`revisionSame=${before===after} valid=${await valid(d.row.id)}`)
  }
  {
    const task='r.ind_partial', {line,order}=await open(task,5,'ind-r02'), arr=[]
    for(let i=0;i<5;i++){const a=await ready(task,`C#${i}`);arr.push(a);await supply(line,a,order)}
    for(const a of arr.slice(0,3)) await revoke(a)
    const r=await close(order,'delivered',arr[4].q)
    const partial=await close(order,'partial',null)
    check('R02 revoked 3 of 5 before close: delivered rejects, partial accepts',!r.ok && /full quantity/.test(r.err) && partial.ok,`delivered=${JSON.stringify(r)} partial=${JSON.stringify(partial)}`)
  }
  // Hold supersede/revoke/close in one connection. Competing RPC must wait, then recheck.
  {
    const task='r.ind_reveal',line=await newLine('guided_practice',1,'ind-reveal',task),a=await ready(task,'C#9'),d=await supply(line,a)
    await pool.query(`insert into embargoed_items values ('C#9')`)
    const line2=await newLine('guided_practice',1,'ind-reveal-new',task),r=await supply(line2,a)
    check('R04 CSAT Reveal Gate blocks current count and new supply',await valid(d.row.id)===false && !r.ok && /source not eligible/.test(r.err),`valid=${await valid(d.row.id)} new=${JSON.stringify(r)}`)
    await pool.query(`delete from embargoed_items where item_id='C#9'`)
  }
  {
    const task='r.ind_superrace',line=await newLine('guided_practice',2,'ind-superrace',task),a=await ready(task,'C#5')
    const c=await held();await c.query(`select set_config('request.jwt.claim.sub',$1,true)`,[ADMIN])
    const rev=(await c.query(`select supply_artifact_revision('csat_item','C#5') r`)).rows[0].r
    await c.query(`select content_qualification_record('FQ1.1','csat_item','C#5',$1,$2,'guided_practice',$3::jsonb,'s',$4,null,'g',$4,'{}','{e}','race',$5)`,[rev,task,JSON.stringify(Object.fromEntries([... 'ABCDEFGH'].map(x=>[x,{state:'pass'}]))),H,a.q])
    const r=asUser(ME,`select workspace_delivery_record($1,null,$2,$3,$4) id`,[line,a.q,a.p,randomUUID()])
    await new Promise(r=>setTimeout(r,150));await release(c)
    const result=await r
    check('supersede in flight: delivery waits then rejects',!result.ok && /superseded/.test(result.err),JSON.stringify(result))
  }
  {
    const task='r.ind_closerace',{line,order}=await open(task,1,'ind-close'),a=await ready(task,'C#6')
    const c=await held();await close(order,'failed',null,{client:c})
    const r=supply(line,a,order);await new Promise(r=>setTimeout(r,150));await release(c)
    const result=await r
    check('order close in flight: delivery waits then rejects',!result.ok && /order closed/.test(result.err),JSON.stringify(result))
  }
  {
    const task='r.ind_revokeclose',{line,order}=await open(task,1,'ind-revokeclose'),a=await ready(task,'C#7')
    await supply(line,a,order)
    const c=await held();await revoke(a,c)
    const r=close(order,'delivered',a.q);await new Promise(r=>setTimeout(r,150));await release(c)
    const result=await r
    check('revocation in flight: delivered transition waits then rejects',!result.ok && /delivery row|full quantity/.test(result.err),JSON.stringify(result))
  }
  // A malformed required axis used to produce NULL in fq_role_ok; IF NOT NULL did not reject it.
  {
    const task='r.ind_nullaxis', axes=Object.fromEntries([... 'ABCDEFGH'].map(x=>[x,{state:'pass'}]));axes.A={}
    const q=await qual(task,'C#8',{axes})
    let accepted=false
    if(q.ok){const p=await asUser(ADMIN,`select content_release_approve($1,'public') id`,[q.row.id]);if(p.ok){const line=await newLine('guided_practice',1,'ind-null',task);accepted=(await supply(line,{q:q.row.id,p:p.row.id})).ok}}
    check('missing required axis state cannot yield approved supply',!accepted,`qualification=${q.ok} supply=${accepted}`)
  }
  // A SQL connection with the authenticated role may create pg_temp tables. A definer must not resolve those first.
  {
    await pool.query(`grant usage on schema public,auth to authenticated; grant select on all tables in schema public to authenticated`)
    const target=await ready('r.ind_tempauth','C#26')
    const c=await held();await c.query(`select set_config('request.jwt.claim.sub',$1,true)`,[ME]);await c.query('set local role authenticated')
    await c.query(`create temporary table user_profiles(user_id uuid,role text)`)
    await c.query(`insert into pg_temp.user_profiles values ($1,'admin')`,[ME])
    const r=await asUser(ME,`select content_release_revoke($1,'temp spoof')`,[target.p],{client:c})
    await c.query('rollback');c.release()
    check('pg_temp table cannot impersonate administrator in definer',!r.ok && /Forbidden/.test(r.err),JSON.stringify(r))
  }
  {
    const c=await held();await c.query(`select set_config('request.jwt.claim.sub',$1,true)`,[randomUUID()]);await c.query('set local role authenticated')
    const tables=['workspace_content_demand','workspace_content_demand_line','factory_order','factory_order_event','workspace_content_delivery','content_qualification','content_release_approval','content_release_revocation','factory_product_order','factory_order_product_link']
    const counts=[];for(const t of tables)counts.push((await c.query(`select count(*)::int n from public.${t}`)).rows[0].n)
    check('PG authenticated other student sees zero rows in all ten ledgers',counts.every(n=>n===0),JSON.stringify(counts))
    const forbidden=await asUser(ME,`select content_release_approve($1,'public')`,[randomUUID()],{client:c})
    await c.query('rollback');c.release()
    check('PG authenticated learner cannot approve',!forbidden.ok&&/Forbidden/.test(forbidden.err),JSON.stringify(forbidden))
    const acl=(await pool.query(`select bool_and(not has_function_privilege('anon',p.oid,'execute')) ok from pg_proc p where pronamespace='public'::regnamespace and proname in ('workspace_demand_record','factory_order_open','factory_order_transition','workspace_delivery_record','content_qualification_record','content_release_approve','content_release_revoke','workspace_line_fulfillment')`)).rows[0].ok
    check('PG anonymous has no mutation/fulfillment EXECUTE',acl===true,String(acl))
  }
  {
    const c=await held();await c.query('set local role authenticated')
    const r=await asUser(ME,`truncate table public.workspace_content_delivery`,[],{client:c})
    // 성공해도 반드시 rollback: 이력은 로컬 fixture에서도 보존한다.
    await c.query('rollback');c.release()
    check('PG default ALL privileges cannot bypass RLS with TRUNCATE',!r.ok&&/permission denied/.test(r.err),JSON.stringify(r))
  }
  {
    await pool.query('create database vf_rollback')
    const rb=new pool.constructor({...pool.options,password:pool.options.password,database:'vf_rollback'})
    try {
      await rb.query(STUB.replace('create role anon nologin; create role authenticated nologin;',''))
      await rb.query(STUB_I1);for(const sql of LAYERS)await rb.query(sql)
      await rb.query(`insert into auth.users values ($1)`,[ADMIN]);await rb.query(`insert into admins values ($1,'admin')`,[ADMIN])
      const c=await rb.connect();await c.query('begin')
      await asUser(ADMIN,`select factory_product_order_register('ROLLBACK-RACE',1,$1,'active',$2,'r.central_meaning','guided_practice',1,null,$3)`,[H,'b'.repeat(32),randomUUID()],{client:c})
      const runner=await rb.connect()
      const pending=runner.query(rollback).then(()=>({ok:true}),e=>({ok:false,err:e.message}))
      await new Promise(r=>setTimeout(r,200));await c.query('commit');c.release()
      const result=await pending;await runner.query('rollback');runner.release()
      const exists=(await rb.query(`select to_regclass('public.factory_product_order') is not null yes`)).rows[0].yes
      const n=exists?(await rb.query(`select count(*)::int n from factory_product_order`)).rows[0].n:0
      check('rollback versus registration preserves the committed ledger',!result.ok&&/has rows/.test(result.err)&&n===1,JSON.stringify({result,rows:n,tableExists:exists}))
    }finally{await rb.end()}
  }
}
