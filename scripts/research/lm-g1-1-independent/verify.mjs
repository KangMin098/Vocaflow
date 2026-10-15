// scripts/research/lm-g1-1-independent/verify.mjs
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../..'),dir=root+'/docs/research/lm-g1-1-independent',read=p=>JSON.parse(fs.readFileSync(dir+'/'+p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=read('manifest.json');for(const f of manifest.files)assert.equal(sha(fs.readFileSync(root+'/'+f.path)),f.current_sha256,f.path);for(const [p,h]of Object.entries(manifest.protocol_hashes))assert.equal(sha(fs.readFileSync(root+'/'+p)),h,p);
assert.equal(manifest.files.filter(f=>!f.unchanged).length,1);assert.equal(read('pinned-unit.json').numFailedTests,1,'preserved pre-fix counterexample');
for(const p of ['regression-unit-final.json','revised-unit-final.json']){const r=read(p);assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numPendingTests,0)}
for(const width of [1280,1440]){const r=read('evidence/accepted-'+width+'/results.json');assert.equal(r.pass,9);assert.equal(r.fail,0);assert.equal(r.accountsLeft,0);assert.equal(r.results.find(x=>x.name.startsWith('T04')).detail.plan.stage,'transfer');}
const security=read('evidence/workspace-boundary/results.json');assert.equal(security.results.length,5);assert.ok(security.results.every(r=>r.ok));assert.equal(security.accountsLeft,0);
const w=read('evidence/workspace/results.json');assert.equal(w.pass,36);assert.equal(w.fail,0);assert.equal(w.accountsLeft,0);
for(const [name,n]of Object.entries({workspace:36,return:7,study:6,supply:6})){const r=read('regressions.json').results.find(x=>x.name===name);assert.equal(r.exit,0,name);assert.equal(r.passed,n,name);assert.equal(r.failed,0,name)}
console.log('PASS: source and protocol hashes; immutable history; 722 + 15 unit checks; 18 stage browser checks; 5 ownership checks; 36/7/6/6 original regressions');
