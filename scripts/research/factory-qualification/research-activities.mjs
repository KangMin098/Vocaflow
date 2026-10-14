// scripts/research/factory-qualification/research-activities.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const out = 'docs/research/factory-qualification/data';
const local = 'scripts/research/factory-qualification/local';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const ref = path => ({path, sha256:sha(fs.readFileSync(path))});
const contentPath='scripts/research/csat-reading/local/v15/content-packages-revision2.json';
const rolesPath='scripts/research/csat-reading/local/v15/content-roles-revision3.json';
const candidatesPath='docs/research/csat-reading/data/v15/content-candidates-revision1.json';
const content=read(contentPath), roleInput=read(rolesPath), candidates=read(candidatesPath);
const activities=[...content.reused_priority_activities,...content.new_activities];
const inputs=[contentPath,rolesPath,candidatesPath,
 'scripts/research/csat-reading/local/v15/content-review-first.json',
 'scripts/research/csat-reading/local/v15/content-review-revision2.json',
 'scripts/research/csat-reading/local/v15/content-review-revision3.json',
 'scripts/research/csat-reading/local/v14/education-packages-revision3.json',
 'scripts/research/csat-reading/local/v15/assessment-input.json',
 'scripts/research/csat-reading/local/v15/assessment-review-first.json'].map(ref);
