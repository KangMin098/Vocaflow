// packages/library-pipeline/src/textbook/educational-validation-v2.ts
import { z } from 'zod'
import { researchBodyHash } from '../ingest-article/research-origin'
import { canonicalJson } from './review-digest'
import { validationBundleSchema, validationProtocolSchema, SEMANTIC_CRITERIA, semanticDimensions, studentSessionSchema } from './educational-validation'

const id=z.string().trim().min(2), hash=z.string().regex(/^[a-f0-9]{64}$/), date=z.string().datetime({offset:true}), reason=z.string().trim().min(12)
const grade=z.enum(['middle_1','high_1'])
const legacy=validationBundleSchema.innerType().shape
const range=validationProtocolSchema.innerType().shape.ranges.element
export const METRIC_KEYS=['reading_seconds','comprehension_accuracy','lexical_accuracy','syntax_accuracy','reasoning_accuracy','unknown_word_fraction','lexical_burden','sentence_burden','reasoning_burden','perceived_difficulty'] as const
const nullableRange=range.extend(Object.fromEntries(METRIC_KEYS.map(k=>[k,range.shape[k].nullable()])) as { [K in typeof METRIC_KEYS[number]]: z.ZodNullable<typeof range.shape[K]> })
export const protocolV2Schema=z.object({
  version:z.literal(2), description:reason, study_purpose:z.enum(['calibration','validation','replication']),
  scale_points:z.literal(4), minimum_item_score:z.literal(3), minimum_experts:z.literal(2),
  score_anchors:z.array(reason).length(4),
  minimum_students_per_variant:z.number().int().min(15).max(30), minimum_students_per_grade:z.number().int().min(15).max(30),
  minimum_items_per_axis:z.number().int().min(3), ranges:z.array(nullableRange).length(2),
  band_rationale: z.object({middle_1:reason.nullable(),high_1:reason.nullable()}).strict(),
  operations:reason.nullable(), expert_reuse_allowed:z.boolean(), failed_passage_policy:z.literal('skip_only_after_completed_failure'),
}).strict().refine(p=>new Set(p.ranges.map(r=>r.grade)).size===2,'Both grades required')
const rating=z.object({score:z.number().int().min(1).max(4).nullable(),critical:z.boolean().nullable(),passage_quote:z.string().min(8).nullable(),research_quote:z.string().min(8).nullable(),reason:reason.nullable()}).strict()
const ratings=z.object(Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,rating])) as Record<typeof SEMANTIC_CRITERIA[number],typeof rating>).strict()
const distortions=z.array(legacy.records.element.shape.expert_reviews.element.shape.distortions.element.extend({severity:z.enum(['major','minor'])}).strict())
export const ordinalReviewSchema=z.object({expert_id:id,blind_item_id:id,passage_hash:hash,packet_hash:hash,rated_at:date,ratings,
  distortions,reason}).strict()
export const adjudicationV2Schema=z.object({
  adjudicator_id:id, initial_review_hashes:z.array(hash).length(2), adjudicator_independent_review_hash:hash,
  initial_reviews_disclosed_at:date, adjudicated_at:date, item_resolution:ratings,
  final_distortions:distortions,
  unresolved_items:z.array(z.enum(SEMANTIC_CRITERIA)), evidence_and_reason:reason,
}).strict()
const expert=legacy.experts.element.extend({screened_at:date,screened_by:id,prior_exposure:z.array(z.string().min(1)),blind_eligible:z.literal(true),screening_evidence:reason})
const exclusion=z.object({study_id:id, file_hash:hash,manifest_hash:hash,completed_at:date,
  source_ids:z.array(z.string().uuid()).min(1),research_dois:z.array(z.string().min(1)).min(1),
  passage_hashes:z.array(hash).min(1),student_ids:z.array(id),expert_ids:z.array(id),evidence:reason}).strict()
