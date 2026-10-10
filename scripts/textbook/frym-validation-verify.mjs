// scripts/textbook/frym-validation-verify.mjs
import fs from 'node:fs'
import { readEducationalValidation,evaluateCurrentEducation } from './educational-validation-contract.mjs'
import { readPreservationRules,digest,targetKey } from './academic-reading-contract.mjs'
import { preservationPilotSchema } from '@vocaflow/library-pipeline/reading-preservation'
import { evaluateEducationalRecord,matchEducationalBinding,assertPilotGradeCoverage } from '@vocaflow/library-pipeline/educational-validation'
import {productionV2} from '@vocaflow/library-pipeline/educational-validation-v2'

const arg=(n)=>{const i=process.argv.indexOf(`--${n}`);return i<0?null:process.argv[i+1]}
if(process.argv.includes('--commit'))throw Error('Educational validation verify has no DB commit mode')
for(const n of ['input','pilot','preservation-rules','precision-review'])if(!arg(n))throw Error(`--${n} required`)
const now=Date.now(),validation=readEducationalValidation(arg('input'),now,arg('precision-review'),arg('evidence-dir')),b=validation.bundle
const raw=fs.readFileSync(arg('pilot'),'utf8'),pilot=preservationPilotSchema.parse(JSON.parse(raw))
const tasks=readPreservationRules(arg('preservation-rules'),arg('precision-review'))
const first=tasks.values().next().value
assertPilotGradeCoverage(b.records,[...tasks.values()].map(t=>t.entry.pair_id))
if(b.pilot_hash!==digest(raw)||b.review_hash!==pilot.review_hash||b.rules_hash!==first.rules_hash||b.records.length!==pilot.records.length)throw Error('Educational input hashes or coverage changed')
const expected=new Set(pilot.records.map(r=>r.id)),seen=new Set(),results=[]
for(const r of b.records){
 const p=pilot.records.find(p=>p.id===r.id),task=tasks.get(r.source_id)
 if(!p||!task||!expected.has(r.id)||seen.has(r.id)||r.grade!==p.target.age_band||!matchEducationalBinding(r,task,p.text,targetKey(p.target)))throw Error('Educational source/passage/target changed')
 seen.add(r.id);results.push({id:r.id,...evaluateCurrentEducation(validation,r,p.text,now)})
}
if(process.argv.includes('--production')){
 if(b.version!==2)throw Error('Production verification requires v2')
 for(const n of ['replication','replication-pilot','replication-precision-review','replication-evidence-dir'])if(!arg(n))throw Error(`--${n} required for production verification`)
 const replicaValidation=readEducationalValidation(arg('replication'),now,arg('replication-precision-review'),arg('replication-evidence-dir')),replica=replicaValidation.bundle
 if(replica.version!==2)throw Error('Replication requires v2')
 const replicaRaw=fs.readFileSync(arg('replication-pilot'),'utf8'),replicaPilot=preservationPilotSchema.parse(JSON.parse(replicaRaw))
 if(digest(replicaRaw)!==replica.pilot_hash||replica.records.length!==replicaPilot.records.length||replica.records.some(r=>!replicaPilot.records.some(p=>p.id===r.id&&p.text_hash===r.passage_hash&&p.text===r.adapted_passage&&p.target_key===r.target_key)))throw Error('Replication pilot binding changed')
 if(!replica.records.every(r=>evaluateCurrentEducation(replicaValidation,r,r.adapted_passage,now).state==='gold'))throw Error('Replication fails current source/link/gold validation')
 const {loadEnv}=await import('./volume-pool.mjs'),{createScriptClient}=await import('../lib/supabase-client.mjs')
 loadEnv();const db=createScriptClient()
 const {data,error}=await db.from('library_articles').select('id,status,content,adapted_from_id,composed_spec').in('adapted_from_id',[...new Set(b.records.map(r=>r.source_id))]).eq('status','published')
 if(error)throw Error(`Published row verification failed: ${error.message}`)
 if(!data)throw Error('Published row query returned no data envelope')
 const replicaPassages=Object.fromEntries(replicaPilot.records.map(r=>[r.id,r.text])),basePassages=Object.fromEntries(pilot.records.map(r=>[r.id,r.text]))
 for(const r of b.records){
  if(results.find(x=>x.id===r.id)?.state!=='gold')continue
  const candidates=data.filter(row=>row.composed_spec?.academic_reading?.target_key===r.target_key&&row.adapted_from_id===r.source_id&&row.composed_spec?.academic_reading?.provenance?.educational_validation?.manifest_hash===b.protocol_approval?.manifest_hash&&row.composed_spec?.academic_reading?.provenance?.educational_validation?.validation_hash===validation.file_hash)
  if(candidates.length===1&&productionV2(b,r,basePassages[r.id],replica,replicaPassages,candidates[0],now,basePassages)){const result=results.find(x=>x.id===r.id);result.state='production';result.production=true;result.published_article_id=candidates[0].id}
 }
}
const report={version:b.version,mode:b.mode,study_purpose:b.protocol.study_purpose??'legacy',generalization:b.version===2&&b.protocol.study_purpose==='calibration'?'none_calibration_only':'exact_passage_only',states:Object.fromEntries(['candidate','reviewed','expert_validated','student_validated','gold','production'].map(s=>[s,results.filter(r=>r.state===s).length])),actual_expert_reviews:b.records.reduce((n,r)=>n+r.expert_reviews.length,0),actual_adjudications:b.records.filter(r=>r.adjudication).length,actual_student_sessions:b.records.reduce((n,r)=>n+r.student_sessions.length,0),disagreements:results.filter(r=>r.disagreement).length,results,db_writes:0}
if(arg('report'))fs.writeFileSync(arg('report'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(report,null,2))
