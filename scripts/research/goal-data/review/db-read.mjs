// scripts/research/goal-data/review/db-read.mjs
// GET only. Credentials and raw passages are never persisted.
import fs from 'node:fs'
import crypto from 'node:crypto'
const url=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url?.includes('jajenrevcbmrpaliomxv')||!key) throw Error('dev configuration unavailable')
const queries=[]
async function get(table,query){
 const rows=[]
 queries.push({method:'GET',table,query})
 for(let from=0;;from+=1000){
  const res=await fetch(`${url}/rest/v1/${table}?${query}`,{method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`,Range:`${from}-${from+999}`,'Range-Unit':'items'}})
  if(!res.ok) throw Error(`${table}: HTTP ${res.status}`)
  const batch=await res.json();rows.push(...batch);if(batch.length<1000)return rows
 }
}
const insert=await get('csat_items','select=id,stem,passage,choices,raw_block&type_id=eq.R-INSERT&order=id')
const m=await get('csat_exams','select=id&or=(id.eq.M2709,and(exam_year.eq.2027,month.eq.9))')
const choice=await get('csat_items','select=id,body_ok,choices&id=eq.2023%2338')
const exams=await get('csat_exams','select=id,source_note&order=id')
const itemExams=await get('csat_items','select=exam_id&order=id')
const used=new Set(itemExams.map(x=>x.exam_id))
const applications=await get('knowledge_applications','select=surface_ref,status&surface=eq.csat_item_task&or=(surface_ref.like.cohesion-link:*,surface_ref.like.option-restate:*)&order=surface_ref')
const local=JSON.parse(fs.readFileSync('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/input.json','utf8')).rows
const insertionSamples=insert.filter(x=>['2025#38','2025#39','M2609#38','M2609#39','2026#38','2026#39','M2706#38','M2706#39'].includes(x.id))
for(const x of insertionSamples)console.log(JSON.stringify({id:x.id,passage:x.passage,local_same:local.some(y=>y.item_id===x.id&&y.source.passage===x.passage)}))
const out={observed_at:new Date().toISOString(),queries,insert:{count:insert.length,raw_block_null:insert.filter(x=>x.raw_block==null).length,rows:insert.map(x=>({id:x.id,stem:x.stem,passage_chars:x.passage?.length,choices_count:x.choices?.length??null,sha256:crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')}))},M2709:m,choices_2023_38:choice,rights:{exams_with_items:exams.filter(x=>used.has(x.id)).length,nonempty_notes:exams.filter(x=>used.has(x.id)&&x.source_note?.trim()).map(x=>({id:x.id,source_note:x.source_note}))}}
out.applications=applications
out.insertion_samples=insertionSamples.map(x=>({id:x.id,local_same:local.some(y=>y.item_id===x.id&&y.source.passage===x.passage),prefix_sha256:crypto.createHash('sha256').update(x.passage.split(/(?<=[.!?])\s/)[0]).digest('hex')}))
fs.writeFileSync('docs/research/goal-data-batches/review/db-observations.json',JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({...out,insert:{...out.insert,rows:out.insert.rows.slice(0,4)}}))
