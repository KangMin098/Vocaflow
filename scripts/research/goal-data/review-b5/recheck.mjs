// scripts/research/goal-data/review-b5/recheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root='D:/workspace/Vocaflow-goal-data';
const rev='e81b759f1', old='7ad98fda0';
const doc='docs/research/goal-data-batches/D2-task-mapping/';
const base='scripts/research/goal-data/local/';
const dest='docs/research/goal-data-batches/review-b5/';
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...a],{encoding:'utf8',maxBuffer:20*1024*1024});
const at=(p,r=rev)=>git('show',`${r}:${p}`);
const json=(p)=>JSON.parse(at(p));
const local=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const diff=git('diff',`${old}..${rev}`);
fs.writeFileSync('scripts/research/goal-data/review-b5/diff.local.json',JSON.stringify({old,rev,diff},null,2));
const changed=git('diff','--name-only',`${old}..${rev}`).trim().split('\n');
const normalizedDiff=[];
for(const p of changed){
 if(p.endsWith('.jsonl')){
  const parse=s=>s.trim().split('\n').map(JSON.parse);
  const before=parse(at(p,old)), after=parse(at(p));
  const key=r=>`${r.batch}|${r.item}|${r.task}`;
  const bm=new Map(before.map(r=>[key(r),r]));
  normalizedDiff.push({file:p,before:before.length,after:after.length,changes:after.flatMap(r=>{
   const b=bm.get(key(r));return !b?[{key:key(r),added:true}]:Object.keys(r).filter(k=>JSON.stringify(b[k])!==JSON.stringify(r[k])).map(k=>({key:key(r),field:k,before:b[k],after:r[k]}));
  }),removed:before.filter(r=>!after.some(a=>key(a)===key(r))).map(key)});
 }else if(p.endsWith('mapping-coverage.json')){
  const a=JSON.parse(at(p,old)),b=json(p); normalizedDiff.push({file:p,changed_fields:Object.keys(b).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])),old_scope:a.scope,new_scope:b.scope});
 }
}
// All tracked dependencies are read at the requested commit, never the live b6 HEAD.
const virtualFs={...fs,readFileSync:(p,...args)=>{
 const rel=path.relative(root,String(p)).replaceAll('\\','/');
 if(!rel.startsWith('../')&&!rel.includes('/local/')){try{return at(rel);}catch{}}
 return fs.readFileSync(p,...args);
}};
let lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'');
lib=lib.replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`);
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateRow,validateChunk};')(virtualFs,path);
const run=at('scripts/research/goal-data/d2-run.mjs').replace(/^import .*\r?\n/gm,'');
const input=local(base+'b5-v22/input.json');
const tracks=Object.fromEntries(['A','B'].map(t=>[t,[1,2].flatMap(n=>local(`${base}b5-v22/chunk-${t}-0${n}.out.json`).rows)]));
const validate=(batch,overrides={})=>{
 const logs=[];let code=null;
 const f={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 new Function('crypto','fs','path','ROOT','nonHeldTasks','validateChunk','validateRow','process','console',run)(crypto,f,path,root,pilot.nonHeldTasks,pilot.validateChunk,pilot.validateRow,{argv:['node','d2-run',batch,'validate'],exit:c=>{code=c;}},{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))});
 return {code,logs};
};
const regression=Object.fromEntries(['b2-v2','b3-insert','b4-v21','b5-v22'].map(b=>[b,validate(b)]));
const d3=at('scripts/research/goal-data/d3-build.mjs');
const passedCode=d3.slice(d3.indexOf('function passed('),d3.indexOf('\nconst reasoning'));
const atomic=pilot.nonHeldTasks().filter(t=>t.kind!=='integrated');
const d3Passed=new Function('fs','path','validateChunk','validateRow',passedCode+'\nreturn passed;')(virtualFs,path,pilot.validateChunk,pilot.validateRow);
const d3Regression=Object.fromEntries(['b2-v2','b3-insert','b4-v21','b5-v22'].map(batch=>{
 const inp=local(base+batch+'/input.json');
 const src={dir:root+'/'+base+batch,subset:!!inp.tasks,contract:inp.contract,tasks:inp.tasks?atomic.filter(t=>inp.tasks.includes(t.id)):atomic};
 const byId=new Map(inp.rows.map(r=>[r.item_id,r]));
 return [batch,{expected:byId.size,A:d3Passed(src,'A',byId).size,B:d3Passed(src,'B',byId).size}];
}));
const counterexamples=[];
for(const contract of ['v2.1','v2.2','v2.3']) for(const mode of ['valid','nonempty_secondary','direct_present','no_subset','missing_secondary','null_secondary']){
 const inp=structuredClone(input),packet=local(base+'b5-v22/chunk-A-01.out.json');
 inp.contract=contract;
 const r=packet.rows[0],first=r.links.find(l=>l.relevance==='direct');
 for(const l of r.links)if(l.relevance==='direct')l.relevance='not_applicable';
 first.relevance='indirect';
 first.counterfactual={kind:'choice',choice:[1,2,3,4,5].find(n=>!(inp.rows[0].source.answers??[inp.rows[0].source.answer]).includes(n)),how:'고유 수행을 놓치면 특정 오답으로 진행하는 가상 검증 입력이다'};
 r.primary_task=null;r.secondary_tasks=[];r.directly_observable=[];
 if(mode==='nonempty_secondary')r.secondary_tasks=[first.task_id];
 if(mode==='direct_present')first.relevance='direct';
 if(mode==='no_subset')delete inp.tasks;
 if(mode==='missing_secondary')delete r.secondary_tasks;
 if(mode==='null_secondary')r.secondary_tasks=null;
 if(contract==='v2.3')for(const row of packet.rows)row.main_performance_outside_subset=false;
 const overrides={[`${root}/${base}b5-v22/input.json`]:JSON.stringify(inp),[`${root}/${base}b5-v22/chunk-A-01.out.json`]:JSON.stringify(packet)};
 // Make all B / second chunk rows satisfy the new v2.3 field so its own error cannot hide the target result.
 if(contract==='v2.3')for(const t of ['A','B'])for(const n of [1,2]){
  const p=`${root}/${base}b5-v22/chunk-${t}-0${n}.out.json`;
  if(overrides[p])continue;
  const q=JSON.parse(fs.readFileSync(p,'utf8'));for(const row of q.rows)row.main_performance_outside_subset=false;overrides[p]=JSON.stringify(q);
 }
 const d2=validate('b5-v22',overrides);
 const fake={...virtualFs,readFileSync:(p,...a)=>overrides[String(p).replaceAll('\\','/')]??virtualFs.readFileSync(p,...a)};
 const passed=new Function('fs','path','validateChunk','validateRow',passedCode+'\nreturn passed;')(fake,path,pilot.validateChunk,pilot.validateRow);
 const src={dir:`${root}/${base}b5-v22`,subset:!!inp.tasks,contract,tasks:inp.tasks?atomic.filter(t=>inp.tasks.includes(t.id)):atomic};
 const result=passed(src,'A',new Map(inp.rows.map(r=>[r.item_id,r])));
 counterexamples.push({contract,mode,item:r.item_id,d2_target_accepted:!d2.logs.some(l=>l.includes(r.item_id)),d2_exit:d2.code,d2_target_errors:d2.logs.filter(l=>l.includes(r.item_id)),d3_target_accepted:result.has(r.item_id)});
}
const cats=['direct','indirect','not_applicable','unknown'];
const stat=p=>{const n=p.length,a=p.filter(([a,b])=>a===b).length;const pe=cats.reduce((s,c)=>s+p.filter(x=>x[0]===c).length*p.filter(x=>x[1]===c).length/n/n,0);return {pairs:n,agree:a,agreement:a/n,kappa:(a/n-pe)/(1-pe)};};
const per={},pairs=[];
for(const task of input.tasks){const p=input.rows.map(r=>['A','B'].map(t=>tracks[t].find(a=>a.item_id===r.item_id).links.find(l=>l.task_id===task).relevance));per[task]=stat(p);pairs.push(...p);}
const allLinks=json(doc+'mapping-coverage.json');
const jl=p=>at(doc+p).trim().split('\n').map(JSON.parse);
const linked=jl('item-task-links.jsonl'),disputed=jl('disputed-links.jsonl');
const corrections=json(doc+'b5-v22-corrections.json').corrections.map(c=>{
 const r=disputed.find(l=>l.batch==='b5-v22'&&l.item===c.item&&l.task===c.task);
 return {item:c.item,task:c.task,track:c.track,found:!!r,state:r?.state,tier:r?.tier,relevance:r?.relevance,candidateRelevance:r?.candidateRelevance,refuted_rationale:r?.refuted_rationale,not_promoted:!linked.some(l=>l.batch==='b5-v22'&&l.item===c.item&&l.task===c.task)};
});
const combineWrites=new Map();
const pinnedFiles=git('ls-tree','-r','--name-only',rev,doc).trim().split('\n');
const combineFs={...virtualFs,readdirSync:p=>String(p).replaceAll('\\','/')===root+'/'+doc.slice(0,-1)?pinnedFiles.map(p=>p.slice(doc.length)).filter(p=>!p.includes('/')):fs.readdirSync(p),
 existsSync:p=>{const rel=path.relative(root,String(p)).replaceAll('\\','/');return rel.includes('/local/')?fs.existsSync(p):pinnedFiles.includes(rel);},
 writeFileSync:(p,s)=>combineWrites.set(path.basename(p),s)};
new Function('fs','path','ROOT','nonHeldTasks','console',at('scripts/research/goal-data/d2-combine.mjs').replace(/^import .*\r?\n/gm,''))(combineFs,path,root,pilot.nonHeldTasks,{log:()=>{}});
const recombined={r1:combineWrites.get('item-task-links.jsonl').trim().split('\n').length,disputed:combineWrites.get('disputed-links.jsonl').trim().split('\n').length,
 links_exact_match:combineWrites.get('item-task-links.jsonl')===at(doc+'item-task-links.jsonl'),disputed_exact_match:combineWrites.get('disputed-links.jsonl')===at(doc+'disputed-links.jsonl')};
// Run exporter entirely in memory with local synthetic rows, no fetch/network or writes to either input worktree.
let exporter=at('scripts/research/goal-data/d2-export.mjs').replace(/^import .*\r?\n/gm,'').replace('export const BATCHES','const BATCHES').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`);
const src=input.rows[0].source;
const fixture=[{...src,id:'M2506#18',exam_id:'M2506',no:18,type_id:'R-PURPOSE',body_ok:true},{...src,id:'M2506#25',type_id:'R-CHART',body_ok:true},{...src,id:'2023#38',type_id:'R-INSERT',body_ok:true,choices:null}];
const writes=new Map();const exportFs={...fs,existsSync:()=>false,mkdirSync:()=>{},writeFileSync:(p,s)=>writes.set(String(p).replaceAll('\\','/'),s)};
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
await new AsyncFunction('crypto','fs','path','insertSplit','process','fetch','console',exporter)(crypto,exportFs,path,()=>({confidence:'uncertain'}),{argv:['node','export','b6-v23'],env:{NEXT_PUBLIC_SUPABASE_URL:'jajenrevcbmrpaliomxv',SUPABASE_SERVICE_ROLE_KEY:'synthetic'}},async url=>({ok:true,json:async()=>url.includes('/csat_items?')?fixture:[]}),{log:()=>{}});
const expInput=JSON.parse(writes.get(`${root}/${base}b6-v23/input.json`));
const expSelection=JSON.parse(writes.get(`${root}/${doc}b6-v23-selection.json`));
const snapshotTests=expSelection.excluded.filter(e=>e.snapshot).map(e=>{
 const raw=expInput.excluded_raw.find(r=>r.item_id===e.item_id);const {body_ok,...source}=raw.source;
 return {item:e.item_id,source_hash_ok:hash(source)===e.snapshot.source_sha256,passage_hash_ok:hash(source.passage)===e.snapshot.passage_sha256,body_ok_matches:body_ok===e.snapshot.body_ok,choices_matches:Array.isArray(source.choices)===e.snapshot.choices_is_array,raw_type_preserved:'type_id' in raw.source};
});
const localB6=local(base+'b6-v23/input.json');
const selB6=json(doc+'b6-v23-selection.json');
const actualSnapshots=selB6.excluded.map(e=>{const raw=localB6.excluded_raw?.find(r=>r.item_id===e.item_id);if(!raw)return {item:e.item_id,raw_available:false};const {body_ok,...s}=raw.source;return {item:e.item_id,raw_available:true,source_hash_ok:hash(s)===e.snapshot.source_sha256,passage_hash_ok:hash(s.passage)===e.snapshot.passage_sha256,raw_type_preserved:'type_id' in raw.source};});
const result={task_id:'T-0104',owner:'goal-data-independent',session:'t-0104-codex',source_commit:git('rev-parse',rev).trim(),base_commit:git('rev-parse',old).trim(),observed_at:new Date().toISOString(),source_read_only:true,db_access:false,changed_files:changed,diff_sha256:hash(diff),normalized_diff:normalizedDiff,regression,counterexamples,b5:{overall:stat(pairs),per_task:per,packet_hash:hash(fs.readFileSync(path.join(root,base+'b5-v22/input.json'),'utf8')),reported:json(doc+'b5-v22-agreement.json').kappa,unchanged_files:git('diff','--name-only',`${old}..${rev}`,'--',doc+'b5-v22-agreement.json',doc+'b5-v22-item-task-links.jsonl',doc+'b5-v22-disputed-links.jsonl').trim()===''},combined:{r1:linked.length,disputed:disputed.length,reported:allLinks.scope,all_relevance_unknown:[...linked,...disputed].every(r=>r.relevance==='unknown')},corrections,snapshot_export:{synthetic:snapshotTests,actual:actualSnapshots,missing_rows_recorded_as_null:expInput.excluded_raw.filter(r=>r.source===null).length,selection_hash_matches:hash(expSelection.items)===expSelection.selection_sha256,b5_historical_raw_present:!!input.excluded_raw},skip_count:0};
fs.writeFileSync(dest+'recheck.json',JSON.stringify(result,null,2)+'\n');
result.d3_regression=d3Regression;result.recombined=recombined;
for(const r of Object.values(regression))assert.equal(r.code,0);
for(const r of Object.values(d3Regression)){assert.equal(r.A,r.expected);assert.equal(r.B,r.expected);}
assert.equal(recombined.links_exact_match,true);assert.equal(recombined.disputed_exact_match,true);
assert.equal(linked.length,511);assert.equal(disputed.length,328);
assert.equal(result.b5.overall.agree,210);
for(const c of counterexamples){const expected=c.contract!=='v2.1'&&['valid','missing_secondary','null_secondary'].includes(c.mode);assert.equal(c.d2_target_accepted,expected);assert.equal(c.d3_target_accepted,expected);}
assert.ok(corrections.every(c=>c.not_promoted&&c.refuted_rationale&&c.relevance==='unknown'));
assert.ok(snapshotTests.every(s=>s.source_hash_ok&&s.passage_hash_ok));
assert.ok(actualSnapshots.every(s=>s.source_hash_ok&&s.passage_hash_ok));
result.assertions='passed (observed defects are asserted as observations, not acceptance passes)';
fs.writeFileSync(dest+'recheck.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({regression,d3Regression,recombined,counterexamples:counterexamples.map(c=>({contract:c.contract,mode:c.mode,d2:c.d2_target_accepted,d3:c.d3_target_accepted})),overall:result.b5.overall,corrections:corrections.map(c=>({item:c.item,track:c.track,not_promoted:c.not_promoted})),snapshot_export:result.snapshot_export,assertions:result.assertions},null,2));
