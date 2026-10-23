// docs/csat-learner/skeleton-v4/s1-v6/correction/r2/content-policy.mjs
// Isolated display projection only; product authorization remains a server duty.
export const CANDIDATE_LABEL='검수 전 수정 후보'
export const HELD_LABEL='콘텐츠 검수 대기'
export const LECTURE_LABEL='검수 전 참고 대본 · C1 영향 검토 중'
export function projectSamples(samples,audience,proposal){
 if(!['learner','review'].includes(audience))throw new Error('unknown-audience')
 return structuredClone(samples).map(s=>{
  if(s.itemId!=='2026#38')return s
  s.inquiry.v3.choices=s.inquiry.v3.choices.map(c=>c.n!==5?c:audience==='review'?{...proposal.payload.proposed,display_state:'PROPOSED_NOT_APPROVED'}:{...c,decisive:'',meaning_ids:[],sentences:[],display_state:'HELD_CONTENT_APPROVAL'})
  return s
 })
}
export function projectLectures(lectures,audience){
 if(!['learner','review'].includes(audience))throw new Error('unknown-audience')
 const copy=structuredClone(lectures)
 if(audience==='learner')delete copy.lectures['2026#38']
 return copy
}
export function displayContext(audience,proposal,binding){
 if(!['learner','review'].includes(audience))throw new Error('unknown-audience')
 return {audience,questionPages:binding.questionPages,candidateMeta:{id:proposal.id,version:proposal.version,payloadSha256:proposal.payloadSha256,approvalRequired:true,state:'PROPOSED_NOT_APPROVED'},review:audience==='review'?{proposal,sourceBinding:binding}:null}
}
