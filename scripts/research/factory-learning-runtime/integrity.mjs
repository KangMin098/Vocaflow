// scripts/research/factory-learning-runtime/integrity.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const DIR='docs/research/factory-learning-runtime';
const LOCAL='scripts/research/factory-learning-runtime/local';
export function checkBinding(root,file,expected){
 if(typeof file!=='string'||!file)return{file,ok:false,why:'Missing file path'};
 const absolute=path.resolve(root,file),base=path.resolve(root);
 if(!absolute.startsWith(base+path.sep))return{file,ok:false,why:'File outside root'};
 if(!HEX.test(expected??''))return{file,ok:false,why:'Missing or invalid hash'};
 if(!fs.existsSync(absolute))return{file,ok:false,why:'Missing bound file'};
 const actual=sha(fs.readFileSync(absolute));return{file,expected,actual,ok:actual===expected};
}
export function privacyIssues(value,at='$',synthetic=false,schema=false){
 const issues=[];
 if(typeof value==='string'){
  if(/(?:sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s]+|https:\/\/[a-z0-9]+\.supabase\.co)/.test(value))issues.push({at,why:'Secret or database connection value'});
  return issues;
 }
 if(!value||typeof value!=='object')return issues;
 const isSchema=schema||typeof value.$schema==='string';
 const isSynthetic=synthetic||value.population==='synthetic_contract_test'||value.synthetic_contract_test===true;
 const rawFields=new Set(['passage','passage_text','original_passage','full_gold','gold_responses','gold_answer','answer_key','actual_response','private_evidence']);
 const contentFields=new Set(['sentences','choices','stem','context','bank','accepted_answers','answer','response','answer_text','explanation_ko']);
 const symbols=v=>typeof v==='string'?/^(?:TOKEN|OPTION|CHOICE|ANSWER|RESPONSE|STEM|CONTEXT|HINT|SYNTHETIC|ITEM|FIXTURE)[_A-Za-z0-9 .:-]*$/i.test(v):Array.isArray(v)?v.every(symbols):v&&typeof v==='object'?Object.values(v).every(x=>typeof x==='number'||typeof x==='boolean'||x===null||symbols(x)):typeof v==='number'||v===null;
 for(const[k,v]of Object.entries(value)){
  const where=at+'.'+k;
  const nonempty=typeof v==='string'?v.length>0:Array.isArray(v)?v.length>0:v&&typeof v==='object';
  const schemaDef=isSchema&&(v&&typeof v==='object'||['required','enum','const','type','description','title','additionalProperties'].includes(k));
  const coverageMetadata=/\.coverage\.answer_key$/.test(where)&&['all','none','bounded_context','not_read'].includes(v);
  if(rawFields.has(k)&&nonempty&&!schemaDef&&!coverageMetadata)issues.push({at:where,why:'Private raw content field'});
  if(contentFields.has(k)&&nonempty&&!schemaDef&&!(isSynthetic&&symbols(v)))issues.push({at:where,why:'Real content/response field without symbolic synthetic scope'});
  issues.push(...privacyIssues(v,where,isSynthetic,isSchema));
 }
 return issues;
}
export function references(value,at='$',out=[]){
 if(!value||typeof value!=='object')return out;
 for(const[field,hashField]of [['path','sha256'],['file','sha256'],['first_review_path','first_review_sha256'],['first_private_path','first_private_sha256']]){
  if(typeof value[field]==='string'&&(value[hashField]!==undefined||/^(?:docs|scripts)\//.test(value[field])))out.push({file:value[field],sha256:value[hashField]??value.file_sha256,at});
 }
 for(const[k,v]of Object.entries(value))references(v,at+'.'+k,out);
 return out;
}
export function linkIssues(root,file,body){
 const issues=[];let count=0;
 for(const m of body.matchAll(/\]\(([^)]+)\)/g)){
  let target=m[1].replace(/^<|>$/g,'');if(/^(?:https?:|app:|#)/.test(target))continue;
  try{target=decodeURIComponent(target.split('#')[0]).replace(/:\d+$/,'');}catch{issues.push({file,target,why:'Malformed link'});continue;}
  if(!target)continue;count++;
  if(!fs.existsSync(path.resolve(path.dirname(path.join(root,file)),target)))issues.push({file,target,why:'Missing local target'});
 }
 return{count,issues};
}
export function sourceExcerptIssues(text,privateItems){
 const normalize=x=>String(x).toLowerCase().replace(/\s+/g,' ').trim();const haystack=normalize(text),issues=[];
 for(const item of privateItems){
  const values=[item.source?.content,...(Array.isArray(item.item?.payload?.sentences)?item.item.payload.sentences:[]),item.item?.payload?.context,item.item?.answer_key?.explanation_ko].filter(x=>typeof x==='string');
  if(values.some(value=>{const normalized=normalize(value);for(let start=0;start+90<=normalized.length;start+=45)if(haystack.includes(normalized.slice(start,start+90)))return true;return false;}))issues.push({id:item.sample_id,why:'At least 90 normalized characters copied from private source/payload/explanation'});
 }
 return issues;
}
function walk(root,dir,extension){
 const absolute=path.join(root,dir);if(!fs.existsSync(absolute))return[];
 return fs.readdirSync(absolute,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(root,dir+'/'+e.name,extension):e.name.endsWith(extension)?[dir+'/'+e.name]:[]);
}
export function verifySnapshot(root,snapshot){
 return[...(snapshot.private_first_seals??[]),...(snapshot.public_snapshot??[])].map(r=>checkBinding(root,r.file,r.sha256)).filter(r=>!r.ok);
}
export function runIntegrity(root=process.cwd()){
 const json=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const checks=[],errors=[],leaks=[],links=[],external=[];
 const add=(category,file,hash)=>checks.push({category,...checkBinding(root,file,hash)});
 const reg=json(DIR+'/data/registration.json');
 if(reg.version!=='FQR1-preregistered'||reg.seed!=='FQR1-20261015'||Object.keys(reg.frozen??{}).length!==463)errors.push('Preregistration identity or 463 historical file denominator drift');
 for(const[file,hash]of Object.entries(reg.frozen??{}))add('historical_registered',file,hash);
 add('protocol',reg.protocol?.path,reg.protocol?.sha256);
 const historicalLedgers=['docs/research/factory-qualification/data/integrity.json','docs/research/factory-qualification-v11/data/integrity.json'];
 for(const file of historicalLedgers){const old=json(file);for(const c of old.checks??[])if(c.file?.includes('/local/'))add('historical_private_binding',c.file,c.expected??c.actual);for(const s of [...(old.private_first_seals??[]),...(old.first_seals??[])])add('historical_private_first',s.file,s.sha256);}
 const sample=json(DIR+'/data/sample-registration.json'),exported=json(DIR+'/data/sample-export.json'),packet=json(LOCAL+'/sample-content-first.json');
 add('metadata_freeze',sample.metadata_receipt?.file,sample.metadata_receipt?.sha256);
 add('selection_code','scripts/research/factory-learning-runtime/sample-freeze.mjs',sample.code_sha256);
 add('prior_registration',sample.prior_registration?.file,sample.prior_registration?.sha256);
 add('frozen_selection',DIR+'/data/sample-registration.json',exported.registration_sha256);
 add('private_actual_packet',exported.packet?.file,exported.packet?.sha256);
 if(sample.seed!==reg.seed||sample.body_key_explanation_values_reads_before_freeze!==0||sample.metadata_only_before_freeze!==true||packet.registration_sha256!==exported.registration_sha256)errors.push('Metadata-first selection binding invalid');
 if(sample.selected.length!==14||packet.items.length!==14||new Set(packet.items.map(x=>x.item.ref_id)).size!==14)errors.push('Actual sample must be 14 items and 14 distinct refs');
 const priorIds=new Set(sample.prior_registration.excluded_item_ids),priorRefs=new Set(sample.prior_registration.excluded_source_ids);
 if(priorIds.size!==12||priorRefs.size!==12)errors.push('Prior sample exclusion denominator drift');
 const typeCounts={};
 for(const selected of sample.selected){
  typeCounts[selected.type]=(typeCounts[selected.type]??0)+1;
  const row=packet.items.find(x=>x.sample_id===selected.sample_id);
  if(!row||row.item.id!==selected.id||row.item.ref_id!==selected.ref_id||row.item.type!==selected.type){errors.push('Selected ID/type/ref mismatch '+selected.sample_id);continue;}
  if(priorIds.has(row.item.id)||priorRefs.has(row.item.ref_id))errors.push('Prior sample/source reused '+selected.sample_id);
  if(sha(JSON.stringify(row.item))!==row.item_sha256||sha(JSON.stringify(row.source))!==row.source_sha256)errors.push('Actual item/source object hash drift '+selected.sample_id);
  if(typeof row.source?.content!=='string'||!row.source.content.length)errors.push('Actual source body missing '+selected.sample_id);
  const publicRow=exported.metadata.find(x=>x.sample_id===selected.sample_id);
  if(!publicRow||publicRow.item_sha256!==row.item_sha256||publicRow.source_sha256!==row.source_sha256)errors.push('Export public metadata binding drift '+selected.sample_id);
 }
 if(reg.primary_types.length!==7||reg.primary_types.some(t=>typeCounts[t]!==2)||Object.keys(typeCounts).length!==7)errors.push('Seven actual types, 2 each denominator drift');
 const inventory=json(DIR+'/data/inventory.json');
 if(inventory.volumes.length!==13||inventory.volumes.filter(x=>x.series==='vocab').length!==6||inventory.volumes.filter(x=>x.series==='syntax').length!==6||inventory.volumes.filter(x=>x.series==='reading'&&x.step===1).length!==1)errors.push('Book combination denominator must be 6+6+1');
 const author=json(DIR+'/data/content-review.json');
 add('author_first',LOCAL+'/content-review-first.json',author.first_sha256);
 add('author_input',LOCAL+'/sample-content-first.json',author.input_sha256);
 const privateAuthor=json(LOCAL+'/content-review-first.json');
 if(author.items.length!==14||privateAuthor.items.length!==14)errors.push('Content author count drift');
 for(const row of author.items){
  const item=packet.items.find(x=>x.sample_id===row.id);if(!item){errors.push('Unknown actual reviewed item '+row.id);continue;}
  const coverage=row.coverage;
  if(coverage?.source_sha256!==item.source_sha256||coverage.source_total_chars!==item.source.content.length)errors.push('Coverage source/hash/size drift '+row.id);
  if(coverage.source_body==='bounded_context'&&(!Array.isArray(coverage.source_ranges)||!coverage.source_ranges.length))errors.push('Bounded source coverage must state ranges '+row.id);
  for(const range of coverage.source_ranges??[])if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<0||range.end>item.source.content.length||range.end<=range.start)errors.push('Invalid source coverage range '+row.id);
  if(row.public_qualified!==false||row.assessment_qualified!==false)errors.push('Actual review promoted release '+row.id);
 }
 const requiredIndependent=DIR+'/data/independent-review.json';
 if(!fs.existsSync(path.join(root,requiredIndependent)))errors.push('Required independent first review public ledger missing');
 else{
  const independent=json(requiredIndependent);
  const firstPath=independent.first_review_path??independent.first_private_path??LOCAL+'/independent-review-first.json';
  add('independent_first',firstPath,independent.first_review_sha256??independent.first_private_sha256??independent.first_sha256);
  const blindPath=independent.blind_input_path??LOCAL+'/blind-content-input.json';
  add('independent_blind',blindPath,independent.blind_input_sha256??independent.input_sha256);
 }
 const publicFiles=walk(root,DIR,'.json').filter(f=>!f.endsWith('/integrity.json'));
 for(const file of publicFiles){
  const value=json(file),bytes=fs.readFileSync(path.join(root,file),'utf8');
  leaks.push(...privacyIssues(value).map(i=>({file,...i})),...sourceExcerptIssues(bytes,packet.items).map(i=>({file,...i})));
  for(const ref of references(value)){
   const isObserved=file.endsWith('/code-audit.json')&&ref.at.startsWith('$.code_files')||file.endsWith('/inventory.json')&&ref.at.startsWith('$.catalog_snapshot');
   if(isObserved){if(!HEX.test(ref.sha256??''))errors.push('External snapshot hash missing '+ref.file);external.push({...ref,why:'Observed read-only external working-tree receipt; may change after observation'});}
   else add('new_public_binding',ref.file,ref.sha256);
  }
 }
 const docs=walk(root,DIR,'.md');
 for(const file of docs){const body=fs.readFileSync(path.join(root,file),'utf8'),checked=linkIssues(root,file,body);links.push({file,count:checked.count});errors.push(...checked.issues.map(i=>'Missing doc link '+i.file+': '+i.target));leaks.push(...sourceExcerptIssues(body,packet.items).map(i=>({file,...i})));}
 const failures=checks.filter(c=>!c.ok),uniquePrivate=[...new Map(checks.filter(c=>c.ok&&c.file.includes('/local/')).map(c=>[c.file,{file:c.file,sha256:c.actual}])).values()];
 const snapshots=[...publicFiles,...docs].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
 return{version:'FQR1-integrity1',checks,errors,failures,public_leaks:leaks,doc_links:links,private_first_seals:uniquePrivate,public_snapshot:snapshots,external_observation_receipts:external,counts:{historical_registered:463,inherited_private_unique:new Set(checks.filter(c=>c.category.startsWith('historical_private')).map(c=>c.file)).size,new_public_json:publicFiles.length,new_docs:docs.length,private_bound_unique:uniquePrivate.length},denominators:{primary_types:7,actual_new_items:14,distinct_new_sources:14,book_combinations:13,prior_excluded_items:12,prior_excluded_sources:12,inherited_regression_tests:122,test_count_not_source_count:true,semantic_observation_not_student_effect:true},pass:!errors.length&&!failures.length&&!leaks.length,scope:'Byte binding, privacy, source coverage bounds, denominator and link integrity; no automated semantic/rights/human/student approval'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=runIntegrity(),target=DIR+'/data/integrity.json';
 if(process.argv.includes('--run')){if(fs.existsSync(target))throw Error('First snapshot exists: refuse overwrite');if(!result.pass)throw Error(JSON.stringify({errors:result.errors,failures:result.failures,leaks:result.public_leaks}));fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');}
 else if(process.argv.includes('--check')){if(fs.existsSync(target)){const failures=verifySnapshot(process.cwd(),JSON.parse(fs.readFileSync(target,'utf8')));result.failures.push(...failures);if(failures.length)result.pass=false;}}
 else throw Error('Use read-only --check; final --run requires root milestone readiness');
 console.log(JSON.stringify({pass:result.pass,counts:result.counts,denominators:result.denominators,errors:result.errors,failures:result.failures,leaks:result.public_leaks}));if(!result.pass)process.exitCode=1;
}
