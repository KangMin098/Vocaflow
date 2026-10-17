// scripts/research/factory-i0-277-independent/sql-isolated.mjs
// Pending SQL is executed only inside disposable local PGlite. No network or dev DB client.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),{PGlite}=req('@electric-sql/pglite')
const original=fs.readFileSync(root+'/supabase/migrations/_pending_workspace_supply_c_qualification.sql','utf8')
const out=import.meta.dirname+'/local/sql-isolated.json';fs.mkdirSync(path.dirname(out),{recursive:true});if(fs.existsSync(out))throw Error('Immutable SQL evidence exists')
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001',rows=[]
try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${uid}');create role anon;create role authenticated;create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;create function public.is_admin_or_curator() returns boolean language sql as $$select true$$;create function public.is_admin() returns boolean language sql as $$select true$$;`)
 await db.exec(original)
 const valid=Object.fromEntries('ABCDEFGH'.split('').map(k=>[k,{state:'pass'}]))
 const malformed={...valid,A:{}}
 const record=async axes=>(await db.query("select public.content_qualification_record('FQ1.1','csat_item','fixture','rev1','v.contextual_sense','guided_practice',$1::jsonb,'source1',$2,'analysis1','gold1',$2,'{}','{}','isolated',null) as id",[JSON.stringify(axes),'a'.repeat(64)])).rows[0].id
 const q=await record(malformed)
 const before=(await db.query('select public.fq_axes_valid($1::jsonb) as axes,public.fq_role_ok($1::jsonb,\'guided_practice\') as role',[JSON.stringify(malformed)])).rows[0]
 const approved=(await db.query("select public.content_release_approve($1,'public',null) as id",[q])).rows[0].id
 assert.equal(before.axes,true);assert.equal(before.role,null);assert.ok(approved)
 rows.push({id:'SQL01',scope:'original pending C/local admin fixture',expected:'missing state rejected',actual:'qualification and public approval inserted',safetyPass:false,reproduced:true})
 // Proposed fix specification only; never writes the pending file or installs remotely.
 await db.exec(`create or replace function public.fq_axes_valid(p jsonb) returns boolean language sql immutable set search_path to 'public' as $$
 select case when jsonb_typeof(p) is distinct from 'object' then false else
 (select count(*)=8 and coalesce(bool_and(k in ('A','B','C','D','E','F','G','H') and ((jsonb_typeof(p->k)='object' and (p->k->>'state') in ('pass','fail','unknown','not_applicable')) is true)),false) from jsonb_object_keys(p) k) end $$;`)
 const approval=original.match(/create or replace function public\.content_release_approve[\s\S]*?end \$\$;/)?.[0]
 if(!approval)throw Error('Approval function not found')
 const proposal=approval.replace('if not public.fq_role_ok(q.axes, q.role) then', 'if public.fq_role_ok(q.axes, q.role) is not true then')
 if(proposal===approval)throw Error('Expected unsafe condition not found')
 await db.exec(proposal)
 for(const [name,value] of [['missing_A',malformed],['null_A',{...valid,A:{state:null}}],['nonobject_A',{...valid,A:'pass'}],['invalid_A',{...valid,A:{state:'invented'}}],['nonobject_root',[]]]){
  const r=(await db.query('select public.fq_axes_valid($1::jsonb) as ok',[JSON.stringify(value)])).rows[0]
  assert.equal(r.ok,false);rows.push({id:'proposal:'+name,pass:true})
 }
 let rejected=false;try{await db.query("select public.content_release_approve($1,'assessment',null)",[q])}catch(e){rejected=String(e).includes('required axes not pass')}
 assert.equal(rejected,true);rows.push({id:'proposal:legacy_null_role_rejected',pass:true})
 const good=await record(valid);assert.ok((await db.query("select public.content_release_approve($1,'public',null) as id",[good])).rows[0].id)
 rows.push({id:'proposal:valid_positive',pass:true})
}finally{await db.close()}
fs.writeFileSync(out,JSON.stringify({engine:'local PGlite only',pendingFileSha256:crypto.createHash('sha256').update(original).digest('hex'),pendingFileModified:false,remoteChanges:false,auth:'fixed admin fixture; not a real RLS or permission test',rows},null,2));console.log(JSON.stringify({originalDefect:rows[0].reproduced,proposalChecks:rows.slice(1).length}))
