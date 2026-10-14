// scripts/research/factory-learning-runtime/contracts.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { TYPES, INPUTS, SUPPORT, structure, makeActivity, validateActivity, publicSpecification } from './activity.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const digest=x=>sha(JSON.stringify(x));
const hashPattern=/^[0-9a-f]{64}$/;
export const ROLES=['source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check'];
export const FUTURE_INPUTS=['span_selection','meaning_explanation','meaning_comparison','guided_steps'];
const observed={vocab_choice:'Identify the marked contextual word that is inappropriate; no rationale response elicited.',unit_vocab:'Recognize one supplied word meaning; contextual-sense rationale not elicited.',blank_word:'Retrieve a word under the displayed cue and sentence constraints.',grammar_choice:'Identify one marked form error; attachment/scope explanation not elicited.',grammar_fix:'Write the corrected word; sentence equivalence and alternatives need review.',unit_grammar:'Select a form-correction candidate; no independent scope explanation elicited.',word_order:'Reconstruct a sentence from token occurrences; source meaning and alternative order need review.'};
const prompts={vocab_choice:'표시된 낱말 중 문맥상 적절하지 않은 것을 하나 고르세요.',grammar_choice:'표시된 낱말 중 어법상 적절하지 않은 것을 하나 고르세요.',word_order:'주어진 낱말을 모두 사용하여 문장을 배열하세요.'};
export function validateLearningContract(spec,canonicalTasks=null){
 validateActivity(spec); publicSpecification(spec);
 if(!TYPES.includes(spec.dcp_type)||spec.input.kind!==INPUTS[spec.dcp_type])throw Error('DCP type and response contract mismatch');
 if(!ROLES.includes(spec.role))throw Error('Unknown material role');
 if(!hashPattern.test(spec.source.sha256)||!hashPattern.test(spec.generated_sha256))throw Error('Invalid source/generated hash');
 if(!spec.source.id||!['article','book'].includes(spec.source.kind))throw Error('Source identity/kind missing');
 if(!spec.content.revision_kind||spec.content.revision_kind!=='sealed_observation_not_generation_revision')throw Error('Snapshot revision mislabeled');
 if(spec.series.assignment_status==='unassigned'){
  if(spec.series.id!==null||spec.series.step!==null)throw Error('Unassigned book fabricated');
  if(!spec.runtime.additional_requirements.includes('requires_book_assignment'))throw Error('Unassigned book hold absent');
 } else if(spec.series.assignment_status!=='bound'||typeof spec.series.id!=='string'||!Number.isInteger(spec.series.step)||spec.series.step<1)throw Error('Book binding invalid');
 if(spec.qualified_public!==false||spec.qualified_assessment!==false||spec.TASK.direct_mastery_evidence!==false)throw Error('Research contract promoted to qualification/mastery');
 if(spec.TASK.core!==null&&canonicalTasks&&!canonicalTasks.includes(spec.TASK.core))throw Error('Unknown core TASK');
 if(!Array.isArray(spec.TASK.support)||spec.TASK.support.some(t=>canonicalTasks&&!canonicalTasks.includes(t)))throw Error('Unknown support TASK');
 if(!spec.answer_qualification.server_secret_ref||spec.answer_qualification.status!=='requires_validation')throw Error('Unvalidated key qualification promoted');
 if(spec.scoring.method!=='requires_scoring_contract'||spec.scoring.partial_supported!==false)throw Error('Research scorer support promoted');
 if(!spec.feedback.Gold_after_final_freeze||!spec.help.assisted_label||!spec.help.hint_log_required||spec.learner_exposure.independent_evidence!==false)throw Error('Exposure/assistance boundary missing');
 if(spec.runtime.status==='supported_by_existing_runner')throw Error('Legacy runner excludes all seven types');
 if(!Array.isArray(spec.runtime.additional_requirements)||!spec.runtime.additional_requirements.includes('requires_scoring_contract')||!spec.runtime.additional_requirements.includes('requires_qualification'))throw Error('Multiple runtime holds omitted');
 if(['choice','marked_selection'].includes(spec.input.kind)){
  const opts=spec.presentation.options;if(!Array.isArray(opts)||opts.length<2||opts.length!==spec.input.actual_choice_count||new Set(opts.map(x=>x.id)).size!==opts.length)throw Error('Actual choices mismatched or padded');
 }else if(spec.input.actual_choice_count!==null||spec.presentation.options.length)throw Error('Non-choice response given choices');
 if(spec.input.kind==='token_order'){
  const b=spec.presentation.stimulus.bank;if(!Array.isArray(b)||!b.length||b.length!==spec.input.token_ids.length||new Set(b.map(x=>x.id)).size!==b.length||b.some((x,i)=>x.id!==spec.input.token_ids[i]))throw Error('Token occurrence identity mismatch');
 }
 return true;
}
export function conservativeReview(author,independent){
 const B={author:author.axes.B.state,independent:independent.axes.B_meaning};
 const E={author:author.axes.E.state,independent:independent.axes.E_key_explanation};
 return {B,E,disagreement:B.author!==B.independent||E.author!==E.independent,
 content_repair_required:[B.author,B.independent,E.author,E.independent].includes('fail'),
 author_and_independent_B_E_pass:[B.author,B.independent,E.author,E.independent].every(x=>x==='pass'),
 policy:'Any fail requires repair; unknown or disagreement retained. This is a conservative requirement union, not adjudication or original relabeling.'};
}
export function deriveContracts(packet,author,independent,references,canonicalTasks){
 const privateSpecs=[],metadata=[];
 for(const row of packet.items){
  const a=author.items.find(x=>x.id===row.sample_id),b=independent.items.find(x=>x.sample_id===row.sample_id);
  if(!a||!b||b.item_id!==row.item.id||b.item_sha256!==row.item_sha256||b.source_sha256!==row.source_sha256)throw Error('Review or immutable source binding missing');
  const measured=structure(row.item);if(!measured.valid)throw Error('Structure hold '+row.sample_id+': '+measured.errors.join(','));
  const review=conservativeReview(a,b);
  const spec=makeActivity(row.item,{revision:'FQR1-sealed-snapshot:'+row.item_sha256,
   source_id:row.source.id,source_revision:null,source_sha256:row.source_sha256,historical_generation_revision:row.generation_revision,
   series:{id:null,step:null,assignment_status:'unassigned'},core_TASK:null,support_TASKs:[],observed_performance:observed[row.item.type],
   missing_direct_evidence:['No bound TASK/role demand; no actual learner response or validated direct rubric.'],educational_purpose:'Constrained guided-practice candidate; repair/qualification holds preserved.',
   role:'guided_practice',explicit_prompt:prompts[row.item.type],secret_ref:'private_item_key:'+row.item.id+':'+row.item_sha256,
   explanation_ref:'private_stored_explanation:'+row.item.id+':'+row.item_sha256,
   FQ_ref:{author:references.author,independent:references.independent,sample_id:row.sample_id},normalization_policy_ref:null});
  spec.content.revision_kind='sealed_observation_not_generation_revision';spec.source.kind=row.item.kind;
  spec.generated_stimulus_sha256=digest(row.item.payload);spec.runtime.additional_requirements.push('requires_book_assignment');
  if(review.content_repair_required)spec.runtime.additional_requirements.push('requires_content_repair');
  spec.review_requirements=review;validateLearningContract(spec,canonicalTasks);privateSpecs.push(spec);
  metadata.push({sample_id:row.sample_id,content:spec.content,source:spec.source,generated_sha256:spec.generated_sha256,generated_stimulus_sha256:spec.generated_stimulus_sha256,
   specification_sha256:digest(spec),dcp_type:spec.dcp_type,input:{kind:spec.input.kind,actual_choice_count:spec.input.actual_choice_count,id_basis:spec.input.id_basis},
   series:spec.series,TASK:spec.TASK,role:spec.role,review_requirements:review,runtime:spec.runtime,scoring:spec.scoring,
   response_keys:spec.input.kind==='token_order'?['token_ids']:spec.input.kind==='short_text'?['text']:['option_id'],
   public_qualified:false,assessment_qualified:false,legacy_RPC_supported:false,prototype_scope:'Research proposed reference comparison only; no production server scorer or learner execution.'});
 }
 return {privateSpecs,metadata};
}
export function buildSchema(canonicalTasks){
 const str={type:'string',minLength:1},nullableStr={type:['string','null']},h={type:'string',pattern:'^[0-9a-f]{64}$'},strings={type:'array',items:str};
 const obj=(required,properties)=>({type:'object',required,properties,additionalProperties:true});
 const task={anyOf:[{enum:canonicalTasks},{type:'null'}]};
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:vocaflow:research:FQR1:LearningActivitySpecification:1',title:'FQR1 research LearningActivitySpecification; schema validation is not release or assessment authorization',
  ...obj(['schema_version','content','source','generated_sha256','series','dcp_type','TASK','purpose','role','presentation','input','answer_qualification','scoring','feedback','help','learner_exposure','runtime','FQ','qualified_public','qualified_assessment'],{
   schema_version:{const:'FQR1-LearningActivitySpecification-1'},content:obj(['id','revision','revision_kind'],{id:str,revision:str,revision_kind:{const:'sealed_observation_not_generation_revision'}}),
   source:obj(['id','kind','revision','sha256','historical_generation_revision'],{id:str,kind:{enum:['article','book']},revision:nullableStr,sha256:h,historical_generation_revision:nullableStr}),generated_sha256:h,generated_stimulus_sha256:h,
   series:obj(['id','step','assignment_status'],{id:nullableStr,step:{type:['integer','null'],minimum:1},assignment_status:{enum:['bound','unassigned']}}),
   dcp_type:{enum:TYPES},TASK:obj(['core','support','observed_performance','missing_direct_evidence','direct_mastery_evidence'],{core:task,support:{type:'array',items:{enum:canonicalTasks}},observed_performance:str,missing_direct_evidence:strings,direct_mastery_evidence:{const:false}}),
   purpose:str,role:{enum:ROLES},presentation:obj(['stimulus','prompt','options','required_output_ids'],{stimulus:{type:'object'},prompt:str,options:{type:'array',items:obj(['id','label','text'],{id:str,label:str,text:str})},required_output_ids:{type:'array',minItems:1,uniqueItems:true,items:str}}),
   input:obj(['kind','id_basis','token_ids','actual_choice_count'],{kind:{enum:[...new Set(Object.values(INPUTS))]},id_basis:str,token_ids:{type:'array',uniqueItems:true,items:str},actual_choice_count:{type:['integer','null'],minimum:2}}),
   answer_qualification:obj(['server_secret_ref','status','accepted_alternatives'],{server_secret_ref:str,status:{const:'requires_validation'},accepted_alternatives:{const:'explicit_versioned_only'}}),
   scoring:obj(['method','required_output_ids','partial_supported','normalization_policy_ref'],{method:{const:'requires_scoring_contract'},required_output_ids:strings,partial_supported:{const:false},normalization_policy_ref:nullableStr}),
   feedback:obj(['explanation_ref','Gold_after_final_freeze','required_output_ids','completeness_status'],{explanation_ref:nullableStr,Gold_after_final_freeze:{const:true},required_output_ids:strings,completeness_status:{const:'requires_content_review'}}),
   help:obj(['assisted_label','hint_log_required','original_question_cue_present','optional_added_hint_requires_review'],{assisted_label:{const:true},hint_log_required:{const:true},original_question_cue_present:{type:'boolean'},optional_added_hint_requires_review:{const:true}}),
   learner_exposure:obj(['server_supply_time_required','independent_evidence'],{server_supply_time_required:{const:true},independent_evidence:{const:false}}),
   runtime:obj(['status','additional_requirements'],{status:{enum:SUPPORT.filter(x=>x!=='supported_by_existing_runner')},additional_requirements:strings}),FQ:obj(['reference','state'],{reference:{type:['object','null']},state:{const:'requires_qualification'}}),qualified_public:{const:false},qualified_assessment:{const:false}
  }),allOf:TYPES.map(t=>({if:{properties:{dcp_type:{const:t}}},then:{properties:{input:{properties:{kind:{const:INPUTS[t]}}}}}})),
  'x-future-input-contracts':FUTURE_INPUTS,'x-future-input-status':'Not implemented or admitted by current schema: requires new input and validated scoring contract.',
  'x-additional-semantic-validator':'validateLearningContract enforces output agreement, key secrecy, original cardinality, unknown book hold, source binding and non-promotion. JSON schema alone is insufficient.'};
}
const own=path.resolve('scripts/research/factory-learning-runtime'),data=path.resolve('docs/research/factory-learning-runtime/data');
export function runContracts(mode){
 const paths={packet:path.join(own,'local/sample-content-first.json'),author:path.join(data,'content-review.json'),independent:path.join(data,'independent-content-review.json')};
 const refs=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,{path:p.replace(process.cwd()+path.sep,''),sha256:sha(fs.readFileSync(p))}]));
 const vals=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,JSON.parse(fs.readFileSync(p,'utf8'))]));
 const codebook=fs.readFileSync(path.join(own,'local/code-audit-snapshots/apps/web/src/lib/csat/map/v4/definition.data.ts'),'utf8');
 const code=JSON.parse(codebook.slice(codebook.indexOf('{',codebook.indexOf('export const V4_DATA'))));const tasks=code.tasks.map(t=>t.id);
 const schema=buildSchema(tasks),derived=deriveContracts(vals.packet,vals.author,vals.independent,refs,tasks);
 const privateFile=path.join(own,'local/activity-specifications-first.json'),publicFile=path.join(data,'runtime-contracts.json'),schemaFile=path.join(data,'learning-activity.schema.json');
 const privatePacket={version:'FQR1-derived-learning-activity-first',references:refs,specifications:derived.privateSpecs,actual_generation_revision_count:0,public_qualified:0,assessment_qualified:0,actual_learner_runs:0};
 const privateBytes=JSON.stringify(privatePacket,null,2)+'\n';
 const metadata={version:'FQR1-runtime-contracts1',references:refs,private_specification_sha256:sha(privateBytes),schema_sha256:sha(JSON.stringify(schema,null,2)+'\n'),canonical_codebook_version:code.version,canonical_TASK_count:tasks.length,
  actual_content_count:derived.metadata.length,structural_valid_count:derived.metadata.length,semantic_approval_claim:false,items:derived.metadata,
  counts:{requires_runner_adapter:derived.metadata.length,requires_scoring_contract:derived.metadata.length,requires_qualification:derived.metadata.length,requires_book_assignment:derived.metadata.length,
   requires_content_repair:derived.metadata.filter(x=>x.review_requirements.content_repair_required).length,author_and_independent_B_E_pass:derived.metadata.filter(x=>x.review_requirements.author_and_independent_B_E_pass).length,
   B_or_E_disagreement:derived.metadata.filter(x=>x.review_requirements.disagreement).length,existing_runner_supported:0,existing_scoring_supported:0,public_qualified:0,assessment_qualified:0,human_validation:0,student_validation:0,product_application:0},
  denominator_warning:'14 newly sampled unique DCP contents; multiple requirements overlap, no role/test/student denominator merge.'};
 if(mode==='write'){
  for(const p of [privateFile,publicFile,schemaFile])if(fs.existsSync(p))throw Error('Sealed derived output exists '+p);
  fs.writeFileSync(privateFile,privateBytes);fs.writeFileSync(publicFile,JSON.stringify(metadata,null,2)+'\n');fs.writeFileSync(schemaFile,JSON.stringify(schema,null,2)+'\n');
 }else{
  if(fs.readFileSync(privateFile,'utf8')!==privateBytes||fs.readFileSync(publicFile,'utf8')!==JSON.stringify(metadata,null,2)+'\n'||fs.readFileSync(schemaFile,'utf8')!==JSON.stringify(schema,null,2)+'\n')throw Error('Derived contract drift');
 }
 return {mode,private_specification_sha256:metadata.private_specification_sha256,counts:metadata.counts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){console.log(JSON.stringify(runContracts(process.argv.includes('--write')?'write':'check')));}
