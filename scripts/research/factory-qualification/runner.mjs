// scripts/research/factory-qualification/runner.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {AXES,qualify,releaseBoundary} from './qualification.mjs';
const base='docs/research/factory-qualification/data/';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fileRef=p=>({path:p,sha256:digest(fs.readFileSync(p))});
const approvals=()=>Object.fromEntries(['rights','release','human_gold','scorer_validated','student_measurement_validated'].map(k=>[k,null]));
const learner=()=>Object.fromEntries(['source_group_unseen','normalized_body_unseen','no_explanation_before','no_hint_before','first_response_frozen'].map(k=>[k,null]));
const roleMap={original_analysis:'source_analysis',principle_explanation:'model_explanation',semantic_contrast:'guided_practice',guided_practice:'guided_practice',direct_check:'independent_check',other_passage_transfer:'transfer',delayed_retrieval:'delayed_check',model_explanation:'model_explanation'};
function specification(id,revision,task,role,versions,rawAxes,reviewRef,candidates,roleContext={}){
 const evidence=AXES.map(a=>({id:`${id}:${a}`,content_id:id,content_revision:revision,revision:reviewRef.version,sha256:reviewRef.sha256,path:reviewRef.path,axis:a}));
 const axes=Object.fromEntries(AXES.map(a=>[a,{state:rawAxes[a].state??rawAxes[a].status,method:rawAxes[a].method??'Source-bound independent AI review with recorded normalization',reason:rawAxes[a].reason??'Actual first review retained; see its axis and opaque issue IDs.',evidence_id:`${id}:${a}`} ]));
 return {rules_version:'FQ1.0',content:{id,revision},demand:{key:`fq1-research-demand:${id}:${role}`,definitionVersion:'FQ1.0-reference-only',task,role,workspace:task==='s.form_scope'?'ws.grammar-scope':'ws.vocab-context'},task_id:task,role,versions,axes,evidence,approvals:approvals(),approval_evidence:{},learner:learner(),role_context:{includes_gold:true,observations_population:'no_actual_learners',...roleContext},candidate_roles:candidates,producible:null};
}
export function buildResults(){
 const research=read(base+'research-activities.json'),main=read(base+'dcp-main-review.json'),counter=read(base+'dcp-counter-review.json'),exported=read(base+'sample-export.json');
 const inputs=['research-activities.json','dcp-main-review.json','dcp-counter-review.json','sample-export.json'].map(p=>fileRef(base+p));
 inputs.push(fileRef('scripts/research/factory-qualification/qualification.mjs'),fileRef('scripts/research/factory-qualification/runner.mjs'));
 if(digest(fs.readFileSync(research.first_private_review.path))!==research.first_private_review.sha256)throw Error('Research private review hash mismatch');
 for(const packet of exported.packets)if(digest(fs.readFileSync(packet.file))!==packet.sha256)throw Error('DCP input hash mismatch '+packet.split);
 const specs=[],metadata=[];
 for(const a of research.activities){
  const revision=a.content_revision;
  const versions={source:a.source,analysis:{revision:a.analysis_version,scope:'pinned research version, not latest DB revision'},gold:{revision:a.gold_version,sha256:a.axes.E.target_sha256},artifact:{revision,sha256:a.axes.A.target_sha256,actual_product_runtime_artifact:false}};
  specs.push(specification(a.content_id,revision,a.task_id,'model_explanation',versions,a.axes,{...research.first_private_review,version:research.version},a.design_candidate_roles.map(r=>roleMap[r]),{}));
  metadata.push({content_id:a.content_id,cohort:'research8',raw_first_axes:a.axes,original_exam_task_fit:a.original_exam_task_fit,derived_task_fit:a.derived_task_fit,issue_ids:a.issue_ids,source_qa_scope:a.source_qa_scope});
 }
 for(const [cohort,review] of [['dcp_main8',main],['dcp_counter4',counter]]){
  for(const item of review.items){
   const raw=item.axes,axes=structuredClone(raw);
   // First review values remain raw. Composite E also requires a rubric, not just recognition key.
   if(axes.E.state==='pass')axes.E={...axes.E,state:'unknown',reason:'Recognition key/explanation subreview passed; no complete accepted/partial/equivalent/defer rubric or human scoring validation. Composite E remains unknown.'};
   if(axes.A.state==='pass')axes.A={...axes.A,state:'unknown',reason:'First A pass covered supplied local source structure. Historical generation-source binding and explicit generation revision remain unobserved; strict source/version composite A is unknown.'};
   const revision=`sealed-snapshot:${item.item_sha256}`;
   const task=item.requested_task??item.task;
   const privatePath=review.first_review_path??'scripts/research/factory-qualification/local/dcp-counter-review-first.json';
   const expected=review.first_review_sha256??review.private_review?.sha256;
   const actual=digest(fs.readFileSync(privatePath));
   if(expected&&actual!==expected)throw Error('DCP first review hash mismatch '+cohort);
   const versions={source:{sha256:item.source_sha256,observed_snapshot_revision:item.source_revision,historical_generation_binding:'unknown'},analysis:{revision:'unknown_not_present'},gold:{revision:'unknown_not_present',key_quality_subreview:item.E_key_quality??{state:raw.E.state},rubric_quality_subreview:item.E_rubric_unknown??{state:'unknown'}},artifact:{sha256:item.item_sha256,revision,generation_revision:item.generation_revision??null,snapshot_revision_is_not_generation_revision:true}};
   specs.push(specification(item.id,revision,task,'guided_practice',versions,axes,{path:privatePath,sha256:actual,version:review.version},['guided_practice','model_explanation'],{}));
   metadata.push({content_id:item.id,cohort,raw_first_axes:raw,normalized_E_reason:axes.E.reason,normalized_A_reason:axes.A.reason,first_key_quality:item.E_key_quality??{state:raw.E.state},first_rubric_quality:item.E_rubric_unknown??{state:'unknown'},categories:item.classifications??item.categories,issue_ids:item.issue_kinds??item.issue_ids});
  }
 }
 if(specs.length!==20||new Set(specs.map(s=>s.content.id)).size!==20)throw Error('Expected 20 distinct content cases');
 const results=specs.map(s=>{const r=qualify(s);releaseBoundary(s,r);return r;});
 const roleResults=research.role_candidates.map(m=>{
  const original=specs.find(s=>s.content.id===m.activity_id),role=roleMap[m.role];
  const s=structuredClone(original);s.role=role;s.demand.role=role;s.demand.key=`fq1-research-demand:${m.candidate_id}`;
  s.candidate_roles=[role];
  s.role_context={...s.role_context,material_id:m.candidate_id,material_revision:m.role_revision,
   ...(m.role==='guided_practice'?{hint_log_contract:true,Gold_after_final_guided_freeze:true,assisted_label:true}:{}),
   ...(m.role==='other_passage_transfer'?{different_learning_body:true,same_performance_goal:true,shared_body_excluded:null}:{}),
   ...(m.role==='delayed_retrieval'?{actual_elapsed_observed:null,intermediate_exposure_observed:null,same_item_recognition_separated:true}:{}),
   role_context_is_design_not_execution:true};
  const r=qualify(s);releaseBoundary(s,r);return {candidate_id:m.candidate_id,original_role:m.role,original_role_metadata:m,result:r};
 });
 if(results.some(r=>r.public_qualified||r.assessment_qualified)||roleResults.some(r=>r.result.public_qualified||r.result.assessment_qualified))throw Error('Unexpected actual qualification promotion');
 return {version:'FQ1.0-qualification-results-1',inputs,specifications:specs,first_review_metadata:metadata,results,role_results:roleResults,counts:{content_cases:20,research_activities:8,dcp_main_items:8,dcp_counter_items:4,research_role_uses:14,qualified_public:0,qualified_assessment:0,actual_human_approval:0,actual_learners:0},normalization_policy:'Raw first A-H preserved. Strict source/generation-version and full Gold/rubric composite qualifications remain unknown when narrower local/key review passed. No private source, key, Gold or individual fit value is copied.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=buildResults(),text=JSON.stringify(result,null,2)+'\n',path=base+'qualification-results.json';
 if(process.argv.includes('--check')){if(fs.readFileSync(path,'utf8')!==text)throw Error('Qualification results drift');}
 else fs.writeFileSync(path,text);
 console.log(JSON.stringify({mode:process.argv.includes('--check')?'check':'write',counts:result.counts,sha256:digest(text)}));
}
