// scripts/csat/v2-holdout/verify.mjs
// Read-only verification of the sample, source evidence and confidentiality boundary.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sha256,normalizePassage,chooseSample,fiveTargetStem,jaccard} from './lib.mjs';
assert.ok(process.argv[2],'Private audit directory required');
assert.match(process.argv[3]||'',/^[a-f0-9]{64}$/,'Externally anchored seal SHA required');
const root=path.resolve(process.argv[2]),expected=process.argv[3];
const pub=path.resolve('docs/research/v2-holdout-20261017');
const privateBytes=f=>fs.readFileSync(path.join(root,f));
const read=f=>JSON.parse(privateBytes(f));
const rulesBytes=fs.readFileSync(path.join(pub,'SELECTION_RULES.json')),rules=JSON.parse(rulesBytes),rulesSha=sha256(rulesBytes);
const prereg=JSON.parse(fs.readFileSync(path.join(pub,'PREREGISTRATION.json')));
assert.equal(rulesSha,prereg.rulesSha256);
assert.equal(sha256(privateBytes('SEAL.sample-r001.json')),expected);
const seal=read('SEAL.sample-r001.json');
assert.equal(seal.rulesSha256,rulesSha);
assert.equal(sha256(fs.readFileSync(path.join(pub,'PROTOCOL.md'))),seal.protocolSha256);
assert.equal(sha256(fs.readFileSync('scripts/csat/v2-holdout/lib.mjs')),seal.selectorLibSha256);
for(const [file,sha] of Object.entries(seal.privateArtifactHashes)){
 assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'));
 assert.equal(sha256(privateBytes(file)),sha,file);
}
for(const source of seal.sourceFiles)assert.equal(sha256(fs.readFileSync(source.file)),source.sha256,'source PDF SHA changed');
const ledgerBytes=fs.readFileSync(path.join(pub,'SELECTION_LEDGER.json'));
assert.equal(sha256(ledgerBytes),seal.publicLedgerSha256);
const ledger=JSON.parse(ledgerBytes),receipt=JSON.parse(fs.readFileSync(path.join(pub,'SEAL_RECEIPT.json')));
assert.equal(receipt.sealSha256,expected);
assert.equal(receipt.selectionLedgerSha256,seal.publicLedgerSha256);
assert.equal(receipt.privateAuditSha256,sha256(privateBytes('AUDIT.r001.private.json')));
const audit=read('AUDIT.r001.private.json'),population=read('population-readonly.json').rows;
assert.equal(population.length,rules.expectedPopulation);
assert.equal(new Set(population.map(x=>x.id)).size,51);
assert.deepEqual(ledger.candidates.map(x=>x.itemId).sort(),population.map(x=>x.id).sort());
const forbidden=new Set(['passage','stem','answer','answers','raw_block','senseOptions','contextSenseKo','correct','rejectWhy','cue','why']);
function privacy(value){if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){assert.ok(!forbidden.has(key),'source or answer content in public ledger: '+key);privacy(v);}}
privacy(ledger);privacy(receipt);
const candidates=audit.candidates;
for(const a of candidates){
 const row=population.find(x=>x.id===a.itemId),p=ledger.candidates.find(x=>x.itemId===a.itemId);
 assert.equal(sha256(row.passage),row.source_revision);
 assert.equal(p.sourceRevision,row.source_revision);
 assert.equal(a.normalizedText,normalizePassage(row.passage));
 assert.equal(p.normalizedPassageSha256,sha256(a.normalizedText));
 assert.equal(a.formatEligible,fiveTargetStem(row.stem));
 assert.equal(p.status,a.status);
 assert.deepEqual(p.reasons,a.reasons);
 assert.equal(p.skeletonProjectionSha256,sha256(JSON.stringify({chars:a.skeleton.sentenceChars,ranges:a.skeleton.sentenceRanges,targets:a.skeleton.targets})));
 let cursor=0;
 for(const [start,end] of a.skeleton.sentenceRanges){assert.equal(row.passage.slice(cursor,start).trim(),'');assert.ok(end>start);cursor=end;}
 assert.equal(cursor,row.passage.length);
 assert.equal(p.verification.v2S5Boundary,'NOT_ASSESSED_PRE_INSTRUMENT');
 assert.equal(p.verification.productRights,'NOT_CLEARED');
 assert.equal(a.answerEvidence.answerMatches,true);
 if(a.examId==='2025')assert.equal(audit.manualEvidence.rows.find(x=>x.no===row.no).answer,row.answer);
 else {
  const source=read('answer-source-private.json').find(x=>x.examId===a.examId);
  const key=source.pages.find(x=>x.page===source.matchedPage).parsed.find(x=>x.no===row.no);
  assert.equal(key.answer,row.answer);assert.equal(key.answers.length,1);
 }
 if(a.status==='ELIGIBLE_LOCAL_RESEARCH'){
  assert.ok(a.formatEligible&&a.sourceMatches&&a.pdf.bodyTextMatch&&a.skeleton.coversCurrentPassage&&a.paperFormMatch);
  assert.ok(a.singleAnswerPresent&&a.skeleton.fiveMarkers&&a.skeleton.targetsInRange);
  assert.equal(a.reasons.length,0);
 }
}
const pilot=rules.pilotExcludedIds.map(itemId=>({itemId,normalizedText:normalizePassage(population.find(x=>x.id===itemId).passage)}));
const selected=chooseSample(rules,rulesSha,candidates,pilot);
assert.deepEqual(selected.primary.map(x=>x.itemId),ledger.primary.map(x=>x.itemId));
assert.deepEqual(selected.reserve.map(x=>x.itemId),ledger.reserve.map(x=>x.itemId));
assert.deepEqual(selected.decisions,ledger.decisions);
assert.equal(selected.primary.length,12);assert.equal(selected.reserve.length,6);
const all=[...selected.primary,...selected.reserve];
assert.equal(new Set(all.map(x=>x.itemId)).size,18);
assert.ok(all.every(x=>!rules.pilotExcludedIds.includes(x.itemId)));
for(let i=0;i<all.length;i++)for(const x of [...pilot,...all.slice(0,i)])assert.ok(jaccard(all[i].normalizedText,x.normalizedText)<0.8,'reused passage');
for(const cell of rules.ordering.globalCellOrder){assert.equal(selected.primary.filter(x=>x.cell===cell).length,2);assert.equal(selected.reserve.filter(x=>x.cell===cell).length,1);}
for(const x of [...ledger.primary,...ledger.reserve]){
 const chosen=all.find(a=>a.itemId===x.itemId),visual=audit.visualInspection.find(a=>a.itemId===x.itemId);
 assert.equal(x.selectionScore,chosen.selectionScore);
 assert.equal(visual.checked,true);
 assert.equal(x.visualStatus,'CHECKED_SOURCE_FORM_AND_MARKERS');
}
const c=ledger.counts;
assert.deepEqual(c,audit.counts);assert.deepEqual(c,receipt.counts);
assert.equal(c.population,51);assert.equal(c.pilotExcluded,12);assert.equal(c.formatExcluded,6);assert.equal(c.eligible,33);
assert.equal(c.eligibleNotSelected,15);assert.equal(c.answerMatched,51);assert.equal(c.sourceAndSkeletonShaMatched,51);
assert.equal(c.newContextualGoldCreated,0);assert.equal(c.newSenseOptionsCreated,0);assert.equal(c.boundaryNotAssessed,51);
assert.equal(ledger.status,'SAMPLE_PREPARED_NOT_EVALUATED');assert.equal(ledger.accepted,false);assert.equal(ledger.realLearnableV2Count,0);
console.log(JSON.stringify({verified:true,sealSha256:expected,rulesSha256:rulesSha,counts:c,sourcePdfsVerified:seal.sourceFiles.length,publicContentGuardPassed:true}));
