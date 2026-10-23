// scripts/research/goal-data/review-b6/recheck-calc.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root='D:/workspace/Vocaflow-goal-data',rev='16561e875',old='c6adb9090';
const local='scripts/research/goal-data/review-b6/',dest='docs/research/goal-data-batches/review-b6/';
const base='scripts/research/goal-data/local/',doc='docs/research/goal-data-batches/D2-task-mapping/';
fs.mkdirSync(dest,{recursive:true});
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...a],{encoding:'utf8',maxBuffer:30*1024*1024});
const at=(p,r=rev)=>git('show',`${r}:${p}`),json=p=>JSON.parse(at(p));
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
// Snapshot all local packets once. Reruns use the snapshot, never another owner's evolving files.
const snapFile=local+'recheck-packets.local.json';
if(!fs.existsSync(snapFile)){
 const files={};for(const b of ['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23'])for(const f of fs.readdirSync(root+'/'+base+b))if(f.endsWith('.json'))files[base+b+'/'+f]=fs.readFileSync(root+'/'+base+b+'/'+f,'utf8');
 fs.writeFileSync(snapFile,JSON.stringify({observed_at:new Date().toISOString(),files},null,2));
}
const snap=JSON.parse(fs.readFileSync(snapFile,'utf8')),read=p=>JSON.parse(snap.files[p]);
const diff=git('diff',`${old}..${rev}`);fs.writeFileSync(local+'recheck-diff.local.json',JSON.stringify({old,rev,diff},null,2));
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
const run=at('scripts/research/goal-data/d2-run.mjs').replace(/^import .*\r?\n/gm,'');
const validate=(batch,overrides={})=>{
 const logs=[];let code=null;
 const f={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 new Function('crypto','fs','path','ROOT','nonHeldTasks','validateChunk','validateRow','process','console',run)(crypto,f,path,root,pilot.nonHeldTasks,pilot.validateChunk,pilot.validateRow,{argv:['node','d2-run',batch,'validate'],exit:c=>{code=c;}},{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))});return {code,logs};
};
const regression=Object.fromEntries(['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23'].map(b=>[b,validate(b)]));
const d3=at('scripts/research/goal-data/d3-build.mjs');
const passedCode=d3.slice(d3.indexOf('function passed('),d3.indexOf('\nconst reasoning'));
const atomic=pilot.nonHeldTasks().filter(t=>t.kind!=='integrated');
const passed=(inp,batch,overrides={},track='A')=>{
 const f={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 const fn=new Function('fs','path','validateChunk','validateRow',passedCode+'\nreturn passed;')(f,path,pilot.validateChunk,pilot.validateRow);
 return fn({dir:root+'/'+base+batch,subset:!!inp.tasks,contract:inp.contract,tasks:inp.tasks?atomic.filter(t=>inp.tasks.includes(t.id)):atomic},track,new Map(inp.rows.map(r=>[r.item_id,r])));
};
const d3Regression=Object.fromEntries(Object.keys(regression).map(b=>{const i=read(base+b+'/input.json');return [b,{expected:i.rows.length,accepted_A:passed(i,b).size,accepted_B:passed(i,b,{},'B').size}];}));
const counterexamples=[];
for(const contract of ['v2.1','v2.2','v2.3'])for(const mode of ['valid','nonempty_secondary','direct_present','no_subset','missing_secondary','null_secondary']){
 const inp=read(base+'b5-v22/input.json'),packet=read(base+'b5-v22/chunk-A-01.out.json');inp.contract=contract;
 const r=packet.rows[0],first=r.links.find(l=>l.relevance==='direct');
 for(const l of r.links)if(l.relevance==='direct')l.relevance='not_applicable';
 first.relevance='indirect';first.counterfactual={kind:'choice',choice:[1,2,3,4,5].find(n=>!(inp.rows[0].source.answers??[inp.rows[0].source.answer]).includes(n)),how:'고유 수행을 놓치면 특정 오답으로 진행하는 가상 검증 입력이다'};
 r.primary_task=null;r.secondary_tasks=[];r.directly_observable=[];
 if(mode==='nonempty_secondary')r.secondary_tasks=[first.task_id];if(mode==='direct_present')first.relevance='direct';if(mode==='no_subset')delete inp.tasks;if(mode==='missing_secondary')delete r.secondary_tasks;if(mode==='null_secondary')r.secondary_tasks=null;
 if(contract==='v2.3')for(const row of packet.rows)row.main_performance_outside_subset=false;
 const overrides={[`${root}/${base}b5-v22/input.json`]:JSON.stringify(inp),[`${root}/${base}b5-v22/chunk-A-01.out.json`]:JSON.stringify(packet)};
 if(contract==='v2.3')for(const t of ['A','B'])for(const n of [1,2]){const p=`${root}/${base}b5-v22/chunk-${t}-0${n}.out.json`;if(overrides[p])continue;const q=read(base+`b5-v22/chunk-${t}-0${n}.out.json`);for(const row of q.rows)row.main_performance_outside_subset=false;overrides[p]=JSON.stringify(q);}
 const d2=validate('b5-v22',overrides);counterexamples.push({contract,mode,item:r.item_id,d2_target_accepted:!d2.logs.some(l=>l.includes(r.item_id)),d2_errors:d2.logs.filter(l=>l.includes(r.item_id)),d3_target_accepted:passed(inp,'b5-v22',overrides).has(r.item_id)});
}
const inp=read(base+'b6-v23/input.json'),selection=json(doc+'b6-v23-selection.json');
const tracks=Object.fromEntries(['A','B'].map(t=>[t,[1,2].flatMap(n=>read(base+`b6-v23/chunk-${t}-0${n}.out.json`).rows)]));
const cats=['direct','indirect','not_applicable','unknown'];
const stat=p=>{const n=p.length,a=p.filter(([a,b])=>a===b).length,pe=cats.reduce((s,c)=>s+p.filter(x=>x[0]===c).length*p.filter(x=>x[1]===c).length/n/n,0);return {n,agree:a,agreement:a/n,kappa:pe===1?null:(a/n-pe)/(1-pe),counts:Object.fromEntries(['A','B'].map((t,i)=>[t,Object.fromEntries(cats.map(c=>[c,p.filter(x=>x[i]===c).length]))]))};};
const per={},pairs=[];for(const task of inp.tasks){const p=inp.rows.map(r=>['A','B'].map(t=>tracks[t].find(a=>a.item_id===r.item_id).links.find(l=>l.task_id===task).relevance));per[task]=stat(p);pairs.push(...p);}
const priority=['r.central_meaning','r.discourse_structure','e.option_correspondence','e.evidence_location','r.inference','e.task_demand'];
const pattern=Object.fromEntries(['A','B'].map(t=>[t,[1,2].map(n=>{
 const rows=read(base+`b6-v23/chunk-${t}-0${n}.out.json`).rows;
 const details=rows.map(r=>{const direct=priority.filter(task=>r.links.some(l=>l.task_id===task&&l.relevance==='direct'));return {item:r.item_id,primary:r.primary_task,predicted:direct[0]??null,matches:r.primary_task===(direct[0]??null),direct_count:direct.length};});
 const repeats=field=>{const counts=new Map();for(const r of rows)for(const l of r.links){const s=l[field];if(s){const k=String(s).replace(/\s+/g,' ').replace(/\d+/g,'').trim();const key=l.task_id+'|'+l.relevance+'|'+k;counts.set(key,[...(counts.get(key)??[]),r.item_id]);}}return [...counts].filter(([,ids])=>ids.length>1).map(([key,items])=>({key,items,count:items.length}));};
 const repeatedSpans=[];
 for(const field of ['why','task_distinction']){
  const seen=new Map();for(const r of rows)for(const l of r.links)if(l[field]){const text=String(l[field]).replace(/\s+/g,' ').replace(/\d+/g,'');for(let i=0;i<=text.length-15;i++){const span=text.slice(i,i+15);const k=l.task_id+'|'+l.relevance+'|'+span;if(!seen.has(k))seen.set(k,new Set());seen.get(k).add(r.item_id);}}
  const ranked=[...seen].filter(([,ids])=>ids.size>=3).sort((a,b)=>b[1].size-a[1].size);const picked=[];
  for(const [key,ids] of ranked){if(picked.some(p=>p.items.join('|')===[...ids].join('|')&&p.key.split('|').slice(0,2).join('|')===key.split('|').slice(0,2).join('|')))continue;picked.push({field,key,items:[...ids],count:ids.size});}repeatedSpans.push(...picked);
 }
 return {chunk:n,total:rows.length,matches:details.filter(x=>x.matches).length,multi_direct:details.filter(x=>x.direct_count>1).length,multi_direct_matches:details.filter(x=>x.direct_count>1&&x.matches).length,details,repeated_why:repeats('why'),repeated_distinction:repeats('task_distinction'),repeated_15char_spans:repeatedSpans};
})]));
const repeatTests=[];
for(const kind of ['insert_E2_unknown','insert_R4_direct','noninsert_E2_direct','insert_E2_direct','decision_path']){
 const chunk=kind.startsWith('insert')?'02':'01';
 const packet=read(base+`b6-v23/chunk-A-${chunk}.out.json`);const inserts=packet.rows.filter(r=>inp.rows.find(i=>i.item_id===r.item_id).type_id==='R-INSERT');const others=packet.rows.filter(r=>!inserts.includes(r));
 const targets=kind.startsWith('insert')?inserts:others.slice(0,3);
 for(const row of targets){if(kind==='decision_path')row.decision_path.summary='특정 결정 문장을 보지 않고 모든 문항을 같은 수행 설명으로 판정한다';else{const task=kind.includes('R4')?'r.discourse_structure':'e.evidence_location';const l=row.links.find(l=>l.task_id===task);l.relevance=kind.endsWith('unknown')?'unknown':'direct';l.why='검증용으로 세 문항 이상의 근거 설명을 똑같이 복제한 문장이다';}}
 const out=validate('b6-v23',{[`${root}/${base}b6-v23/chunk-A-${chunk}.out.json`]:JSON.stringify(packet)});
 repeatTests.push({kind,targets:targets.map(r=>r.item_id),repeat_detected:out.logs.some(l=>l.includes('같은 문장 반복')),code:out.code,repeat_errors:out.logs.filter(l=>l.includes('같은 문장 반복'))});
}
const sourceChecks=inp.rows.map(r=>({item:r.item_id,source_hash:hash(r.source)===r.source_sha256,passage_hash:hash(r.source.passage)===r.passage_sha256,selection_bound:selection.items.some(i=>i.item_id===r.item_id&&i.source_sha256===r.source_sha256&&i.passage_sha256===r.passage_sha256),eligible:r.body_ok&&Array.isArray(r.source.choices)&&r.type_id!=='R-CHART'&&(r.source.answers?.length>0||r.source.answer!=null)}));
const excluded=selection.excluded.map(e=>{const raw=inp.excluded_raw.find(r=>r.item_id===e.item_id);const {body_ok,...s}=raw.source;return {item:e.item_id,source_hash:hash(s)===e.snapshot.source_sha256,passage_hash:hash(s.passage)===e.snapshot.passage_sha256,type_preserved:s.type_id===e.snapshot.type_id,body_ok:body_ok===e.snapshot.body_ok};});
const restored=inp.rows.find(r=>r.item_id==='2023#38'),b5=read(base+'b5-v22/input.json').excluded_raw?.find(r=>r.item_id==='2023#38');
const jl=p=>at(p).trim().split('\n').map(JSON.parse),links=jl(doc+'b6-v23-item-task-links.jsonl'),disputed=jl(doc+'b6-v23-disputed-links.jsonl');
const stop_alarm=Object.fromEntries(inp.tasks.filter(t=>t!=='e.evidence_location').map(t=>[t,per[t].kappa===null?'unclear':per[t].agreement<.8&&per[t].kappa<.68?'stop':'ok']));
const locate=(p,needle)=>{const txt=snap.files[p]??at(p);return p+':'+(txt.split('\n').findIndex(l=>l.includes(needle))+1);};
const sample=json(doc+'b6-v23-review-sample.json');
const samples=[...sample.candidates.map(s=>({...s,group:'candidate'})),...sample.disputed.map(s=>({...s,group:'disputed'})),...['2022#31','2022#33','2022#34','M2506#33','M2506#34'].map(item=>({item,group:'blank_boundary',task:'r.central_meaning'})),{item:'M2506#24',group:'title_boundary',task:'e.evidence_location'}].map(s=>({sample:s,input:inp.rows.find(r=>r.item_id===s.item),judgments:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===s.item)])),evidence:[locate(base+'b6-v23/input.json',`"item_id": "${s.item}"`),...['A','B'].map(t=>{const n=tracks[t].findIndex(r=>r.item_id===s.item)<20?1:2;return locate(base+`b6-v23/chunk-${t}-0${n}.out.json`,`"item_id": "${s.item}"`);})]}));
fs.writeFileSync(local+'recheck-sample.local.json',JSON.stringify(samples,null,2));
const writes=new Map();
const memoryFs={...virtualFs,writeFileSync:(p,s)=>writes.set(path.basename(p),s),mkdirSync:()=>{}};
new Function('crypto','fs','path','ROOT','nonHeldTasks','validateChunk','validateRow','process','console',run)(crypto,memoryFs,path,root,pilot.nonHeldTasks,pilot.validateChunk,pilot.validateRow,{argv:['node','d2-run','b6-v23','agree'],exit:()=>{}},{log:()=>{},error:()=>{}});
const regenerated=Object.fromEntries([...writes].map(([f,s])=>[f,s===at(doc+f)]));
const insertChecks=inp.rows.filter(r=>r.type_id==='R-INSERT').map(r=>({item:r.item_id,given_in_passage:r.source.passage.includes(r.insert_split.given_sentence),body_in_passage:r.source.passage.includes(r.insert_split.body),isolated:['A','B'].every(t=>{const row=tracks[t].find(a=>a.item_id===r.item_id);return row.independent_assessment.eligibility==='not_suitable'&&row.links.find(l=>l.task_id==='e.evidence_location').relevance==='unknown';})}));
const blindChecks=['A','B'].flatMap(t=>[1,2].map(n=>{const p=read(base+`b6-v23/chunk-${t}-0${n}.json`);return {track:t,chunk:n,items:p.items.length,source_bound:p.items.every(r=>{const i=inp.rows.find(x=>x.item_id===r.item_id);return hash(r.source)===i.source_sha256&&r.source_sha256===i.source_sha256;}),prior_analysis_count:p.items.filter(r=>r.prior_analysis_unverified).length,prior_traps_count:p.items.filter(r=>r.prior_traps).length};}));
const diffSummary=changed.map(p=>{const content=at(p);let before='';try{before=at(p,old);}catch{};if(p.endsWith('.jsonl')){const rows=content.trim().split('\n').map(JSON.parse),prev=before.trim()?before.trim().split('\n').map(JSON.parse):[];return {file:p,before:prev.length,after:rows.length,added:rows.filter(r=>!prev.some(x=>JSON.stringify(x)===JSON.stringify(r))).length,removed:prev.filter(r=>!rows.some(x=>JSON.stringify(x)===JSON.stringify(r))).length};}return {file:p,sha256:hash(content),lines:content.split('\n').length};});
const previous=JSON.parse(fs.readFileSync(local+'packets.local.json','utf8'));
const changes=[], reasons=[], chunks=[];
for(const t of ['A','B'])for(const n of [1,2]){
 const p=base+`b6-v23/chunk-${t}-0${n}.out.json`, now=read(p).rows, before=JSON.parse(previous.files[p]).rows;
 const reasonRows=now.map(r=>({item:r.item_id,reason:r.primary_reason}));reasons.push({track:t,chunk:n,rows:reasonRows});
 const normReason=s=>String(s??'').replace(/\s+/g,' ').replace(/\d+/g,'').trim();
 const counts=new Map();for(const r of now){const k=normReason(r.primary_reason);counts.set(k,[...(counts.get(k)??[]),r.item_id]);const b=before.find(b=>b.item_id===r.item_id);if(b.primary_task!==r.primary_task)changes.push({track:t,chunk:n,item:r.item_id,old:b.primary_task,new:r.primary_task,reason_sha256:hash(r.primary_reason??''),evidence:locate(p,`"item_id": "${r.item_id}"`)});}
 const group=[...counts.values()].filter(a=>a.length>1);
 const spans=new Map();for(const r of now){const s=normReason(r.primary_reason);for(let i=0;i<=s.length-15;i++){const k=s.slice(i,i+15);if(!spans.has(k))spans.set(k,new Set());spans.get(k).add(r.item_id);}}
 const shared=[...spans.values()].filter(ids=>ids.size>=3);
 chunks.push({track:t,chunk:n,rows:now.length,links_unchanged:now.every(r=>JSON.stringify(r.links)===JSON.stringify(before.find(b=>b.item_id===r.item_id).links)),primary_reason_present:now.filter(r=>typeof r.primary_reason==='string'&&r.primary_reason.trim().length>=15).length,exact_duplicate_groups:group,duplicate_rows:group.reduce((s,a)=>s+a.length,0),single_direct_label_rows:now.filter(r=>r.primary_reason.startsWith('direct ')).length,shared_15char_span_count:shared.length,shared_span_rows:[...new Set(shared.flatMap(ids=>[...ids]))],primary_matches:pattern[t][n-1].matches,multi_direct:pattern[t][n-1].multi_direct,multi_matches:pattern[t][n-1].multi_direct_matches});
}
fs.writeFileSync(local+'recheck-reasons.local.json',JSON.stringify(reasons,null,2));
const changedSamples=changes.map(c=>({change:c,input:inp.rows.find(r=>r.item_id===c.item),judgment:tracks[c.track].find(r=>r.item_id===c.item)}));
fs.writeFileSync(local+'recheck-changes.local.json',JSON.stringify(changedSamples,null,2));
const jl3=p=>at('docs/research/goal-data-batches/D3-principles/'+p).trim().split('\n').map(JSON.parse);
const d3Rows=jl3('item-reasoning.jsonl'),d3Wrong=jl3('distractor-logic.jsonl');
const totals={items:d3Rows.length,primary_agree:d3Rows.filter(r=>r.primary_task.agree).length,wrong:d3Wrong.length,wrong_agree:d3Wrong.filter(r=>r.distortion.agree).length,source_wrong:d3Wrong.filter(r=>r.evidence==='source_text').length,source_wrong_agree:d3Wrong.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length};
const propagation=inp.rows.map(i=>{const r=d3Rows.find(r=>r.batch==='b6-v23'&&r.item_id===i.item_id);return {item:i.item_id,primary:['A','B'].every(t=>r.primary_task[t]===tracks[t].find(r=>r.item_id===i.item_id).primary_task),fields:['A','B'].every(t=>{const a=tracks[t].find(r=>r.item_id===i.item_id);return r.answer_logic[t]===a.answer_logic.why&&r.decision_path[t]===a.decision_path.summary&&r.passage_structure[t]===a.passage_structure&&r.design_hypothesis[t]===a.design_hypothesis;}),distractors:['A','B'].every(t=>tracks[t].find(r=>r.item_id===i.item_id).distractors.every(d=>d3Wrong.find(x=>x.batch==='b6-v23'&&x.item_id===i.item_id&&x.choice===d.choice)?.why[t]===d.why))};});
const v24tests=[];
for(const mode of ['reason_control','missing_reason','repeated_reason','E2_control','invalid_E2']){
 const input=read(base+'b6-v23/input.json');input.contract='v2.4';const packet=read(base+'b6-v23/chunk-A-01.out.json');const target=mode.includes('E2')?packet.rows[0]:packet.rows.find(r=>r.item_id==='M2506#29');
 if(mode==='missing_reason')delete target.primary_reason;
 if(mode==='repeated_reason')for(const r of packet.rows.slice(0,3))r.primary_reason='모든 문항에서 중심 내용을 정하는 것이 가장 직접적인 수행이다';
 if(mode==='invalid_E2'){const r=input.rows.find(r=>r.item_id===target.item_id);r.type_id='R-PURPOSE';target.links.find(l=>l.task_id==='e.evidence_location').relevance='direct';}
 if(mode==='E2_control'){target.links.find(l=>l.task_id==='e.evidence_location').relevance='not_applicable';target.secondary_tasks=target.secondary_tasks.filter(t=>t!=='e.evidence_location');}
 const overrides={[`${root}/${base}b6-v23/input.json`]:JSON.stringify(input),[`${root}/${base}b6-v23/chunk-A-01.out.json`]:JSON.stringify(packet)};
 const d2=validate('b6-v23',overrides);const targetErrors=d2.logs.filter(l=>l.includes('A '+target.item_id));v24tests.push({mode,target:target.item_id,d2_target_accepted:targetErrors.length===0,d2_target_errors:targetErrors,d3_target_accepted:passed(input,'b6-v23',overrides).has(target.item_id)});
}
const safeDiffSummary=diffSummary.map(r=>({...r}));
const directSets=inp.rows.map(i=>{const [a,b]=['A','B'].map(t=>tracks[t].find(r=>r.item_id===i.item_id).links.filter(l=>l.relevance==='direct').map(l=>l.task_id).sort());return {item:i.item_id,exact:JSON.stringify(a)===JSON.stringify(b),jaccard:a.filter(t=>b.includes(t)).length/new Set([...a,...b]).size};});
const allReasons=reasons.flatMap(c=>c.rows);const reasonGroups=new Map();for(const r of allReasons){const k=r.reason.replace(/\s+/g,' ').replace(/\d+/g,'').trim();reasonGroups.set(k,(reasonGroups.get(k)??0)+1);}
const metrics={source_commit:git('rev-parse',rev).trim(),base_commit:git('rev-parse',old).trim(),observed_at:snap.observed_at,diff_sha256:hash(diff),diff_summary:safeDiffSummary,regression,d3Regression,counterexamples,repeatTests,regenerated,chunks,reason_duplicates_all80:[...reasonGroups.values()].filter(n=>n>1),direct_sets:{exact:directSets.filter(r=>r.exact).length,total:40,mean_jaccard:directSets.reduce((s,r)=>s+r.jaccard,0)/40},changes,overall:stat(pairs),per_task:per,stop_alarm,primary_agreement:inp.rows.filter(i=>tracks.A.find(r=>r.item_id===i.item_id).primary_task===tracks.B.find(r=>r.item_id===i.item_id).primary_task).length,d3_totals:totals,d3_propagation:propagation,v24tests,packet_hashes:Object.fromEntries(Object.entries(snap.files).map(([p,s])=>[p,hash(s)]))};
for(const r of Object.values(regression))assert.equal(r.code,0);for(const r of Object.values(d3Regression)){assert.equal(r.accepted_A,r.expected);assert.equal(r.accepted_B,r.expected);}assert.ok(Object.values(regenerated).every(Boolean));assert.ok(chunks.every(c=>c.links_unchanged&&c.primary_reason_present===20));assert.equal(changes.length,8);assert.equal(metrics.primary_agreement,32);assert.equal(totals.primary_agree,165);assert.ok(propagation.every(p=>p.primary&&p.fields&&p.distractors));
for(const c of counterexamples){const expected=c.contract!=='v2.1'&&c.mode==='valid';assert.equal(c.d2_target_accepted,expected);assert.equal(c.d3_target_accepted,expected);}
assert.ok(sourceChecks.every(c=>c.source_hash&&c.passage_hash&&c.selection_bound&&c.eligible));assert.ok(excluded.every(c=>c.source_hash&&c.passage_hash));
assert.equal(repeatTests.find(x=>x.kind==='insert_E2_unknown').repeat_detected,false);for(const r of repeatTests.filter(x=>x.kind!=='insert_E2_unknown'))assert.equal(r.repeat_detected,true);
for(const c of v24tests.filter(c=>c.mode!=='repeated_reason')){assert.equal(c.d2_target_accepted,c.mode.endsWith('control'));assert.equal(c.d3_target_accepted,true);}
fs.writeFileSync(dest+'recheck-metrics.json',JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify({assertions:'passed',chunks,direct_sets:metrics.direct_sets,reason_duplicates_all80:metrics.reason_duplicates_all80,overall:metrics.overall,primary_agreement:metrics.primary_agreement,d3_totals:totals,v24tests},null,2));