export const bundleV2Schema=z.object({
  version:z.literal(2),mode:z.literal('local_educational_validation'),taxonomy_version:z.literal(1),study_id:id,
  pilot_hash:hash,review_hash:hash,rules_hash:hash,protocol_hash:hash,instrument_hash:hash,
  protocol:protocolV2Schema, experts:z.array(expert),
  participants:z.array(z.object({student_id:id,grade,grade_verified_by:id,record_order:z.array(id).min(1)}).strict()),
  calibration_exclusions:z.array(exclusion),
  protocol_approval:z.object({human_lead_id:id,approved_at:date,manifest_hash:hash,registration_evidence:reason}).strict().nullable(),
  records:z.array(legacy.records.element.omit({expert_reviews:true}).extend({
    research_doi:z.string().min(1),research_contexts:z.array(z.string().min(8)).min(1),adapted_passage:z.string().min(8),topic:id,source_family:id,
    expert_assignment:z.object({initial_expert_ids:z.array(id).length(2),adjudicator_id:id}).strict().nullable(),
    expert_reviews:z.array(ordinalReviewSchema),adjudication:adjudicationV2Schema.nullable(),
    student_sessions:z.array(studentSessionSchema.extend({packet_hash:hash}).strict()),
  }).strict()).min(1),
}).strict().superRefine((b,ctx)=>{
  const unique=(xs:string[],label:string)=>{if(new Set(xs).size!==xs.length)ctx.addIssue({code:'custom',message:`Duplicate ${label}`})}
  unique(b.experts.map(e=>e.id),'experts');unique(b.participants.map(p=>p.student_id),'participants')
  unique(b.records.map(r=>r.id),'records');unique(b.records.map(r=>r.blind_item_id),'blind IDs')
  unique(b.records.map(r=>`${r.source_id.toLowerCase()}:${r.target_key}`),'source targets')
  const seen=new Set<string>()
  for(const r of b.records){
    unique(r.expert_reviews.map(e=>e.expert_id),'reviews');unique(r.instrument.map(i=>i.id),'items')
    for(const s of r.student_sessions){const key=`${r.pair_id}:${s.student_id}`;if(seen.has(key))ctx.addIssue({code:'custom',message:'Repeated student/pair'});seen.add(key)}
  }
  for(const p of b.participants){unique(p.record_order,'assignment order');if(p.record_order.length!==b.records.filter(r=>r.grade===p.grade).length||p.record_order.some(rid=>!b.records.some(r=>r.id===rid&&r.grade===p.grade)))ctx.addIssue({code:'custom',message:'Incomplete or wrong-grade student assignment'})}
})
export type BundleV2=z.infer<typeof bundleV2Schema>
export type RecordV2=BundleV2['records'][number]
export const digestV2=(value:unknown)=>researchBodyHash(canonicalJson(value))
export function instrumentIdentityV2(records:RecordV2[]){return records.map(({expert_reviews: _e,student_sessions:_s,adjudication:_a,provenance_verified:_p,link_confidence:_l,...frozen})=>frozen)}
export function manifestIdentityV2(b:BundleV2){return {version:2,study_id:b.study_id,taxonomy_version:b.taxonomy_version,pilot_hash:b.pilot_hash,review_hash:b.review_hash,rules_hash:b.rules_hash,protocol:b.protocol,records:instrumentIdentityV2(b.records),experts:b.experts,participants:b.participants,calibration_exclusions:b.calibration_exclusions}}
export function deliveryPacketV2(b:BundleV2,r:RecordV2,role:'expert'|'student'){
  const manifest_hash=digestV2(manifestIdentityV2(b))
  const payload=role==='expert'?{blind_item_id:r.blind_item_id,passage_hash:r.passage_hash,instructions:'Independently rate all eight criteria against the original research. Flag critical failures separately. The third reviewer rates before disclosure of initial reviews. Target grade, producer and prior outcomes are withheld.',original_research_context:r.research_contexts,adapted_passage:r.adapted_passage,criteria:SEMANTIC_CRITERIA,score_anchors:b.protocol.score_anchors}:{blind_item_id:r.blind_item_id,passage_hash:r.passage_hash,instructions:'Read first and record reading start/end before answering. Mark unknown word occurrences. Answer in Korean or English. Do not access scoring rubrics.',passage:r.adapted_passage,questions:r.instrument.map(({id,axis,prompt})=>({id,axis,prompt}))}
  const packet_hash=digestV2({manifest_hash,role,payload})
  const response=role==='expert'?{expert_id:null,blind_item_id:r.blind_item_id,passage_hash:r.passage_hash,packet_hash,rated_at:null,ratings:Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,{score:null,critical:null,passage_quote:null,research_quote:null,reason:null}])),distortions:[],reason:null}:{student_id:null,blind_item_id:r.blind_item_id,passage_hash:r.passage_hash,packet_hash,reading_started_at:null,reading_finished_at:null,unknown_word_count:null,lexical_burden:null,sentence_burden:null,reasoning_burden:null,perceived_difficulty:null,answers:r.instrument.map(i=>({item_id:i.id,response:null}))}
  return {version:2,manifest_hash,packet_hash,payload,response}
}
export function refreshV2Hashes(b:BundleV2){b.protocol_hash=digestV2(b.protocol);b.instrument_hash=digestV2(instrumentIdentityV2(b.records));return b}
const core=new Set<typeof SEMANTIC_CRITERIA[number]>(['core_claim','causal_direction','comparison_relation','conditions_and_scope','no_key_omission','no_epistemic_overstatement'])
const complete=(x:z.infer<typeof ratings>)=>SEMANTIC_CRITERIA.every(k=>Object.values(x[k]).every(v=>v!==null))
const passed=(x:z.infer<typeof ratings>)=>complete(x)&&SEMANTIC_CRITERIA.every(k=>x[k].score!>=3&&!x[k].critical)
const critical=(x:z.infer<typeof ratings>)=>SEMANTIC_CRITERIA.some(k=>core.has(k)&&x[k].critical===true)
function evidenceValid(r:RecordV2,x:z.infer<typeof ratings>,passage:string){return SEMANTIC_CRITERIA.every(k=>x[k].passage_quote!==null&&passage.includes(x[k].passage_quote!)&&x[k].research_quote!==null&&r.research_contexts.some(c=>c.includes(x[k].research_quote!)))}
export function studentBindingV2(b:BundleV2,r:RecordV2,s:z.infer<typeof studentSessionSchema>&{packet_hash:string},passage:string,now:number,passages:Record<string,string>={}){
  if(s.packet_hash!==deliveryPacketV2(b,r,'student').packet_hash)return false
  const a=b.protocol_approval,p=b.participants.find(p=>p.student_id===s.student_id),start=s.reading_started_at===null?null:Date.parse(s.reading_started_at),end=s.reading_finished_at===null?null:Date.parse(s.reading_finished_at)
  if(!a||!p||p.grade!==r.grade||!p.record_order.includes(r.id)||(s.grade!==null&&s.grade!==r.grade)||(s.grade_verified_by!==null&&s.grade_verified_by!==a.human_lead_id)||[start,end].some(t=>t!==null&&(t<Date.parse(a.approved_at)||t>now))||(end!==null&&start!==null&&end<=start)||s.answers.some(x=>!r.instrument.some(i=>i.id===x.item_id)||(x.scorer_id!==null&&!b.experts.some(e=>e.id===x.scorer_id)))||new Set(s.answers.map(x=>x.item_id)).size!==s.answers.length||s.unknown_word_count!==null&&s.unknown_word_count>passage.trim().split(/\s+/).length)return false
  if(start!==null){
    const m=expertOutcomeV2(b,r,passage,start)
    if(!m.ok||m.completed_at>start)return false
    for(const rid of p.record_order.slice(0,p.record_order.indexOf(r.id))){
      const prior=b.records.find(x=>x.id===rid)!,previous=prior.student_sessions.find(x=>x.student_id===s.student_id)
      const priorText=passages[prior.id]??prior.adapted_passage
      if(!priorText||researchBodyHash(priorText)!==prior.passage_hash)return false
      if(previous?.reading_started_at&&previous.reading_finished_at&&Date.parse(previous.reading_finished_at)<=start&&studentBindingV2(b,prior,previous,priorText,now,passages))continue
      const outcome=expertOutcomeV2(b,prior,priorText,start)
      // An unresolved noncritical 2/4 disagreement is not a final failure.
      const hardFailure=outcome.blockers.includes('critical_rejection')
      const allowed=hardFailure?['critical_rejection','distortion_present','semantic_review_not_passed','independent_adjudication_required']:['semantic_review_not_passed','distortion_present']
      if(outcome.expert_count!==2||!outcome.blockers.length||outcome.blockers.some(x=>!allowed.includes(x)))return false
    }
  }
  return true
}
export function registrationBlockersV2(b:BundleV2,now:number){
  const out:string[]=[],a=b.protocol_approval,p=b.protocol
  if(!Number.isFinite(now)||!a||Date.parse(a.approved_at)>now||a.manifest_hash!==digestV2(manifestIdentityV2(b)))out.push('protocol_not_sealed_or_changed')
  if(b.protocol_hash!==digestV2(p)||b.instrument_hash!==digestV2(instrumentIdentityV2(b.records)))out.push('protocol_or_instrument_hash_changed')
  if(!p.operations||!p.band_rationale.middle_1||!p.band_rationale.high_1||p.ranges.some(r=>METRIC_KEYS.some(k=>r[k]===null)))out.push('human_protocol_incomplete')
  for(const e of b.experts)if(!a||e.screened_by!==a.human_lead_id||e.credential_verified_by!==a.human_lead_id||e.prior_exposure.length||Date.parse(e.screened_at)>Date.parse(a.approved_at))out.push('expert_screening_invalid')
  for(const r of b.records){const x=r.expert_assignment,ids=x?[...x.initial_expert_ids,x.adjudicator_id]:[];if(ids.length!==3||new Set(ids).size!==3||ids.some(id=>!b.experts.some(e=>e.id===id)))out.push('expert_assignment_invalid')}
  for(const g of ['middle_1','high_1'] as const){const ps=b.participants.filter(p=>p.grade===g),rs=b.records.filter(r=>r.grade===g);if(ps.length<p.minimum_students_per_grade||ps.length>30||ps.some(s=>!a||s.grade_verified_by!==a.human_lead_id))out.push(`cohort_assignment_invalid_${g}`);for(const r of rs){const counts=rs.map((_,position)=>ps.filter(s=>s.record_order[position]===r.id).length);if(Math.max(...counts)-Math.min(...counts)>1)out.push(`student_order_unbalanced_${g}`)}}
  if(p.study_purpose!=='calibration'&&!b.calibration_exclusions.length)out.push('calibration_exclusion_evidence_missing')
  for(const e of b.calibration_exclusions){
    if(!a||Date.parse(e.completed_at)>=Date.parse(a.approved_at)||e.study_id===b.study_id)out.push('calibration_exclusion_chronology_invalid')
    if(b.records.some(r=>e.source_ids.some(id=>id.toLowerCase()===r.source_id.toLowerCase())||e.research_dois.some(doi=>doi.toLowerCase()===r.research_doi.toLowerCase())||e.passage_hashes.includes(r.passage_hash))||b.participants.some(s=>e.student_ids.includes(s.student_id))||(!p.expert_reuse_allowed&&b.experts.some(x=>e.expert_ids.includes(x.id))))out.push('calibration_validation_overlap')
  }
  return [...new Set(out)]
}
export function registerV2(input:BundleV2,approval:NonNullable<BundleV2['protocol_approval']>,now:number){
  const b=bundleV2Schema.parse(input)
  if(b.protocol_approval||b.records.some(r=>r.expert_reviews.length||r.student_sessions.length||r.adjudication))throw Error('Registration must precede all responses and cannot replace a seal')
  b.protocol_approval=bundleV2Schema.innerType().shape.protocol_approval.unwrap().parse(approval)
  const errors=registrationBlockersV2(b,now);if(errors.length)throw Error(errors.join(', '));return b
}
export function expertOutcomeV2(b:BundleV2,r:RecordV2,passage:string,now:number){
  const blockers=registrationBlockersV2(b,now),a=b.protocol_approval,x=r.expert_assignment
  const valid=(e:RecordV2['expert_reviews'][number])=>!!a&&!!x&&[...x.initial_expert_ids,x.adjudicator_id].includes(e.expert_id)&&e.packet_hash===deliveryPacketV2(b,r,'expert').packet_hash&&e.blind_item_id===r.blind_item_id&&e.passage_hash===r.passage_hash&&Date.parse(e.rated_at)>=Date.parse(a.approved_at)&&Date.parse(e.rated_at)<=now&&complete(e.ratings)&&evidenceValid(r,e.ratings,passage)
  if(r.expert_reviews.some(e=>!valid(e)))blockers.push('expert_review_invalid')
  const initial=x?x.initial_expert_ids.map(id=>r.expert_reviews.find(e=>e.expert_id===id)).filter((e):e is RecordV2['expert_reviews'][number]=>!!e&&valid(e)):[]
  if(initial.length!==2)blockers.push('independent_reviews_insufficient')
  if(r.expert_reviews.some(e=>critical(e.ratings)))blockers.push('critical_rejection')
  if(r.expert_reviews.some(e=>e.distortions.some(d=>!passage.includes(d.passage_quote))))blockers.push('distortion_quote_absent')
  const signature=(e:RecordV2['expert_reviews'][number])=>({ratings:SEMANTIC_CRITERIA.map(k=>({score:e.ratings[k].score,critical:e.ratings[k].critical})),codes:[...new Set(e.distortions.map(d=>`${d.code}:${d.severity}`))].sort()})
  const disagreement=initial.length===2&&canonicalJson(signature(initial[0]!))!==canonicalJson(signature(initial[1]!))
  let final=initial[0]?.ratings??null,finalDistortions=initial[0]?.distortions??[],completedAt=Math.max(0,...initial.map(e=>Date.parse(e.rated_at)))
  const third=x?r.expert_reviews.find(e=>e.expert_id===x.adjudicator_id):undefined
  if(disagreement){
    const adj=r.adjudication
    if(!adj||!third||!valid(third)||adj.adjudicator_id!==x?.adjudicator_id||canonicalJson([...adj.initial_review_hashes].sort())!==canonicalJson(initial.map(digestV2).sort())||adj.adjudicator_independent_review_hash!==digestV2(third)||Date.parse(adj.initial_reviews_disclosed_at)<=Math.max(completedAt,Date.parse(third.rated_at))||Date.parse(adj.adjudicated_at)<Date.parse(adj.initial_reviews_disclosed_at)||Date.parse(adj.adjudicated_at)>now||adj.unresolved_items.length||!complete(adj.item_resolution)||!evidenceValid(r,adj.item_resolution,passage)||adj.final_distortions.some(d=>!passage.includes(d.passage_quote)))blockers.push('independent_adjudication_required')
    else{final=adj.item_resolution;finalDistortions=adj.final_distortions;completedAt=Date.parse(adj.adjudicated_at);if(critical(final))blockers.push('critical_rejection')}
  }else if(r.adjudication||third)blockers.push('unexpected_adjudication')
  if(!final||!passed(final)||(!disagreement&&initial.some(e=>!passed(e.ratings))))blockers.push('semantic_review_not_passed')
  if(finalDistortions.some(d=>d.severity==='major'))blockers.push('distortion_present')
  const ok=blockers.length===0
  const finalDimensions=final?semanticDimensions(Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,final[k].score===null?'unassessed':final[k].score!>=3&&!final[k].critical?'pass':'fail'])) as Parameters<typeof semanticDimensions>[0]):null
  return {ok,blockers:[...new Set(blockers)],disagreement,completed_at:completedAt,expert_count:initial.length,final_ratings:final,final_distortions:finalDistortions,
    final_semantic_dimensions:finalDimensions,
    semantic_reviews:r.expert_reviews.map(e=>({expert_id:e.expert_id,...semanticDimensions(Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,e.ratings[k].score===null?'unassessed':e.ratings[k].score!>=3&&!e.ratings[k].critical?'pass':'fail'])) as Parameters<typeof semanticDimensions>[0])}))}
}
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null
const quantile=(xs:number[],q:number)=>{if(!xs.length)return null;const x=[...xs].sort((a,b)=>a-b),p=(x.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return x[lo]!+(x[hi]!-x[lo]!)*(p-lo)}
function completeStudentsV2(b:BundleV2,r:RecordV2,passage:string,now:number,passages:Record<string,string>){
  const meaning=expertOutcomeV2(b,r,passage,now),a=b.protocol_approval,words=passage.trim().split(/\s+/).length
  if(researchBodyHash(passage)!==r.passage_hash)return []
  return r.student_sessions.filter(s=>{
    const start=Date.parse(s.reading_started_at??''),end=Date.parse(s.reading_finished_at??'')
    return meaning.ok&&studentBindingV2(b,r,s,passage,now,passages)&&!!a&&s.grade===r.grade&&s.grade_verified_by===a.human_lead_id&&start>=meaning.completed_at&&end>start&&end<=now&&s.unknown_word_count!==null&&s.unknown_word_count<=words&&[s.lexical_burden,s.sentence_burden,s.reasoning_burden,s.perceived_difficulty].every(v=>v!==null)&&s.answers.length===r.instrument.length&&s.answers.every(x=>x.response!==null&&x.response.trim().length>0&&x.score!==null&&x.scorer_id!==null)
  })
}
export function evaluateV2(b:BundleV2,r:RecordV2,passage:string,now:number,passages:Record<string,string>={}){
  const meaning=expertOutcomeV2(b,r,passage,now),blockers=[...meaning.blockers]
  if(!r.provenance_verified||researchBodyHash(passage)!==r.passage_hash||researchBodyHash(r.adapted_passage)!==r.passage_hash)blockers.push('provenance_or_passage_changed')
  if(r.link_confidence!=='high')blockers.push('link_confidence_insufficient')
  const axes=['comprehension','lexical','syntax','reasoning'] as const
  if(axes.some(axis=>r.instrument.filter(i=>i.axis===axis).length<b.protocol.minimum_items_per_axis)||r.instrument.some(i=>!passage.includes(i.source_quote)))blockers.push('instrument_invalid')
  const words=passage.trim().split(/\s+/).length
  const eligible=completeStudentsV2(b,r,passage,now,passages)
  const axis=(key:typeof axes[number])=>eligible.flatMap(s=>{const value=mean(s.answers.filter(x=>r.instrument.some(i=>i.id===x.item_id&&i.axis===key)).map(x=>x.score!));return value===null?[]:[value]})
  const samples={reading_seconds:eligible.map(s=>(Date.parse(s.reading_finished_at!)-Date.parse(s.reading_started_at!))/1000),comprehension_accuracy:axis('comprehension'),lexical_accuracy:axis('lexical'),syntax_accuracy:axis('syntax'),reasoning_accuracy:axis('reasoning'),unknown_word_fraction:eligible.map(s=>s.unknown_word_count!/words),lexical_burden:eligible.map(s=>s.lexical_burden!),sentence_burden:eligible.map(s=>s.sentence_burden!),reasoning_burden:eligible.map(s=>s.reasoning_burden!),perceived_difficulty:eligible.map(s=>s.perceived_difficulty!)}
  const metrics=Object.fromEntries(METRIC_KEYS.map(k=>[k,k.endsWith('_accuracy')?mean(samples[k]):quantile(samples[k],.5)])) as Record<typeof METRIC_KEYS[number],number|null>
  const distributions=Object.fromEntries(METRIC_KEYS.map(k=>[k,{n:samples[k].length,min:quantile(samples[k],0),q1:quantile(samples[k],.25),median:quantile(samples[k],.5),q3:quantile(samples[k],.75),max:quantile(samples[k],1)}]))
  const range=b.protocol.ranges.find(x=>x.grade===r.grade)!
  for(const k of METRIC_KEYS)if(range[k]===null||metrics[k]===null||metrics[k]!<range[k]!.min||metrics[k]!>range[k]!.max)blockers.push(`target_range_failed_${k}`)
  const cohort=new Set(b.records.filter(x=>x.grade===r.grade).flatMap(x=>completeStudentsV2(b,x,passages[x.id]??(x.id===r.id?passage:x.adapted_passage),now,passages).map(s=>s.student_id)))
  if(eligible.length<b.protocol.minimum_students_per_variant)blockers.push('student_sample_insufficient')
  if(cohort.size<b.protocol.minimum_students_per_grade)blockers.push('grade_sample_insufficient')
  const valid=blockers.length===0,state=valid?(b.protocol.study_purpose==='calibration'?'student_validated':'gold'):meaning.ok?'expert_validated':'candidate'
  const item_responses=r.instrument.map(i=>{const values=eligible.flatMap(s=>s.answers.filter(a=>a.item_id===i.id).map(a=>a.score!));return {item_id:i.id,axis:i.axis,n:values.length,mean:mean(values),q1:quantile(values,.25),q3:quantile(values,.75)}})
  const order_positions=b.records.filter(x=>x.grade===r.grade).map((_,position)=>{const ids=b.participants.filter(s=>s.record_order[position]===r.id).map(s=>s.student_id),sessions=eligible.filter(s=>ids.includes(s.student_id));return {position:position+1,planned:ids.length,complete:sessions.length,reading_seconds:quantile(sessions.map(s=>(Date.parse(s.reading_finished_at!)-Date.parse(s.reading_started_at!))/1000),.5)}})
  const expert_agreement=SEMANTIC_CRITERIA.map(k=>({criterion:k,ratings:r.expert_reviews.map(e=>({expert_id:e.expert_id,score:e.ratings[k].score,critical:e.ratings[k].critical})),initial_agreement:!!r.expert_assignment&&r.expert_assignment.initial_expert_ids.every(id=>{const first=r.expert_reviews.find(e=>e.expert_id===r.expert_assignment!.initial_expert_ids[0]),e=r.expert_reviews.find(e=>e.expert_id===id);return !!first&&!!e&&first.ratings[k].score===e.ratings[k].score&&first.ratings[k].critical===e.ratings[k].critical})}))
  return {state,blockers:[...new Set(blockers)],student_count:eligible.length,grade_student_count:cohort.size,expert_count:meaning.expert_count,disagreement:meaning.disagreement,semantic_reviews:meaning.semantic_reviews,final_semantic_dimensions:meaning.final_semantic_dimensions,final_distortions:meaning.final_distortions,expert_agreement,metrics,distributions,item_responses,order_positions,missing_sessions:r.student_sessions.length-eligible.length,not_collected_sessions:b.participants.filter(s=>s.grade===r.grade&&!r.student_sessions.some(x=>x.student_id===s.student_id)).length,
    lexical_level:{measurement:'contextual_vocabulary_accuracy',value:metrics.lexical_accuracy},syntax_level:{measurement:'sentence_meaning_accuracy',value:metrics.syntax_accuracy},reasoning_level:{measurement:'source_bound_inference_accuracy',value:metrics.reasoning_accuracy},
    scope:b.protocol.study_purpose==='calibration'?'calibration_only_no_generalization':'exact_passage_target_protocol_only',production:false}
}
export function productionV2(b:BundleV2,r:RecordV2,passage:string,replication:BundleV2,replicationPassages:Record<string,string>,article:{status:string;content:string;adapted_from_id:string;composed_spec:{academic_reading?:{target_key?:string}}|null}|null,now:number,basePassages:Record<string,string>={}){
  if(evaluateV2(b,r,passage,now,basePassages).state!=='gold'||!b.protocol_approval||replication.protocol.study_purpose!=='replication'||replication.study_id===b.study_id||!replication.protocol_approval||Date.parse(replication.protocol_approval.approved_at)<=Math.max(Date.parse(b.protocol_approval.approved_at),...b.records.flatMap(x=>x.student_sessions.flatMap(s=>s.reading_finished_at?[Date.parse(s.reading_finished_at)]:[]))))return false
  // Replication is independently evaluated; a published flag or a boolean assertion is insufficient.
  if(replication.records.some(x=>b.records.some(y=>x.source_id.toLowerCase()===y.source_id.toLowerCase()||x.research_doi.toLowerCase()===y.research_doi.toLowerCase()||x.passage_hash===y.passage_hash||x.topic===y.topic||x.source_family===y.source_family))||replication.participants.some(x=>b.participants.some(y=>x.student_id===y.student_id)))return false
  if(!replication.protocol.expert_reuse_allowed&&replication.experts.some(x=>b.experts.some(y=>x.id===y.id)))return false
  return replication.records.every(x=>evaluateV2(replication,x,replicationPassages[x.id]??'',now,replicationPassages).state==='gold')&&article?.status==='published'&&article.adapted_from_id===r.source_id&&researchBodyHash(article.content)===r.passage_hash&&article.composed_spec?.academic_reading?.target_key===r.target_key
}
export function calibrationCompletedV2(b:BundleV2,now:number){
  if(b.protocol.study_purpose!=='calibration'||registrationBlockersV2(b,now).length)return false
  return b.records.every(r=>{
    if(researchBodyHash(r.adapted_passage)!==r.passage_hash)return false
    const m=expertOutcomeV2(b,r,r.adapted_passage,now)
    if(!m.ok){
      const permitted=m.blockers.includes('critical_rejection')?['critical_rejection','semantic_review_not_passed','distortion_present','independent_adjudication_required']:['semantic_review_not_passed','distortion_present']
      return m.expert_count===2&&m.blockers.length>0&&m.blockers.every(x=>permitted.includes(x))&&r.student_sessions.every(s=>s.reading_started_at===null)
    }
    const result=evaluateV2(b,r,r.adapted_passage,now)
    // A measured calibration outside the proposed bands is a completed finding, not a pass.
    return result.student_count>=b.protocol.minimum_students_per_variant&&result.grade_student_count>=b.protocol.minimum_students_per_grade&&Object.values(result.metrics).every(x=>x!==null)&&!result.blockers.includes('instrument_invalid')&&!result.blockers.includes('provenance_or_passage_changed')&&!result.blockers.includes('link_confidence_insufficient')
  })
}
