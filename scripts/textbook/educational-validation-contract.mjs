// scripts/textbook/educational-validation-contract.mjs
import fs from 'node:fs'
import path from 'node:path'
import { canonical, digest } from './academic-reading-contract.mjs'
import { validationBundleSchema, instrumentIdentity, evaluateEducationalRecord, matchEducationalBinding } from '@vocaflow/library-pipeline/educational-validation'
import { precisionRoundSchema,validatePrecisionEvidence } from '../../packages/library-pipeline/src/textbook/parallel-precision.ts'
import {bundleV2Schema,instrumentIdentityV2,evaluateV2,digestV2,manifestIdentityV2} from '@vocaflow/library-pipeline/educational-validation-v2'
export function assertIndependentOfFixedCalibration(bundle){
  if(bundle.version!==2||bundle.protocol.study_purpose==='calibration')return
  const fixedPilot=JSON.parse(fs.readFileSync(new URL('./frym-precision/adaptation-pilot-1.json',import.meta.url),'utf8')),fixedRules=JSON.parse(fs.readFileSync(new URL('./frym-precision/preservation-rules-1.json',import.meta.url),'utf8'))
  const sources=new Set(fixedRules.entries.map(e=>e.source_id)),dois=new Set(fixedRules.entries.map(e=>e.original_work_id.toLowerCase())),passages=new Set(fixedPilot.records.map(r=>digest(r.text)))
  if(bundle.records.some(r=>sources.has(r.source_id)||dois.has(r.research_doi.toLowerCase())||passages.has(r.passage_hash)))throw Error('Fixed eight-passage calibration source/research/passage cannot be reused for validation or replication')
}

export function currentEducationalEvidence(bundle,reviewFile,evidenceDir){
  assertIndependentOfFixedCalibration(bundle)
  if (!reviewFile) throw new Error('Educational validation requires --precision-review')
  const reviewRaw=fs.readFileSync(reviewFile,'utf8'),review=precisionRoundSchema.parse(JSON.parse(reviewRaw))
  if(digest(reviewRaw)!==bundle.review_hash)throw Error('Educational precision review changed')
  const provenance={}
  for(const r of bundle.records){
    const p=review.pairs.find(p=>p.id===r.pair_id)
    const verified=Boolean(p&&p.source.id===r.source_id&&p.source.source_hash===r.source_hash&&p.source.source_revision===r.source_revision&&p.research.hash===r.research_hash&&p.research.access==='full_text'&&p.link_review.verdict==='verified'&&p.alignments.every(a=>a.verdict==='aligned'))
    provenance[r.id]={verified,confidence:p?.link_review.confidence.grade??'low'}
    if(bundle.version===2){
      if(!verified||r.research_doi.toLowerCase()!==p.relation.doi.toLowerCase())throw Error('Educational source/research binding changed')
      if(!evidenceDir)throw Error('V2 validation requires --evidence-dir for original research context verification')
      const read=name=>{if(!name||! /^[A-Za-z0-9_.-]+$/.test(name)||['.','..'].includes(name))throw Error('Unsafe evidence filename');const f=path.join(path.resolve(evidenceDir),name);if(fs.lstatSync(f).isSymbolicLink())throw Error('Evidence symlink rejected');return fs.readFileSync(f,'utf8')}
      const fym=read(p.files.fym),research=read(p.files.research),errors=validatePrecisionEvidence(p,fym,research)
      if(errors.length)throw Error(errors.join('; '))
      if(canonical(r.research_contexts)!==canonical(p.reviewed_spans.research.map(s=>research.slice(s.start,s.end))))throw Error('Educational original research context changed')
    }
  }
  return provenance
}
export function readEducationalValidation(file, now, reviewFile,evidenceDir) {
  if (!file) return null
  const raw=fs.readFileSync(file,'utf8'), parsed=JSON.parse(raw), bundle=(parsed.version===2?bundleV2Schema:validationBundleSchema).parse(parsed)
  if (digest(canonical(bundle.protocol))!==bundle.protocol_hash || digest(canonical(bundle.version===2?instrumentIdentityV2(bundle.records):instrumentIdentity(bundle.records)))!==bundle.instrument_hash)
    throw new Error('Educational protocol/instrument hash changed')
  const provenance=currentEducationalEvidence(bundle,reviewFile,evidenceDir)
  for (const r of bundle.records) {
    if(bundle.version===1){r.provenance_verified=r.provenance_verified&&provenance[r.id].verified;r.link_confidence=provenance[r.id].confidence}
  }
  return { bundle, provenance, file_hash:digest(raw), checked_at:now }
}
export function evaluateCurrentEducation(validation,r,passage,now){
  const b=validation.bundle
  const current=validation.provenance?.[r.id]
  const result=b.version===2?evaluateV2(b,r,passage,now):evaluateEducationalRecord(b,r,passage,now)
  if(b.version===2&&(!current?.verified||current.confidence!=='high'))return {...result,state:'candidate',blockers:[...result.blockers,'current_precision_provenance_failed']}
  return result
}
export function validateEducationalPromotion(draft, task, validation, now) {
  if (!task) return {ok:true,certificate:null}
  if (!validation) return {ok:false,reason:'educational validation required before DB seed'}
  const b=validation.bundle
  if(b.version!==2)return {ok:false,reason:'legacy v1 retained for reading only; new DB seed requires sealed v2 validation'}
  try{assertIndependentOfFixedCalibration(b)}catch(error){return {ok:false,reason:error.message}}
  if (b.review_hash!==task.review_hash || b.rules_hash!==task.rules_hash) return {ok:false,reason:'educational review/rules binding changed'}
  const matches=b.records.filter(r=>matchEducationalBinding(r,task,draft.text??'',draft.reading?.target_key))
  if (matches.length!==1) return {ok:false,reason:'educational passage/target/source binding missing or ambiguous'}
  const r=matches[0]
  if (r.grade!==draft.reading.target.age_band) return {ok:false,reason:'educational target grade mismatch'}
  const result=evaluateCurrentEducation(validation,r,draft.text,now)
  if (result.state!=='gold') return {ok:false,reason:`educational ${result.state}: ${result.blockers.join(', ')}`}
  return {ok:true,certificate:{
    version:2,state:'gold',study_id:b.study_id,study_purpose:b.protocol.study_purpose,manifest_hash:digestV2(manifestIdentityV2(b)),validation_hash:validation.file_hash,protocol_hash:b.protocol_hash,
    instrument_hash:b.instrument_hash,pilot_hash:b.pilot_hash,review_hash:b.review_hash,rules_hash:b.rules_hash,
    passage_hash:r.passage_hash,target_key:r.target_key,source_id:r.source_id,
    semantic_reviews:result.semantic_reviews,final_semantic_dimensions:result.final_semantic_dimensions,final_distortions:result.final_distortions,adjudication_hash:r.adjudication?digestV2(r.adjudication):null,metrics:result.metrics,expert_count:result.expert_count,
    student_count:result.student_count,scope:result.scope,production:false,
  }}
}
