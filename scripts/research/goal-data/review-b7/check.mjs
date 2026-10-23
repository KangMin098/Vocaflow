// scripts/research/goal-data/review-b7/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root='D:/workspace/Vocaflow-goal-data',rev='e87bdc173',old='78ff7df39';
const local='scripts/research/goal-data/review-b7/',dest='docs/research/goal-data-batches/review-b7/';
const base='scripts/research/goal-data/local/',doc='docs/research/goal-data-batches/D2-task-mapping/';
fs.mkdirSync(dest,{recursive:true});
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...a],{encoding:'utf8',maxBuffer:30*1024*1024,stdio:['pipe','pipe','pipe']});
const at=(p,r=rev)=>git('show',`${r}:${p}`),json=p=>JSON.parse(at(p));
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
// Snapshot all local packets once. Reruns use the snapshot, never another owner's evolving files.
const snapFile=local+'packets.local.json';
if(!fs.existsSync(snapFile)){
 const files={};for(const b of ['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23','b7-v24'])for(const f of fs.readdirSync(root+'/'+base+b))if(f.endsWith('.json'))files[base+b+'/'+f]=fs.readFileSync(root+'/'+base+b+'/'+f,'utf8');
 fs.writeFileSync(snapFile,JSON.stringify({observed_at:new Date().toISOString(),files},null,2));
}
const snap=JSON.parse(fs.readFileSync(snapFile,'utf8')),read=p=>JSON.parse(snap.files[p]);
const diff=git('diff',`${old}..${rev}`);fs.writeFileSync(local+'diff.local.json',JSON.stringify({old,rev,diff},null,2));
const changed=git('diff','--name-only',`${old}..${rev}`).trim().split('\n');
const virtualFs={...fs,readFileSync:(p,...args)=>{
 const rel=path.relative(root,String(p)).replaceAll('\\','/');
 if(snap.files[rel]!==undefined)return snap.files[rel];
 if(!rel.startsWith('../'))return at(rel);
 return fs.readFileSync(p,...args);
}};
let lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'');
lib=lib.replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`);
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateRow,validateChunk};')(virtualFs,path);
const validatorCode=at('scripts/research/goal-data/d2-validate.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'');
const makeValidator=new Function('validateChunk','validateRow',validatorCode+'\nreturn makeValidator;')(pilot.validateChunk,pilot.validateRow);
const run=at('scripts/research/goal-data/d2-run.mjs').replace(/^import .*\r?\n/gm,'');
const validate=(batch,overrides={})=>{
 const logs=[];let code=null;
 const f={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 new Function('crypto','fs','path','ROOT','nonHeldTasks','makeValidator','process','console',run)(crypto,f,path,root,pilot.nonHeldTasks,makeValidator,{argv:['node','d2-run',batch,'validate'],exit:c=>{code=c;}},{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))});return {code,logs};
};
const regression=Object.fromEntries(['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23','b7-v24'].map(b=>[b,validate(b)]));
const d3=at('scripts/research/goal-data/d3-build.mjs');
const passedCode=d3.slice(d3.indexOf('function passed('),d3.indexOf('\nconst reasoning'));
const atomic=pilot.nonHeldTasks().filter(t=>t.kind!=='integrated');
const passed=(inp,batch,overrides={},track='A')=>{
 const f={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 const fn=new Function('fs','path','validateChunk','validateRow',passedCode+'\nreturn passed;')(f,path,pilot.validateChunk,pilot.validateRow);
 return fn({dir:root+'/'+base+batch},track,makeValidator(inp,inp.tasks?atomic.filter(t=>inp.tasks.includes(t.id)):atomic));
};
const d3Regression=Object.fromEntries(Object.keys(regression).map(b=>{const i=read(base+b+'/input.json');return [b,{expected:i.rows.length,accepted_A:passed(i,b).size,accepted_B:passed(i,b,{},'B').size}];}));
const inp=read(base+'b7-v24/input.json'), selection=json(doc+'b7-v24-selection.json');
const tracks=Object.fromEntries(['A','B'].map(t=>[t,[1,2].flatMap(n=>read(base+`b7-v24/chunk-${t}-0${n}.out.json`).rows)]));
const locate=(p,needle)=>p+':'+((snap.files[p]??at(p)).split('\n').findIndex(l=>l.includes(needle))+1);
const sample=json(doc+'b7-v24-review-sample.json');
const ids=[...new Set([...sample.candidates,...sample.disputed].map(s=>s.item).concat(['2024#21','2025#21','2023#19','2024#19','2025#19','2024#26','2024#27','2024#28','2025#26','2025#27','2025#28']))];
const samples=ids.map(id=>({id,input:inp.rows.find(i=>i.item_id===id),judgments:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===id)])),evidence:[locate(base+'b7-v24/input.json',`"item_id": "${id}"`),...['A','B'].map(t=>locate(base+`b7-v24/chunk-${t}-0${tracks[t].findIndex(r=>r.item_id===id)<20?1:2}.out.json`,`"item_id": "${id}"`))]}));
fs.writeFileSync(local+'sample.local.json',JSON.stringify(samples,null,2));
const cats=['direct','indirect','not_applicable','unknown'];
const stat=p=>{const n=p.length,agree=p.filter(([a,b])=>a===b).length,pe=cats.reduce((s,c)=>s+p.filter(x=>x[0]===c).length*p.filter(x=>x[1]===c).length/n/n,0);return {n,agree,agreement:agree/n,kappa:pe===1?null:(agree/n-pe)/(1-pe)};};
const pairs=[],per={};for(const task of inp.tasks){const p=inp.rows.map(i=>['A','B'].map(t=>tracks[t].find(r=>r.item_id===i.item_id).links.find(l=>l.task_id===task).relevance));per[task]=stat(p);pairs.push(...p);}
const agreement=json(doc+'b7-v24-agreement.json');
assert.equal(Number(stat(pairs).agreement.toFixed(4)),agreement.agreement);assert.equal(Number(stat(pairs).kappa.toFixed(4)),agreement.kappa);
for(const t of inp.tasks){assert.equal(Number(per[t].agreement.toFixed(4)),agreement.per_task[t].agreement);assert.equal(Number(per[t].kappa.toFixed(4)),agreement.per_task[t].kappa);}
const sourceChecks=inp.rows.map(r=>({item:r.item_id,source:hash(r.source)===r.source_sha256,passage:hash(r.source.passage)===r.passage_sha256,selection:selection.items.some(i=>i.item_id===r.item_id&&i.source_sha256===r.source_sha256&&i.passage_sha256===r.passage_sha256)}));
const excluded=selection.excluded.map(e=>{const r=inp.excluded_raw.find(r=>r.item_id===e.item_id);const {body_ok,...s}=r.source;return {item:e.item_id,source:hash(s)===e.snapshot.source_sha256,passage:hash(s.passage)===e.snapshot.passage_sha256,body_ok:body_ok===e.snapshot.body_ok,type_independently_present:Object.hasOwn(r.source,'type_id')};});
assert.ok(sourceChecks.every(r=>r.source&&r.passage&&r.selection));assert.ok(excluded.every(r=>r.source&&r.passage&&r.body_ok));assert.equal(hash(selection.items),selection.selection_sha256);
const prior=new Set();for(const p of git('ls-tree','-r','--name-only',rev,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')&&!p.endsWith('/b7-v24-selection.json')))for(const r of json(p).items)prior.add(r.item_id);for(const r of json('docs/csat-learner/v62/data-expansion/pilot-selection.json').items)prior.add(r.item_id);
assert.ok(inp.rows.every(r=>!prior.has(r.item_id)));assert.equal(inp.rows.length,40);assert.equal(excluded.length,3);
// Reuse the exact exclusion function with synthetic source maps, never execute fetch or writes.
const exp=at('scripts/research/goal-data/d2-export.mjs');const exclusionCode=exp.slice(exp.indexOf('function exclusion('),exp.indexOf('// 제외 행도'));
const fixture=inp.rows[0],src={...fixture.source,type_id:fixture.type_id,body_ok:true};
const exclude=(range,judged,source=src)=>new Function('byId','def','judgedBefore','EXCLUDE_TYPES','insertSplit',exclusionCode+';return exclusion("probe")')(new Map([['probe',source]]),{range},new Map(judged?[['probe','previous-batch']]:[]),{'R-CHART':'chart'},()=>({confidence:'certain'}));
const exportProbes={range_prior:exclude(true,true),range_new:exclude(true,false),fixed_prior:exclude(false,true)};assert.match(exportProbes.range_prior,/이미 판정/);assert.equal(exportProbes.range_new,null);assert.equal(exportProbes.fixed_prior,null);
const types=at('scripts/research/goal-data/d2-validate.mjs').match(/const IN_SUBSET_TYPES = (\[[^\n]+\])/)[1];const guarded=new Function('return '+types)();assert.equal(guarded.length,13);
const V=makeValidator(inp,atomic.filter(t=>inp.tasks.includes(t.id)));
const oldValidator=at('scripts/research/goal-data/d2-validate.mjs',old).replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'');const oldV=new Function('validateChunk','validateRow',oldValidator+';return makeValidator')(pilot.validateChunk,pilot.validateRow)(inp,atomic.filter(t=>inp.tasks.includes(t.id)));
const a02=tracks.A.slice(20);const blanket=a02.map(r=>({...r,main_performance_outside_subset:true}));
const typeProbes=blanket.map(r=>({item:r.item_id,type:inp.rows.find(i=>i.item_id===r.item_id).type_id,old:oldV.row(r),current:V.row(r)}));assert.equal(typeProbes.filter(r=>r.current.some(e=>e.includes('판정 TASK 안'))).length,12);assert.ok(typeProbes.every(r=>r.old.length===0));
const allTypeProbes=guarded.map(type=>{const i=structuredClone(inp);i.rows[0].type_id=type;const r={...tracks.A[0],main_performance_outside_subset:true};return {type,rejected:makeValidator(i,atomic.filter(t=>i.tasks.includes(t.id))).row(r).some(e=>e.includes('판정 TASK 안'))};});assert.ok(allTypeProbes.every(r=>r.rejected));
const priority=['r.central_meaning','r.discourse_structure','e.option_correspondence','e.evidence_location','r.inference','e.task_demand'];
const patterns=['A','B'].flatMap(t=>[1,2].map(n=>{const rows=tracks[t].slice((n-1)*20,n*20);const norm=s=>String(s??'').replace(/\s+/g,' ').replace(/\d+/g,'').trim();const details=rows.map(r=>{const ds=priority.filter(task=>r.links.some(l=>l.task_id===task&&l.relevance==='direct'));return {id:r.item_id,primary:r.primary_task,predicted:ds[0]??null,matches:r.primary_task===(ds[0]??null),direct_count:ds.length};});const groups=field=>{const m=new Map();for(const r of rows){const k=norm(typeof r[field]==='object'?JSON.stringify(r[field]):r[field]);m.set(k,[...(m.get(k)??[]),r.item_id]);}return [...m].filter(([k,v])=>k&&v.length>1).map(([key,items])=>({sha256:hash(key),items}));};return {track:t,chunk:n,total:rows.length,matches:details.filter(r=>r.matches).length,multi_direct:details.filter(r=>r.direct_count>1).length,multi_matches:details.filter(r=>r.direct_count>1&&r.matches).length,reason_repeats:groups('primary_reason'),decision_repeats:groups('decision_path'),details};}));
const outside=Object.fromEntries(['A','B'].map(t=>[t,tracks[t].filter(r=>r.main_performance_outside_subset).map(r=>r.item_id)]));
const sameFields=Object.fromEntries(['primary_reason','decision_path','answer_logic','links','main_performance_outside_subset'].map(f=>[f,tracks.A.filter(a=>hash(a[f])===hash(tracks.B.find(b=>b.item_id===a.item_id)[f])).map(r=>r.item_id)]));
const blind=['A','B'].flatMap(t=>[1,2].map(n=>{const p=read(base+`b7-v24/chunk-${t}-0${n}.json`);return {track:t,chunk:n,count:p.items.length,source_bound:p.items.every(r=>hash(r.source)===r.source_sha256&&inp.rows.some(i=>i.item_id===r.item_id&&i.source_sha256===r.source_sha256)),prior_analysis:p.items.filter(r=>r.prior_analysis_unverified).length,prior_traps:p.items.filter(r=>r.prior_traps).length,other_track_exposed:JSON.stringify(p).includes('primary_reason')};}));
const writes=new Map(),memoryFs={...virtualFs,writeFileSync:(p,s)=>writes.set(path.basename(p),s),mkdirSync:()=>{}};
new Function('crypto','fs','path','ROOT','nonHeldTasks','makeValidator','process','console',run)(crypto,memoryFs,path,root,pilot.nonHeldTasks,makeValidator,{argv:['node','d2-run','b7-v24','agree'],exit:()=>{}},{log:()=>{},error:()=>{}});
const regenerated=Object.fromEntries([...writes].map(([f,s])=>[f,s===at(doc+f)]));assert.ok(Object.values(regenerated).every(Boolean));
const diffDetails=changed.map(p=>{const content=at(p);let before='';try{before=at(p,old);}catch{}if(p.endsWith('.jsonl')){const a=content.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],as=new Set(a.map(hash)),bs=new Set(b.map(hash));return {path:p,rows:a.length,added:a.filter(r=>!bs.has(hash(r))),removed:b.filter(r=>!as.has(hash(r)))};}return {path:p,content,before};});
fs.writeFileSync(local+'diff-detail.local.json',JSON.stringify(diffDetails,null,2));
const jl=p=>at(p).trim().split('\n').map(JSON.parse);const d3doc='docs/research/goal-data-batches/D3-principles/';
const d3rows=jl(d3doc+'item-reasoning.jsonl'),wrong=jl(d3doc+'distractor-logic.jsonl');
const totals={items:d3rows.length,primary:d3rows.filter(r=>r.primary_task.agree).length,wrong:wrong.length,wrong_agree:wrong.filter(r=>r.distortion.agree).length,links:jl(doc+'item-task-links.jsonl').length,disputed:jl(doc+'disputed-links.jsonl').length};
const propagation=inp.rows.map(i=>{const r=d3rows.find(r=>r.batch==='b7-v24'&&r.item_id===i.item_id);return {item:i.item_id,ok:['A','B'].every(t=>{const a=tracks[t].find(r=>r.item_id===i.item_id);return r.primary_task[t]===a.primary_task&&r.answer_logic[t]===a.answer_logic.why&&r.decision_path[t]===a.decision_path.summary&&r.passage_structure[t]===a.passage_structure&&r.design_hypothesis[t]===a.design_hypothesis&&a.distractors.every(d=>wrong.find(w=>w.batch==='b7-v24'&&w.item_id===i.item_id&&w.choice===d.choice)?.why[t]===d.why);})};});assert.ok(propagation.every(r=>r.ok));
for(const r of Object.values(regression))assert.equal(r.code,0);for(const r of Object.values(d3Regression)){assert.equal(r.accepted_A,r.expected);assert.equal(r.accepted_B,r.expected);}
const metrics={rev,old,observed_at:snap.observed_at,regression,d3Regression,selection:{items:inp.rows.length,exam_totals:selection.exam_totals,sourceChecks,excluded,selection_hash:hash(selection.items)},stats:stat(pairs),per,stop_alarm:agreement.stop_alarm,exportProbes,typeProbes,allTypeProbes,outside,patterns,sameFields,blind,regenerated,totals,propagation,diff:diffDetails.map(d=>({path:d.path,rows:d.rows,added:d.added?.length,removed:d.removed?.length})),sample_ids:ids};
fs.writeFileSync(local+'metrics.local.json',JSON.stringify(metrics,null,2)+'\n');
fs.writeFileSync(dest+'recalculation.json',JSON.stringify({...metrics,regression:Object.fromEntries(Object.entries(regression).map(([b,r])=>[b,{exit_code:r.code,defects:0}]))},null,2)+'\n');
console.log('b2–b7 D2/D3 regression, source hashes, 12-row type probe, 13 types, 3 export probes, 4 regenerated artifacts and D3 propagation: assertions passed.');
export {fs,path,root,rev,old,local,dest,base,doc,at,git,hash,snap,read,pilot,makeValidator,validate,passed,atomic,inp,tracks,metrics,locate,samples,sample};
