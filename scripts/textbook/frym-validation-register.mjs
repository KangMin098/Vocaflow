// scripts/textbook/frym-validation-register.mjs
import fs from 'node:fs'
import path from 'node:path'
import {digest} from './academic-reading-contract.mjs'
import {currentEducationalEvidence} from './educational-validation-contract.mjs'
import {bundleV2Schema,refreshV2Hashes,digestV2,manifestIdentityV2,registerV2,calibrationCompletedV2,deliveryPacketV2} from '@vocaflow/library-pipeline/educational-validation-v2'
const arg=n=>{const i=process.argv.indexOf(`--${n}`);return i<0?null:process.argv[i+1]}
if(process.argv.includes('--commit'))throw Error('Registration has no DB commit mode')
for(const n of ['input','output','precision-review','evidence-dir'])if(!arg(n))throw Error(`--${n} required`)
const prepare=process.argv.includes('--prepare')
if(prepare===Boolean(arg('approval')))throw Error('Use --prepare or --approval <human-registration.json>')
let b=bundleV2Schema.parse(JSON.parse(fs.readFileSync(arg('input'),'utf8')))
if(b.protocol_approval||b.records.some(r=>r.expert_reviews.length||r.student_sessions.length||r.adjudication))throw Error('Cannot register after responses or overwrite an existing seal')
if(fs.existsSync(arg('output')))throw Error('Output exists; preserve the previous revision')
// Exclusions are derived from the actual completed calibration file, never from hand-written exclusion lists.
if(arg('calibration-results')){
 const raw=fs.readFileSync(arg('calibration-results'),'utf8'),old=bundleV2Schema.parse(JSON.parse(raw))
 if(!calibrationCompletedV2(old,Date.now()))throw Error('Completed registered calibration evidence required: final meaning failures or complete student measurements')
 const dates=old.records.flatMap(r=>[...r.expert_reviews.map(e=>e.rated_at),...r.student_sessions.flatMap(s=>s.reading_finished_at?[s.reading_finished_at]:[]),...(r.adjudication?[r.adjudication.adjudicated_at]:[])])
 b.calibration_exclusions=[{study_id:old.study_id,file_hash:digest(raw),manifest_hash:old.protocol_approval.manifest_hash,completed_at:new Date(Math.max(...dates.map(Date.parse))).toISOString(),source_ids:[...new Set(old.records.map(r=>r.source_id))],research_dois:[...new Set(old.records.map(r=>r.research_doi.toLowerCase()))],passage_hashes:old.records.map(r=>r.passage_hash),student_ids:old.participants.map(s=>s.student_id),expert_ids:old.experts.map(e=>e.id),evidence:'Derived from the registered calibration result file supplied by the human coordinator.'}]
}else if(b.protocol.study_purpose!=='calibration')throw Error('--calibration-results required for validation/replication registration')
b=refreshV2Hashes(b)
currentEducationalEvidence(b,arg('precision-review'),arg('evidence-dir'))
const manifest_hash=digestV2(manifestIdentityV2(b))
if(prepare){
 const request=arg('output')+'.registration-request.json'
 if(fs.existsSync(request))throw Error('Registration request exists')
 fs.writeFileSync(request,JSON.stringify({human_lead_id:null,approved_at:null,manifest_hash,registration_evidence:null},null,2)+'\n',{flag:'wx'})
}else{
 b=registerV2(b,JSON.parse(fs.readFileSync(arg('approval'),'utf8')),Date.now())
 if(b.records.some(r=>! /^[A-Za-z0-9_-]+$/.test(r.blind_item_id)))throw Error('Unsafe blind packet filename')
 const packetDir=arg('output')+'.packets'
 if(fs.existsSync(packetDir))throw Error('Registered packet directory exists; choose a new output path')
 for(const role of ['expert','student']){
  fs.mkdirSync(path.join(packetDir,role),{recursive:true})
  for(const r of b.records)fs.writeFileSync(path.join(packetDir,role,r.blind_item_id+'.json'),JSON.stringify(deliveryPacketV2(b,r,role),null,2)+'\n',{flag:'wx'})
 }
}
fs.writeFileSync(arg('output'),JSON.stringify(b,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({mode:prepare?'registration_request_only':'human_registered_protocol',manifest_hash,registered:!prepare,actual_responses:0,db_writes:0}))
