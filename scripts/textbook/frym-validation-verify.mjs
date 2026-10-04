// scripts/textbook/frym-validation-verify.mjs
import fs from 'node:fs'
import { readEducationalValidation } from './educational-validation-contract.mjs'
import { readPreservationRules,digest,targetKey } from './academic-reading-contract.mjs'
import { preservationPilotSchema } from '@vocaflow/library-pipeline/reading-preservation'
import { evaluateEducationalRecord,matchEducationalBinding,assertPilotGradeCoverage } from '@vocaflow/library-pipeline/educational-validation'

const arg=(n)=>{const i=process.argv.indexOf(`--${n}`);return i<0?null:process.argv[i+1]}
if(process.argv.includes('--commit'))throw Error('Educational validation verify has no DB commit mode')
for(const n of ['input','pilot','preservation-rules','precision-review'])if(!arg(n))throw Error(`--${n} required`)
const now=Date.now(),validation=readEducationalValidation(arg('input'),now,arg('precision-review')),b=validation.bundle
const raw=fs.readFileSync(arg('pilot'),'utf8'),pilot=preservationPilotSchema.parse(JSON.parse(raw))
const tasks=readPreservationRules(arg('preservation-rules'),arg('precision-review'))
const first=tasks.values().next().value
assertPilotGradeCoverage(b.records,[...tasks.values()].map(t=>t.entry.pair_id))
if(b.pilot_hash!==digest(raw)||b.review_hash!==pilot.review_hash||b.rules_hash!==first.rules_hash||b.records.length!==pilot.records.length)throw Error('Educational input hashes or coverage changed')
const expected=new Set(pilot.records.map(r=>r.id)),seen=new Set(),results=[]
for(const r of b.records){
 const p=pilot.records.find(p=>p.id===r.id),task=tasks.get(r.source_id)
 if(!p||!task||!expected.has(r.id)||seen.has(r.id)||r.grade!==p.target.age_band||!matchEducationalBinding(r,task,p.text,targetKey(p.target)))throw Error('Educational source/passage/target changed')
 seen.add(r.id);results.push({id:r.id,...evaluateEducationalRecord(b,r,p.text,now)})
}
console.log(JSON.stringify({mode:b.mode,states:Object.fromEntries(['candidate','reviewed','gold','production'].map(s=>[s,results.filter(r=>r.state===s).length])),actual_expert_reviews:b.records.reduce((n,r)=>n+r.expert_reviews.length,0),actual_student_sessions:b.records.reduce((n,r)=>n+r.student_sessions.length,0),results,db_writes:0},null,2))
