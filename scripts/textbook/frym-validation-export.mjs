// scripts/textbook/frym-validation-export.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { canonical,digest,readPreservationRules,targetKey } from './academic-reading-contract.mjs'
import { preservationPilotSchema } from '@vocaflow/library-pipeline/reading-preservation'
import { validationProtocolSchema,validationBundleSchema,instrumentIdentity,expertBlindPacket,assertPilotGradeCoverage,DISTORTION_TAXONOMY,DISTORTION_TAXONOMY_VERSION } from '@vocaflow/library-pipeline/educational-validation'
import { precisionRoundSchema,validatePrecisionEvidence } from '../../packages/library-pipeline/src/textbook/parallel-precision.ts'
import { draftMeasurementItems } from './frym-validation/instruments.mjs'
import {protocolV2Schema,bundleV2Schema,refreshV2Hashes,digestV2,manifestIdentityV2,deliveryPacketV2} from '@vocaflow/library-pipeline/educational-validation-v2'
import {assertIndependentOfFixedCalibration} from './educational-validation-contract.mjs'

const arg=(n)=>{const i=process.argv.indexOf(`--${n}`);return i<0?null:process.argv[i+1]}
if(process.argv.includes('--commit'))throw Error('Educational validation export has no DB commit mode')
for(const n of ['pilot','preservation-rules','precision-review','protocol','evidence-dir','output']) if(!arg(n))throw Error(`--${n} required`)
const pilotRaw=fs.readFileSync(arg('pilot'),'utf8'),pilot=preservationPilotSchema.parse(JSON.parse(pilotRaw))
const reviewRaw=fs.readFileSync(arg('precision-review'),'utf8'),review=precisionRoundSchema.parse(JSON.parse(reviewRaw))
const tasks=readPreservationRules(arg('preservation-rules'),arg('precision-review'))
const protocolInput=JSON.parse(fs.readFileSync(arg('protocol'),'utf8')),v2=protocolInput.version===2
const protocol=(v2?protocolV2Schema:validationProtocolSchema).parse(protocolInput)
const calibrationRaw=fs.readFileSync(new URL('./frym-precision/adaptation-pilot-1.json',import.meta.url),'utf8')
if(v2&&protocol.study_purpose!=='calibration'&&digest(pilotRaw)===digest(calibrationRaw))throw Error('Existing eight-passage pilot is calibration only; use an independent sample')
if(v2&&protocol.study_purpose!=='calibration'&&!arg('instruments'))throw Error('--instruments required for independent validation/replication samples')
const suppliedInstruments=arg('instruments')?JSON.parse(fs.readFileSync(arg('instruments'),'utf8')):null
if(v2&&!arg('study-id'))throw Error('--study-id required for v2')
const taxonomy=JSON.parse(fs.readFileSync(new URL('./frym-validation/taxonomy-1.json',import.meta.url),'utf8'))
// Failure examples belong to the fixed calibration round, not to a new independent sample.
const taxonomyReview=precisionRoundSchema.parse(JSON.parse(fs.readFileSync(new URL('./frym-precision/round-1.json',import.meta.url),'utf8')))
if(taxonomy.version!==DISTORTION_TAXONOMY_VERSION||canonical(taxonomy.definitions)!==canonical(DISTORTION_TAXONOMY))throw Error('Taxonomy definition/version drift')
for(const alignmentId of ['F05-A1','F09-A1','F10-A2','F13-A2']){
 const example=taxonomy.examples.find(e=>e.alignment_id===alignmentId)
 const p=taxonomyReview.pairs.find(p=>p.alignments.some(a=>a.id===alignmentId)),a=p?.alignments.find(a=>a.id===alignmentId)
 if(!example||example.source_id!==p.source.id||example.source_hash!==p.source.source_hash||example.original_work_id!==p.relation.doi||example.research_hash!==p.research.hash||canonical(example.original_evidence)!==canonical(a.original_evidence)||canonical(example.fym_evidence)!==canonical(a.fym_evidence)||!example.codes.length||example.codes.some(c=>!Object.hasOwn(DISTORTION_TAXONOMY,c)))throw Error('Taxonomy failure example binding changed')
}
const first=tasks.values().next().value
if(pilot.review_hash!==digest(reviewRaw)||pilot.rules_hash!==first.rules_hash)throw Error('Pilot review/rules changed')
const evidenceDir=path.resolve(arg('evidence-dir'))
function read(file){
 if(!file||! /^[A-Za-z0-9_.-]+$/.test(file)||['.','..'].includes(file))throw Error('Unsafe evidence filename')
 const filePath=path.join(evidenceDir,file)
 if(fs.lstatSync(filePath).isSymbolicLink())throw Error('Evidence symlink rejected')
 return fs.readFileSync(filePath,'utf8')
}
const contexts=new Map()
for(const task of tasks.values()){
 const p=review.pairs.find(p=>p.id===task.entry.pair_id),fym=read(p.files.fym),research=read(p.files.research)
 const errors=validatePrecisionEvidence(p,fym,research)
 if(errors.length)throw Error(errors.join('; '))
 contexts.set(p.id,p.reviewed_spans.research.map(s=>research.slice(s.start,s.end)))
}
const seed=crypto.randomBytes(32).toString('hex')
const blindId=(value)=>`B-${crypto.createHmac('sha256',seed).update(value).digest('hex').slice(0,16)}`
const packets=[]
const records=pilot.records.map(r=>{
 const task=[...tasks.values()].find(t=>t.entry.pair_id===r.pair_id),p=review.pairs.find(p=>p.id===r.pair_id)
 if(!task||digest(r.text)!==r.text_hash||targetKey(r.target)!==r.target_key||!['middle_1','high_1'].includes(r.target.age_band))throw Error('Pilot passage/target binding invalid')
 if(suppliedInstruments&&!suppliedInstruments[r.id])throw Error('Missing supplied instruments for passage')
 const blind_item_id=blindId(r.id),instrument=suppliedInstruments?suppliedInstruments[r.id]:draftMeasurementItems(r)
 const expert=expertBlindPacket(blind_item_id,r.text,contexts.get(r.pair_id))
 if(v2){expert.version=2;expert.score_anchors=protocol.score_anchors;expert.response={expert_id:null,blind_item_id,passage_hash:r.text_hash,rated_at:null,ratings:Object.fromEntries(expert.criteria.map(k=>[k,{score:null,critical:null,passage_quote:null,research_quote:null,reason:null}])),distortions:[],reason:null};expert.instructions+=' Use the sealed four-point anchors; flag critical failures separately. Complete all eight criteria with quotes. A third reviewer first rates independently before seeing prior reviews.'}
 packets.push({blind_item_id,expert,student:{
  version:v2?2:1,blind_item_id,passage:r.text,
  instructions:'Read the passage first and record reading start/end before answering questions. Mark unknown word occurrences. Answer in Korean or English. Do not read the scoring rubric.',
  questions:instrument.map(({id,axis,prompt})=>({id,axis,prompt})),
  response:{student_id:null,reading_started_at:null,reading_finished_at:null,unknown_word_count:null,
   lexical_burden:null,sentence_burden:null,reasoning_burden:null,perceived_difficulty:null,
   answers:instrument.map(i=>({item_id:i.id,response:null}))},
 }})
 return {id:r.id,pair_id:r.pair_id,blind_item_id,source_id:task.entry.source_id,source_hash:task.entry.source_hash,source_revision:task.entry.source_revision,research_hash:task.entry.research_hash,target_key:r.target_key,grade:r.target.age_band,passage_hash:r.text_hash,link_confidence:p.link_review.confidence.grade,provenance_verified:true,instrument,expert_reviews:[],student_sessions:[],...(v2?{research_doi:p.relation.doi.toLowerCase(),research_contexts:contexts.get(r.pair_id),adapted_passage:r.text,topic:`research-${r.pair_id}`,source_family:'frontiers_for_young_minds',expert_assignment:null,adjudication:null}:{})}
})
if(new Set(records.map(r=>`${r.source_id}:${r.target_key}`)).size!==records.length||records.length!==tasks.size*2)throw Error('Expected complete pair × two target coverage')
const bundleInput={version:v2?2:1,mode:'local_educational_validation',taxonomy_version:DISTORTION_TAXONOMY_VERSION,
 pilot_hash:digest(pilotRaw),review_hash:pilot.review_hash,rules_hash:pilot.rules_hash,
 protocol_hash:digest(canonical(protocol)),instrument_hash:digest(canonical(instrumentIdentity(records))),protocol,protocol_approval:null,experts:[],records,...(v2?{study_id:arg('study-id'),participants:[],calibration_exclusions:[]}:{})}
