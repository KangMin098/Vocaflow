// scripts/research/goal-data/review-b5/recompute.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = 'D:/workspace/Vocaflow-goal-data';
const out = path.resolve('docs/research/goal-data-batches/review-b5');
const local = path.resolve('scripts/research/goal-data/review-b5');
fs.mkdirSync(out,{recursive:true});
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const base = 'scripts/research/goal-data/local/';
const doc = 'docs/research/goal-data-batches/D2-task-mapping/';
const input = read(base+'b5-v22/input.json');
const sample = read(doc+'b5-v22-review-sample.json');
const hash = v => crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v),'utf8').digest('hex');
const locate = (p,needle) => {const lines=fs.readFileSync(path.join(root,p),'utf8').split('\n'); const i=lines.findIndex(l=>l.includes(needle)); return `${p}:${i+1}`;};
const tracks = {};
for(const t of ['A','B']) tracks[t]=[1,2].flatMap(n=>read(`${base}b5-v22/chunk-${t}-0${n}.out.json`).rows);
const rows = Object.fromEntries(input.rows.map(r=>[r.item_id,r]));
const snapshots = [...sample.candidates,...sample.disputed].map(s=>({sample:s,input:rows[s.item],judgments:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===s.item)])),evidence:[locate(base+'b5-v22/input.json',`"item_id": "${s.item}"`),...['A','B'].map(t=>{let n=tracks[t].findIndex(r=>r.item_id===s.item)<20?1:2;return locate(`${base}b5-v22/chunk-${t}-0${n}.out.json`,`"item_id": "${s.item}"`);})]}));
fs.writeFileSync(path.join(local,'sample.local.json'),JSON.stringify(snapshots,null,2));
const pilot=await import(pathToFileURL(path.join(root,'scripts/csat/map/v62/data/pilot-lib.mjs')));
let run=fs.readFileSync(path.join(root,'scripts/research/goal-data/d2-run.mjs'),'utf8');
run=run.replace(/^import .*\r?\n/gm,'');
const validation={};
function validateWith(b, overrides={}) {
 const logs=[];let exit=null;
 const proc={argv:['node','d2-run.mjs',b,'validate'],exit:n=>{exit=n;}};
 const fakeFs={...fs,readFileSync:(p,...args)=>overrides[String(p).replaceAll('\\','/')]??fs.readFileSync(p,...args)};
 new Function('crypto','fs','path','ROOT','nonHeldTasks','validateChunk','validateRow','process','console',run)(crypto,fakeFs,path,root,pilot.nonHeldTasks,pilot.validateChunk,pilot.validateRow,proc,{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))});
 return {exit,logs};
}
for(const b of ['b2-v2','b3-insert','b4-v21','b5-v22']) {
 validation[b]=validateWith(b);
}
// In-memory counterexamples only. Never change input worktree or original outputs.
const mutations={};
for(const mode of ['null_with_empty_secondary','null_with_nonempty_secondary','null_without_v22_contract']) {
 const f=`${root}/${base}b5-v22/chunk-A-01.out.json`;
 const packet=JSON.parse(fs.readFileSync(f,'utf8'));
 const r=packet.rows[0];const first=r.links.find(l=>l.relevance==='direct');
 for(const l of r.links) if(l.relevance==='direct'&&l!==first)l.relevance='not_applicable';
 first.relevance='indirect';first.counterfactual={kind:'choice',choice:[1,2,3,4,5].find(n=>!rows[r.item_id].source.answers.includes(n)),how:'고유 수행을 놓치면 특정 오답으로 진행하는 가상 검증 입력이다'};
 r.primary_task=null;r.directly_observable=[];r.secondary_tasks=mode==='null_with_nonempty_secondary'?[first.task_id]:[];
 const overrides={[f]:JSON.stringify(packet)};
 if(mode==='null_without_v22_contract')overrides[`${root}/${base}b5-v22/input.json`]=JSON.stringify({...input,contract:'v2.1'});
 mutations[mode]=validateWith('b5-v22',overrides);
}
const cats=['direct','indirect','not_applicable','unknown'];
function stat(pairs){const n=pairs.length;const agree=pairs.filter(([a,b])=>a===b).length;const pe=cats.reduce((s,c)=>s+pairs.filter(([a])=>a===c).length*pairs.filter(([,b])=>b===c).length/n/n,0);return {n,agree,agreement:agree/n,kappa:pe===1?null:((agree/n)-pe)/(1-pe),counts:Object.fromEntries(['A','B'].map((t,i)=>[t,Object.fromEntries(cats.map(c=>[c,pairs.filter(p=>p[i]===c).length]))]))};}
const per={};let all=[];
for(const task of input.tasks){const pairs=input.rows.map(r=>['A','B'].map(t=>tracks[t].find(x=>x.item_id===r.item_id).links.find(l=>l.task_id===task).relevance));per[task]=stat(pairs);all.push(...pairs);}
const stable=input.tasks.filter(t=>t!=='e.evidence_location');
const agreement=read(doc+'b5-v22-agreement.json');
const selection=read(doc+'b5-v22-selection.json');
const links=fs.readFileSync(path.join(root,doc+'b5-v22-item-task-links.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const disputed=fs.readFileSync(path.join(root,doc+'b5-v22-disputed-links.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const {insertSplit}=await import(pathToFileURL(path.join(root,'scripts/research/goal-data/insert-split.mjs')));
const checks=input.rows.map(r=>({id:r.item_id,source_hash_ok:hash(r.source)===r.source_sha256,passage_hash_ok:hash(r.source.passage)===r.passage_sha256,selection_hash_ok:selection.items.some(s=>s.item_id===r.item_id&&s.source_sha256===r.source_sha256&&s.passage_sha256===r.passage_sha256),eligible:r.body_ok&&Array.isArray(r.source.choices)&&!!(r.source.answers?.length||r.source.answer!=null)&&r.type_id!=='R-CHART',split:r.insert_split?{matches:JSON.stringify(insertSplit(r.source.passage))===JSON.stringify(r.insert_split),given_in_original:r.source.passage.includes(r.insert_split.given_sentence),body_in_original:r.source.passage.includes(r.insert_split.body),given_chars:r.insert_split.given_sentence.length,body_chars:r.insert_split.body.length}:null}));
const nulled=['A','B'].flatMap(t=>tracks[t].filter(r=>r.primary_task===null).map(r=>({track:t,id:r.item_id,secondary:r.secondary_tasks,indirect:r.links.filter(l=>l.relevance==='indirect').map(l=>l.task_id)})));
const result={source_head:'7ad98fda08f3739a14bcff1c41273968f7fe2fa6 (observed via shell git rev-parse)',validation,selection:{total:input.rows.length,unique:new Set(input.rows.map(r=>r.item_id)).size,exam_totals:input.rows.reduce((a,r)=>(a[r.exam_id]=(a[r.exam_id]||0)+1,a),{}),excluded_reported:selection.excluded,checks},overall:stat(all),per_task:per,alarms:Object.fromEntries(stable.map(t=>[t,per[t].kappa===null?'unclear':per[t].agreement<.8&&per[t].kappa<.68?'stop':'ok'])),reported_overall_matches:Math.abs(stat(all).agreement-agreement.agreement)<.00005&&Math.abs(stat(all).kappa-agreement.kappa)<.00005,ai_links:{candidates:links.length,disputed:disputed.length,all_unknown:[...links,...disputed].every(r=>r.relevance==='unknown')},primary_null:nulled,sample:snapshots.map(s=>({item:s.sample.item,task:s.sample.task,evidence:s.evidence})),insertion_isolation:['A','B'].every(t=>tracks[t].filter(r=>rows[r.item_id].type_id==='R-INSERT').every(r=>r.independent_assessment.eligibility==='not_suitable'&&r.links.find(l=>l.task_id==='e.evidence_location').relevance==='unknown'))};
result.validator_counterexamples=mutations;
result.input_packet_sha256=hash(fs.readFileSync(path.join(root,base+'b5-v22/input.json'),'utf8'));
result.selection_order_matches=JSON.stringify(input.rows.map(r=>r.item_id))===JSON.stringify([...Array.from({length:28},(_,i)=>`M2509#${18+i}`),...[22,23,29,31,32,33,34,36,37,38,39,40].map(i=>`2023#${i}`)].filter(id=>!selection.excluded.some(e=>e.item_id===id)));
result.excluded_raw_rows_available=false;
result.chunk_binding=['A','B'].flatMap(t=>[1,2].map(n=>{
 const p=read(`${base}b5-v22/chunk-${t}-0${n}.json`);
 return {track:t,chunk:n,count:p.items.length,tasks_match:JSON.stringify(p.tasks.map(t=>t.id))===JSON.stringify(input.tasks),source_match:p.items.every(i=>hash(i.source)===rows[i.item_id].source_sha256&&i.source_sha256===rows[i.item_id].source_sha256),b_has_no_prior:t!=='B'||p.items.every(i=>!('prior_analysis_unverified' in i)&&!('prior_traps' in i))};
}));
result.analysis_hashes_match=input.rows.every(r=>!r.analysis||hash(r.analysis)===r.analysis_sha256);
result.legacy_subset_flags=Object.fromEntries(['b2-v2','b3-insert','b4-v21'].map(b=>[b,!!read(`${base}${b}/input.json`).tasks]));
fs.writeFileSync(path.join(out,'recalculation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({validation,overall:result.overall,per,alarms:result.alarms,hash_failures:checks.filter(r=>!r.source_hash_ok||!r.passage_hash_ok||!r.selection_hash_ok),ai_links:result.ai_links,primary_null:nulled,mutations},null,2));

