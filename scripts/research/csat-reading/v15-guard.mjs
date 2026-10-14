// scripts/research/csat-reading/v15-guard.mjs
import fs from 'node:fs';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
export const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function frozen(entries){for(const[p,h]of Object.entries(entries))if(digest(p)!==h)throw Error('Frozen input drift '+p);return Object.keys(entries).length;}
export function publicOnly(v,p='root'){
 if(!v||typeof v!=='object')return;
 for(const[k,x]of Object.entries(v)){const presence=k==='choices'&&(typeof x==='number'||typeof x==='boolean'||x===null);if(!presence&&['passage','choices','correct_answer','full_response','raw_candidate','gold','student_prompt','response','response_text','expected_facets'].includes(k))throw Error('Private content '+p+'.'+k);publicOnly(x,p+'.'+k);}
}
export function readable(v,p='root'){
 if(typeof v==='string'&&(/\?{2,}|\uFFFD/.test(v)))throw Error('Encoding damaged '+p);
 if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))readable(x,p+'.'+k);
}
export function noPromotion(s){
 if(s.students===0&&(s.assessment_qualified>0||s.mastery_verified===true))throw Error('Synthetic/AI cannot authorize assessment or mastery');
 if(s.human_or_rights_approved===false&&s.public_qualified>0)throw Error('AI content cannot authorize public rights');
}
export function check(){const d='docs/research/csat-reading/data/v15/',r=read(d+'registration.json');const previous=frozen(r.prior_hashes);const inheritedFrozen=frozen(read('docs/research/csat-reading/data/v14/registration.json').previous_hashes);const inheritedInputs=frozen(read('docs/research/csat-reading/data/v14/pilot-registration.json').hashes);const inheritedFirsts=frozen(read('docs/research/csat-reading/data/v14/pilot-execution.json').first_hashes);if(digest('docs/research/csat-reading/PROTOCOL-v1.5.md')!==r.protocol_sha256)throw Error('Protocol drift');frozen({[r.private_access.path]:r.private_access.sha256});
 const files=fs.readdirSync(d).filter(f=>f.endsWith('.json')&&!['artifacts.json','integrity.json'].includes(f));for(const f of files){const v=read(d+f);publicOnly(v,f);readable(v,f);}
 let refs=0;function bind(v){if(!v||typeof v!=='object')return;if(v.path&&(v.sha256||v.file_sha256)){frozen({[v.path]:v.sha256??v.file_sha256});refs++;}for(const x of Object.values(v))bind(x);}for(const f of files)bind(read(d+f));
 if(fs.existsSync(d+'assessment-registration.json'))frozen(read(d+'assessment-registration.json').hashes);
 const out={version:'1.5',previous_files_preserved:previous,inherited_frozen_files:inheritedFrozen,inherited_pilot_inputs:inheritedInputs,inherited_first_rater_files:inheritedFirsts,public_json_checked:files.length,bound_refs:refs,privacy:'pass',encoding:'pass',scientific_validity:'not_implied'};fs.writeFileSync(d+'integrity.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)check();
