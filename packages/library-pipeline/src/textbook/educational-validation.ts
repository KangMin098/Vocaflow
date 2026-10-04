// packages/library-pipeline/src/textbook/educational-validation.ts
import { z } from 'zod'
import { researchBodyHash } from '../ingest-article/research-origin'
import { type PreservationTask } from './reading-preservation'

export const DISTORTION_TAXONOMY_VERSION = 1
export const DISTORTION_TAXONOMY = {
  CAUSE_REVERSAL: 'Reverse the direction of an established causal relation.',
  SCOPE_EXPANSION: 'Apply a claim to a broader population, setting or period than supported.',
  SCOPE_REDUCTION: 'Narrow the supported scope so that the original claim changes.',
  CLAIM_STRENGTHENING: 'Increase certainty or magnitude beyond the evidence.',
  CLAIM_WEAKENING: 'Reduce a supported claim so its meaning changes.',
  CONTRAST_LOSS: 'Remove a comparison or contrast necessary to interpret the claim.',
  CONDITION_LOSS: 'Remove a condition on which the claim depends.',
  ADDED_CAUSALITY: 'Turn association or sequence into an unsupported causal claim.',
  UNSUPPORTED_DETAIL: 'Add a factual detail that the source evidence does not support.',
  KEY_DETAIL_OMISSION: 'Omit information necessary to retain the core claim.',
  COMPARISON_REVERSAL: 'Reverse the ordering or roles of compared groups; this is not necessarily causal.',
  DENOMINATOR_CHANGE: 'Change the population counted by a proportion or rate.',
  MEASUREMENT_TIME_CHANGE: 'Change or conflate the age, time or sequence of measurements.',
  RESULT_DIRECTION_CHANGE: 'Change an increase, decrease or null result into a different direction.',
} as const
export type DistortionCode = keyof typeof DISTORTION_TAXONOMY
const distortion = z.enum(Object.keys(DISTORTION_TAXONOMY) as [DistortionCode, ...DistortionCode[]])
export const SEMANTIC_CRITERIA = [
  'core_claim', 'causal_direction', 'comparison_relation', 'conditions_and_scope',
  'no_unnecessary_addition', 'no_unsupported_addition', 'no_key_omission', 'no_epistemic_overstatement',
] as const
const id = z.string().trim().min(2)
const reason = z.string().trim().min(12)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const date = z.string().datetime({ offset: true })
const grade = z.enum(['middle_1', 'high_1'])
const verdict = z.enum(['pass', 'fail', 'unassessed'])
const criteria = z.object({
  core_claim: verdict, causal_direction: verdict, comparison_relation: verdict,
  conditions_and_scope: verdict, no_unnecessary_addition: verdict, no_unsupported_addition: verdict,
  no_key_omission: verdict, no_epistemic_overstatement: verdict,
}).strict()
const interval = z.object({ min: z.number().min(0), max: z.number().min(0) }).strict()
  .refine(r => r.min <= r.max, 'Invalid target interval')
const accuracyInterval = interval.refine(r => r.max <= 1, 'Accuracy must be between 0 and 1')
const burdenInterval = interval.refine(r => r.min >= 1 && r.max <= 5, 'Burden uses a 1–5 scale')
const targetRange = z.object({
  grade,
  reading_seconds: interval,
  comprehension_accuracy: accuracyInterval,
  lexical_accuracy: accuracyInterval,
  syntax_accuracy: accuracyInterval,
  reasoning_accuracy: accuracyInterval,
  unknown_word_fraction: accuracyInterval,
  lexical_burden: burdenInterval,
  sentence_burden: burdenInterval,
  reasoning_burden: burdenInterval,
  perceived_difficulty: burdenInterval,
}).strict()
export const validationProtocolSchema = z.object({
  version: z.literal(1),
  description: reason,
  threshold_basis: z.literal('pilot_design_proposal_not_grade_norms'),
  minimum_experts: z.number().int().min(2),
  minimum_students_per_variant: z.number().int().min(5),
  minimum_items_per_axis: z.number().int().min(3),
  minimum_link_confidence: z.literal('high'),
  ranges: z.array(targetRange).length(2),
}).strict().refine(p => new Set(p.ranges.map(r => r.grade)).size === 2, 'Both target grades required')
export type ValidationProtocol = z.infer<typeof validationProtocolSchema>

