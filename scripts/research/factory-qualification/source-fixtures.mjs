// scripts/research/factory-qualification/source-fixtures.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceGuard} from './qualification.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const metadataPath='docs/research/csat-reading/data/v15/exam-sources.json';
const versionPath='docs/research/csat-reading/data/v15/v3-version-audit.json';
const metadata=JSON.parse(read(metadataPath)),versions=JSON.parse(read(versionPath));
const exam=id=>{const row=metadata.exams.find(x=>x.id===id);if(!row)throw Error('missing exam metadata '+id);return row;};
const a=exam('2014A'),b=exam('2014B'),bad=exam('M2009'),duplicate=exam('M2106'),script=exam('M2109');
if(a.listening_end!==22||b.body_lo!==23||bad.question_file.sha256!==duplicate.question_file.sha256||script.named_key_file.kind!=='listening_script')throw Error('historical premise changed');
const version=versions.rows.find(x=>x.item_id==='2014A#32');
if(!version||version.latest_published_version!==5||versions.read_connection_version!==3)throw Error('historical revision premise changed');
const source=id=>{const e=exam(id);return {expected_exam_id:id,header_exam_id:id,expected_form:e.paper_form??undefined,observed_form:e.paper_form??undefined,listening_end:e.listening_end,reading_start:e.body_lo,reading_end:e.body_hi,expected_sha256:e.question_file.sha256,actual_sha256:e.question_file.sha256};};
// Synthetic guard-only positive control. Verified is a fixture flag, not renewed source verification or approval.
const key=id=>{const e=exam(id);return {kind:'answer_key',content_verified:true,actual_sha256:e.named_key_file.sha256,exam_id:id,form:e.paper_form??undefined,row_count:45,distinct_numbers:45,min_no:1,max_no:45,total_points:100};};
const first={source:source('2014A'),key:key('2014A'),require_exam_key:true};
const fixture=(id,description,input,state,code,evidence)=>({id,description,input,expected:{state,code},evidence});
export const fixtures=[
 fixture('SG01','Incorrect 17 listening / 18 reading split imposed on 2014A',{...structuredClone(first),source:{...source('2014A'),listening_end:17,reading_start:18}},'fail','2014_regime_mismatch',{metadata_exam:'2014A',observed_listening_end:22,observed_reading_start:23}),
 fixture('SG02','Incorrect split imposed on separately preserved 2014B',{source:{...source('2014B'),listening_end:17,reading_start:18},key:key('2014B')},'fail','2014_regime_mismatch',{metadata_exam:'2014B',observed_listening_end:22,observed_reading_start:23}),
 fixture('SG03','Mix A question with B key',{...structuredClone(first),key:key('2014B')},'fail','key_exam_mismatch',{source_exam:'2014A',key_exam:'2014B'}),
 fixture('SG04','Contrafactual odd/even key mix while exam ID stays same',{...structuredClone(first),key:{...key('2014A'),form:'짝수'}},'fail','key_form_mismatch',{metadata_exam:'2014A',observed_paper_form:a.paper_form,contrafactual_key_form:'짝수'}),
 fixture('SG05','M2009 catalog body is same hash as adjudicated M2106 body',{source:{...source('M2009'),header_exam_id:'M2106'},key:key('M2009')},'fail','exam_header_mismatch',{catalog_exam:'M2009',adjudicated_exam:'M2106',shared_question_sha256:bad.question_file.sha256,historical_adjudication:'exam-sources M2009 source_note; no new PDF/header inspection'}),
 fixture('SG06','Named answer file is actually listening script',{source:source('M2109'),key:{kind:'listening_transcript',content_verified:true,exam_id:'M2109',actual_sha256:script.named_key_file.sha256}},'fail','transcript_is_not_answer_key',{metadata_exam:'M2109',observed_document_kind:script.named_key_file.kind}),
 fixture('SG07','Preserved analysis revision3 compared with observed latest5',{...structuredClone(first),declared:{analysis:{id:'2014A#32:analysis',revision:3,sha256:null}},generated_binding:{analysis:{id:'2014A#32:analysis',revision:3,sha256:null}},latest_analysis:{revision:version.latest_published_version}},'unknown','newer_analysis_requires_conflict_review',{metadata_item:version.item_id,preserved_analysis_revision:3,latest_observed_revision:version.latest_published_version,analysis_content_hash_available:false}),
 fixture('SG08','Generated artifact incorrectly binds latest5 while Gold declares preserved3',{...structuredClone(first),declared:{analysis:{id:'2014A#32:analysis',revision:3,sha256:null}},generated_binding:{analysis:{id:'2014A#32:analysis',revision:5,sha256:null}}},'fail','analysis_binding_conflict',{metadata_item:version.item_id,preserved_analysis_revision:3,latest_observed_revision:version.latest_published_version,analysis_content_hash_available:false}),
 fixture('SG09','Unresolved named-key document kind stays unknown',{source:source('2025'),key:{kind:'decode_unresolved',content_verified:false,exam_id:'2025',actual_sha256:exam('2025').named_key_file.sha256}},'unknown','key_document_kind_unverified',{metadata_exam:'2025',observed_document_kind:exam('2025').named_key_file.kind})
];
export function calculate(){
 const evaluated=fixtures.map(f=>{const observed=sourceGuard(f.input);if(observed.state!==f.expected.state||![...observed.fail,...observed.unknown].includes(f.expected.code))throw Error('guard fixture mismatch '+f.id);return {...f,observed};});
 return {version:'FQ1-source-guard-fixtures1',evidence:[{path:metadataPath,sha256:sha(metadataPath),observed_at_utc:metadata.observed_at_utc},{path:versionPath,sha256:sha(versionPath)}],guard_function_sha256:crypto.createHash('sha256').update(sourceGuard.toString()).digest('hex'),fixture_count:fixtures.length,all_expected_states_reproduced:true,fixtures:evaluated,limits:['Metadata-grounded negative and positive controls, not new corpus/PDF/key audit','Correcting one injected mismatch only removes that mismatch; guard pass is not public/source/legal/assessment qualification','No answer values, original passages or individual Gold emitted','Latest revision alone does not invalidate preserved Gold; conflict review remains unknown'],public_qualified:0,assessment_qualified:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out='docs/research/factory-qualification/data/source-guard-fixtures.json';const encoded=JSON.stringify(calculate(),null,2)+'\n';
 if(process.argv.includes('--check')){if(read(out).toString('utf8')!==encoded)throw Error('source guard fixture hash/version drift');console.log('source fixtures9 reproduced; preserved metadata hashes verified');}
 else {if(fs.existsSync(path.join(root,out)))throw Error('refuse overwrite');fs.writeFileSync(path.join(root,out),encoded);console.log('source guard fixtures9 written');}
}