const definitions=[
 {id:'RQ-E01',activity:'v14-s.form_scope-1',axis:'E',field:'operator.defect',kind:'unobservable_response_mislabeled_defect',reason:'A grammar-label-only answer may supply no interpretable operator meaning; the local defect example conflicts with the global unobservable-first decision rule.',detector:'Compare interpretable semantic components with the facet defer rule before assigning defect.'},
 {id:'RQ-E02',activity:'v14-s.form_scope-2',axis:'E',field:'gold.partial',kind:'explicit_strengthening_labeled_partial',reason:'The reference partial response explicitly strengthens a possibility/frequency assertion while the same activity rubric and global policy classify strengthening as defect.',detector:'Normalize assertion strength for every partial/equivalent alternative; reject explicit strengthening as omission-based partial.'},
 {id:'RQ-E03',activity:'v14-s.form_scope-2',axis:'E',field:'examples.defect',kind:'unobservable_response_mislabeled_defect',reason:'A grammar-name-only response without a boundary example conflicts with the example facet defer rule.',detector:'Separate unobserved required examples from explicit false examples.'},
 {id:'RQ-E04',activity:'v14-s.form_scope-3',axis:'E',field:'boundary.defect',kind:'unobservable_response_mislabeled_defect',reason:'Attachment-only prose supplies no required boundary classification; the defect example overlaps the no-boundary-response defer criterion.',detector:'Inspect the presence of interpretable boundary judgments; preserve omission/defer separately from distortion.'},
 {id:'RQ-D01',activity:'v14-v.contextual_sense-3',axis:'D',field:'limit.meets versus student_prompt',kind:'unrequested_scored_output',reason:'The rubric requires two distinctions between contextual interpretation and other performances, but the actual learner prompt does not request those distinctions.',detector:'Map every required rubric output to an explicit prompt instruction; missing instruction is a provider defect, not learner failure.'}
];
const sourceChecks=[];
const privateRows=activities.map(a=>{
 const c=candidates.candidates.find(c=>c.candidate_id===a.activity_id);
 if(!c) throw new Error('Candidate missing '+a.activity_id);
 const snapshot=read(c.source.path), rows=Array.isArray(snapshot)?snapshot:snapshot.items;
 const row=rows.find(r=>r.id===a.item_id);
 if(!row) throw new Error('Source row missing '+a.item_id);
 const fileMatches=sha(fs.readFileSync(c.source.path))===c.source.sha256;
 const rowMatches=sha(JSON.stringify(row))===c.source.row_sha256;
 const ledgerMatches=sha(fs.readFileSync(c.source.admission_ledger.path))===c.source.admission_ledger.sha256;
 if(!fileMatches||!rowMatches||!ledgerMatches) throw new Error('Source binding mismatch '+a.activity_id);
 sourceChecks.push({activity_id:a.activity_id,file_hash_matches:fileMatches,row_hash_matches:rowMatches,admission_ledger_hash_matches:ledgerMatches});
 const issues=definitions.filter(i=>i.activity===a.activity_id).map(i=>{
  const [parent,field]=i.field.split('.');
  const facet=a.analytic_rubric.find(r=>r.facet===parent);
  return {...i,actual_private_example:parent==='gold'?a.gold[field]:i.axis==='D'?{prompt:a.student_prompt,required:a.analytic_rubric.find(r=>r.facet==='limit').meets}:{defect:facet?.defect,defer:facet?.defer,global_policy:a.analytic_rubric[0].level_decision_order},source_reference:ref(c.source.path)};
 });
 return {activity_id:a.activity_id,source_row:row,prompt:a.student_prompt,gold:a.gold,rubric:a.analytic_rubric,issues};
});
const review={version:'fq1-research-activity-first-1.0',method:'fresh AI investigator read of all eight full bodies/prompts/Gold/facet boundaries plus fourteen role delivery contracts; inherited exact-row PDF/key provenance, no fresh visual certification',inputs,activities:privateRows,source_checks:sourceChecks,issues:definitions,first_result_policy:'preserved; subsequent repair must use a separate revision and independent review'};
fs.mkdirSync(local,{recursive:true});fs.mkdirSync(out,{recursive:true});
const privatePath=local+'/research-activity-review-first.json';
if(fs.existsSync(privatePath)) {
 const old=read(privatePath);
 if(JSON.stringify(old)!==JSON.stringify(review)) throw new Error('Refusing first-review overwrite');
} else fs.writeFileSync(privatePath,JSON.stringify(review,null,2)+'\n');
const evidence=ref(privatePath);
const axis=(status,reason,evidenceIds=['RQ-FIRST'])=>({status,reason,evidence_ids:evidenceIds.length?evidenceIds:['RQ-FIRST'],target_version:content.version,target_sha256:inputs[0].sha256,method:'AI source-bound content/specification audit; not human approval'});
const ledgerActivities=activities.map(a=>{
 const c=candidates.candidates.find(c=>c.candidate_id===a.activity_id), findings=definitions.filter(i=>i.activity===a.activity_id);
 const mats=roleInput.role_materials.filter(m=>m.base_activity_id===a.activity_id);
 return {content_id:a.activity_id,content_revision:a.revision??'inherited-v14-r3',item_id:a.item_id,task_id:a.task_id,workspace_demand_reference:a.task_id==='s.form_scope'?'ws.grammar-scope':'ws.vocab-context',source:c.source,analysis_version:c.analysis_version,gold_version:content.version,source_qa_scope:'hash/row/provenance rechecked; prior PDF/same-form-key admission reused',original_exam_task_fit:c.original_exam_task_relevance,derived_task_fit:c.derived_task_relevance,
  axes:{A:axis('pass','Exact source row/file/admission hash matches, inherited complete fields and same-form key. Official download chain remains unresolved.'),B:axis('pass','Bounded source-bound full/equivalent explanation preserves target participants, direction, scope and strength; partial-label defects are separately E failures.'),C:axis('pass','Actual derived prompt elicits the permanent TASK performance; original exam answer remains indirect evidence and does not observe that performance independently.'),D:axis(findings.some(i=>i.axis==='D')?'fail':'pass',findings.some(i=>i.axis==='D')?'Required scored output is absent from learner prompt.':'Actual instruction, contrast and delivery design elicit the target output; execution and instructional effect remain unobserved.',findings.filter(i=>i.axis==='D').map(i=>i.id)),E:axis(findings.some(i=>i.axis==='E')?'fail':'pass',findings.some(i=>i.axis==='E')?'Gold/rubric decision-boundary inconsistency detected; preserve prior pass and this new disagreement.':'No new concrete semantic Gold/boundary defect found in this bounded AI recheck. Human scoring validity and direct-assessment qualification remain unknown.',findings.filter(i=>i.axis==='E').map(i=>i.id)),F:axis('unknown','No source adaptation/distribution/release approval record.'),G:axis('unknown','No actual learner same/shared/normalized passage, answer, hint or first-response exposure record.'),H:axis('unknown','No actual ContentArtifact delivered/run in the product Workspace; static runnable:false is a product candidate contract, not artifact compatibility test.')},
  E_qualification:{research_AI_content_review:findings.some(i=>i.axis==='E')?'fail':'pass',human_scoring_validity:'unknown',direct_assessment_qualified:false},
  candidate_role_ids:mats.map(m=>m.material_id),design_candidate_roles:mats.map(m=>m.role),blocked_public_roles:mats.map(m=>m.role),issue_ids:findings.map(i=>i.id),error_types_possible:[a.task_id==='s.form_scope'?'scope_strength_time_metric_distortion':'sense_argument_direction_or_context_confound','missing_required_output','unobservable_versus_partial_or_defect','exposure_or_runtime_promotion'],detectors:['Exact source/row/revision hash checks','AI source-bound participant/operator/scope and relation comparison','Prompt-to-facet required-output coverage','Separate meaning from procedural/exposure logs'],independent_recheck_conditions:['New explicit repair revision only; preserve first content/QA/Gold','Fresh reviewer reads complete supplied source, actual prompt, every Gold alternative and rubric state overlap','Bind exact source, analysis, Gold and delivery revisions; record repaired issue IDs','Human scoring/adaptation rights and actual learner/runtime records before public or assessment qualification'],product_application:'reference_only_for_contract_and_tests; no publication, production, ingestion or learner evaluation',public_qualified:false,direct_assessment_qualified:false,evidence_reference:evidence};
});
const roles=roleInput.role_materials.map(m=>{
 const a=ledgerActivities.find(a=>a.content_id===m.base_activity_id);
 return {candidate_id:m.material_id,activity_id:m.base_activity_id,task_id:m.task_id,role:m.role,role_revision:roleInput.version,role_input:inputs[1],content_axes_reference:a.content_id,content_issue_ids:a.issue_ids,design_candidate:true,blocked_for_actual_public_supply:true,direct_assessment_qualified:false,role_specific_conditions:['actual rights/release and runtime support',...(['direct_check','other_passage_transfer','delayed_retrieval'].includes(m.role)?['human-validated Gold/scoring boundary','learner-specific unaided first-response freeze and exposure records']:[]),...(m.role==='other_passage_transfer'?['different normalized/shared passage and same required TASK performance']:[]),...(m.role==='delayed_retrieval'?['actual elapsed time and intervening exposure/study records; seven days is a design choice']:[]),...(m.role==='guided_practice'?['staged assistance log; Gold feedback only after final guided response seal; label assisted']:[])],delivery_specification_review:'prior v15 carried content plus focused two-guided-role AI delivery review; not executed runtime evidence',product_eligibility:'reference_only'};
});
const publicData={version:'fq1-research-activities-first-1.0',inputs,first_private_review:evidence,prior_v14_AI_review:ref('scripts/research/csat-reading/local/v14/education-revision3-review.json'),reviewer:'separate AI context; no human reviewer or learner',activities:ledgerActivities,role_candidates:roles,issues:definitions,counts:{activities:8,unique_original_item_ids:8,role_uses:14,facets:32,A_source_pass:8,B_semantic_pass:8,C_task_pass:8,D_instruction_pass:7,D_instruction_fail:1,E_gold_rubric_pass:5,E_gold_rubric_fail:3,issues:5,public_qualified:0,direct_assessment_qualified:0,human_reviewers:0,actual_learners:0,runtime_artifacts_tested:0,new_PDF_visual_audits:0},prior_QA_disagreement:'Prior v15 review accepted new two-activity/eight-facet semantics and focused delivery. It did not establish a new full review of retained six activities; discovered inherited defects remain visible alongside its original result.'};
fs.writeFileSync(out+'/research-activities.json',JSON.stringify(publicData,null,2)+'\n');
console.log(JSON.stringify({counts:publicData.counts,private_review:evidence,public:ref(out+'/research-activities.json')}));
