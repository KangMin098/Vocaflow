// scripts/textbook/educational-validation-contract.mjs
import fs from 'node:fs'
import { canonical, digest } from './academic-reading-contract.mjs'
import { validationBundleSchema, instrumentIdentity, evaluateEducationalRecord, matchEducationalBinding } from '@vocaflow/library-pipeline/educational-validation'
import { precisionRoundSchema } from '../../packages/library-pipeline/src/textbook/parallel-precision.ts'

export function readEducationalValidation(file, now, reviewFile) {
  if (!file) return null
  const raw=fs.readFileSync(file,'utf8'), bundle=validationBundleSchema.parse(JSON.parse(raw))
  if (digest(canonical(bundle.protocol))!==bundle.protocol_hash || digest(canonical(instrumentIdentity(bundle.records)))!==bundle.instrument_hash)
    throw new Error('Educational protocol/instrument hash changed')
  if (!reviewFile) throw new Error('Educational validation requires --precision-review')
  const reviewRaw=fs.readFileSync(reviewFile,'utf8'),review=precisionRoundSchema.parse(JSON.parse(reviewRaw))
  if (digest(reviewRaw)!==bundle.review_hash) throw new Error('Educational precision review changed')
  for (const r of bundle.records) {
    const p=review.pairs.find(p=>p.id===r.pair_id)
    const verified=Boolean(p && p.source.id===r.source_id && p.source.source_hash===r.source_hash &&
      p.source.source_revision===r.source_revision && p.research.hash===r.research_hash &&
      p.research.access==='full_text' && p.link_review.verdict==='verified' && p.alignments.every(a=>a.verdict==='aligned'))
    r.provenance_verified=r.provenance_verified&&verified
    r.link_confidence=p?.link_review.confidence.grade??'low'
  }
  return { bundle, file_hash:digest(raw), checked_at:now }
}
export function validateEducationalPromotion(draft, task, validation, now) {
  if (!task) return {ok:true,certificate:null}
  if (!validation) return {ok:false,reason:'educational validation required before DB seed'}
  const b=validation.bundle
  if (b.review_hash!==task.review_hash || b.rules_hash!==task.rules_hash) return {ok:false,reason:'educational review/rules binding changed'}
  const matches=b.records.filter(r=>matchEducationalBinding(r,task,draft.text??'',draft.reading?.target_key))
  if (matches.length!==1) return {ok:false,reason:'educational passage/target/source binding missing or ambiguous'}
  const r=matches[0]
  if (r.grade!==draft.reading.target.age_band) return {ok:false,reason:'educational target grade mismatch'}
  const result=evaluateEducationalRecord(b,r,draft.text,now)
  if (result.state!=='gold') return {ok:false,reason:`educational ${result.state}: ${result.blockers.join(', ')}`}
  return {ok:true,certificate:{
    version:1,state:'gold',validation_hash:validation.file_hash,protocol_hash:b.protocol_hash,
    instrument_hash:b.instrument_hash,pilot_hash:b.pilot_hash,review_hash:b.review_hash,rules_hash:b.rules_hash,
    passage_hash:r.passage_hash,target_key:r.target_key,source_id:r.source_id,
    semantic_reviews:result.semantic_reviews,metrics:result.metrics,expert_count:result.expert_count,
    student_count:result.student_count,scope:result.scope,production:false,
  }}
}
