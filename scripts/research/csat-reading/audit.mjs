// scripts/research/csat-reading/audit.mjs
// Read-only corpus/v3/DB metadata audit. Full bodies are only exported to ignored local/.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseExamId } from '../../csat/lib-exam-id.mjs'

const arg = (key, fallback) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? fallback : process.argv[i + 1] }
const root = process.cwd()
const source = path.resolve(arg('source', root))
const output = path.resolve(arg('output', 'docs/research/csat-reading/data'))
const local = path.resolve('scripts/research/csat-reading/local')
const asOf = arg('as-of', '2026-10-12')
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const hash = text => createHash('sha256').update(text).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value
const jsonHash = value => hash(JSON.stringify(canonical(value)))
const countBy = (rows, fn) => Object.fromEntries([...rows.reduce((m, r) => {const k=fn(r);m.set(k,(m.get(k)||0)+1);return m},new Map())].sort(([a],[b])=>String(a).localeCompare(String(b))))
const write = (dir, name, body) => { fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify(body,null,2)+'\n') }

const corpusFile = path.resolve(arg('corpus',path.join(source,'scripts/csat/data/corpus.json')))
const corpus = read(corpusFile).items.filter(it=>it.in_scope)
const legacyFile=path.join(source,'scripts/csat/data/corpus.json')
const legacy=fs.existsSync(legacyFile)?new Map(read(legacyFile).items.filter(it=>it.in_scope).map(it=>[it.id,it])):new Map()
const inquiryFile = path.join(root,'apps/web/src/lib/csat/inquiry-data.json')
const pairFile = path.join(root,'apps/web/src/lib/csat/compare-v3-data.json')
const inquiries = read(inquiryFile).items
const pairDocument = read(pairFile)
const pairs = Object.entries(pairDocument.pairs).map(([id,p])=>({id,...p}))
const db = new Map(read(path.join(output,'db-items.json')).map(r=>[r.id,r]))
const exams = read(path.join(output,'db-exams.json'))
if(db.size!==corpus.length)throw new Error(`DB/local denominator mismatch ${db.size}/${corpus.length}`)
const outs=new Map()
const drain=path.join(root,'scripts/csat/inquiry-drain')
for(const f of fs.readdirSync(drain).filter(f=>/^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()){
 for(const item of read(path.join(drain,f)).items||[]){const prev=outs.get(item.id);if(!prev||(item.v3&&!prev.v3)||f.startsWith('chunk-v3'))outs.set(item.id,{...item,file:f})}
}
const previouslyExposed=new Set(['2026#34','2026#19','M2606#19','M2609#18','2025#18','M2609#19'])
const rows=corpus.map(it=>{
 const meta=parseExamId(it.exam);if(!meta||meta.organizer!=='kice')throw new Error(`Unrecognized KICE id ${it.id}`)
 const live=db.get(it.id);if(!live)throw new Error(`Missing DB item ${it.id}`)
 const set=meta.schoolYear>2026?'out_of_scope':meta.schoolYear>=2025?'validation':'discovery'
 const pHash=hash(it.passage||'');const sHash=hash(it.stem||'')
 const shared=it.no>=43?`${it.exam}:43-45`:it.no>=41?`${it.exam}:41-42`:`${it.exam}:${it.no}`
 return {id:it.id,exam:it.exam,school_year:meta.schoolYear,exam_year:meta.examYear,kind:meta.kind,month:meta.month,form:meta.form,type:it.type_id,points:it.points,set,passage_group:shared,passage_sha256:pHash,normalized_passage_sha256:hash((it.passage||'').replace(/\s+/g,' ').trim()),stem_sha256:sHash,choices_sha256:jsonHash(it.choices),answer_sha256:jsonHash(it.answers??[it.answer]),passage_chars:(it.passage||'').length,ascii_word_tokens:(it.passage||'').match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)?.length||0,choices_n:it.choices?.length||0,db_passage_matches:live.passage_hash===pHash,db_stem_matches:live.stem_hash===sHash,db_answer_matches:live.answer===it.answer,db_type_matches:live.type_id===it.type_id,db_body_ok:live.body_ok,local_body_suspect:it.body_suspect,public_v3:!!inquiries[it.id]?.v3,ai_review_label:inquiries[it.id]?.review??null,existing_status:outs.get(it.id)?.status??'not_written',previously_exposed:previouslyExposed.has(it.id),source_status:'stored_text_db_hash_checked_pdf_not_yet_checked',source_binding_sha256:jsonHash({passage:it.passage,stem:it.stem,choices:it.choices,answer:it.answers??[it.answer]})}
})
const inScope=rows.filter(r=>r.set!=='out_of_scope')
const eligible=rows.filter(r=>r.set==='discovery'&&r.public_v3&&r.db_passage_matches&&r.db_stem_matches&&r.db_answer_matches&&r.choices_n===5)
const pilot=[]
for(const type of [...new Set(eligible.map(r=>r.type))].sort()){
 const pool=eligible.filter(r=>r.type===type).sort((a,b)=>hash('pilot-v1:'+a.id).localeCompare(hash('pilot-v1:'+b.id)))
 pilot.push(pool[0])
}
// Supplement required early forms, institution and period without outcome-dependent selection.
for(const predicate of [r=>r.exam==='2014A',r=>r.exam==='2014B',r=>r.kind==='mock',r=>r.school_year>=2023]){
 if(!pilot.some(predicate)){const r=eligible.filter(predicate).sort((a,b)=>a.id.localeCompare(b.id))[0];if(r)pilot.push(r)}
}
for(const type of ['R-PURPOSE','R-MOOD','R-ORDER','R-INSERT','R-BLANK','R-FACT']){
 const r=eligible.filter(r=>r.type===type&&!pilot.some(p=>p.id===r.id)).sort((a,b)=>hash('supplement-v1:'+a.id).localeCompare(hash('supplement-v1:'+b.id)))[0]
 if(r)pilot.push(r)
}
const rawOf=new Map(corpus.map(it=>[it.id,it]))
const blankInput=r=>{const it=rawOf.get(r.id);return {id:r.id,binding:r.source_binding_sha256,passage_group:r.passage_group,passage:it.passage,stem:it.stem,choices:it.choices,type_id:r.type,source_status:r.source_status,visual_required:r.type==='R-CHART',answer_blind:true}}
write(local,'pilot-input.json',{protocol:'1.0',as_of:asOf,items:pilot.map(blankInput)})
write(local,'pilot-answer-key.json',pilot.map(r=>({id:r.id,answer:rawOf.get(r.id).answer,answers:rawOf.get(r.id).answers})))
write(output,'item-manifest.json',rows)
write(output,'pilot-manifest.json',pilot.map(r=>({id:r.id,type:r.type,passage_group:r.passage_group,binding:r.source_binding_sha256})))
const held=rows.filter(r=>!r.public_v3).map(r=>({id:r.id,type:r.type,set:r.set,school_year:r.school_year,status:r.existing_status,source_file:outs.get(r.id)?.file??null,legacy_note_sha256:hash(outs.get(r.id)?.review_note||''),issue_summary:r.type==='R-MOOD'||r.type==='X-REFER'?'legacy_sentence_reference_requires_revalidation':r.type==='R-VOCAB'?'legacy_quotation_or_subject_structure_requires_revalidation':'legacy_evidence_reference_requires_revalidation',admission:'hold_no_research_canonical_admission'}))
write(output,'held-ledger.json',held)
const drift=corpus.flatMap(it=>{const prior=legacy.get(it.id);if(!prior||hash(prior.passage||'')===hash(it.passage||''))return [];return [{id:it.id,legacy_passage_sha256:hash(prior.passage||''),current_passage_sha256:hash(it.passage||''),whitespace_normalized_equal:(prior.passage||'').replace(/\s+/g,' ').trim()===(it.passage||'').replace(/\s+/g,' ').trim(),legacy_chars:(prior.passage||'').length,current_chars:(it.passage||'').length,interpretation:'version_difference_not_automatically_error'}]})
write(output,'legacy-input-drift.json',drift)
const bothScope=p=>[p.left,p.right].every(id=>inScope.some(r=>r.id===id))
const principlePairs=pairs.filter(p=>p.principle)
const coverage=countBy(pairs.flatMap(p=>[p.left,p.right]),x=>x)
const summary={as_of:asOf,source_files:[{role:'local_corpus',sha256:hash(fs.readFileSync(corpusFile))},{role:'public_inquiry',sha256:hash(fs.readFileSync(inquiryFile))},{role:'public_pairs',sha256:hash(fs.readFileSync(pairFile))}],all_reading:rows.length,research_reading:inScope.length,out_of_scope:rows.filter(r=>r.set==='out_of_scope').length,by_set:countBy(rows,r=>r.set),by_kind:countBy(inScope,r=>r.kind),by_school_year:countBy(inScope,r=>r.school_year),by_type:countBy(inScope,r=>r.type),by_exam:exams,unique_declared_passage_groups:new Set(inScope.map(r=>r.passage_group)).size,unique_normalized_text_hashes:new Set(inScope.map(r=>r.normalized_passage_sha256)).size,group_hash_conflicts:[...new Set(inScope.map(r=>r.passage_group))].flatMap(g=>{const rs=inScope.filter(r=>r.passage_group===g);return new Set(rs.map(r=>r.normalized_passage_sha256)).size>1?[{group:g,ids:rs.map(r=>r.id)}]:[]}),db_mismatch:rows.filter(r=>!r.db_passage_matches||!r.db_stem_matches||!r.db_answer_matches||!r.db_type_matches).map(r=>({id:r.id,passage:r.db_passage_matches,stem:r.db_stem_matches,answer:r.db_answer_matches,type:r.db_type_matches})),public_v3_all:Object.keys(inquiries).length,public_v3_scope:inScope.filter(r=>r.public_v3).length,held_all:held.length,held_scope:held.filter(r=>r.set!=='out_of_scope').length,held_by_type:countBy(held,r=>r.type),pairs_all:pairs.length,pairs_both_scope:pairs.filter(bothScope).length,pairs_kind:countBy(pairs,p=>p.kind),pairs_kind_scope:countBy(pairs.filter(bothScope),p=>p.kind),principle_pair_objects:principlePairs.length,principle_unique_statements:new Set(principlePairs.map(p=>p.principle.statement)).size,principle_pairs_scope:principlePairs.filter(bothScope).length,principle_level:countBy(principlePairs,p=>p.principle.level),pair_covered_items:Object.keys(coverage).length,pair_uncovered_public:Object.keys(inquiries).filter(id=>!coverage[id]).length,pair_endpoint_degrees:countBy(Object.values(coverage),x=>x),pilot_items:pilot.length,pilot_types:new Set(pilot.map(r=>r.type)).size,holdout_exposed:[...previouslyExposed].sort(),minimum_evidence_note:'Corpus structure and legacy AI content audit; no semantic classification or expert validation inferred.'}
write(output,'audit-summary.json',summary)
console.log(JSON.stringify({all:summary.all_reading,scope:summary.research_reading,passage_groups:summary.unique_declared_passage_groups,hash_conflicts:summary.group_hash_conflicts.length,db_mismatches:summary.db_mismatch.length,v3_scope:summary.public_v3_scope,pilot:summary.pilot_items,pairs:summary.pairs_all,kinds:summary.pairs_kind,principle_objects:summary.principle_pair_objects},null,2))
