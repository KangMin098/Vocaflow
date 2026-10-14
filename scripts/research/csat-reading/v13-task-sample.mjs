// scripts/research/csat-reading/v13-task-sample.mjs
// Selection uses metadata/source completeness and candidate flags, never semantic review.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const base='docs/research/csat-reading/',out=base+'data/v13/task-selection.json'
if(fs.existsSync(out))throw Error('Selection is frozen; refusing overwrite')
const paths=['scripts/research/csat-reading/local/main-20261014/input.json','scripts/research/csat-reading/local/v12/restore-a.json','scripts/research/csat-reading/local/v12/restore-b.json','scripts/research/csat-reading/local/v12/pilot-input.json']
const complete=read(base+'data/main-20261014/source-audit.json').items.filter(x=>['body','stem','choices','presentation','answer'].every(k=>x[k]?.status==='complete')).map(x=>x.id)
const ids=new Set(complete)
for(const p of paths.slice(1)){const data=read(p);for(const item of data.items??data)ids.add(item.id)}
const old=new Set(read(base+'data/v12/item-task-reviewed.json').rows.map(x=>`${x.item_id}/${x.task_id}`))
const rows=fs.readFileSync(base+'data/v12/item-task-map.jsonl','utf8').trim().split('\n').map(JSON.parse)
const tasks=['r.central_meaning','e.option_correspondence','s.form_scope','v.contextual_sense']
let state=202610143;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
const strata=tasks.map(task=>{const pool=rows.filter(r=>r.task_id===task&&ids.has(r.item_id)&&/^(201[4-9]|202[0-4])[AB]?#/.test(r.item_id)&&!old.has(`${r.item_id}/${task}`)).sort((a,b)=>a.item_id.localeCompare(b.item_id));const shuffled=[...pool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}return {task_id:task,denominator:pool.length,denominator_ids:pool.map(x=>x.item_id),candidate_counts:pool.reduce((s,r)=>(s[r.candidate_relevance]=(s[r.candidate_relevance]??0)+1,s),{}),sample:shuffled.slice(0,6).map(r=>({item_id:r.item_id,type_id:r.type_id,candidate_relevance:r.candidate_relevance,candidate_rule:r.rule,inclusion_probability:6/pool.length}))}})
const result={version:'1.3',seed:202610143,selection_method:'Independent within-task uniform sampling without replacement; six per task; seeded Fisher-Yates using 32-bit LCG. No candidate outcome stratification imposed.',source_available_unique_items:ids.size,published_priority_denominator:786*4,restricted_denominator:strata.reduce((s,x)=>s+x.denominator,0),exclusions:'Previously reviewed item/task combinations; unavailable complete research inputs; non-main or outside2014–2024. All are previously researcher-exposed development items.',source_hashes:paths.map(path=>({path,sha256:sha(path)})),map_hash:sha(base+'data/v12/item-task-map.jsonl'),old_review_hash:sha(base+'data/v12/item-task-reviewed.json'),strata,limitations:['Inference is restricted to these source-available development strata, not all786 or all23580.','Repeated items within task are absent; cross-task repeats are dependent.','Single AI post-key semantic review, not blind independent raters.','Candidate positive/unknown strata may be absent when rule covers all items; E3 allpositive is an identifiability limitation.'],semantic_review_started:false}
fs.mkdirSync(base+'data/v13',{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sha256:sha(out),source_available:ids.size,strata:strata.map(x=>({task:x.task_id,n:x.denominator,candidates:x.candidate_counts,sample:x.sample.map(y=>y.item_id)}))},null,2))
