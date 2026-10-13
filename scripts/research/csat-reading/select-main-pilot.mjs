// scripts/research/csat-reading/select-main-pilot.mjs
// Deterministic metadata-only main-exam re-pilot. Never select by answer or content labels.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
const root=process.cwd(),dir=path.join(root,'docs/research/csat-reading/data'),run='main-20261014'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=x=>createHash('sha256').update(x).digest('hex')
const rows=read(path.join(dir,'item-manifest.json')),prior=read(path.join(dir,'pilot-manifest.json'))
const priorGroups=new Set(prior.map(x=>x.passage_group)),priorIds=new Set(prior.map(x=>x.id))
const exposedHashes=new Set(rows.filter(r=>priorIds.has(r.id)||priorGroups.has(r.passage_group)||r.previously_exposed).map(r=>r.normalized_passage_sha256))
const pool=rows.filter(r=>r.kind==='suneung'&&r.set==='discovery'&&!priorGroups.has(r.passage_group)&&!exposedHashes.has(r.normalized_passage_sha256)&&r.public_v3&&r.db_passage_matches&&r.db_stem_matches&&r.db_answer_matches&&r.choices_n===5)
const selected=[],byExam=new Map(),rank=r=>hash('csat-main-repilot-v1.1:'+r.id)
const choose=rs=>rs.filter(r=>!selected.some(x=>x.id===r.id)).sort((a,b)=>(byExam.get(a.exam)||0)-(byExam.get(b.exam)||0)||rank(a).localeCompare(rank(b)))[0]
const add=r=>{if(!r)throw Error('Missing eligible item');selected.push(r);byExam.set(r.exam,(byExam.get(r.exam)||0)+1)}
const types=[...new Set(pool.map(r=>r.type))].sort((a,b)=>pool.filter(r=>r.type===a).length-pool.filter(r=>r.type===b).length||a.localeCompare(b))
for(const type of types)add(choose(pool.filter(r=>r.type===type)))
for(const type of ['R-BLANK','R-ORDER','R-INSERT','R-TOPIC','R-FACT','R-VOCAB'])if(selected.length<32)add(choose(pool.filter(r=>r.type===type)))
while(selected.length<32)add(choose(pool))
if(selected.length!==32||new Set(selected.map(r=>r.passage_group)).size<24)throw Error('Re-pilot minimum unmet')
const out=path.join(dir,run),local=path.join(root,'scripts/research/csat-reading/local',run)
if(fs.existsSync(path.join(out,'manifest.json'))||fs.existsSync(path.join(local,'input.json')))throw Error('Run already exists; do not overwrite registered input')
const source=path.join(root,'scripts/research/csat-reading/local/snapshots/20261012-r0/db-corpus.json')
const corpus=read(source),raw=new Map(corpus.items.map(x=>[x.id,x]))
const manifest=selected.map(r=>({id:r.id,exam:r.exam,school_year:r.school_year,type:r.type,passage_group:r.passage_group,binding:r.source_binding_sha256,passage_sha256:r.passage_sha256,normalized_passage_sha256:r.normalized_passage_sha256}))
const input={protocol:'1.1',as_of:'2026-10-14',run,answer_blind:true,items:selected.map(r=>{const it=raw.get(r.id);return {id:r.id,binding:r.source_binding_sha256,passage_group:r.passage_group,passage:it.passage,stem:it.stem,choices:it.choices,type_id:r.type,visual_required:r.type==='R-CHART',source_status:'pinned_DB_snapshot; PDF_verification_pending',answer_blind:true}})}
const key=selected.map(r=>({id:r.id,answer:raw.get(r.id).answer}))
const write=(base,name,data)=>{fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,name),JSON.stringify(data,null,2)+'\n')}
write(out,'manifest.json',manifest);write(local,'input.json',input);write(local,'key.json',key)
write(out,'registration.json',{run,protocol:'1.1',date:'2026-10-14',task:'T-0025',base_commit:'4917c67ae',source_snapshot:{id:'20261012-r0',sha256:hash(fs.readFileSync(source)),data_as_of:'2026-10-12'},selection_rule:'main discovery only; old pilot groups/normalized duplicates/exposures removed; public-v3 operational eligibility only, no v3 meaning read; rarest type first; least-selected exam then SHA256 fixed seed; six specified type supplements to32',pool_n:pool.length,items:32,types:types.length,passage_groups:new Set(manifest.map(r=>r.passage_group)).size,by_exam:Object.fromEntries([...byExam].sort()),manifest_sha256:hash(fs.readFileSync(path.join(out,'manifest.json'))),blind_input_sha256:hash(fs.readFileSync(path.join(local,'input.json'))),key_sha256:hash(fs.readFileSync(path.join(local,'key.json'))),first_submissions:{},holdout_opened:false})
console.log(JSON.stringify({run,items:32,types:types.length,groups:new Set(manifest.map(r=>r.passage_group)).size,by_exam:Object.fromEntries([...byExam].sort()),ids:manifest.map(r=>r.id)},null,2))
