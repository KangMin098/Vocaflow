// scripts/research/factory-qualification/qualification.mjs
import {isDeepStrictEqual} from 'node:util';
export const AXES=['A','B','C','D','E','F','G','H'];
export const STATES=['pass','fail','unknown','not_applicable'];
export const ROLES=['source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check'];
const measured=new Set(['independent_check','transfer','delayed_check']);
export function validateSpecification(s){
 if(s.rules_version!=='FQ1.0'||!s.content?.id||!s.content?.revision||!s.demand?.key||!s.demand?.definitionVersion||!s.task_id||!ROLES.includes(s.role))throw Error('Missing specification binding');
 if(s.demand.task!==s.task_id||s.demand.role!==s.role)throw Error('Demand TASK/role mismatch');
 if(!s.versions||!['source','analysis','gold'].every(k=>Object.hasOwn(s.versions,k))||!Array.isArray(s.evidence)||!s.approvals||!s.learner||!s.role_context)throw Error('Missing qualification context');
 for(const a of AXES){const x=s.axes?.[a];if(!x||!STATES.includes(x.state)||!x.method||!x.reason)throw Error('Invalid axis '+a);if(x.state==='pass'||x.state==='fail'){const e=s.evidence.find(e=>e.id===x.evidence_id);if(!e||!e.revision||!(/^[a-f0-9]{64}$/i.test(e.sha256??''))||e.content_id!==s.content.id||e.content_revision!==s.content.revision)throw Error('Unbound axis '+a);}}
 return true;
}
export function sourceGuard(v){
 const fail=[],unknown=[];
 if(v.source){if(v.source.expected_exam_id&&v.source.header_exam_id&&v.source.expected_exam_id!==v.source.header_exam_id)fail.push('exam_header_mismatch');
 if(/^2014[AB]$/.test(v.source.expected_exam_id??'')&&(v.source.listening_end!==22||v.source.reading_start!==23||v.source.reading_end!==45))fail.push('2014_regime_mismatch');
 if(v.source.expected_form&&v.source.observed_form&&v.source.expected_form!==v.source.observed_form)fail.push('paper_form_mismatch');
 if(v.source.expected_sha256&&v.source.actual_sha256&&v.source.expected_sha256!==v.source.actual_sha256)fail.push('source_hash_mismatch');
 if(v.source.kind==='article'){if(!v.source.id||!v.source.actual_sha256)unknown.push('article_identity_unobserved');if(v.source.generation_source_revision_bound!==true)unknown.push('generation_source_revision_unbound');}
 else if(!v.source.header_exam_id||!v.source.actual_sha256)unknown.push('source_identity_unobserved');
 if(v.source.current_updated_at&&v.source.cache_source_updated_at&&v.source.current_updated_at!==v.source.cache_source_updated_at)unknown.push('stale_source_eligibility');
 else if(v.source.cache_status==='blocked'&&v.source.current_updated_at&&v.source.cache_source_updated_at)fail.push('fresh_source_policy_blocked');}else unknown.push('source_unbound');
 if(v.key){if(v.key.kind==='listening_transcript')fail.push('transcript_is_not_answer_key');else if(v.key.kind!=='answer_key'||v.key.content_verified!==true||!v.key.actual_sha256)unknown.push('key_document_kind_unverified');
 if(v.source?.expected_exam_id&&v.key.exam_id&&v.source.expected_exam_id!==v.key.exam_id)fail.push('key_exam_mismatch');
 if(v.source?.expected_form&&v.key.form&&v.source.expected_form!==v.key.form)fail.push('key_form_mismatch');
 if(v.key.kind==='answer_key'&&(v.key.row_count!==45||v.key.distinct_numbers!==45||v.key.min_no!==1||v.key.max_no!==45||v.key.total_points!==100))fail.push('key_inventory_mismatch');}else if(v.require_exam_key)unknown.push('same_form_key_unverified');
 for(const k of ['source','analysis','gold']){const declared=v.declared?.[k],bound=v.generated_binding?.[k];if(declared&&bound&&(declared.id!==bound.id||declared.revision!==bound.revision||declared.sha256!==bound.sha256))fail.push(k+'_binding_conflict');else if(declared&&!bound)unknown.push(k+'_generated_binding_missing');}
 if(v.latest_analysis&&v.declared?.analysis&&v.latest_analysis.revision!==v.declared.analysis.revision)unknown.push('newer_analysis_requires_conflict_review');
 return {state:fail.length?'fail':unknown.length?'unknown':'pass',fail,unknown};
}
export function roleEligibility(s,role=s.role){
 validateSpecification(s);if(!ROLES.includes(role))throw Error('Unknown role');
 const required=measured.has(role)?AXES:['A','B','C','D','F','G','H',...(s.role_context.includes_gold?['E']:[])];
 const blocked=required.filter(a=>s.axes[a].state!=='pass').map(a=>({axis:a,state:s.axes[a].state,reason:s.axes[a].reason}));
 for(const field of ['rights','release'])if(!attested(s,field))blocked.push({gate:field,state:s.approvals[field]===false?'fail':'unknown'});
 if(measured.has(role)){
  for(const field of ['human_gold','scorer_validated','student_measurement_validated'])if(!attested(s,field))blocked.push({gate:field,state:'unknown'});
  for(const field of ['source_group_unseen','normalized_body_unseen','no_explanation_before','no_hint_before','first_response_frozen'])if(s.learner[field]!==true)blocked.push({gate:field,state:s.learner[field]===false?'fail':'unknown'});
  if(s.role_context.observations_population==='synthetic')blocked.push({gate:'synthetic_is_not_student_validation',state:'fail'});
 }
 if(role==='guided_practice')for(const field of ['hint_log_contract','Gold_after_final_guided_freeze','assisted_label'])if(s.role_context[field]!==true)blocked.push({gate:field,state:'unknown'});
 if(role==='transfer')for(const field of ['different_learning_body','same_performance_goal','shared_body_excluded'])if(s.role_context[field]!==true)blocked.push({gate:field,state:'unknown'});
 if(role==='delayed_check')for(const field of ['actual_elapsed_observed','intermediate_exposure_observed','same_item_recognition_separated'])if(s.role_context[field]!==true)blocked.push({gate:field,state:'unknown'});
 return {role,eligible:blocked.length===0,blocked};
}
export function supplyCrosswalk(s){
 validateSpecification(s);const flag=a=>s.axes[a].state==='pass'?true:s.axes[a].state==='fail'?false:null;
 const and=values=>values.includes(false)?false:values.every(v=>v===true)?true:null;
 const approval=k=>attested(s,k)?true:s.approvals[k]===false?false:null;
 const qualification={producible:typeof s.producible==='boolean'?s.producible:null,rights:and([flag('F'),approval('rights')]),content:and(['A','B','C'].map(flag)),teaching:flag('D'),assessment:s.role_context.observations_population==='synthetic'?false:and([flag('E'),...['human_gold','scorer_validated','student_measurement_validated'].map(approval)]),learner:flag('G'),runnable:flag('H')};
 return {qualification,retained_axes:s.axes,loss_warning:'Source, semantics and TASK collapsed into content only in adapter; full A-H ledger mandatory. not_applicable maps null, not true.',product_use:'proposal_only_no_product_write'};
}
export function qualify(s){validateSpecification(s);const roles=ROLES.map(r=>roleEligibility(s,r));return {rules_version:s.rules_version,content:s.content,demand_ref:{key:s.demand.key,definitionVersion:s.demand.definitionVersion},task_id:s.task_id,requested_role:s.role,versions:s.versions,axes:s.axes,evidence:s.evidence,role_candidates:s.candidate_roles??[],blocked_roles:roles.filter(r=>!r.eligible),eligible_roles:roles.filter(r=>r.eligible),additional_review:roles.flatMap(r=>r.blocked),product_mapping:supplyCrosswalk(s),public_qualified:roles.find(r=>r.role===s.role)?.eligible===true,assessment_qualified:measured.has(s.role)&&roles.find(r=>r.role===s.role)?.eligible===true,approval_scope:'declared evidence evaluation, never creates legal/human authorization'};}
export function releaseBoundary(s,r){validateSpecification(s);const expected=qualify(s);if(r.public_qualified!==expected.public_qualified||r.assessment_qualified!==expected.assessment_qualified)throw Error('Unauthorized qualification promotion');if(r.content.id!==s.content.id||r.content.revision!==s.content.revision)throw Error('Result content revision mismatch');if(!isDeepStrictEqual(r,expected))throw Error('Result contract/evidence/role drift');return true;}
function attested(s,k){const r=s.approval_evidence?.[k];return s.approvals[k]===true&&r?.kind==='actual_approval_record'&&r.verified===true&&r.authority&&r.authority!=='AI'&&r.content_id===s.content.id&&r.content_revision===s.content.revision&&r.revision&&/^[a-f0-9]{64}$/i.test(r.sha256??'');}
