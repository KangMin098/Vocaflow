// scripts/csat/source-origin-search-diagnosis.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const STATUSES=['confirmed_exact','supported_candidate','topic_lineage_only','unresolved']
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const sorted=o=>Object.entries(o).sort(([a],[b])=>a.localeCompare(b))
const equalHashes=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b))
const group=rows=>{
 const result=new Map()
 for(const [index,r] of rows.entries()){
  if(!/^[a-f0-9]{64}$/.test(r.passage_sha256||'')||typeof r.representative_item_id!=='string'||typeof r.query!=='string'||typeof r.raw_search!=='string')throw new Error('Invalid search log identity/query/result')
  const list=result.get(r.representative_item_id)||[];list.push({...r,record_number:index+1});result.set(r.representative_item_id,list)
 }
 return result
}

export function diagnoseOrigins({snapshot,generalLog,booksLog,decisions,auditedAt}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(auditedAt||''))throw new Error('auditedAt must be an explicit date')
 const identities=new Set(),ids=new Set()
 for(const r of snapshot){
  if(!STATUSES.includes(r.status)||!/^[a-f0-9]{64}$/.test(r.passage_sha256||'')||identities.has(r.passage_sha256)||ids.has(r.representative_item_id))throw new Error('Invalid status or duplicate registry identity')
  identities.add(r.passage_sha256);ids.add(r.representative_item_id)
  if(!Array.isArray(r.item_ids)||!r.item_ids.includes(r.representative_item_id)||new Set(r.item_ids).size!==r.item_ids.length)throw new Error('Invalid linked items')
  if(!r.body_sha256_by_item||Object.keys(r.body_sha256_by_item).length!==r.item_ids.length||r.item_ids.some(id=>!/^[a-f0-9]{64}$/.test(r.body_sha256_by_item[id]||'')))throw new Error('Missing current linked body hashes')
  if(typeof r.passage!=='string'||createHash('sha256').update(r.passage,'utf8').digest('hex')!==r.body_sha256_by_item[r.representative_item_id])throw new Error('Representative body hash mismatch')
 }
 const general=group(generalLog),books=group(booksLog),deep=new Map(),deepById=new Map()
 for(const d of decisions){if(deep.has(d.passage_sha256)||deepById.has(d.representative_item_id))throw new Error('Duplicate deep decision');deep.set(d.passage_sha256,d);deepById.set(d.representative_item_id,d)}
 const rows=snapshot.filter(r=>r.status==='unresolved').map(r=>{
  const d=deep.get(r.passage_sha256)||deepById.get(r.representative_item_id)
  const allG=general.get(r.representative_item_id)||[],allB=books.get(r.representative_item_id)||[]
  const g=allG.filter(x=>x.passage_sha256===r.passage_sha256),b=allB.filter(x=>x.passage_sha256===r.passage_sha256)
  if(d&&(d.passage_sha256!==r.passage_sha256||d.representative_item_id!==r.representative_item_id||!d.body_sha256_by_item||!equalHashes(d.body_sha256_by_item,r.body_sha256_by_item)))throw new Error('Deep decision identity/body conflict: '+r.representative_item_id)
  const searches=(records,input)=>records.map(x=>({passage_sha256:x.passage_sha256,query:x.query,record_reference:{input,record_number:x.record_number}}))
  // This is an explicit historical-record classification, not a causal model.
  // A scan is a format, not proof of access failure. Only the recorded 404 qualifies.
  const access=!!d&&r.representative_item_id==='2019#26'&&/404/.test(d.why)
  const provenance=!!d&&r.representative_item_id==='2014B#34'&&/재인용.*미확인/.test(d.why)
  return {passage_sha256:r.passage_sha256,representative_item_id:r.representative_item_id,item_ids:r.item_ids,body_sha256_by_item:r.body_sha256_by_item,
   scope:r.representative_item_id.startsWith('M')?'mock':'suneung',legacy_general_queries:g.length,legacy_book_queries:b.length,
   legacy_general_searches:searches(g,'general-log'),legacy_book_searches:searches(b,'books-log'),
   excluded_stale_general_searches:searches(allG.filter(x=>x.passage_sha256!==r.passage_sha256),'general-log'),
   excluded_stale_book_searches:searches(allB.filter(x=>x.passage_sha256!==r.passage_sha256),'books-log'),
   legacy_books_empty:b.length?b.every(x=>String(x.raw_search).includes('Empty search results')):null,
   legacy_query_in_current_body:g.some(x=>{const phrase=String(x.query).match(/"([^"\n]+)"/)?.[1];return !!phrase&&norm(r.passage).includes(norm(phrase))}),
   deep_record:d?{why:d.why,checked_range:d.checked_range,checked_urls:d.checked_urls,body_bound:true}:null,
   diagnosis:{primary:!d?'unclassified':access?'observed_access_obstacle':'source_not_identified',reason_number:!d?null:access?1:4,
    reason3_provenance_uncertainty:provenance,reason2_causal_evidence:false,causal_distribution_known:false,
    classification_basis:!d?'No individual follow-up hold decision; cause unclassified.':access?'Explicit 404 in body-bound historical hold; original attribution remains unestablished.':'No work attribution established by recorded searches; this does not prove the passage lacks distinctive clues.'}}
 })
 const counts=scope=>Object.fromEntries(STATUSES.map(status=>{
  const rs=snapshot.filter(r=>(!scope||(r.representative_item_id.startsWith('M')?'mock':'suneung')===scope)&&r.status===status)
  return [status,{passages:rs.length,linked_items:rs.reduce((n,r)=>n+r.item_ids.length,0)}]
 }))
 return {schema_version:1,audited_at:auditedAt,purpose:'Search-history diagnosis, not an original-attribution review or a causal estimate.',
  counts:{all:counts(null),suneung:counts('suneung'),mock:counts('mock')},
  observed_primary_counts:{reason1_access_obstacle:rows.filter(r=>r.diagnosis.primary==='observed_access_obstacle').length,reason4_work_not_identified:rows.filter(r=>r.diagnosis.primary==='source_not_identified').length,unclassified:rows.filter(r=>r.diagnosis.primary==='unclassified').length},
  overlapping_flags:{reason3_uncertain_quotation_relation:rows.filter(r=>r.diagnosis.reason3_provenance_uncertainty).length,reason2_documented_causal_obstacle:0},
  caveats:['Zero documented causal obstacles is not zero actual occurrences.','Reason 3 is an uncertainty flag, not a verified secondary quotation.','Legacy search logs have registry hashes but no current body hashes; do not present them as direct body verification.','Deep hold decisions must match current linked body hashes.','Book-site searches are not native book full-text searches.'],rows}
}

function main(){
 const args=process.argv.slice(2),value=k=>{const i=args.indexOf(k);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing '+k);return args[i+1]}
 const json=p=>JSON.parse(fs.readFileSync(p,'utf8'))
 const jsonl=p=>fs.readFileSync(p,'utf8').split(/\r?\n/).filter(x=>x.trim()).map(x=>JSON.parse(x))
 const result=diagnoseOrigins({snapshot:json(value('--snapshot')),generalLog:jsonl(value('--general-log')),booksLog:jsonl(value('--books-log')),decisions:json(value('--decisions')).decisions,auditedAt:value('--audited-at')})
 fs.writeFileSync(value('--output'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({rows:result.rows.length,observed:result.observed_primary_counts,overlaps:result.overlapping_flags}))
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
