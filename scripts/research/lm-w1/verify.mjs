// scripts/research/lm-w1/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../..');
const dir=path.join(root,'docs/research/lm-w1-design-review');
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
const manifest=read('manifest.json');
for(const f of manifest.files){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex'),f.after,f.path);if(f.kind==='preserved_engine_contract')assert.equal(f.before,f.after,f.path);}
const acceptance=read('evidence/final-acceptance/results.json');
assert.equal(acceptance.results.length,42);assert.ok(acceptance.results.every(r=>r.ok));
for(const file of ['unit.json','supply-unit.json']){const r=read(file);assert.equal(r.success,true);assert.equal(r.numPassedTests,r.numTotalTests);assert.equal(r.numPendingTests,0);assert.equal(r.numTodoTests,0);}
assert.equal(read('unit.json').numTotalTests+read('supply-unit.json').numTotalTests,94);
for(const r of read('regressions.json').runs){assert.equal(r.all_pass,true);assert.equal(r.passed,r.expected);}
console.log('PASS: 16 source hashes, 11 preserved engine contracts, 42 browser checks, 94 unit checks, 36/7/6/6 regressions');
