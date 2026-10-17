// scripts/csat/v2-stage1-seal/verify.mjs
// Read-only verifier: never opens Stage 2, annotations, or Claude judgments.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2] || '.local/v2-d2-stage1');
const expectedSeal=process.argv[3];
assert.match(expectedSeal || '', /^[a-f0-9]{64}$/, 'Supply the externally anchored seal SHA256');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=f=>fs.readFileSync(path.join(root,f));
const read=f=>JSON.parse(bytes(f));
assert.equal(hash(bytes('SEAL.r001.json')),expectedSeal);
const seal=read('SEAL.r001.json'),ledger=read('stage1-submissions.json');
assert.equal(hash(bytes('stage1-submissions.json')),seal.ledgerSha256);
assert.equal(seal.sessionId,ledger.sessionId);
assert.equal(seal.results.length,12);
const expectedIds=['2024','2025','2026','M2606','M2609','M2706'].flatMap(x=>[x+'#30',x+'#42']).sort();
assert.deepEqual(seal.results.map(x=>x.itemId).sort(),expectedIds);
const sources=read('source-readonly.json').rows;
for(const [file,sha] of Object.entries(seal.artifactHashes))assert.equal(hash(bytes(file)),sha,file);
const counts={reviewed:0,clear:0,ambiguous:0,insufficient:0,boundary:0,pdf:0,source:0};
for(const entry of seal.results){
  assert.equal(entry.file,`r001/review-${entry.slug}.stage1.json`);
  const reviewBytes=bytes(entry.file),review=JSON.parse(reviewBytes);
  assert.equal(hash(reviewBytes),entry.sha256,entry.itemId);
  assert.deepEqual(ledger.submissions[entry.slug],Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='slug')));
  assert.equal(review.sessionId,seal.sessionId);
  assert.equal(review.reviewedAt,entry.at);
  assert.equal(review.revision,'r001');
  assert.equal(review.stage,1);
  assert.equal(review.sourceRevision,entry.sourceRevision);
  const source=sources.find(x=>x.id===entry.itemId);
  assert.equal(hash(Buffer.from(source.passage)),entry.sourceRevision);
  const inputFile=`inputs/stage1-${entry.slug}.json`,input=read(inputFile);
  assert.equal(hash(bytes(inputFile)),entry.inputSha256);
  assert.deepEqual(Object.keys(input).sort(),[...seal.inputKeysAllowed].sort());
  assert.equal(input.task,'stage1');
  assert.equal(input.sourceRevision,review.sourceRevision);
  assert.equal(input.skeletonSig,review.skeletonSig);
  assert.equal(input.sentenceCount,input.sentenceRanges.length);
  assert.equal(input.sentenceCount,review.sentenceCount);
  let cursor=0;
  for(const [a,b] of input.sentenceRanges){assert.ok(a>=cursor&&b>a&&b<=source.passage.length);assert.equal(source.passage.slice(cursor,a).trim(),'');cursor=b;}
  assert.equal(source.passage.slice(cursor).trim(),'');
  const markers=entry.itemId.endsWith('#30')?['①','②','③','④','⑤']:['(a)','(b)','(c)','(d)','(e)'];
  markers.forEach((marker,i)=>{assert.equal(source.passage.split(marker).length-1,1);const [a,b]=input.sentenceRanges[input.targets[i]];assert.ok(source.passage.slice(a,b).includes(marker));});
  for(const n of [...review.cue.sentences,...review.cue.acceptable])assert.ok(Number.isInteger(n)&&n>=0&&n<input.sentenceCount);
  assert.ok(review.cue.sentences.length>0);
  for(const expression of review.cueExpressions){const [a,b]=input.sentenceRanges[expression.sentence];assert.ok(source.passage.slice(a,b).includes(expression.text));}
  for(const field of ['contextSenseKo','why','evidenceSufficiencyWhy','uncertainty'])assert.ok(review[field].length>10);
  assert.ok(review.alternativeReadings.length>0);
  assert.equal(review.blindAttestation.claudeItemJudgmentsRead,false);
  assert.equal(review.blindAttestation.stage2Read,false);
  assert.equal(review.releaseApproved,false);
  assert.equal(review.officialAnswerExposure.agreementCountedAsIndependentSuccess,false);
  assert.equal(review.pdfComparison.checked,true);
  assert.equal(hash(fs.readFileSync(review.pdfComparison.file)),review.pdfComparison.pdfSha256);
  assert.equal(hash(fs.readFileSync(review.pdfComparison.imagePath)),review.pdfComparison.imageSha256);
  assert.equal(review.pdfComparison.anchorHashMatch,true);
  counts.reviewed++;counts[review.clarity]++;
  if(review.evidenceSufficiency==='insufficient')counts.insufficient++;
  if(review.v2S5Boundary.classification==='boundary')counts.boundary++;
  counts.pdf++;counts.source++;
}
assert.deepEqual(counts,{reviewed:12,clear:11,ambiguous:1,insufficient:0,boundary:7,pdf:12,source:12});
assert.equal(ledger.stage2.executed,false);
assert.equal(ledger.realLearnableV2Count,0);
console.log(JSON.stringify({verified:true,sealSha256:expectedSeal,ledgerSha256:seal.ledgerSha256,counts,stage2Executed:false}));
