// scripts/research/goal-data/review-r3/validate-output.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
const dir='docs/research/goal-data-batches/review-r3/';
const v=JSON.parse(fs.readFileSync(dir+'verdict.json','utf8'));
const r=JSON.parse(fs.readFileSync(dir+'recomputed.json','utf8'));
assert.deepEqual(v.acceptance_covers,[0,1,2,3,4]);
assert.equal(new Set(v.items.map(x=>x.id)).size,v.items.length);
for(const x of v.items){assert.ok(['confirmed','refuted','unclear'].includes(x.verdict));assert.ok(x.claim&&x.note&&x.evidence.length);}
for(const state of ['confirmed','refuted','unclear'])assert.equal(v.summary[state],v.items.filter(x=>x.verdict===state).length);
for(const x of v.engine_handoff){assert.equal(v.items.find(i=>i.id===x.id).verdict,'confirmed');assert.equal(x.relevance,'unknown');assert.ok(x.scope&&x.excluded_use.length);}
assert.ok(r.snapshot.every(x=>x.same_blob));assert.equal(r.combined.unique_pairs,2160);assert.ok(r.combined.links_match&&r.combined.disputes_match);
for(const b of Object.keys(r.agreements)){const published=JSON.parse(fs.readFileSync('docs/research/goal-data-batches/D2-task-mapping/'+b+'-agreement.json','utf8'));const actual=r.agreements[b];assert.equal(actual.hashErrors,0);assert.equal(actual.agreement,published.agreement);assert.equal(actual.kappa,published.kappa);assert.equal(actual.primary,published.primary_task_agreement);for(const [t,m]of Object.entries(actual.per_task)){assert.equal(m.kappa,published.per_task[t].kappa);assert.equal(m.agreement,published.per_task[t].agreement);}}
assert.equal(r.b3_triple_direct.filter(x=>x.tasks.length===3).length,7);
for(const f of ['insert','mapping','d3']){const p=dir+f+'-packet.local.json';assert.equal(cp.execFileSync('git',['check-ignore',p],{encoding:'utf8'}).trim(),p);}
console.log(JSON.stringify({result:'PASS',items:v.items.length,summary:v.summary,engine_handoff:v.engine_handoff.length,acceptance_covers:v.acceptance_covers}));