export const measurementItemSchema = z.object({
  id, axis: z.enum(['comprehension', 'lexical', 'syntax', 'reasoning']),
  prompt: reason, source_quote: z.string().trim().min(8), scoring_rubric: reason,
}).strict()
const reviewer = z.object({
  id, kind: z.literal('human_domain_expert'),
  independent_of_author: z.literal(true), credential_verified_by: id, qualification_evidence: reason,
}).strict()
const approval = z.object({
  human_lead_id: id, approved_at: date, protocol_hash: hash, instrument_hash: hash,
  registration_evidence: reason,
}).strict()
const review = z.object({
  expert_id: id, blind_item_id: id, reviewed_at: date, passage_hash: hash,
  criteria,
  distortions: z.array(z.object({ code: distortion, passage_quote: z.string().min(8), reason }).strict()),
  reason,
}).strict()
const answer = z.object({ item_id: id, response: z.string().trim().min(1), score: z.number().min(0).max(1), scorer_id: id }).strict()
const session = z.object({
  student_id: id, grade, grade_verified_by: id,
  reading_started_at: date, reading_finished_at: date,
  unknown_word_count: z.number().int().nonnegative(),
  lexical_burden: z.number().int().min(1).max(5),
  sentence_burden: z.number().int().min(1).max(5),
  reasoning_burden: z.number().int().min(1).max(5),
  perceived_difficulty: z.number().int().min(1).max(5),
  answers: z.array(answer),
}).strict()
export const validationBundleSchema = z.object({
  version: z.literal(1), mode: z.literal('local_educational_validation'),
  taxonomy_version: z.literal(DISTORTION_TAXONOMY_VERSION),
  pilot_hash: hash, review_hash: hash, rules_hash: hash, protocol_hash: hash, instrument_hash: hash,
  protocol: validationProtocolSchema,
  protocol_approval: approval.nullable(),
  experts: z.array(reviewer),
  records: z.array(z.object({
    id, pair_id: id, blind_item_id: id, source_id: z.string().uuid(),
    source_hash: hash, source_revision: z.string().min(1), research_hash: hash,
    target_key: z.string().regex(/^[a-f0-9]{24}$/), grade, passage_hash: hash,
    link_confidence: z.enum(['high','medium','low']),
    provenance_verified: z.boolean(),
    instrument: z.array(measurementItemSchema),
    expert_reviews: z.array(review),
    student_sessions: z.array(session),
  }).strict()).min(1),
}).strict().superRefine((b,ctx) => {
  if (new Set(b.experts.map(e=>e.id)).size !== b.experts.length ||
      new Set(b.records.map(r=>r.id)).size !== b.records.length ||
      new Set(b.records.map(r=>r.blind_item_id)).size !== b.records.length ||
      new Set(b.records.map(r=>`${r.source_id}:${r.target_key}`)).size !== b.records.length)
    ctx.addIssue({code:'custom',message:'Duplicate expert/record/blind IDs'})
  const participants = new Set<string>()
  const grades = new Map<string,string>()
  for (const r of b.records) {
    if (new Set(r.expert_reviews.map(e=>e.expert_id)).size !== r.expert_reviews.length ||
        new Set(r.instrument.map(i=>i.id)).size !== r.instrument.length)
      ctx.addIssue({code:'custom',message:'Duplicate reviews/instrument IDs'})
    for (const s of r.student_sessions) {
      const key=`${r.pair_id}:${s.student_id}`
      if (participants.has(key)) ctx.addIssue({code:'custom',message:'Student repeated the same pair or both variants'})
      participants.add(key)
      if (grades.has(s.student_id) && grades.get(s.student_id)!==s.grade)
        ctx.addIssue({code:'custom',message:'Student grade changed across sessions'})
      grades.set(s.student_id,s.grade)
    }
  }
})
export type ValidationBundle = z.infer<typeof validationBundleSchema>
export type ValidationRecord = ValidationBundle['records'][number]
export const VALIDATION_STATES = ['candidate','reviewed','gold','production'] as const

export function assertPilotGradeCoverage(records: {pair_id:string; grade:string}[], pairIds: string[]) {
  if (new Set(pairIds).size!==pairIds.length || records.length!==pairIds.length*2 ||
      records.some(r=>!pairIds.includes(r.pair_id)) || pairIds.some(pairId=>
        ['middle_1','high_1'].some(g=>records.filter(r=>r.pair_id===pairId && r.grade===g).length!==1)))
    throw Error('Expected exactly one middle_1 and high_1 variant per pair')
}