const bundle=v2?refreshV2Hashes(bundleV2Schema.parse(bundleInput)):validationBundleSchema.parse(bundleInput)
if(v2){assertIndependentOfFixedCalibration(bundle);for(const p of packets){const r=bundle.records.find(r=>r.blind_item_id===p.blind_item_id);p.expert=deliveryPacketV2(bundle,r,'expert');p.student=deliveryPacketV2(bundle,r,'student')}}
assertPilotGradeCoverage(records,[...tasks.values()].map(t=>t.entry.pair_id))
const out=path.resolve(arg('output'))
if(fs.existsSync(out))throw Error('Output already exists; preserve the old study and choose a new directory')
for(const folder of ['expert','student','coordinator'])fs.mkdirSync(path.join(out,folder),{recursive:true})
function write(file,value){fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2)+'\n',{flag:'wx'})}
packets.sort((a,b)=>a.blind_item_id.localeCompare(b.blind_item_id))
for(const p of packets){write(`expert/${p.blind_item_id}.json`,p.expert);write(`student/${p.blind_item_id}.json`,p.student)}
write('coordinator/results.json',bundle)
if(v2)write('coordinator/registration-request.json',{human_lead_id:null,approved_at:null,manifest_hash:digestV2(manifestIdentityV2(bundle)),registration_evidence:null,note:'Draft identity only. Fill bands, reviewed instruments, screened experts and participant order first; prepare a fresh registration request. Never sign this incomplete draft.'})
write('coordinator/manifest.json',{version:1,blind_seed:seed,order:packets.map(p=>p.blind_item_id),
 source_attributions:pilot.records.map(r=>({id:r.id,attribution:r.source_attribution})),
 protocol_note:'Draft: human lead must preregister the exact protocol and reviewed instruments before any evaluations. Minimum sample is a pilot floor, not a grade norm. Experts complete meaning review before students start. Same student must not see both versions of a pair.',
 blind_handling:'Send expert files only for semantic review. Keep this coordinator folder, target labels, draft rubrics, prior observer judgments and results private. Retain source credits for disclosure after blind review.',
})
write('coordinator/taxonomy.json',taxonomy)
console.log(JSON.stringify({expert_packets:packets.length,student_packets:packets.length,draft_measurement_items:records.reduce((n,r)=>n+r.instrument.length,0),actual_expert_reviews:0,actual_student_sessions:0,gold:0,db_writes:0},null,2))
