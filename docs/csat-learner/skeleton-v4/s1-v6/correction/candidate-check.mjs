// docs/csat-learner/skeleton-v4/s1-v6/correction/candidate-check.mjs
// Validate a proposal for isolated review. This never applies a product patch.
import crypto from 'node:crypto'
export const objectHash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function candidateErrors(candidate,current){
 const errors=[]
 if(candidate.version!=='1.0.0')errors.push('unsupported-version')
 if(candidate.baseFileSha256!==current.fileHash)errors.push('stale-file')
 if(candidate.baseItemSha256!==objectHash(current.item))errors.push('stale-item')
 if(candidate.sourceSha256!==current.sourceHash)errors.push('wrong-source')
 if(candidate.payloadSha256!==objectHash(candidate.payload))errors.push('changed-payload')
 if(objectHash(candidate.payload.expected)!==objectHash(current.item.v3.choices.find(c=>c.n===5)))errors.push('changed-base-choice')
 if(candidate.approval.required!==true||candidate.approval.status!=='NOT_APPROVED'||candidate.approval.appliedToOriginal!==false)errors.push('invalid-proposal-approval-state')
 if(candidate.payload.proposed.n!==5||!candidate.payload.proposed.sentences.includes(4)||!candidate.payload.proposed.sentences.includes(5))errors.push('missing-general-context')
 if(candidate.payload.proposed.meaning_ids.some(id=>!current.item.v3.meanings.some(m=>m.id===id)))errors.push('unknown-meaning')
 return errors
}
