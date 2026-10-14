// scripts/research/csat-reading/v12-map.mjs
// Candidate extraction never becomes verified item relevance or learner mastery.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const hash=x=>createHash('sha256').update(x).digest('hex')
export function candidateLink(task,analysis,type){
 const req=analysis.v3?.requirement,meanings=analysis.v3?.meanings||[],choices=analysis.v3?.choices||[]
 let proposed='unknown',rule='no_explicit_annotation',basis=[]
 if(['L','X'].includes(task.axis))return {candidate_relevance:'unknown',rule:'reading_items_cannot_establish_listening_or_execution',basis:[]}
 if(task.id==='e.task_demand'&&req){proposed='direct';rule='v3_explicit_requirement';basis=['v3.requirement']}
 if(task.id==='e.evidence_location'&&choices.some(c=>c.sentences?.length)){proposed='direct';rule='v3_choice_evidence_positions';basis=['v3.choices.sentences']}
 if(task.id==='e.option_correspondence'&&choices.length===5){proposed='direct';rule='v3_five_candidate_judgments';basis=['v3.choices']}
 if(task.kind==='integrated'&&meanings.length){proposed='indirect';rule='meaning_or_final_judgment_observation_candidate';basis=['v3.meanings','v3.choices']}
 if(task.id==='s.sentence_core'&&meanings.length){proposed='indirect';rule='meaning_records_support_sentence_analysis_not_core_annotation';basis=['v3.meanings']}
 if(task.id==='r.central_meaning'&&['R-GIST','R-TOPIC','R-TITLE','R-CLAIM','X-TITLE'].includes(type)){proposed='direct';rule='macro_task_type_candidate_requires_original_check';basis=['metadata.type','v3.requirement']}
 if(task.id==='r.reference'&&['X-REFER','R-ORDER','R-INSERT'].includes(type)){proposed='direct';rule='reference_or_coherence_type_candidate_not_observed_antecedent';basis=['metadata.type']}
 if(task.id==='r.discourse_structure'&&['R-ORDER','R-INSERT','R-IRRELEVANT'].includes(type)){proposed='direct';rule='coherence_type_candidate_not_unique_required_path';basis=['metadata.type','v3.requirement']}
 if(task.id==='r.relation'&&['R-ORDER','R-INSERT','R-IRRELEVANT','R-SUMMARY','R-BLANK','X-BLANK'].includes(type)){proposed='indirect';rule='integration_type_candidate_relation_unconfirmed';basis=['metadata.type']}
 if(task.id==='s.form_scope'&&type==='R-GRAMMAR'){proposed='direct';rule='grammar_type_candidate_requires_form_scope_facet';basis=['metadata.type','v3.requirement']}
 if(task.id==='v.contextual_sense'&&['R-VOCAB','X-VOCAB','R-IMPLY'].includes(type)){proposed='direct';rule='lexical_type_candidate_polysemy_vs_fit_unresolved';basis=['metadata.type','v3.requirement']}
 return {candidate_relevance:proposed,rule,basis}
}
export function mappingRow(item,task,analysis,review=null){
 const candidate=candidateLink(task,analysis,item.type)
 if(review&&(!['direct','indirect','not_applicable','unknown'].includes(review.relevance)||!review.source_checked||!review.evidence?.length||!review.why))throw Error('Actual relevance requires source-checked evidence and a reason')
 return {item_id:item.id,exam_id:item.exam,type_id:item.type,analysis_version:analysis.analysis_version,units_hash:analysis.v3?.units_hash??null,source_binding:item.source_binding_sha256,research_input:review?{ref:review.source_ref,version:review.research_input_version,sha256:review.research_input_sha256}:null,task_id:task.id,relevance:review?.relevance??'unknown',...candidate,reason:review?.why??'Automatic candidate only; unreviewed relation remains unknown.',evidence:review?.evidence??candidate.basis,sufficiency:review?.sufficiency??'not_established',counterexample:review?.counterexample??'not_searched_for_this_combination',review_status:review?'source_checked_ai_case_review':'automatic_candidate_not_reviewed',disagreement:review?.disagreement??'not_double_rated',public_learning_use:false}
}
function main(){
 const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
 const audit=read(dir+'audit.json'),tasks=read(audit.files.codebook.path).tasks,inquiry=read(audit.files.inquiry.path),items=read(base+'data/item-manifest.json')
 for(const key of ['codebook','inquiry'])if(hash(fs.readFileSync(audit.files[key].path))!==audit.files[key].sha256)throw Error(`${key} source drift`)
 const byId=new Map(items.map(x=>[x.id,x])),reviews=fs.existsSync(dir+'item-task-reviewed.json')?read(dir+'item-task-reviewed.json').rows:[]
 const reviewMap=new Map(reviews.map(r=>[`${r.item_id}/${r.task_id}`,r]))
 if(reviewMap.size!==reviews.length)throw Error('Duplicate source-reviewed item/task link')
 const rows=[];for(const [id,analysis]of Object.entries(inquiry.items)){const item=byId.get(id);if(!item)throw Error(`Missing snapshot metadata ${id}`);for(const task of tasks)rows.push(mappingRow(item,task,analysis,reviewMap.get(`${id}/${task.id}`)))}
 if(rows.length!==786*30)throw Error('Mapping denominator changed')
 const output=dir+'item-task-map.jsonl';if(fs.existsSync(output))throw Error('Registered mapping already exists; use a new version')
 fs.writeFileSync(output,rows.map(x=>JSON.stringify(x)).join('\n')+'\n')
 const count=(axis)=>rows.reduce((s,r)=>(s[r[axis]]=(s[r[axis]]||0)+1,s),{})
 const summary={date:'2026-10-14',protocol:'1.2',n_items:786,n_tasks:30,n_combinations:rows.length,sha256:hash(fs.readFileSync(output)),relevance:count('relevance'),candidate_relevance:count('candidate_relevance'),review_status:count('review_status'),reviewed_rows:reviews.length,unseen_recent_semantic_output:false,source_files:audit.files,per_task:tasks.map(t=>{const rs=rows.filter(r=>r.task_id===t.id);return {id:t.id,display:t.display,kind:t.kind,status:t.status,actual_direct:rs.filter(r=>r.relevance==='direct').length,actual_indirect:rs.filter(r=>r.relevance==='indirect').length,actual_unknown:rs.filter(r=>r.relevance==='unknown').length,candidate_direct:rs.filter(r=>r.candidate_relevance==='direct').length,candidate_indirect:rs.filter(r=>r.candidate_relevance==='indirect').length}}),limitations:['Automatic rules summarize stored AI annotations/type, not original item demands.','Source-reviewed AI links do not establish human validation or learner proficiency.','No untagged combination is converted to not_applicable.','No score gain, mastery probability or two-item universal criterion.']}
 fs.writeFileSync(dir+'mapping-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({combinations:summary.n_combinations,actual:summary.relevance,candidates:summary.candidate_relevance,reviewed:reviews.length},null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
