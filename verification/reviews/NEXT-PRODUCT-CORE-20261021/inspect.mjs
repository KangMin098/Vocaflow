// verification/reviews/NEXT-PRODUCT-CORE-20261021/inspect.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const wt='D:/workspace/Vocaflow-final-product'
const base=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))
const read=(p)=>fs.readFileSync(path.join(wt,p),'utf8')
const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(wt,p))).digest('hex')
const templates=JSON.parse(read('docs/csat-learner/v4/workspaces.json')).templates
const book=JSON.parse(read('docs/csat-learner/v4/codebook.json'))
const pack=read('docs/final/APPROVAL_PACKAGE.md')
const dir='apps/web/src/lib/knowledge/authored'
const sets=fs.readdirSync(path.join(wt,dir)).filter(p=>p.endsWith('.json')).map(f=>{
 const p=`${dir}/${f}`,s=JSON.parse(read(p));if(!s.items||!s.taskId)return null
 return {task:s.taskId,set:s.set,file:p,sha256:sha(p),package_mentions_current_sha:pack.includes(sha(p)),roles:Object.fromEntries([...new Set(s.items.map(i=>i.role))].map(r=>[r,s.items.filter(i=>i.role===r).length])),core:templates.filter(t=>t.core.includes(s.taskId)).map(t=>t.id),support:templates.filter(t=>t.support.includes(s.taskId)).map(t=>t.id),entry:s.taskId==='s.attachment'?'DEFERRED_CONNECTION_DECISION':'EXISTING_WORKSPACE',human_approval:'NOT_ESTABLISHED; package is not an approval record'}
}).filter(Boolean)
const pending='supabase/migrations/_pending_authored_supply.sql'
const snapshot={observed_at:new Date().toISOString(),product_head:execFileSync('git',['rev-parse','HEAD'],{cwd:wt,encoding:'utf8'}).trim(),sets_count:sets.length,items:sets.reduce((n,s)=>n+Object.values(s.roles).reduce((a,b)=>a+b,0),0),sets,remaining_nonheld:book.tasks.filter(t=>t.status!=='hold'&&!sets.some(s=>s.task===t.id)).map(t=>({task:t.id,kind:t.kind,entry:t.id==='v.core_meaning'?'T0069_EXISTING_WORDVAULT_PRACTICE_ONLY':'EXISTING_INTEGRATED_OBSERVATION; no new score'})),pending_sql:{sha256:sha(pending),package_mentions_current_sha:pack.includes(sha(pending)),applied:false,applied_basis:'read-only DB metadata: authored/human decision tables absent'},fresh_db:{observed_at:'2026-10-20T23:42:11.579993Z',authored_item:null,content_human_decision:null,content_human_decision_revocation:null,workspace_content_delivery:'workspace_content_delivery',workspace_delivery_attempt:'workspace_delivery_attempt',scope:'SELECT current_timestamp,to_regclass only; no learner rows or DB writes'},limitations:['No fresh browser/isolated DB implementation acceptance; current UI snapshot reused from T0069 report','No actual Gold/rights approval inferred from package hashes','Goal Check baseline b4fc9ff83 is separate from official main']}
fs.writeFileSync(path.join(base,'inventory.json'),JSON.stringify(snapshot,null,2)+'\n')
console.log(JSON.stringify({head:snapshot.product_head,sets:snapshot.sets_count,items:snapshot.items,hashes:sets.filter(s=>s.package_mentions_current_sha).length,workspace_entries:sets.filter(s=>s.entry==='EXISTING_WORKSPACE').length,remaining:snapshot.remaining_nonheld,sql:snapshot.pending_sql},null,2))
