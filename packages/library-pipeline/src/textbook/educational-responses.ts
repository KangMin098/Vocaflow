// packages/library-pipeline/src/textbook/educational-responses.ts
import { z } from 'zod'
import { researchBodyHash } from '../ingest-article/research-origin'
import { canonicalJson } from './review-digest'
import {
  expertReviewSchema, studentSessionSchema, validationBundleSchema,
  instrumentIdentity, SEMANTIC_CRITERIA, type ValidationBundle, type ValidationRecord,
} from './educational-validation'

const hash=z.string().regex(/^[a-f0-9]{64}$/)
export const educationalResponseBatchSchema=z.object({
  version:z.literal(1),mode:z.literal('human_response_batch'),protocol_hash:hash,instrument_hash:hash,
  expert_reviews:z.array(expertReviewSchema),
  student_sessions:z.array(studentSessionSchema.extend({blind_item_id:z.string().min(2),passage_hash:hash}).strict()),
}).strict()
export type EducationalResponseBatch=z.infer<typeof educationalResponseBatchSchema>

export function emptyEducationalResponseBatch(bundle:ValidationBundle):EducationalResponseBatch {
  return {version:1,mode:'human_response_batch',protocol_hash:bundle.protocol_hash,instrument_hash:bundle.instrument_hash,expert_reviews:[],student_sessions:[]}
}

// Only coordinator-verified human records belong here; this function cannot authenticate people.
export function mergeEducationalResponses(input:unknown,responses:unknown,now:number) {
  const bundle=validationBundleSchema.parse(input),batch=educationalResponseBatchSchema.parse(responses)
  if (!Number.isFinite(now)) throw Error('Invalid collection clock')
  if (researchBodyHash(canonicalJson(bundle.protocol))!==bundle.protocol_hash ||
      researchBodyHash(canonicalJson(instrumentIdentity(bundle.records)))!==bundle.instrument_hash ||
      batch.protocol_hash!==bundle.protocol_hash || batch.instrument_hash!==bundle.instrument_hash)
    throw Error('Response protocol/instrument binding changed')
  const stats={added_expert_reviews:0,added_student_sessions:0,filled_student_sessions:0,duplicate_responses:0}
  if (batch.expert_reviews.length+batch.student_sessions.length===0) return {bundle,stats}
  const approval=bundle.protocol_approval
  if (!approval || approval.protocol_hash!==bundle.protocol_hash || approval.instrument_hash!==bundle.instrument_hash || Date.parse(approval.approved_at)>now)
    throw Error('Response collection requires the preregistered protocol/instruments')
  const expert=(id:string)=>bundle.experts.some(e=>e.id===id && e.credential_verified_by===approval.human_lead_id)
  const record=(blindId:string,passageHash:string)=>{
    const r=bundle.records.find(r=>r.blind_item_id===blindId)
    if (!r || r.passage_hash!==passageHash) throw Error('Response blind ID/passage binding changed')
    return r
  }
  const validTime=(value:string|null)=>value===null || (Date.parse(value)>=Date.parse(approval.approved_at) && Date.parse(value)<=now)
  for (const response of batch.expert_reviews) {
    const r=record(response.blind_item_id,response.passage_hash)
    if (!expert(response.expert_id) || !validTime(response.reviewed_at)) throw Error('Unregistered expert or invalid review time')
    const previous=r.expert_reviews.find(e=>e.expert_id===response.expert_id)
    if (previous) {
      if (canonicalJson(previous)!==canonicalJson(response)) throw Error('Conflicting expert review; preserve both files for human resolution')
      stats.duplicate_responses++
    } else {r.expert_reviews.push(response);stats.added_expert_reviews++}
  }
  for (const response of batch.student_sessions) {
    const r=record(response.blind_item_id,response.passage_hash)
    const {blind_item_id:_,passage_hash:__,...incoming}=response
    if (incoming.grade!==null && incoming.grade!==r.grade) throw Error('Student target grade mismatch')
    if (incoming.grade_verified_by!==null && incoming.grade_verified_by!==approval.human_lead_id) throw Error('Unknown student grade verifier')
    if (!validTime(incoming.reading_started_at) || !validTime(incoming.reading_finished_at) ||
        (incoming.reading_started_at!==null && incoming.reading_finished_at!==null && Date.parse(incoming.reading_finished_at)<=Date.parse(incoming.reading_started_at)))
      throw Error('Invalid student collection time')
    if (incoming.answers.some(a=>!r.instrument.some(i=>i.id===a.item_id) || (a.scorer_id!==null && !expert(a.scorer_id))) ||
        new Set(incoming.answers.map(a=>a.item_id)).size!==incoming.answers.length) throw Error('Unknown/duplicate measurement item or scorer')
    const previous=r.student_sessions.find(s=>s.student_id===incoming.student_id)
    const merged=previous?fillStudentSession(previous,incoming):incoming
    // Check the final combined timestamps and meaning gate, including partial fills in later batches.
    if (!validTime(merged.reading_started_at) || !validTime(merged.reading_finished_at) ||
        (merged.reading_started_at!==null && merged.reading_finished_at!==null && Date.parse(merged.reading_finished_at)<=Date.parse(merged.reading_started_at))) throw Error('Invalid combined student time')
    if (merged.reading_started_at!==null) {
      const panel=r.expert_reviews
      if (panel.length<bundle.protocol.minimum_experts || !panel.every(e=>expert(e.expert_id) && validTime(e.reviewed_at) &&
          e.passage_hash===r.passage_hash && e.blind_item_id===r.blind_item_id && e.distortions.length===0 &&
          SEMANTIC_CRITERIA.every(k=>e.criteria[k]==='pass') && Date.parse(e.reviewed_at)<=Date.parse(merged.reading_started_at!)))
        throw Error('Student reading requires completed passing semantic reviews first')
    }
    if (!previous) {r.student_sessions.push(merged);stats.added_student_sessions++}
    else if (canonicalJson(previous)===canonicalJson(merged)) stats.duplicate_responses++
    else {r.student_sessions[r.student_sessions.indexOf(previous)]=merged;stats.filled_student_sessions++}
  }
  return {bundle:validationBundleSchema.parse(bundle),stats}
}

type StudentSession=ValidationRecord['student_sessions'][number]
function fillStudentSession(previous:StudentSession,incoming:StudentSession):StudentSession {
  const output=structuredClone(previous)
  const fill=<T>(old:T,next:T,field:string):T=>{
    if (next===null || next==='') return old
    if (old===null || old==='') return next
    if (old!==next) throw Error(`Conflicting student ${field}; preserve both files for human resolution`)
    return old
  }
  const keys=['grade','grade_verified_by','reading_started_at','reading_finished_at','unknown_word_count','lexical_burden','sentence_burden','reasoning_burden','perceived_difficulty'] as const
  for (const key of keys) Object.assign(output,{[key]:fill(previous[key],incoming[key],key)})
  if (new Set(output.answers.map(a=>a.item_id)).size!==output.answers.length) throw Error('Duplicate stored answer IDs')
  for (const answer of incoming.answers) {
    const old=output.answers.find(a=>a.item_id===answer.item_id)
    if (!old) output.answers.push(structuredClone(answer))
    else for (const key of ['response','score','scorer_id'] as const) Object.assign(old,{[key]:fill(old[key],answer[key],`answer ${key}`)})
  }
  return output
}