export function instrumentIdentity(records: ValidationBundle['records']) {
  return records.map(r=>({ id:r.id,pair_id:r.pair_id,blind_item_id:r.blind_item_id,
    source_id:r.source_id,source_hash:r.source_hash,source_revision:r.source_revision,research_hash:r.research_hash,
    target_key:r.target_key,grade:r.grade,passage_hash:r.passage_hash,instrument:r.instrument }))
}
export function semanticDimensions(c: z.infer<typeof criteria>) {
  const pass = (...keys: (keyof typeof c)[]) => keys.some(k=>c[k]==='fail') ? false : keys.every(k=>c[k]==='pass') ? true : null
  return {
    claim_preserved:pass('core_claim','no_key_omission'),
    relation_preserved:pass('causal_direction','comparison_relation'),
    scope_preserved:pass('conditions_and_scope'),
    epistemic_strength_preserved:pass('no_epistemic_overstatement'),
    no_hallucinated_content:pass('no_unsupported_addition'),
  }
}
const mean=(values:number[])=>values.length ? values.reduce((a,b)=>a+b,0)/values.length : null
const median=(values:number[])=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]!:(sorted[m-1]!+sorted[m]!)/2}
export function evaluateEducationalRecord(bundle: ValidationBundle, r: ValidationRecord, passage: string, now: number) {
  const blockers:string[]=[]
  const approval=bundle.protocol_approval
  const validTime=(value:string)=>Number.isFinite(now)&&Date.parse(value)<=now
  if (!approval) blockers.push('protocol_not_preregistered')
  else if (approval.protocol_hash!==bundle.protocol_hash || approval.instrument_hash!==bundle.instrument_hash || !validTime(approval.approved_at)) blockers.push('protocol_approval_binding_invalid')
  if (!r.provenance_verified || researchBodyHash(passage)!==r.passage_hash) blockers.push('provenance_or_passage_changed')
  if (r.link_confidence!=='high') blockers.push('link_confidence_insufficient')
  const validReview=(e:ValidationRecord['expert_reviews'][number])=>
    bundle.experts.some(x=>x.id===e.expert_id && approval && x.credential_verified_by===approval.human_lead_id) &&
    e.blind_item_id===r.blind_item_id && e.passage_hash===r.passage_hash && validTime(e.reviewed_at) &&
    (!approval || Date.parse(e.reviewed_at)>=Date.parse(approval.approved_at))
  const completeReviews=r.expert_reviews.filter(e=>validReview(e)&&SEMANTIC_CRITERIA.every(k=>e.criteria[k]!=='unassessed'))
  if (completeReviews.length<bundle.protocol.minimum_experts) blockers.push('expert_reviews_insufficient')
  for (const e of r.expert_reviews) {
    if (!validReview(e)) blockers.push('expert_review_binding_invalid')
    if (!SEMANTIC_CRITERIA.every(k=>e.criteria[k]==='pass')) blockers.push('semantic_review_not_passed')
    if (e.distortions.length) blockers.push('distortion_present')
    if (e.distortions.some(d=>!passage.includes(d.passage_quote))) blockers.push('distortion_quote_absent')
  }
  const axes=['comprehension','lexical','syntax','reasoning'] as const
  for (const axis of axes) if (r.instrument.filter(i=>i.axis===axis).length<bundle.protocol.minimum_items_per_axis) blockers.push(`instrument_missing_${axis}`)
  if (r.instrument.some(i=>!passage.includes(i.source_quote))) blockers.push('instrument_quote_absent')
  const eligible:typeof r.student_sessions=[]
  const meaningPassed=completeReviews.length>=bundle.protocol.minimum_experts && r.expert_reviews.every(e=>validReview(e)&&SEMANTIC_CRITERIA.every(k=>e.criteria[k]==='pass')&&e.distortions.length===0)
  const lastSemanticReview=Math.max(0,...r.expert_reviews.map(e=>Date.parse(e.reviewed_at)))
  const words=passage.trim().split(/\s+/).length
  for (const s of r.student_sessions) {
    const started=Date.parse(s.reading_started_at),finished=Date.parse(s.reading_finished_at)
    const answersComplete=s.answers.length===r.instrument.length && new Set(s.answers.map(a=>a.item_id)).size===s.answers.length &&
      s.answers.every(a=>r.instrument.some(i=>i.id===a.item_id)&&bundle.experts.some(e=>e.id===a.scorer_id))
    if (!meaningPassed || started<lastSemanticReview || s.grade!==r.grade || !approval || s.grade_verified_by!==approval.human_lead_id ||
        started<Date.parse(approval.approved_at) || finished<=started || !validTime(s.reading_finished_at) ||
        s.unknown_word_count>words || !answersComplete) blockers.push('student_session_invalid')
    else eligible.push(s)
  }
  if (eligible.length<bundle.protocol.minimum_students_per_variant) blockers.push('student_sample_insufficient')
  const axisScore=(axis:typeof axes[number])=>mean(eligible.map(s=>mean(s.answers.filter(a=>r.instrument.some(i=>i.id===a.item_id&&i.axis===axis)).map(a=>a.score)) ?? 0))
  const metrics={
    reading_seconds:median(eligible.map(s=>(Date.parse(s.reading_finished_at)-Date.parse(s.reading_started_at))/1000)),
    comprehension_accuracy:axisScore('comprehension'), lexical_accuracy:axisScore('lexical'),
    syntax_accuracy:axisScore('syntax'), reasoning_accuracy:axisScore('reasoning'),
    unknown_word_fraction:median(eligible.map(s=>s.unknown_word_count/words)),
    lexical_burden:median(eligible.map(s=>s.lexical_burden)), sentence_burden:median(eligible.map(s=>s.sentence_burden)),
    reasoning_burden:median(eligible.map(s=>s.reasoning_burden)), perceived_difficulty:median(eligible.map(s=>s.perceived_difficulty)),
  }
  const ranges=bundle.protocol.ranges.find(x=>x.grade===r.grade)!
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
    const value=metrics[key],range=ranges[key]
    if (value===null || value<range.min || value>range.max) blockers.push(`target_range_failed_${key}`)
  }
  const state=blockers.length===0?'gold':completeReviews.length>=bundle.protocol.minimum_experts?'reviewed':'candidate'
  return {state,blockers:[...new Set(blockers)],student_count:eligible.length,expert_count:completeReviews.length,
    semantic_reviews:r.expert_reviews.map(e=>({expert_id:e.expert_id,...semanticDimensions(e.criteria)})),
    lexical_level:{measurement:'contextual_vocabulary_accuracy',value:metrics.lexical_accuracy},
    syntax_level:{measurement:'sentence_meaning_accuracy',value:metrics.syntax_accuracy},
    reasoning_level:{measurement:'source_bound_inference_accuracy',value:metrics.reasoning_accuracy},
    metrics,scope:'exact_passage_target_protocol_only',production:false}
}

