// scripts/research/factory-qualification/integrity.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export function checkBinding(root,file,expected){const absolute=path.resolve(root,file);if(!absolute.startsWith(path.resolve(root)+path.sep))return{file,ok:false,why:'outside research root'};if(!/^[a-f0-9]{64}$/.test(expected))return{file,ok:false,why:'invalid hash'};if(!fs.existsSync(absolute))return{file,ok:false,why:'missing'};const actual=sha(fs.readFileSync(absolute));return{file,expected,actual,ok:actual===expected};}
export function privateLeaks(value,at='$'){const issues=[];if(!value||typeof value!=='object')return issues;for(const[k,v]of Object.entries(value)){const here=`${at}.${k}`;if(['passage','passage_text','sentences','answer_key','gold_responses','full_gold','actual_response'].includes(k)&&((typeof v==='string'&&v.length>0)||(Array.isArray(v)&&v.length>0)||(v&&typeof v==='object'&&!Array.isArray(v))))issues.push(here);if(k==='answer'&&(typeof v==='number'||typeof v==='string'))issues.push(here);if(k==='choices'&&Array.isArray(v)&&v.length)issues.push(here);issues.push(...privateLeaks(v,here));}return issues;}
export function references(value,out=[]){if(!value||typeof value!=='object')return out;if(typeof value.path==='string'&&typeof value.sha256==='string')out.push({file:value.path,hash:value.sha256});for(const v of Object.values(value))references(v,out);return out;}
const dir='docs/research/factory-qualification/data',local='scripts/research/factory-qualification/local';
const json=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
export function runIntegrity(root=process.cwd()){
 const registration=json(root,`${dir}/registration.json`);const checks=[];const add=(category,file,hash)=>checks.push({category,...checkBinding(root,file,hash)});
 for(const[file,hash]of Object.entries(registration.v15_frozen))add('v15_public',file,hash);
 for(const[file,hash]of Object.entries(registration.v15_private_frozen))add('v15_private',file,hash);
 add('protocol','docs/research/factory-qualification/PROTOCOL.md',registration.protocol_sha256);
 const v14File='docs/research/csat-reading/data/v14/artifacts.json';let v14=0;
 if(fs.existsSync(path.join(root,v14File)))for(const[file,hash]of Object.entries(json(root,v14File).files)){add('v14_public',file,hash);v14++;}
 const sample=json(root,`${dir}/sample-registration.json`),manifest=json(root,`${dir}/sample-export.json`);
 add('sample_registration',`${dir}/sample-registration.json`,manifest.registration_sha256);
 for(const c of sample.metadata_chunks)add('metadata_chunks',`${local}/${c.file}`,c.sha256);
 for(const p of manifest.packets)add('dcp_inputs',p.file,p.sha256);
 const publicNames=['research-activities.json','dcp-main-review.json','dcp-counter-review.json','gold-comparison.json','gold-critic-summary.json','gold-boundary-review.json'];
 const refChecks=[];const leaks=[];
 for(const name of publicNames){const object=json(root,`${dir}/${name}`);for(const r of references(object))refChecks.push({category:'public_reference',...checkBinding(root,r.file,r.hash)});leaks.push(...privateLeaks(object).map(field=>({file:name,field})));}
 const main=json(root,`${dir}/dcp-main-review.json`);add('main_review',main.first_review_path,main.first_review_sha256);
 const critic=json(root,`${dir}/gold-critic-summary.json`);add('gold_critic',`${local}/gold-critic-first.json`,critic.first_complete_sha256);add('gold_blind',`${local}/gold-blind-input.json`,critic.input_sha256);add('gold_rules',`${dir}/gold-rules.json`,critic.rules_sha256);
 const seals=['research-activity-review-first.json','dcp-main-review-first.json','dcp-counter-review-first.json','gold-countercases-first.json','gold-critic-first.json','gold-blind-input.json','gold-reconciliation.json'].map(file=>({file:`${local}/${file}`,sha256:sha(fs.readFileSync(path.join(root,local,file))),basis:file==='dcp-counter-review-first.json'?'initial observed seal; no prior public byte seal supplied':'checked against supplied public references where present'}));
 const packetRows=manifest.packets.flatMap(p=>json(root,p.file).items);const structural=[];
 for(const r of packetRows){structural.push({id:r.id,item_hash_ok:sha(JSON.stringify(r.item))===r.item_sha256,source_hash_ok:sha(JSON.stringify(r.source))===r.source_sha256,source_present:typeof r.source?.content==='string'&&r.source.content.length>0,payload_sentences:Array.isArray(r.item.payload?.sentences),answer_object:!!r.item.answer_key&&typeof r.item.answer_key==='object'});}
 const splitSets=Object.fromEntries(['main','counter'].map(s=>[s,new Set(packetRows.filter(r=>r.split===s).map(r=>r.item.ref_id))]));const splitOverlap=[...splitSets.main].filter(id=>splitSets.counter.has(id));
 const allChecks=[...checks,...refChecks];const failures=allChecks.filter(x=>!x.ok);const structuralFailures=structural.filter(x=>!x.item_hash_ok||!x.source_hash_ok||!x.source_present||!x.payload_sentences||!x.answer_object);
 return{version:'fq1-integrity-1',checks:allChecks,private_first_seals:seals,structural,split_source_overlap:splitOverlap,public_leaks:leaks,failures,coverage:{v15_public:Object.keys(registration.v15_frozen).length,v15_private:Object.keys(registration.v15_private_frozen).length,v14_public:v14,metadata_chunks:sample.metadata_chunks.length,private_first_seals:seals.length,dcp_inputs:packetRows.length,public_reference_bindings:refChecks.length,structural_failures:structuralFailures.length},pass:failures.length===0&&leaks.length===0&&structuralFailures.length===0&&splitOverlap.length===0,scope:'hash/shape/privacy integrity only; no meaning, rights, learner or assessment approval'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const out=runIntegrity();const target=`${dir}/integrity.json`;
 if(process.argv.includes('--check')){const first=json(process.cwd(),target);for(const seal of first.private_first_seals){const c=checkBinding(process.cwd(),seal.file,seal.sha256);if(!c.ok){out.pass=false;out.failures.push(c);}}}
 else if(process.argv.includes('--run')){if(fs.existsSync(target))throw Error('preserve first integrity output; use --check');fs.writeFileSync(target,JSON.stringify(out,null,2)+'\n');}
 else throw Error('use --run to create own first output or --check for read-only verification');
 console.log(JSON.stringify({pass:out.pass,coverage:out.coverage,failures:out.failures,public_leaks:out.public_leaks}));if(!out.pass)process.exitCode=1;
}
