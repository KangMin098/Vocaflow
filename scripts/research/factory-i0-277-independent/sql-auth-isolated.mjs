// scripts/research/factory-i0-277-independent/sql-auth-isolated.mjs
// Actual pending C and read-only helper definitions, disposable local PostgreSQL only.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),{PGlite}=req('@electric-sql/pglite')
const docs=root+'/docs/research/factory-i0-277-independent',original=fs.readFileSync(root+'/supabase/migrations/_pending_workspace_supply_c_qualification.sql','utf8'),helpers=JSON.parse(fs.readFileSync(docs+'/AUTH-HELPERS.json','utf8'))
const out=import.meta.dirname+'/local/sql-auth-isolated.json';fs.mkdirSync(path.dirname(out),{recursive:true});if(fs.existsSync(out))throw Error('Immutable local evidence already exists; use a clean checkout')
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001',rows=[]
try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${uid}');create role anon;create role authenticated;create table public.user_profiles(user_id uuid,role text);create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;`)
 for(const helper of helpers.rows)await db.exec(helper.definition)
 await db.exec(original)
 const state=(await db.query('select public.is_admin_or_curator() as helper, public.is_admin() as admin')).rows[0];assert.equal(state.helper,null);assert.equal(state.admin,false)
 const axes=JSON.stringify(Object.fromEntries('ABCDEFGH'.split('').map(k=>[k,{state:'pass'}])))
 const record=async()=>(await db.query("select public.content_qualification_record('FQ1.1','csat_item','fixture','rev1','v.contextual_sense','guided_practice',$1::jsonb,'source1',$2,'analysis1','gold1',$2,'{}','{}','isolated',null) as id",[axes,'a'.repeat(64)])).rows[0].id
 const approve=async id=>(await db.query("select public.content_release_approve($1,'public',null) as id",[id])).rows[0].id
 const id=await record(),approval=await approve(id);assert.ok(id);assert.ok(approval)
 rows.push({id:'AUTH01',expected:'authenticated user without profile rejected',actual:'qualification and approval inserted',safetyPass:false,reproduced:true,helper:state.helper})
 await db.exec(`insert into user_profiles values('${uid}','learner')`)
 const rejected=async(fn)=>{let denied=false;try{await fn()}catch(e){denied=String(e).includes('admin')||e.code==='42501'}assert.equal(denied,true)}
 await rejected(record);rows.push({id:'original:learner_profile_rejected',pass:true})
 await db.exec('delete from user_profiles')
 const funcs=original.match(/create or replace function public\.content_(?:qualification_record|release_approve|release_revoke)[\s\S]*?end \$\$;/g)
 assert.equal(funcs?.length,3)
 for(const fn of funcs){const fixed=fn.replace('or not public.is_admin_or_curator() then','or public.is_admin_or_curator() is not true then');assert.notEqual(fixed,fn);await db.exec(fixed)}
 await rejected(record);rows.push({id:'proposal:no_profile_record_rejected',pass:true})
 await rejected(()=>approve(id));rows.push({id:'proposal:no_profile_approve_rejected',pass:true})
 await rejected(()=>db.query("select public.content_release_revoke($1,'isolated')",[approval]));rows.push({id:'proposal:no_profile_revoke_rejected',pass:true})
 await db.exec(`insert into user_profiles values('${uid}','admin')`);assert.ok(await approve(await record()));rows.push({id:'proposal:admin_positive',pass:true})
}finally{await db.close()}
fs.writeFileSync(out,JSON.stringify({engine:'disposable local PGlite',pendingFileSha256:crypto.createHash('sha256').update(original).digest('hex'),helperSnapshotSha256:crypto.createHash('sha256').update(fs.readFileSync(docs+'/AUTH-HELPERS.json')).digest('hex'),pendingFileModified:false,remoteChanges:false,scope:'Fixed authenticated identity; not live RLS or real approval verification',rows},null,2));console.log(JSON.stringify({originalDefect:true,controls:rows.length-1}))
