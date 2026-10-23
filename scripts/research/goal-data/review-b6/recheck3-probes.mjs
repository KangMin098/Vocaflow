// scripts/research/goal-data/review-b6/recheck3-probes.mjs
import assert from 'node:assert/strict';
import {fs,root,local,base,doc,at,hash,snap,read,makeValidator,validate,passed,atomic,inp,tracks,metrics,locate} from './recheck3-calc.mjs';
const logs=[];let exit;
new Function('makeValidator','console','process',at('scripts/research/goal-data/d2-validate.check.mjs').replace(/^import .*\r?\n/gm,''))(makeValidator,{log:s=>logs.push(s)},{exit:c=>exit=c});
assert.equal(exit,0);assert.equal(logs.length,6);
const input=read(base+'b6-v23/input.json');input.contract='v2.4';
const V=makeValidator(input,atomic.filter(t=>input.tasks.includes(t.id)));
const eligible=tracks.A.filter(r=>!V.row(r).length&&r.links.filter(l=>l.relevance==='direct').length>1).slice(0,3);
assert.equal(eligible.length,3);
const probes=[];
for(const mode of ['exact_two','skeleton_three','cross_chunk','single_prefix_multi_direct','single_prefix_single_direct','single_exact_two']){
 const pi=read(base+'b6-v23/input.json');pi.contract='v2.4';
 const packets=[1,2].map(n=>read(base+`b6-v23/chunk-A-0${n}.out.json`));
 const all=packets.flatMap(p=>p.rows);
 let targets=eligible.map(r=>all.find(x=>x.item_id===r.item_id));
 if(mode==='cross_chunk')targets=[targets[0],packets[1].rows.find(r=>!V.row(r).length)];
 if(mode==='single_prefix_single_direct')targets=all.filter(r=>!V.row(r).length&&r.links.filter(l=>l.relevance==='direct').length===1).slice(0,3);
 if(mode==='exact_two'||mode==='single_exact_two')targets=targets.slice(0,2);
 for(const [i,r] of targets.entries())r.primary_reason=mode.startsWith('single')?`direct 단일 — 「marker${mode==='single_exact_two'?0:i}」 를 본문 point${mode==='single_exact_two'?0:i} 문장과 대조해 정답 ${mode==='single_exact_two'?1:i+1} 을 고른다`:mode==='skeleton_three'?`「marker${i}」 를 본문 point${i} 문장과 대조해 정답 ${i+1} 을 고른다`:'빈칸 명제를 본문 결론 문장에서 바로 압축한다';
 const overrides={[`${root}/${base}b6-v23/input.json`]:JSON.stringify(pi),...Object.fromEntries(packets.map((p,i)=>[`${root}/${base}b6-v23/chunk-A-0${i+1}.out.json`,JSON.stringify(p)]))};
 const out=validate('b6-v23',overrides),accepted=passed(pi,'b6-v23',overrides);
 const reasonErrors=makeValidator(pi,atomic.filter(t=>pi.tasks.includes(t.id))).reasons(all);
 probes.push({mode,targets:targets.map(r=>({item:r.item_id,direct_count:r.links.filter(l=>l.relevance==='direct').length,row_errors:V.row(r)})),reason_errors:reasonErrors,d2_track_rejected:out.logs.some(s=>s.includes('A 트랙:')),d3_target_accepted:targets.map(r=>accepted.has(r.item_id))});
}
assert.ok(probes.filter(p=>['exact_two','skeleton_three','cross_chunk','single_exact_two'].includes(p.mode)).every(p=>p.d2_track_rejected&&p.d3_target_accepted.every(a=>!a)));
assert.ok(probes.find(p=>p.mode==='single_prefix_multi_direct').targets.every(t=>t.row_errors.length===0&&t.direct_count>1));
assert.ok(probes.find(p=>p.mode==='single_prefix_multi_direct').d2_track_rejected); assert.ok(probes.find(p=>p.mode==='single_prefix_multi_direct').d3_target_accepted.every(a=>!a));
const r=structuredClone(eligible[0]);const indirect=r.links.find(l=>l.relevance==='indirect');
if(!indirect)throw new Error('indirect fixture missing');delete indirect.counterfactual;
const legacy={normal:makeValidator(input,atomic).row(r),legacy:makeValidator(input,atomic,{legacyV1:true}).row(r)};
assert.ok(legacy.normal.some(e=>e.includes('반사실')));assert.ok(!legacy.legacy.some(e=>e.includes('반사실')));
delete r.primary_reason;legacy.v24_still_checked=makeValidator(input,atomic,{legacyV1:true}).row(r).some(e=>e.includes('primary_reason'));assert.ok(legacy.v24_still_checked);
const jl=p=>at(p).trim().split('\n').map(JSON.parse);
const counts={b6_r1:jl(doc+'b6-v23-item-task-links.jsonl').length,combined_r1:jl(doc+'item-task-links.jsonl').length,b6_disputed:jl(doc+'b6-v23-disputed-links.jsonl').length,combined_disputed:jl(doc+'disputed-links.jsonl').length};
assert.deepEqual(counts,{b6_r1:93,combined_r1:604,b6_disputed:15,combined_disputed:343});
const samples=['M2506#33','M2506#34','M2506#40'].map(id=>({id,source:inp.rows.find(r=>r.item_id===id).source,judgments:Object.fromEntries(['A','B'].map(t=>{const r=tracks[t].find(r=>r.item_id===id);return [t,{primary:r.primary_task,reason:r.primary_reason,path:r.decision_path,links:r.links.filter(l=>['r.central_meaning','r.inference'].includes(l.task_id))}]}))}));
fs.writeFileSync(local+'recheck3-probes.local.json',JSON.stringify({check6:{exit,logs},probes,legacy,counts,samples},null,2));
console.log('recheck3 probes completed; direct-prefix bypass rejected');
