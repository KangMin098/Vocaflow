// scripts/research/lm-g1/verify.mjs
// Offline evidence integrity checks. Does not connect to DB or execute product loaders.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../../..');
const base=path.join(root,'docs/csat-learner/v62');
const json=async name=>JSON.parse(await fs.readFile(path.join(base,'lm-g1',name),'utf8'));
const manifest=await json('source-manifest.json');
for(const f of manifest.files){
  const actual=createHash('sha256').update(await fs.readFile(path.join(root,f.path))).digest('hex');
  assert.equal(actual,f.sha256,`audited source changed: ${f.path}; create a new audit revision`);
}
const result=await json('tests.json');
assert.equal(result.success,true);
assert.equal(result.numTotalTests,83);
assert.equal(result.numPassedTests,83);
assert.equal(result.numFailedTests,0);
const observations=await json('probes.json');
assert.deepEqual(observations.observations.map(x=>x.id),['G01','G02','G03','G04']);
const pending=await json('db-pending-exact.json');
assert.equal(pending.rows.length,8);
assert.ok(pending.rows.every(x=>x.relation===null));
assert.ok(/^select\b/i.test(pending.query));
for(const file of ['GOAL_GAP_AUDIT.md','TARGET_COMPLETION_ROADMAP.md','R5_VERTICAL_ACCEPTANCE.md']){
  const text=await fs.readFile(path.join(base,file),'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    if(/^(https?:|#)/.test(match[1]))continue;
    const target=match[1].split('#')[0];
    await fs.access(path.resolve(base,target));
  }
}
console.log(`LM-G1 integrity PASS: ${manifest.files.length} source hashes, 83 tests, 4 observations, 8 pending relations, local document links`);
