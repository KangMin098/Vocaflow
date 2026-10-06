// scripts/csat/reveal-gate/db-preflight.mjs
// Read-only catalog/JWT verification. Never applies a migration or creates a user.
import pg from 'pg'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { verifiedDbConfig } from './tls-config.mjs'
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const snapshotHash = value => createHash('sha256').update(canonical(value)).digest('hex')
// The permanent learner revocations in 20261005170100 are deployment requirements,
// even when the migration is missing or the same unsafe grant is in both snapshots.
export const PERMANENT_AUTH_REVOCATIONS={csat_dx_session:['raw_score','grade'],csat_dx_response:['is_correct'],csat_dx_snapshot:'*',csat_learner_state:'*'}
export function permanentPermissionIssues(permissions) {
  const issues=[]
  for(const [object,columns]of Object.entries(PERMANENT_AUTH_REVOCATIONS)) {
    const rows=permissions.filter(r=>r.object===object&&r.role==='authenticated')
    if(!rows.length){issues.push({kind:'missing_permanent_revocation_relation',object});continue}
    const expected=columns==='*'?rows.map(r=>r.column):columns
    for(const column of expected)if(rows.find(r=>r.column===column)?.allowed!==false)issues.push({kind:'permanent_select_not_revoked',object,column,role:'authenticated'})
  }
  return issues
}
export function permissionDiff(before,after,expected=[]) {
  const rows=s=>[...s.permissions.map(r=>({key:canonical(['column',r.object,r.column,r.role]),value:r})),...(s.policies??[]).map(r=>({key:canonical(['policy',r.tablename,r.policyname]),value:r})),...(s.functions??[]).map(r=>({key:canonical(['function',r.signature,r.role]),value:r}))]
  const old=new Map(rows(before).map(r=>[r.key,r.value])),next=new Map(rows(after).map(r=>[r.key,r.value]))
  const changes=[...new Set([...old.keys(),...next.keys()])].flatMap(key=>canonical(old.get(key))===canonical(next.get(key))?[]:[{key,before:old.get(key)??null,after:next.get(key)??null}])
  const allowed=new Set(expected.filter(r=>r.decision&&r.reason).map(({decision,reason,...r})=>canonical(r)))
  return {changes,unexpected:changes.filter(r=>!allowed.has(canonical(r))),missing:expected.filter(({decision,reason,...r})=>!changes.some(c=>canonical(c)===canonical(r)))}
}
export async function dbPreflight(repo,manifest,env,{before=null,expectedDiff=[],snapshotOut=null,authenticatedVerified=false}={}) {
  const required=['SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']
  const missing=required.filter(k=>!env[k])
  if(missing.length)return{status:'BLOCKED',reason:'missing_credentials',missing}
  if(!env.NEXT_PUBLIC_SUPABASE_URL.includes('jajenrevcbmrpaliomxv')||!env.SUPABASE_DB_URL.includes('jajenrevcbmrpaliomxv'))return{status:'BLOCKED',reason:'not_development_project'}
  const client=new pg.Client({...verifiedDbConfig(env.SUPABASE_DB_URL,env.SUPABASE_DB_CA_CERT),statement_timeout:15000})
  try{
    await client.connect();await client.query('begin read only')
    const relations=Object.keys(manifest.db_relations)
    const permissions=(await client.query(`select c.relname as object,a.attname as column,r.role,has_column_privilege(r.role,c.oid,a.attnum,'SELECT') as allowed,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped cross join (values('anon'),('authenticated'),('service_role'))r(role)
      where n.nspname='public' and c.relname=any($1::text[]) order by c.relname,a.attname,r.role`,[relations])).rows
    const policies=(await client.query(`select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any($1::text[]) order by tablename,policyname`,[relations])).rows
    const functions=(await client.query(`select n.nspname schema,p.oid::regprocedure::text signature,r.role,has_schema_privilege(r.role,n.oid,'USAGE') schema_usage,has_function_privilege(r.role,p.oid,'EXECUTE') allowed,p.prosecdef security_definer,p.proconfig config,md5(pg_get_functiondef(p.oid)) definition_hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join(values('anon'),('authenticated'),('service_role'))r(role) where p.prokind in ('f','p') and (n.nspname='csat_ec_private' or n.nspname='public' and (p.proname~'^csat_' or p.proname='is_admin') or n.nspname='auth' and p.proname in ('uid','jwt')) order by schema,signature,r.role`)).rows
    const migrations=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version)
    await client.query('commit')
    const hashes=fs.readdirSync(repo+'/supabase/migrations').filter(f=>/csat_ec_.*(?:reveal|pilot|capture)/.test(f)).sort().map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(repo+'/supabase/migrations/'+file)).digest('hex')}))
    const snapshot={permissions,policies,functions,migrations,migration_hashes:hashes}
    const issues=[]
    issues.push(...permanentPermissionIssues(permissions))
    if(!authenticatedVerified&&!env.REVEAL_VERIFY_AUTH_TOKEN)issues.push({kind:'authenticated_actor_not_verified',missing:['REVEAL_VERIFY_AUTH_TOKEN'],reason:'Catalog baseline can be saved, but deployment cannot pass without a real authenticated actor.'})
    if(!before)issues.push({kind:'missing_before_snapshot',reason:'A deployment verdict requires a saved pre-deployment catalog snapshot.'})
    for(const [object,meta]of Object.entries(manifest.db_relations))for(const column of [...(meta.secret_columns??[]),...(meta.revoked_by&&migrations.includes(meta.revoked_by)?meta.sensitive_columns??[]:[])]) {
      for(const role of ['anon','authenticated'])if(permissions.find(r=>r.object===object&&r.column===column&&r.role===role)?.allowed!==false)issues.push({kind:'direct_select',object,column,role})
    }
    const smokes=[]
    // Column ACL probes do not fetch any learner rows (limit=0).
    const probes=[['csat_dx_session','raw_score'],['csat_dx_session','grade'],['csat_dx_response','is_correct'],...permissions.filter(r=>r.role==='authenticated'&&['csat_dx_snapshot','csat_learner_state'].includes(r.object)).map(r=>[r.object,r.column])]
    const actors=[['anon',env.NEXT_PUBLIC_SUPABASE_ANON_KEY,env.NEXT_PUBLIC_SUPABASE_ANON_KEY],...(env.REVEAL_VERIFY_AUTH_TOKEN?[['authenticated',env.NEXT_PUBLIC_SUPABASE_ANON_KEY,env.REVEAL_VERIFY_AUTH_TOKEN]]:[])]
    if(env.REVEAL_VERIFY_AUTH_TOKEN){const user=await fetch(new URL('/auth/v1/user',env.NEXT_PUBLIC_SUPABASE_URL),{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,authorization:'Bearer '+env.REVEAL_VERIFY_AUTH_TOKEN},signal:AbortSignal.timeout(15000)});if(user.status!==200)issues.push({kind:'authenticated_token_not_verified',status:user.status})}
    for(const [actor,key,token]of actors)for(const [table,column]of probes) {
      const url=new URL('/rest/v1/'+table,env.NEXT_PUBLIC_SUPABASE_URL);url.search=new URLSearchParams({select:column,limit:'0'})
      const response=await fetch(url,{headers:{apikey:key,authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)})
      const denied=response.status===403
      smokes.push({actor,table,column,http_status:response.status,ok:denied})
      if(!denied)issues.push({kind:'jwt_direct_select_not_denied',actor,table,column,status:response.status})
    }
    const response=await fetch(new URL('/rest/v1/rpc/csat_ec_embargoed_exams',env.NEXT_PUBLIC_SUPABASE_URL),{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({p_exams:[]}),signal:AbortSignal.timeout(15000)})
    const payload=await response.json().catch(()=>null),serviceOK=response.status===200&&Array.isArray(payload)&&payload.length===0
    smokes.push({actor:'service',rpc:'csat_ec_embargoed_exams',http_status:response.status,ok:serviceOK});if(!serviceOK)issues.push({kind:'service_gate_smoke_failed'})
    const diff=before?permissionDiff(before,snapshot,expectedDiff):null
    if(diff&&(diff.unexpected.length||diff.missing.length))issues.push({kind:'unexpected_permission_diff',diff})
    if(snapshotOut){const target=path.resolve(repo,snapshotOut);if(!target.startsWith(path.join(repo,'tmp')+path.sep)||!target.endsWith('.json'))throw Error('Unsafe snapshot path');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(snapshot,null,2)+'\n')}
    return{status:issues.length?'BLOCKED':'PASS',snapshot_sha256:snapshotHash(snapshot),snapshot,smokes,diff,issues,authenticated_via_live_canary:authenticatedVerified,limitation:'Read-only catalog and real JWT column permissions. Does not apply SQL or replace the held/completed actor canary.'}
  }catch(error){return{status:'BLOCKED',reason:'db_preflight_execution_error',failure_code:typeof error.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:null}}finally{await client.end().catch(()=>{})}
}
