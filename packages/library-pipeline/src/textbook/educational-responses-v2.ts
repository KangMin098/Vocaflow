// packages/library-pipeline/src/textbook/educational-responses-v2.ts
import { z } from 'zod'
import { canonicalJson } from './review-digest'
import { studentSessionSchema, SEMANTIC_CRITERIA } from './educational-validation'
import { bundleV2Schema,ordinalReviewSchema,adjudicationV2Schema,registrationBlockersV2,digestV2,manifestIdentityV2,expertOutcomeV2,studentBindingV2,deliveryPacketV2,type BundleV2 } from './educational-validation-v2'
const hash=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().min(2)
export const responseBatchV2Schema=z.object({version:z.literal(2),mode:z.literal('human_response_batch'),manifest_hash:hash,
  expert_reviews:z.array(ordinalReviewSchema),
  adjudications:z.array(adjudicationV2Schema.extend({blind_item_id:id,passage_hash:hash}).strict()),
  student_sessions:z.array(studentSessionSchema.extend({blind_item_id:id,passage_hash:hash,packet_hash:hash}).strict()),
}).strict()
export function emptyResponseV2(b:BundleV2){return {version:2,mode:'human_response_batch',manifest_hash:digestV2(manifestIdentityV2(b)),expert_reviews:[],adjudications:[],student_sessions:[]}}
function fill<T>(old:T,next:T):T{
  if(next===null||next==='')return old
  if(old===null||old==='')return next
  if(canonicalJson(old)!==canonicalJson(next))throw Error('Conflicting human response; preserve both files')
  return old
}
export function mergeResponsesV2(input:unknown,responses:unknown,passages:Record<string,string>,now:number){
  const b=bundleV2Schema.parse(input),batch=responseBatchV2Schema.parse(responses)
  if(!Number.isFinite(now)||batch.manifest_hash!==digestV2(manifestIdentityV2(b)))throw Error('Response manifest changed')
  const stats={added_expert_reviews:0,added_adjudications:0,added_student_sessions:0,filled_student_sessions:0,duplicate_responses:0}
  if(!batch.expert_reviews.length&&!batch.adjudications.length&&!batch.student_sessions.length)return {bundle:b,stats}
  const blockers=registrationBlockersV2(b,now);if(blockers.length)throw Error(blockers.join(', '))
  const record=(blind:string,hash:string)=>{const r=b.records.find(r=>r.blind_item_id===blind);if(!r||r.passage_hash!==hash)throw Error('Response blind/passage changed');return r}
  for(const e of batch.expert_reviews){
    const r=record(e.blind_item_id,e.passage_hash),assignment=r.expert_assignment!
    if(e.packet_hash!==deliveryPacketV2(b,r,'expert').packet_hash)throw Error('Expert delivery packet changed; use packets generated from the registered bundle')
    if(![...assignment.initial_expert_ids,assignment.adjudicator_id].includes(e.expert_id)||Date.parse(e.rated_at)<Date.parse(b.protocol_approval!.approved_at)||Date.parse(e.rated_at)>now||!SEMANTIC_CRITERIA.every(k=>Object.values(e.ratings[k]).every(v=>v!==null))||!SEMANTIC_CRITERIA.every(k=>passages[r.id]?.includes(e.ratings[k].passage_quote!)&&r.research_contexts.some(c=>c.includes(e.ratings[k].research_quote!)))||e.distortions.some(d=>!passages[r.id]?.includes(d.passage_quote)))throw Error('Unassigned/incomplete expert review or invalid evidence/time')
    const old=r.expert_reviews.find(x=>x.expert_id===e.expert_id)
    if(old){fill(old,e);stats.duplicate_responses++}else{if(r.student_sessions.some(s=>s.reading_started_at!==null))throw Error('Cannot change semantic panel after student reading');r.expert_reviews.push(e);stats.added_expert_reviews++}
  }
  for(const item of batch.adjudications){
    const r=record(item.blind_item_id,item.passage_hash),{blind_item_id:_b,passage_hash:_p,...adj}=item
    if(r.adjudication){fill(r.adjudication,adj);stats.duplicate_responses++}
    else{if(r.student_sessions.some(s=>s.reading_started_at!==null))throw Error('Cannot add adjudication after student reading');r.adjudication=adj;stats.added_adjudications++}
    const outcome=expertOutcomeV2(b,r,passages[r.id]??'',now)
    if(outcome.blockers.includes('independent_adjudication_required')||outcome.blockers.includes('unexpected_adjudication'))throw Error('Invalid independent adjudication binding/time/evidence')
  }
  for(const incoming of batch.student_sessions){
    const r=record(incoming.blind_item_id,incoming.passage_hash),{blind_item_id:_b,passage_hash:_p,...s}=incoming,old=r.student_sessions.find(x=>x.student_id===s.student_id)
    if(incoming.packet_hash!==deliveryPacketV2(b,r,'student').packet_hash)throw Error('Student delivery packet changed; use packets generated from the registered bundle')
    const merged=old?structuredClone(old):s
    if(old){for(const key of ['grade','grade_verified_by','reading_started_at','reading_finished_at','unknown_word_count','lexical_burden','sentence_burden','reasoning_burden','perceived_difficulty'] as const)Object.assign(merged,{[key]:fill(old[key],s[key])});for(const answer of s.answers){const a=merged.answers.find(x=>x.item_id===answer.item_id);if(!a)merged.answers.push(answer);else for(const key of ['response','score','scorer_id'] as const)Object.assign(a,{[key]:fill(a[key],answer[key])})}}
    if(!studentBindingV2(b,r,merged,passages[r.id]??'',now,passages))throw Error('Student assignment/order/meaning gate/time/items invalid')
    if(!old){r.student_sessions.push(merged);stats.added_student_sessions++}else if(canonicalJson(old)===canonicalJson(merged))stats.duplicate_responses++;else{r.student_sessions[r.student_sessions.indexOf(old)]=merged;stats.filled_student_sessions++}
  }
  // Validate the final merged set atomically. Earlier entries cannot be invalidated by later entries.
  for(const r of b.records)for(const s of r.student_sessions)if(!studentBindingV2(b,r,s,passages[r.id]??'',now,passages))throw Error('Combined student binding invalid')
  return {bundle:bundleV2Schema.parse(b),stats}
}
