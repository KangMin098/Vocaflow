// scripts/research/csat-reading/snapshot.mjs
// Fetch current KICE original inputs read-only; never print credentials or full originals.
import fs from 'node:fs'
import path from 'node:path'
const arg=k=>{const i=process.argv.indexOf(`--${k}`);return i<0?null:process.argv[i+1]}
const workspace=path.resolve(arg('workspace')||process.cwd())
const env=name=>{
 if(process.env[name])return process.env[name]
 for(const f of ['.env.local','.env','apps/web/.env.local','apps/web/.env']){
  const p=path.join(workspace,f);if(!fs.existsSync(p))continue
  for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
   const i=line.indexOf('=');if(i<0||line.slice(0,i).trim()!==name)continue
   return line.slice(i+1).trim().replace(/^["']|["']$/g,'')
  }
 }
 return null
}
const url=env('NEXT_PUBLIC_SUPABASE_URL')||env('SUPABASE_URL')
const key=env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY')
if(!url||!key)throw new Error('Existing workspace read credentials unavailable; no credentials are logged.')
const exams=JSON.parse(fs.readFileSync('docs/research/csat-reading/data/db-exams.json','utf8'))
const request=new URL('/rest/v1/csat_items',url)
request.searchParams.set('select','id,exam_id,no,section,in_scope,type_id,stem,passage,choices,answer,answers,points,high_score,body_ok')
request.searchParams.set('in_scope','eq.true')
request.searchParams.set('exam_id',`in.(${exams.map(e=>e.id).join(',')})`)
request.searchParams.set('order','id.asc')
let response
try {response=await fetch(request,{headers:{apikey:key,Authorization:`Bearer ${key}`,Range:'0-999'}})}catch{throw new Error('Read-only snapshot transport failed; sensitive URL/error details suppressed.')}
if(!response.ok)throw new Error(`Read-only snapshot HTTP ${response.status}; body suppressed.`)
const items=await response.json()
const expected=exams.reduce((s,e)=>s+e.n,0)
if(items.length!==expected)throw new Error(`Snapshot denominator mismatch ${items.length}/${expected}`)
const out={report:{source:'current-db-read-only',as_of:arg('as-of')||'2026-10-12'},items:items.map(i=>({...i,exam:i.exam_id,body_suspect:!i.body_ok}))}
const target=path.resolve('scripts/research/csat-reading/local/db-corpus.json')
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(out)+'\n')
console.log(`Read-only private original snapshot: ${items.length} items. Bodies remain in ignored local/.`)
