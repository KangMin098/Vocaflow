// scripts/csat/reveal-gate/live-verification.mjs
// Explicit --live dev canary: fixture writes only, checkpoints before/after; no migrations.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID,createHash } from 'node:crypto'
import pg from 'pg'
export function validateLiveReceipt(receipt,previousHash,currentHash) {
  if(!receipt||!currentHash||currentHash===previousHash||!Array.isArray(receipt.results)||!receipt.results.length||receipt.pass!==receipt.results.length||receipt.fail!==0||receipt.results.some(r=>r.ok!==true))return{ok:false,reason:'stale_or_failed_canary'}
  for(const area of ['canary','rpc','oracle','app','bundle','정리'])if(!receipt.results.some(r=>r.area===area&&!/생략|미실행/.test(r.name??'')))return{ok:false,reason:'missing_live_area',area}
  for(const actor of ['P','N','anon'])if(!receipt.results.some(r=>r.area==='canary'&&r.name?.startsWith(actor+' ·')))return{ok:false,reason:'missing_live_actor',actor}
  return{ok:true,pass:receipt.pass,areas:['canary','rpc','oracle','app','bundle','정리'],authenticated_verified:true}
}
export function checkpointIssues(diff) {
  if(!Array.isArray(diff)||!diff.length)return[{reason:'empty_checkpoint_diff'}]
  return diff.filter(r=>r.status==='disappeared'&&!(r.metric==='bloat_sampled_pct'&&r.subject&&diff.some(a=>a.metric===r.metric&&a.status==='appeared'&&a.subject&&a.subject!==r.subject)))
}
export async function securityAdvisor(env,fetchImpl=fetch,allowlist=[]) {
  if(!env.SUPABASE_ACCESS_TOKEN)return{ok:false,reason:'missing_management_token'}
  try{
    const response=await fetchImpl('https://api.supabase.com/v1/projects/jajenrevcbmrpaliomxv/advisors/security',{headers:{authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(20000)})
    const body=await response.json()
    if(!response.ok||!Array.isArray(body.lints))return{ok:false,reason:'advisor_not_executed_or_invalid'}
    const accepted=new Set(allowlist.filter(r=>r.key&&r.decision&&r.reason).map(r=>r.key))
    const findings=body.lints.map(r=>({name:r.name,level:r.level,key:r.cache_key??r.name,csat_related:/csat/i.test(JSON.stringify(r.metadata??{}))}))
    const blocked=findings.filter(r=>(r.level==='ERROR'||r.level==='WARN'&&r.csat_related)&&!accepted.has(r.key))
    return{ok:blocked.length===0,findings,blocked,policy:'All ERROR and CSAT-related WARN require recorded disposition; other warnings remain visible.'}
  }catch{return{ok:false,reason:'advisor_execution_error'}}
}
export async function liveCanary(repo,env,app,run,{maxActive=3,runtimeVerified=false}={}) {
  if(!runtimeVerified)return{ok:false,reason:'runtime_must_be_owned_and_bound_to_verified_build'}
  if(!app)return{ok:false,reason:'missing_local_app_url'}
  const url=new URL(app)
  if(!['localhost','127.0.0.1'].includes(url.hostname)||url.username||url.password)return{ok:false,reason:'app_must_be_local'}
  const required=['SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']
  if(required.some(k=>!env[k])||!env.SUPABASE_DB_URL.includes('jajenrevcbmrpaliomxv')||!env.NEXT_PUBLIC_SUPABASE_URL.includes('jajenrevcbmrpaliomxv'))return{ok:false,reason:'missing_dev_credentials'}
  if(!fs.existsSync(path.join(repo,'apps/web/.next/static')))return{ok:false,reason:'missing_production_build'}
  const client=new pg.Client({connectionString:env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true,...(env.SUPABASE_DB_CA_CERT?{ca:env.SUPABASE_DB_CA_CERT}:{})},statement_timeout:20000})
  const label='reveal-verify-'+randomUUID(),file=path.join(repo,'scripts/csat/reveal-gate/results-canary.json')
  const hash=()=>fs.existsSync(file)?createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null
  let before=false,result={ok:false,reason:'not_executed'}
  try{
    await client.connect()
    const active=Number((await client.query("select count(*) n from pg_stat_activity where state='active'")).rows[0].n)
    if(!Number.isInteger(maxActive)||maxActive<1||active>maxActive)return{ok:false,reason:'concurrent_db_work',active}
    await client.query('select record_db_health_checkpoint($1,$2,$3)',[label,'before','Reveal Gate controlled dev canary fixture operations'])
    before=true
    const previous=hash(),command=await run(process.execPath,['--tls-max-v1.2','scripts/csat/reveal-gate/canary-scan.mjs','--app',url.origin,'--bundle','apps/web/.next'])
    const current=hash(),receipt=current?JSON.parse(fs.readFileSync(file,'utf8')):null
    result={...validateLiveReceipt(receipt,previous,current),command,checkpoint_label:label}
    if(!command.ok)result.ok=false
  }catch{result={ok:false,reason:'live_canary_execution_error',checkpoint_label:label}}
  finally{
    if(before){try{await client.query('select record_db_health_checkpoint($1,$2,$3)',[label,'after','Reveal Gate canary complete or failed; inspect fixture cleanup and checkpoint diff']);const diff=(await client.query('select * from db_health_checkpoint_diff($1)',[label])).rows;result.checkpoint_diff=diff;result.checkpoint_after_recorded=true;const issues=checkpointIssues(diff);if(issues.length){result.ok=false;result.reason='checkpoint_metrics_missing';result.checkpoint_issues=issues}}catch{result.ok=false;result.reason='checkpoint_after_failed'}}
    await client.end().catch(()=>{})
  }
  return result
}
