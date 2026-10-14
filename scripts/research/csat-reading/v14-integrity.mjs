// scripts/research/csat-reading/v14-integrity.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const base='docs/research/csat-reading/', dir=base+'data/v14/';
export const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function checkHashes(entries){for(const [p,h] of Object.entries(entries))if(sha(p)!==h)throw Error('Frozen artifact changed: '+p);return Object.keys(entries).length;}
export function rejectPrivatePayload(value, location='root'){
  if(!value||typeof value!=='object')return;
  for(const [k,v] of Object.entries(value)){
    if(['passage','choices','correct_answer','answer_key','full_response','equivalent_response','wrong_response','fov_rows','raw_candidate','normalized_candidate'].includes(k))throw Error('Private payload in public artifact: '+location+'.'+k);
    rejectPrivatePayload(v,location+'.'+k);
  }
}
export function rejectDamagedText(value,location='root'){
 if(typeof value==='string'&&/\?{2,}|\uFFFD/.test(value))throw Error('Damaged text: '+location);
 if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))rejectDamagedText(v,location+'.'+k);
}
export function run(){
 const registration=read(dir+'registration.json'), freeze=read(dir+'pilot-registration.json'), execution=read(dir+'pilot-execution.json');
 const previous=checkHashes(registration.previous_hashes), protocol=checkHashes(freeze.hashes), first=checkHashes(execution.first_hashes);
 const logic=read(dir+'logic-review-summary.json');checkHashes({[logic.private_review.path]:logic.private_review.sha256});
 const map=read(dir+'map-agreement.json');checkHashes({[dir+'map-review.json']:map.first_hash,[dir+'map-second-review.json']:map.second_hash});
 const summaries=['education-review-summary.json',...Array.from({length:3},(_,i)=>`education-revision${i+1}-review-summary.json`)].filter(f=>fs.existsSync(dir+f));
 for(const file of summaries){const s=read(dir+file); const p=file==='education-review-summary.json'?'education-review-first.json':file.replace('-review-summary.json','-review.json'); const h=s.private_review_sha256??s.private_review?.sha256; if(h)checkHashes({['scripts/research/csat-reading/local/v14/'+p]:h});}
 const publicFiles=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!['artifacts.json','final-integrity.json'].includes(f));
 for(const f of publicFiles)rejectPrivatePayload(read(dir+f),f);
 let boundReferences=0;
 function references(value){if(!value||typeof value!=='object')return;if(typeof value.path==='string'&&typeof value.sha256==='string'&&/^(scripts|docs)\//.test(value.path)){checkHashes({[value.path]:value.sha256});boundReferences++;}for(const v of Object.values(value))references(v);}
 for(const f of publicFiles)references(read(dir+f));
 const latest=[3,2,1].find(n=>fs.existsSync(dir+`education-revision${n}-review-summary.json`));
 if(latest){const review=read(dir+`education-revision${latest}-review-summary.json`);if(review.counts.encoding_defects===0||latest>=3)rejectDamagedText(read(`scripts/research/csat-reading/local/v14/education-packages-revision${latest}.json`));}
 const docs=fs.readdirSync(base).filter(f=>f.startsWith('V14-')&&f.endsWith('.md'));
 for(const f of docs){const text=fs.readFileSync(base+f,'utf8');for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const target=match[1].split('#')[0];if(target&&!/^(https?:|\/)/.test(target)&&!fs.existsSync(path.resolve(base,target)))throw Error('Missing doc link '+f+': '+target);}}
 const result={version:'1.4',previous_frozen_files:previous,preregistered_files:protocol,first_rater_files:first,bound_references:boundReferences,public_json_files_checked:publicFiles.length,linked_docs_checked:docs.length,private_payload_guard:'pass',first_results_modified:false,scientific_validity:'not_implied_by_integrity'};
 fs.writeFileSync(dir+'final-integrity.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run();
