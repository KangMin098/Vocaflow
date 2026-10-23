// scripts/research/goal-data/review-r3/recompute.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
const base='docs/research/goal-data-batches/',dir=base+'D2-task-mapping/',out=base+'review-r3/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const jl=p=>fs.readFileSync(p,'utf8').trim().split(/\r?\n/).map(JSON.parse);
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const local='D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/';
const cov=read(dir+'mapping-coverage.json'),sup=new Set(cov.scope.superseded_items);
const taskIds=new Set(Object.keys(cov.per_task));
const pilot=read('docs/csat-learner/v62/data-expansion/pilot-links.json').links.filter(r=>taskIds.has(r.task)).map(r=>({...r,batch:'pilot-1'}));
const third=read(local+'b2-v2/r3-third.out.json').rows;
const orig=[];const agreements={};
const kappa=p=>{const n=p.length,po=p.filter(([a,b])=>a===b).length/n,cats=['direct','indirect','not_applicable','unknown'];const pe=cats.reduce((s,c)=>s+p.filter(([a])=>a===c).length*p.filter(([,b])=>b===c).length/n/n,0);return pe===1?null:+((po-pe)/(1-pe)).toFixed(4)};
for(const b of ['b2-v2','b3-insert','b4-v21']){
const input=read(local+b+'/input.json').rows,tracks={};
for(const t of ['A','B'])tracks[t]=new Map(fs.readdirSync(local+b).filter(f=>f.startsWith('chunk-'+t)&&f.endsWith('.out.json')).flatMap(f=>read(local+b+'/'+f).rows).map(r=>[r.item_id,r]));
const pairs=[],per={};let primary=0,hashErrors=0;
for(const r of input){if(sha(r.source)!==r.source_sha256)hashErrors++;const a=tracks.A.get(r.item_id),brow=tracks.B.get(r.item_id);if(a.primary_task===brow.primary_task)primary++;
for(const x of a.links){const y=brow.links.find(l=>l.task_id===x.task_id),same=x.relevance===y.relevance;const p=[x.relevance,y.relevance];pairs.push(p);(per[x.task_id]??=[]).push(p);orig.push({batch:b,item:r.item_id,task:x.task_id,judgments:{A:x.relevance,B:y.relevance},state:same?'INDEPENDENTLY_CHECKED':'DISPUTED',candidateRelevance:same&&['direct','indirect'].includes(x.relevance)?x.relevance:null});}}
agreements[b]={items:input.length,pairs:pairs.length,agreement:+(pairs.filter(([a,b])=>a===b).length/pairs.length).toFixed(4),kappa:kappa(pairs),primary,hashErrors,per_task:Object.fromEntries(Object.entries(per).map(([t,p])=>[t,{kappa:kappa(p),agreement:+(p.filter(([a,b])=>a===b).length/p.length).toFixed(4)}]))};
}
const before=[...pilot,...orig].filter(r=>!(sup.has(r.item)&&['pilot-1','b2-v2'].includes(r.batch)));
const thirdApplied=[];
const rows=before.map(r=>{const c=third.find(c=>c.item_id===r.item);if(r.batch!=='b2-v2'||r.task!=='r.discourse_function'||r.state!=='DISPUTED'||!c)return r;const majority=Object.values(r.judgments).includes(c.relevance);thirdApplied.push({item:r.item,A:r.judgments.A,B:r.judgments.B,C:c.relevance,majority});return {...r,state:majority?'MAJORITY_OF_THREE':'DISPUTED',candidateRelevance:majority&&['direct','indirect'].includes(c.relevance)?c.relevance:null};});
const links=rows.filter(r=>r.candidateRelevance),disputes=rows.filter(r=>r.state==='DISPUTED');
const publishedLinks=jl(dir+'item-task-links.jsonl'),publishedDisputes=jl(dir+'disputed-links.jsonl');
const key=r=>`${r.batch}:${r.item}:${r.task}:${r.candidateRelevance??''}:${r.state}`;
const same=(a,b)=>JSON.stringify(a.map(key).sort())===JSON.stringify(b.map(key).sort());
const d3=jl(base+'D3-principles/distractor-logic.jsonl'),reason=jl(base+'D3-principles/item-reasoning.jsonl');
const source=d3.filter(r=>r.evidence==='source_text');
const groups=Object.fromEntries(['R-ORDER','R-INSERT','R-GRAMMAR'].map(t=>{const r=d3.filter(r=>r.type_id===t);return [t,{total:r.length,agreed:r.filter(r=>r.distortion.A===r.distortion.B).length,both_other:r.filter(r=>r.distortion.A==='other'&&r.distortion.B==='other').length}]}));
const tracked=cp.execFileSync('git',['ls-tree','-r','--name-only','369381724','--',base],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.includes('/D2-task-mapping/')||p.includes('/D3-principles/'));
const snapshot=tracked.map(p=>({path:p,same_blob:cp.execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim()===cp.execFileSync('git',['rev-parse',`369381724:${p}`],{encoding:'utf8'}).trim(),sha256:sha(fs.readFileSync(p,'utf8'))}));
const result={input_commit:'369381724',snapshot,agreements,third_input_count:third.length,thirdApplied,combined:{items:new Set(rows.map(r=>r.item)).size,pairs:rows.length,unique_pairs:new Set(rows.map(r=>r.item+':'+r.task)).size,removed_old_pairs:pilot.length+orig.length-rows.length,links:links.length,disputes:disputes.length,links_match:same(links,publishedLinks),disputes_match:same(disputes,publishedDisputes),majority:thirdApplied.filter(r=>r.majority).length,remaining:thirdApplied.filter(r=>!r.majority).length,superseded_old_rows:rows.filter(r=>sup.has(r.item)&&['pilot-1','b2-v2'].includes(r.batch)).length},d3:{items:reason.length,source_options:source.length,source_agree:source.filter(r=>r.distortion.A===r.distortion.B).length,ratio:source.filter(r=>r.distortion.A===r.distortion.B).length/source.length,primary_agree:reason.filter(r=>r.primary_task.agree).length,same_locus:reason.filter(r=>r.decision_path.same_locus).length,groups}};
result.thirdOriginal=third.map(c=>{const r=orig.find(r=>r.batch==='b2-v2'&&r.item===c.item_id&&r.task==='r.discourse_function');return {item:c.item_id,...r.judgments,C:c.relevance,majority:Object.values(r.judgments).includes(c.relevance),superseded:sup.has(c.item_id)};});
result.b3_triple_direct=[...new Set(orig.filter(r=>r.batch==='b3-insert').map(r=>r.item))].map(item=>({item,tasks:orig.filter(r=>r.batch==='b3-insert'&&r.item===item&&['r.relation','r.discourse_function','r.discourse_structure'].includes(r.task)&&r.candidateRelevance==='direct').map(r=>r.task)}));
result.local_input_manifest=['b2-v2','b3-insert','b4-v21'].flatMap(b=>fs.readdirSync(local+b).filter(f=>f==='input.json'||f.endsWith('.out.json')).map(f=>({path:local+b+'/'+f,sha256:sha(fs.readFileSync(local+b+'/'+f,'utf8'))})));
fs.writeFileSync(out+'recomputed.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({combined:result.combined,d3:result.d3,thirdOriginal:result.thirdOriginal,b3_triple_direct:result.b3_triple_direct}));
