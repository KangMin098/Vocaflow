// scripts/research/pm4b-final/verify.mjs
// Verify bound input files, original review preservation and evidence counts. No product/DB/browser writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const base=path.join(root,'docs/research/pm4b-final');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,'data',f),'utf8').replace(/^\uFEFF/,''));
const m=read('manifest.json');
for(const e of [...m.sourceAndEvidence,...m.priorReview,m.reference,...m.independentProductCohort]){
 const p=path.isAbsolute(e.path)?e.path:path.join(root,e.path),b=fs.readFileSync(p);
 assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256,p);
 if(e.width){assert.equal(b.readUInt32BE(16),e.width);assert.equal(b.readUInt32BE(20),e.height);}
}
assert.equal(m.sourceAndEvidence.filter(e=>e.width).length,32);
const count=r=>r.testResults.flatMap(s=>s.assertionResults).reduce((a,t)=>(a[t.status]=(a[t.status]??0)+1,a),{});
assert.deepEqual(count(read('original-122.json')),{passed:122});
assert.deepEqual(count(read('closure-results.json')),{passed:10});
const p=read('product-summary.json');assert.equal(p.collectionErrors.length,0);assert.deepEqual(p.counts,{passed:2184,skipped:52});
for(const dir of ['pm4b-acceptance-20261015','pm4b-learner-20261015','pm4b-r5-20261015']){
 const r=JSON.parse(fs.readFileSync(path.join(root,'docs/csat-learner/v62/evidence',dir,'results.json'),'utf8'));
 assert.equal(r.head,m.implementationAndBrowserHead);assert.equal(r.results.filter(x=>!x.ok).length,0);
}
for(const name of ['PM4B-FINAL-REVIEW.md','PM4B-FINDINGS.md','PM4B-VISUAL-AUDIT.md','PM4B-EVIDENCE-REVIEW.md','PM4B-CLOSURE.md'])assert.ok(fs.statSync(path.join(base,name)).size>300);
console.log(JSON.stringify({integrity:'PASS',screenshotsAudited:32,independentBrowserScreenshots:0,originalTests:122,closureTests:10,productCounts:p.counts,oldReviewPreserved:true},null,2));
