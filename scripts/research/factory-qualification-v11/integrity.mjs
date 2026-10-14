// scripts/research/factory-qualification-v11/integrity.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha = x=>crypto.createHash('sha256').update(x).digest('hex');
const HASH=/^[a-f0-9]{64}$/;
const DIR='docs/research/factory-qualification-v11';
export function checkBinding(root,file,expected){
 if(typeof file!=='string'||!file.length) return {file,ok:false,why:'missing path'};
 const base=path.resolve(root), absolute=path.resolve(base,file);
 if(!absolute.startsWith(base+path.sep)) return {file,ok:false,why:'outside research root'};
 if(!HASH.test(expected??'')) return {file,ok:false,why:'invalid or missing SHA256'};
 if(!fs.existsSync(absolute)) return {file,ok:false,why:'missing bound file'};
 const actual=sha(fs.readFileSync(absolute));return {file,expected,actual,ok:expected===actual};
}
export function privacyIssues(value,at='$'){
 const out=[];
 if(!value||typeof value!=='object') return out;
 for(const[k,v]of Object.entries(value)){
  const here=at+'.'+k;
  const forbidden=['passage','passage_text','sentences','answer_key','gold_responses','full_gold','actual_response','response','semantic_equivalent','choices'];
  const nonempty=typeof v==='string'?v.length>0:Array.isArray(v)?v.length>0:v&&typeof v==='object';
  const schemaDefinition=v&&typeof v==='object'&&!Array.isArray(v)&&(typeof v.type==='string'||typeof v.$ref==='string'||v.properties);
  if(forbidden.includes(k)&&nonempty&&!schemaDefinition)out.push(here);
  if(k==='answer'&&(typeof v==='number'||typeof v==='string'))out.push(here);
  if(k==='full'&&typeof v==='string'&&v.length>0)out.push(here);
  out.push(...privacyIssues(v,here));
 }return out;
}
export function fileReferences(value,at='$',out=[]){
 if(!value||typeof value!=='object')return out;
 if(typeof value.path==='string'){
  const digest=value.sha256??value.file_sha256;
  if(digest!==undefined||/^(docs|scripts)\//.test(value.path))out.push({file:value.path,hash:digest,at});
 }
 if(typeof value.first_review_path==='string')out.push({file:value.first_review_path,hash:value.first_review_sha256,at});
 if(typeof value.first_private_path==='string')out.push({file:value.first_private_path,hash:value.first_private_sha256,at});
 for(const[k,v]of Object.entries(value))fileReferences(v,at+'.'+k,out);
 return out;
}
export function docLinkIssues(root,filename,body){
 const issues=[];let count=0;
 for(const m of body.matchAll(/\]\(([^)]+)\)/g)){
  let target=m[1].replace(/^<|>$/g,'');
  if(/^(?:https?:|app:|#)/.test(target))continue;
  target=decodeURIComponent(target.split('#')[0]).replace(/:\d+$/,'');
  if(!target)continue;count++;
  if(!fs.existsSync(path.resolve(path.dirname(path.join(root,filename)),target)))issues.push({file:filename,target});
 }return {count,issues};
}
function files(root,dir,ext){
 if(!fs.existsSync(path.join(root,dir)))return [];
 return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(root,dir+'/'+e.name,ext):e.name.endsWith(ext)?[dir+'/'+e.name]:[]);
}
export function runIntegrity(root=process.cwd()){
 const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const reg=json(DIR+'/data/registration.json');const checks=[],errors=[],leaks=[],links=[];
 const add=(category,file,hash)=>checks.push({category,...checkBinding(root,file,hash)});
 if(reg.version!=='FQ1.1-preregistered'||Object.keys(reg.frozen??{}).length!==406)errors.push('Registration version or 406-file denominator drift');
 for(const[file,h]of Object.entries(reg.frozen??{}))add('historical_406',file,h);
 add('preregistered_protocol',reg.protocol?.path,reg.protocol?.sha256);
 add('historical_integrity',reg.historical_integrity?.path,reg.historical_integrity?.sha256);
 const fq=json('docs/research/factory-qualification/data/registration.json');
 for(const[file,h]of Object.entries(fq.v15_private_frozen??{}))add('v15_private',file,h);
 const old=json(reg.historical_integrity.path);
 for(const s of old.private_first_seals??[])add('FQ1_private_first',s.file,s.sha256);
 const publicFiles=files(root,DIR,'.json').filter(p=>!p.endsWith('/integrity.json'));
 const observedExternal=[];
 for(const file of publicFiles){
  const value=json(file);leaks.push(...privacyIssues(value).map(field=>({file,field})));
  if(!value.version && !value.$schema && file!==DIR+'/data/product-audit.json') errors.push('Public artifact version missing: '+file);
  const refs=fileReferences(value);
  for(const r of refs){
   if(value.product_root&&r.at.startsWith('$.files')){
    if(!HASH.test(r.hash??'')||! /^[a-f0-9]{40}$/.test(value.product_head??''))errors.push('External product receipt hash/version missing: '+r.file);
    observedExternal.push({...r,product_root:value.product_root,product_commit:value.product_head,status:'time-bound observed product receipt; external active worktree not rehashed'});
   }else add('public_bound_reference',r.file,r.hash);
  }
 }
 for(const file of files(root,DIR,'.md')){const result=docLinkIssues(root,file,fs.readFileSync(path.join(root,file),'utf8'));links.push({file,count:result.count});errors.push(...result.issues.map(i=>'Missing relative link '+i.file+': '+i.target));}
 const local='scripts/research/factory-qualification-v11/local/';
 const independent=json(DIR+'/data/independent-review.json'),independentResearch=json(DIR+'/data/independent-research-review.json');
 const second=json(DIR+'/data/revision2-review.json'),secondResearch=json(DIR+'/data/revision2-research-review.json');
 const third=json(DIR+'/data/revision3-review.json'),feedback=json(DIR+'/data/feedback-review.json');
 const independentFiles=[['independent-review-first.json',independent.first_review_sha256],['independent-research-first.json',independentResearch.first_review_sha256],['revision2-review-first.json',secondResearch.private_first_sha256],['revision2-combined-review-first.json',second.private_first_sha256],['revision3-review-combined-first.json',third.first_sha256],['feedback-review-first.json',feedback.first_review_sha256]];
 for(const[file,h]of independentFiles)add('new_independent_first',local+file,h);
 const combined=json(local+'revision3-review-combined-first.json');
 add('new_independent_first',local+'revision3-review-first.json',combined.research_first_sha256);
 const thirdDcpPath=local+'revision3-review-dcp-first.json';
 if(JSON.stringify(json(thirdDcpPath))!==JSON.stringify(combined.dcp))errors.push('Third DCP first differs from hash-bound combined first');
 add('new_independent_first_embedded_in_bound_combined',thirdDcpPath,sha(fs.readFileSync(path.join(root,thirdDcpPath))));
 const dcpLedgers=['dcp-repairs.json','dcp-repairs-v2.json','dcp-repairs-v3.json','dcp-repairs-v4.json'].map(p=>json(DIR+'/data/'+p));
 const dcpFiles=[['dcp-repairs-candidates-first.json','dcp-repairs-blind-first.json','dcp-repairs-author-cases-first.json'],['dcp-repairs-v2-candidates-first.json','dcp-repairs-v2-blind-first.json','dcp-repairs-v2-author-cases-first.json'],['dcp-v3-candidate-first.json','dcp-v3-blind-first.json','dcp-v3-author-cases-first.json'],['dcp-v4-candidate-first.json','dcp-v4-blind-first.json']];
 for(const[i,ledger]of dcpLedgers.entries())for(const[j,key]of ['candidates_sha256','blind_sha256','authored_cases_sha256'].entries())if(dcpFiles[i][j])add('new_DCP_artifact_or_blind',local+dcpFiles[i][j],ledger.hashes[key]);
 const oldContent=json('docs/research/factory-qualification/data/research-activities.json').activities;
 const oldFactory=json('docs/research/factory-qualification/data/sample-export.json').packets;
 const factoryIds=oldFactory.flatMap(p=>json(p.file).items.map(x=>x.id));
 if(oldContent.length!==8||factoryIds.length!==12||new Set(factoryIds).size!==12)errors.push('Old20 content denominator not8+12 unique items');
 const repairs=fs.existsSync(path.join(root,DIR+'/data/research-repairs.json'))?json(DIR+'/data/research-repairs.json'):null;
 if(repairs && (repairs.activities.length!==4||new Set(repairs.activities.map(a=>a.activity_id)).size!==4||repairs.activities.some(a=>!oldContent.some(o=>o.content_id===a.activity_id))))errors.push('Research repairs must be four existing activities');
 const researchLedgers=['research-repairs.json','research-repairs-v2.json','research-repairs-v3.json'].map(p=>json(DIR+'/data/'+p));
 const researchVersions=researchLedgers.reduce((n,r)=>n+r.activities.length,0),DCPVersions=dcpLedgers.reduce((n,r)=>n+r.new_content_revisions,0);
 const final=json(DIR+'/data/final-qualification.json'),selectedUnique=new Set(final.selected.map(a=>a.content_id)).size;
 if(final.selected.length!==selectedUnique||selectedUnique!==final.counts.selected_unique_contents||researchVersions+DCPVersions!==final.counts.artifact_versions_created)errors.push('Final selected/version denominator disagrees with intermediate artifact ledgers');
 if(final.selected.filter(a=>a.cohort==='research').length!==researchLedgers[0].activities.length||final.selected.filter(a=>a.cohort==='DCP').length!==dcpLedgers[0].items.length)errors.push('Final cohort denominator disagrees with original repair ledger');
 const snapshots=publicFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
 const firstSeals=checks.filter(c=>c.ok&&c.file.includes('/local/')&& /first|review|blind|packet|repair/.test(c.file)).map(c=>({file:c.file,sha256:c.actual}));
 const uniqueFirstSeals=[...new Map(firstSeals.map(x=>[x.file,x])).values()];
 const failures=checks.filter(c=>!c.ok);
 return {version:'FQ1.1-integrity1',checks,first_seals:uniqueFirstSeals,public_snapshot:snapshots,external_observation_receipts:observedExternal,public_leaks:leaks,doc_links:links,errors,failures,
   denominators:{original_distinct_content:oldContent.length+factoryIds.length,old_research_activities:oldContent.length,old_factory_items:factoryIds.length,selected_unique_contents:selectedUnique,selected_research_contents:final.selected.filter(a=>a.cohort==='research').length,selected_DCP_contents:final.selected.filter(a=>a.cohort==='DCP').length,research_artifact_versions:researchVersions,DCP_artifact_versions:DCPVersions,total_artifact_versions:researchVersions+DCPVersions,original_and_revision_not_added_as_new_sources:true},
   counts:{historical_frozen:406,old_private_bindings:checks.filter(x=>x.category==='v15_private'||x.category==='FQ1_private_first').length,new_public_json:publicFiles.length,private_bound_refs:uniqueFirstSeals.length},
   pass:!failures.length&&!errors.length&&!leaks.length,scope:'byte/version/privacy/link/denominator integrity; no semantics, rights, human or student qualification'};
}
export function verifySnapshot(root,snapshot){
 const failures=[];
 for(const r of [...snapshot.first_seals,...snapshot.public_snapshot]){const c=checkBinding(root,r.file,r.sha256);if(!c.ok)failures.push(c);}
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const output=runIntegrity(),target=DIR+'/data/integrity.json';
 if(process.argv.includes('--run')){if(fs.existsSync(target))throw Error('First integrity snapshot exists; use --check');if(!output.pass)throw Error(JSON.stringify({failures:output.failures,errors:output.errors,leaks:output.public_leaks}));fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');}
 else if(process.argv.includes('--check')){if(fs.existsSync(target)){const failures=verifySnapshot(process.cwd(),JSON.parse(fs.readFileSync(target,'utf8')));output.failures.push(...failures);if(failures.length)output.pass=false;}}
 else throw Error('Use --check (read only) or explicitly authorized --run (first snapshot)');
 console.log(JSON.stringify({pass:output.pass,counts:output.counts,denominators:output.denominators,failures:output.failures,errors:output.errors,public_leaks:output.public_leaks}));if(!output.pass)process.exitCode=1;
}
