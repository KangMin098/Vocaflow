// scripts/research/factory-learning-runtime/activity.mjs
import crypto from 'node:crypto';
export const TYPES=['vocab_choice','unit_vocab','blank_word','grammar_choice','grammar_fix','unit_grammar','word_order'];
export const INPUTS={vocab_choice:'marked_selection',grammar_choice:'marked_selection',unit_vocab:'choice',unit_grammar:'choice',blank_word:'short_text',grammar_fix:'short_text',word_order:'token_order'};
export const SUPPORT=['supported_by_existing_runner','requires_runner_adapter','requires_new_input_contract','requires_scoring_contract','requires_content_repair','requires_qualification','unsupported'];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const text=x=>typeof x==='string'&&x.trim().length>0;
const list=x=>Array.isArray(x)&&x.length>0&&x.every(text);
const selected=new Set(['vocab_choice','grammar_choice','unit_vocab','unit_grammar']);
export function structure(item){
 const errors=[],p=item.payload??{},k=item.answer_key??{},t=item.type;
 const fail=x=>errors.push(x);
 if(!TYPES.includes(t))return {valid:false,errors:['unsupported_type'],input_kind:null};
 if(['vocab_choice','grammar_choice','unit_vocab','unit_grammar'].includes(t)&&!list(p.sentences))fail('sentences_missing');
 if(['unit_vocab','unit_grammar'].includes(t)){
  if(!Array.isArray(p.choices)||p.choices.length<2||p.choices.some(c=>!text(c.label)||!text(c.text)))fail('choices_missing_or_malformed');
  else if(new Set(p.choices.map(c=>c.label)).size!==p.choices.length)fail('choice_labels_duplicate');
  if(!text(p.prompt_ko))fail('prompt_missing');
  if(!Number.isInteger(k.answer)||k.answer<1||k.answer>(p.choices?.length??0))fail('answer_position_invalid');
 }
 if(['vocab_choice','grammar_choice'].includes(t)){
  if(!Array.isArray(p.underlines)||p.underlines.length<2)fail('underlines_missing');
  else{const labels=[];for(const u of p.underlines){labels.push(u.label);if(!text(u.label)||!text(u.word)||!Number.isInteger(u.sentenceIdx)||u.sentenceIdx<0||u.sentenceIdx>=(p.sentences?.length??0))fail('underline_invalid');if(t==='grammar_choice'&&(!Number.isInteger(u.tokenIdx)||u.tokenIdx<0))fail('token_address_missing');}if(new Set(labels).size!==labels.length)fail('underline_labels_duplicate');}
  if(!Number.isInteger(k.position)||k.position<1||k.position>(p.underlines?.length??0))fail('answer_position_invalid');
  if(!text(k.original))fail('source_restoration_missing');
 }
 if(['blank_word','grammar_fix'].includes(t)){
  if(!text(p.stem)||!text(p.prompt_ko)||!Number.isInteger(p.sentence_idx)||p.sentence_idx<0)fail('short_text_stimulus_invalid');
  if(!text(k.text))fail('short_text_key_missing');
  // hint/context may be null in actual grammar_fix rows, not malformed by themselves.
  for(const name of ['hint','context'])if(p[name]!==null&&p[name]!==undefined&&typeof p[name]!=='string')fail(name+'_invalid');
 }
 if(t==='word_order'){
  if(!list(p.bank)||!Number.isInteger(p.sentence_idx)||p.sentence_idx<0)fail('bank_invalid');
  if(!text(k.sentence))fail('sentence_key_missing');
 }
 return {valid:errors.length===0,errors,input_kind:INPUTS[t],actual_choice_count:selected.has(t)?(p.choices?.length??p.underlines?.length??0):null,scope:'Field/reference shape only; no meaning, key uniqueness, rights or runtime approval.'};
}
export function makeActivity(item,metadata){
 const result=structure(item);if(!result.valid)throw Error('Content structure hold: '+result.errors.join(','));
 if(!metadata?.revision||!metadata.source_sha256||!metadata.series||(metadata.series.assignment_status!=='unassigned'&&(!metadata.series.id||!Number.isInteger(metadata.series.step))))throw Error('Activity binding missing');
 const p=item.payload,t=item.type;
 const presentation={stimulus:t==='word_order'?{bank:p.bank.map((value,index)=>({id:'token:'+index,text:value})),context:p.context??null}:INPUTS[t]==='short_text'?{stem:p.stem,context:p.context??null,hint:p.hint??null}:{sentences:p.sentences,underlines:p.underlines??[]},prompt:p.prompt_ko??metadata.explicit_prompt??null,options:selected.has(t)?(p.choices??p.underlines).map((x,index)=>({id:'option:'+index,label:x.label,text:x.text??x.word})):[],required_output_ids:['primary_response']};
 if(!text(presentation.prompt))throw Error('Student prompt must be explicit in adapter');
 return {schema_version:'FQR1-LearningActivitySpecification-1',content:{id:item.id,revision:metadata.revision},source:{id:metadata.source_id,revision:metadata.source_revision??null,sha256:metadata.source_sha256,historical_generation_revision:metadata.historical_generation_revision??null},generated_sha256:hash(item),series:metadata.series,dcp_type:t,TASK:{core:metadata.core_TASK??null,support:metadata.support_TASKs??[],observed_performance:metadata.observed_performance,missing_direct_evidence:metadata.missing_direct_evidence??[],direct_mastery_evidence:false},purpose:metadata.educational_purpose,role:metadata.role??'guided_practice',presentation,input:{kind:INPUTS[t],id_basis:INPUTS[t]==='token_order'?'bank_occurrence_index':selected.has(t)?'one_based_key_to_zero_based_option_id':'text',token_ids:INPUTS[t]==='token_order'?presentation.stimulus.bank.map(x=>x.id):[],actual_choice_count:result.actual_choice_count},answer_qualification:{server_secret_ref:metadata.secret_ref,status:'requires_validation',accepted_alternatives:'explicit_versioned_only'},scoring:{method:'requires_scoring_contract',required_output_ids:['primary_response'],partial_supported:false,normalization_policy_ref:metadata.normalization_policy_ref??null},feedback:{explanation_ref:metadata.explanation_ref??null,Gold_after_final_freeze:true,required_output_ids:['primary_response'],completeness_status:'requires_content_review'},help:{assisted_label:true,hint_log_required:true,original_question_cue_present:text(p.hint),optional_added_hint_requires_review:true},learner_exposure:{server_supply_time_required:true,independent_evidence:false},runtime:{status:'requires_runner_adapter',additional_requirements:[...(t==='word_order'?['requires_new_input_contract']:[]),'requires_scoring_contract','requires_qualification']},FQ:{reference:metadata.FQ_ref??null,state:'requires_qualification'},qualified_public:false,qualified_assessment:false};
}
export function validateActivity(spec){
 if(spec.schema_version!=='FQR1-LearningActivitySpecification-1'||!spec.content?.id||!spec.content?.revision||!spec.source?.sha256||!spec.generated_sha256||!spec.series||!spec.TASK||!spec.purpose||!spec.role||!spec.input||!SUPPORT.includes(spec.runtime?.status)||!spec.FQ||!spec.help||!spec.learner_exposure)throw Error('Activity fields/bindings missing');
 if(!TYPES.includes(spec.dcp_type)||spec.input.kind!==INPUTS[spec.dcp_type])throw Error('Type/input mismatch');
 if(spec.input.kind==='token_order'){
  const bank=spec.presentation?.stimulus?.bank,ids=spec.input.token_ids;
  if(!Array.isArray(bank)||!bank.length||bank.some(x=>!text(x.id)||!text(x.text))||new Set(bank.map(x=>x.id)).size!==bank.length||!Array.isArray(ids)||ids.length!==bank.length||new Set(ids).size!==ids.length||ids.some(id=>!bank.some(x=>x.id===id)))throw Error('Token presentation binding invalid');
 }
 if(['choice','marked_selection'].includes(spec.input.kind)){
  const options=spec.presentation?.options;
  if(!Array.isArray(options)||options.length<2||options.some(x=>!text(x.id))||new Set(options.map(x=>x.id)).size!==options.length)throw Error('Option binding invalid');
 }
 publicSpecification(spec);
 const allowed=spec.presentation?.required_output_ids;if(!Array.isArray(allowed)||!allowed.length)throw Error('Student outputs absent');
 for(const outputs of [spec.scoring?.required_output_ids,spec.feedback?.required_output_ids])if(!Array.isArray(outputs)||outputs.some(id=>!allowed.includes(id)))throw Error('Unrequested required output');
 return true;
}
function result(outcome,error_code=null){return {schema_version:'FQR1-GradeResult-1',outcome,operation_status:error_code==='unsupported_rpc_type'?'unsupported':outcome==='scoring_error'?'failed':outcome==='defer'?'deferred':'scored',error_code,item_level_correct:outcome==='correct'?true:outcome==='incorrect'?false:null,record_as_incorrect:outcome==='incorrect',graded_attempt_allowed:['correct','incorrect','partial'].includes(outcome),TASK_mastery_evidence:false,scope:'Reference-only prototype; no DB scoring/attempt called'};}
export function evaluateResponse(spec,response,secret,server){
 try{validateActivity(spec);}catch{return result('scoring_error','invalid_activity_contract');}
 if(server?.boundary!=='research_test_scoring_context')return result('scoring_error','unverified_scoring_boundary');
 if(server.route==='existing_rpc'&&(TYPES.includes(spec.dcp_type)||!server.supported_types?.includes(spec.dcp_type)))return result('scoring_error','unsupported_rpc_type');
 if(server.route!=='existing_rpc'&&server.route!=='proposed_reference_comparison')return result('scoring_error','scorer_not_bound');
 if(secret?.content_id!==spec.content.id||secret?.content_revision!==spec.content.revision||secret?.generated_sha256!==spec.generated_sha256)return result('scoring_error','key_revision_mismatch');
 if(server.content_review!=='pass')return result('scoring_error','content_quality_hold');
 if(response===null||response===undefined)return result('defer','response_unobserved');
 if(['choice','marked_selection'].includes(spec.input.kind)){
  if(!text(secret.expected_option_id)||!spec.presentation.options.some(x=>x.id===secret.expected_option_id))return result('scoring_error','key_option_missing');
  if(!text(response.option_id)||!spec.presentation.options.some(x=>x.id===response.option_id))return result('scoring_error','invalid_response_option');
  if(secret.uniqueness_review!=='pass')return result('defer','key_uniqueness_unverified');
  return result(response.option_id===secret.expected_option_id?'correct':'incorrect');
 }
 if(spec.input.kind==='short_text'){
  if(typeof response.text!=='string')return result('scoring_error','invalid_text_response');
  if(!response.text.trim())return result('defer','response_unobserved');
  if(!list(secret.accepted_texts)||!secret.normalization_policy)return result('scoring_error','accepted_forms_missing');
  const n=x=>{let v=x.normalize('NFC');if(secret.normalization_policy.trim===true)v=v.trim();if(secret.normalization_policy.case_sensitive===false)v=v.toLowerCase();return v;};
  if(secret.accepted_texts.some(x=>n(x)===n(response.text)))return result('correct');
  return secret.acceptance_set_exhaustive===true?result('incorrect'):result('defer','unregistered_alternative_requires_adjudication');
 }
 if(spec.input.kind==='token_order'){
  const ids=response.token_ids,bank=spec.input.token_ids;
  if(!Array.isArray(ids)||ids.length!==bank.length||new Set(ids).size!==bank.length||ids.some(id=>!bank.includes(id)))return result('scoring_error','incomplete_or_invalid_permutation');
  if(!Array.isArray(secret.accepted_sequences)||!secret.accepted_sequences.length)return result('scoring_error','sequence_Gold_missing');
  for(const sequence of secret.accepted_sequences)if(!Array.isArray(sequence)||sequence.length!==bank.length||new Set(sequence).size!==bank.length||sequence.some(id=>!bank.includes(id)))return result('scoring_error','sequence_Gold_invalid');
  const values=new Map(spec.presentation.stimulus.bank.map(x=>[x.id,x.text]));
  if(secret.accepted_sequences.some(x=>x.every((id,i)=>values.get(id)===values.get(ids[i]))))return result('correct');
  return secret.acceptance_set_exhaustive===true?result('incorrect'):result('defer','alternate_order_requires_adjudication');
 }
 return result('defer','semantic_explanation_requires_human_or_validated_scorer');
}
export function validateExistingRpcReply(reply){
 if(reply?.error||(reply?.ok!==undefined&&reply.ok!==true)||reply?.data?.error||(reply?.data?.ok!==undefined&&reply.data.ok!==true))return result('scoring_error','RPC_failed');
 const data=reply?.data;if(!data||typeof data.correct!=='boolean')return result('scoring_error','RPC_malformed');
 return result(data.correct?'correct':'incorrect');
}
export function validateExistingActionReply(reply){if(reply?.ok!==true||typeof reply.correct!=='boolean')return result('scoring_error','Action_failed_or_malformed');return result(reply.correct?'correct':'incorrect');}
export function feedbackSequence(events,role='guided_practice'){
 let first=false,frozen=false,assisted=false,feedback=false;const errors=[];
 for(const event of events){if(event==='first_response'){if(first)errors.push('duplicate_first_response');first=true;}else if(event==='hint'){if(!first||frozen)errors.push('hint_out_of_order');assisted=true;}else if(event==='revised_response'){if(!first||frozen)errors.push('revision_out_of_order');}else if(event==='final_freeze'){if(!first)errors.push('freeze_before_response');frozen=true;}else if(event==='feedback'){if(!frozen)errors.push('Gold_before_final_freeze');feedback=true;}else if(event==='evidence_explanation_after_feedback'){if(!feedback)errors.push('explanation_before_feedback_stage');assisted=true;}else if(event!=='return')errors.push('unknown_event');}
 if(role==='independent_check'&&assisted)errors.push('assistance_not_independent');
 return {valid:!errors.length,errors,assisted,TASK_mastery_evidence:false,scope:'Event-order contract only; real exposure/first-freeze must be server observed'};
}
const publicObjectFields={"":["schema_version","content","source","generated_sha256","series","dcp_type","TASK","purpose","role","presentation","input","answer_qualification","scoring","feedback","help","learner_exposure","runtime","FQ","qualified_public","qualified_assessment","generated_stimulus_sha256","review_requirements"],"content":["id","revision","revision_kind"],"source":["id","revision","sha256","historical_generation_revision","kind"],"series":["id","step","assignment_status"],"TASK":["core","support","observed_performance","missing_direct_evidence","direct_mastery_evidence"],"presentation":["stimulus","prompt","options","required_output_ids"],"presentation.stimulus":["sentences","underlines","stem","context","hint","bank"],"presentation.stimulus.underlines[]":["word","label","sentenceIdx","tokenIdx"],"presentation.options[]":["id","label","text"],"input":["kind","id_basis","token_ids","actual_choice_count"],"answer_qualification":["server_secret_ref","status","accepted_alternatives"],"scoring":["method","required_output_ids","partial_supported","normalization_policy_ref"],"feedback":["explanation_ref","Gold_after_final_freeze","required_output_ids","completeness_status"],"help":["assisted_label","hint_log_required","original_question_cue_present","optional_added_hint_requires_review"],"learner_exposure":["server_supply_time_required","independent_evidence"],"runtime":["status","additional_requirements"],"FQ":["reference","state"],"FQ.reference":["author","independent","sample_id"],"FQ.reference.author":["path","sha256"],"FQ.reference.independent":["path","sha256"],"review_requirements":["B","E","disagreement","content_repair_required","author_and_independent_B_E_pass","policy"],"review_requirements.B":["author","independent"],"review_requirements.E":["author","independent"],"presentation.stimulus.bank[]":["id","text"]};
export function publicSpecification(spec){const allowed=['schema_version','content','source','generated_sha256','generated_stimulus_sha256','series','dcp_type','TASK','purpose','role','presentation','input','answer_qualification','scoring','feedback','help','learner_exposure','runtime','FQ','qualified_public','qualified_assessment','review_requirements'];if(Object.keys(spec).some(k=>!allowed.includes(k)))throw Error('Unknown public field');const forbidden=['answer_key','expected_option_id','accepted_texts','accepted_sequences','answer','gold','explanation_ko','expected_sentence'];const visit=(v,p='')=>{if(Array.isArray(v)){for(const x of v)visit(x,p+'[]');return;}if(v&&typeof v==='object'){const fields=publicObjectFields[p];if(!fields||Object.keys(v).some(k=>!fields.includes(k)))throw Error('Unknown nested public field; possible scoring secret');for(const[k,x]of Object.entries(v)){if(forbidden.includes(k.toLowerCase()))throw Error('Scoring secret in presentation');visit(x,p?p+'.'+k:k);}}};visit(spec);return spec;}
