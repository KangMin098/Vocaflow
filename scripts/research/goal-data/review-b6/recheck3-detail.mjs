// scripts/research/goal-data/review-b6/recheck3-detail.mjs
import assert from 'node:assert/strict';
import {fs,root,local,base,doc,at,hash,snap,read,makeValidator,validate,passed,atomic,inp,tracks,metrics,locate} from './recheck3-calc.mjs';
const prior=JSON.parse(fs.readFileSync(local+'recheck2-packets.local.json','utf8'));
const packetChanges=[];
for(const t of ['A','B'])for(const n of [1,2]){
 const p=base+`b6-v23/chunk-${t}-0${n}.out.json`;
 const old=JSON.parse(prior.files[p]).rows;
 for(const r of read(p).rows){const b=old.find(x=>x.item_id===r.item_id);for(const k of Object.keys(r))if(!assertEqual(r[k],b[k]))packetChanges.push({track:t,item:r.item_id,field:k,before:b[k],after:r[k],evidence:locate(p,`"item_id": "${r.item_id}"`)});}
}
function assertEqual(a,b){try{assert.deepEqual(a,b);return true;}catch{return false;}}
const changedLinks=packetChanges.filter(x=>x.field==='links');
assert.equal(changedLinks.length,1);
assert.equal(changedLinks[0].item,'M2506#33');assert.equal(changedLinks[0].track,'A');
for(const t of ['A','B'])for(const n of [1,2]){
 const p=base+`b6-v23/chunk-${t}-0${n}.out.json`,old=JSON.parse(prior.files[p]).rows;
 for(const r of read(p).rows){const b=old.find(x=>x.item_id===r.item_id);assert.equal(r.primary_task,b.primary_task);assert.deepEqual(r.links.map(l=>[l.task_id,l.relevance]),b.links.map(l=>[l.task_id,l.relevance]));}
}
const mutations=[];
for(const mode of ['zero_direct','primary_mismatch','duplicate_direct','tab_prefix_multi','single_exact','single_valid']){
 const input=read(base+'b6-v23/input.json');input.contract='v2.4';
 const packets=[1,2].map(n=>read(base+`b6-v23/chunk-A-0${n}.out.json`));
 const rows=packets.flatMap(p=>p.rows),r=rows.find(r=>r.item_id==='M2506#29');
 r.primary_reason='direct 단일 — 이 문항의 결정 지점을 따로 검증하는 고유 설명';
 const direct=r.links.find(l=>l.relevance==='direct');
 if(mode==='zero_direct')direct.relevance='unknown';
 if(mode==='primary_mismatch')r.primary_task=r.links.find(l=>l.task_id!==direct.task_id).task_id;
 if(mode==='duplicate_direct')r.links.push({...direct});
 if(mode==='tab_prefix_multi'){r.links.find(l=>l.task_id!==direct.task_id).relevance='direct';r.primary_reason='direct\t단일 — 이 문항의 결정 지점을 따로 검증하는 고유 설명';}
 if(mode==='single_exact'){const other=rows.find(x=>x.item_id==='M2506#30');other.primary_reason=r.primary_reason;}
 const overrides={[`${root}/${base}b6-v23/input.json`]:JSON.stringify(input),...Object.fromEntries(packets.map((p,i)=>[`${root}/${base}b6-v23/chunk-A-0${i+1}.out.json`,JSON.stringify(p)]))};
 const errors=makeValidator(input,atomic.filter(t=>input.tasks.includes(t.id))).reasons(rows),d2=validate('b6-v23',overrides),d3=passed(input,'b6-v23',overrides);
 const accepted=!d2.logs.some(l=>l.includes('A 트랙:'));assert.equal(accepted,mode==='single_valid');assert.equal(d3.has(r.item_id),mode==='single_valid');assert.equal(errors.length===0,mode==='single_valid');
 mutations.push({mode,errors,d2,d3_accepted:d3.has(r.item_id)});
}
const d3path='docs/research/goal-data-batches/D3-principles/';
const oldGroup=JSON.parse(at(d3path+'principle-groups.json','fdde27456')),newGroup=JSON.parse(at(d3path+'principle-groups.json'));
const lineChanges=[];
for(const p of [doc+'b6-v23-item-task-links.jsonl',doc+'item-task-links.jsonl',d3path+'item-reasoning.jsonl']){
 const before=at(p,'fdde27456').trim().split('\n').map(JSON.parse),after=at(p).trim().split('\n').map(JSON.parse);
 assert.equal(before.length,after.length);
 for(let i=0;i<after.length;i++)if(!assertEqual(before[i],after[i]))lineChanges.push({file:p,line:i+1,before:before[i],after:after[i]});
}
const samples=['M2506#33','M2506#34'].map(id=>({item:id,source:inp.rows.find(r=>r.item_id===id).source,judgments:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===id)]))}));
const agreementUnchanged=assertEqual(JSON.parse(at(doc+'b6-v23-agreement.json','fdde27456')),JSON.parse(at(doc+'b6-v23-agreement.json')));assert.ok(agreementUnchanged);
const oldTotals={...oldGroup.totals},newTotals={...newGroup.totals};
assert.equal(oldTotals.same_decision_locus,97);assert.equal(newTotals.same_decision_locus,96);
delete oldTotals.same_decision_locus;delete newTotals.same_decision_locus;assert.deepEqual(oldTotals,newTotals);
const d3Rows=at(d3path+'item-reasoning.jsonl').trim().split('\n').map(JSON.parse);
assert.equal(d3Rows.filter(r=>r.decision_path.same_locus).length,96);
assert.equal(d3Rows.find(r=>r.item_id==='M2506#34'&&r.batch==='b6-v23').decision_path.same_locus,false);
fs.writeFileSync(local+'recheck3-detail.local.json',JSON.stringify({packetChanges,mutations,lineChanges,samples,oldGroup,newGroup,agreementUnchanged},null,2));
console.log(JSON.stringify({packet_changes:packetChanges.map(({track,item,field,evidence})=>({track,item,field,evidence})),extra_probes:mutations.length,agreement_unchanged:agreementUnchanged,group_before:oldGroup.summary,group_after:newGroup.summary}));