export function matchEducationalBinding(r: ValidationRecord, task: PreservationTask, passage: string, targetKey: string): boolean {
  return r.source_id===task.entry.source_id && r.source_hash===task.entry.source_hash &&
    r.source_revision===task.entry.source_revision && r.research_hash===task.entry.research_hash &&
    r.pair_id===task.entry.pair_id && r.passage_hash===researchBodyHash(passage) && r.target_key===targetKey
}

export function expertBlindPacket(blindItemId: string, passage: string, researchContexts: string[]) {
  return {
    version:1,blind_item_id:blindItemId,
    instructions:'Evaluate the adapted passage against the supplied original research context. Mark unassessed and request more evidence if context is insufficient. Intended age, generation method and prior judgments are withheld.',
    original_research_context:researchContexts,
    adapted_passage:passage,
    criteria:SEMANTIC_CRITERIA,
    response:{expert_id:null,reviewed_at:null,criteria:Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,'unassessed'])),distortions:[],reason:null},
  }
}

// Supply an actual current DB row to derive delivery state; a gold certificate alone is not production.
export function educationalDeliveryState(certificate: {
  state: 'gold'; passage_hash: string; target_key: string; source_id: string
}, article: {
  id: string; status: string; content: string; adapted_from_id: string;
  composed_spec: { academic_reading?: { target_key?: string } } | null
} | null): 'gold' | 'production' {
  return article?.status==='published' && article.adapted_from_id===certificate.source_id &&
    researchBodyHash(article.content)===certificate.passage_hash &&
    article.composed_spec?.academic_reading?.target_key===certificate.target_key ? 'production':'gold'
}
