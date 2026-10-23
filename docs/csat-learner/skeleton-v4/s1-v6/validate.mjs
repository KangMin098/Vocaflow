// docs/csat-learner/skeleton-v4/s1-v6/validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const arg=name=>process.argv[process.argv.indexOf(name)+1];
if(!process.argv.includes('--source-root')||!process.argv.includes('--samples'))throw Error('Usage: node validate.mjs --source-root <same-commit-source> --samples <preserved-samples.json>');
const src=arg('--source-root');
const load=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const records=[];
function check(name,fn){fn();records.push({name,result:'PASS',scope:'artifact/source structure; not content or product acceptance'});}
const manifest=load('MANIFEST.json'), features=load('FEATURE_DECISIONS.json').features, cues=load('LECTURE_CUES.json');
const originals=JSON.parse(fs.readFileSync(path.join(src,cues.sourcePath),'utf8')).lectures;
check('ten features / forty distinct alternative kinds / no unsupported selection',()=>{
 assert.deepEqual(features.map(f=>f.id),Array.from({length:10},(_,i)=>`F${String(i+1).padStart(2,'0')}`));
 for(const f of features){assert.deepEqual(f.alternatives.map(a=>a.kind),['REUSE','IMPROVE','REPLACE','NEW']);assert.equal(new Set(f.alternatives.map(a=>a.proposal)).size,4);assert.equal(f.selected,null);assert.ok(f.minimumEvidence&&f.scenario&&f.acceptance);for(const a of f.alternatives)assert.equal(a.costComparison,'DEFERRED_UNTIL_ADMISSIBLE');}
 assert.equal(features.filter(f=>f.decision==='BLOCKED_EVIDENCE').length,4);
 assert.deepEqual(features.filter(f=>f.alternatives[0].gate==='REJECTED_CONTROL').map(f=>f.id),['F07','F08']);
});
check('lecture file binding / 37 unchanged original cues / six separate proposals',()=>{
 assert.equal(hash(fs.readFileSync(path.join(src,cues.sourcePath))),cues.sourceFileSHA256);
 assert.deepEqual(cues.scripts.map(s=>[s.item_id,s.lecture_version,s.originalScript.cues.length,s.total_sec_est]),[['2026#34',2,12,196],['2026#22',2,13,182],['2026#38',3,12,185]]);
 const proposals=[];
 for(const s of cues.scripts){assert.deepEqual(s.originalScript,originals[s.item_id]);assert.equal(hash(JSON.stringify(s.originalScript)),s.originalScriptSHA256);assert.equal(s.analysis_version,5);assert.equal(s.cueContract.length,s.originalScript.cues.length);s.cueContract.forEach((c,i)=>{assert.equal(c.cueId,s.originalScript.cues[i].id);assert.equal(c.est_sec,s.originalScript.cues[i].est_sec);assert.deepEqual(c.originalTarget,s.originalScript.cues[i].target);assert.ok(c.lookAt&&c.compareOrJudge&&c.visualReaction&&c.disclosureRisk);if(c.proposal){assert.equal(c.proposal.status,'CANDIDATE_NOT_APPROVED_NOT_APPLIED');proposals.push(`${s.item_id}:${c.cueId}`);}});}
 assert.deepEqual(proposals,['2026#34:c1','2026#34:c4','2026#34:c12','2026#22:c13','2026#38:c1','2026#38:c12']);
});
check('v6 AT 26 unique / known current-state failure / honest unverified scope',()=>{
 const a=load('ACCEPTANCE_RESULTS.json');assert.equal(a.tests.length,26);assert.deepEqual(a.tests.map(t=>t.id),Array.from({length:26},(_,i)=>`AT${String(i+1).padStart(2,'0')}`));
 assert.ok(a.tests.every(t=>['PASS','FAIL','BLOCKED','NOT_RUN'].includes(t.result)));
 assert.equal(a.tests.find(t=>t.id==='AT08').result,'FAIL');assert.equal(a.tests.find(t=>t.id==='AT20').result,'PASS');assert.equal(a.normalAuth,'BLOCKED');assert.equal(a.tts,'NOT_RUN');assert.equal(a.contentValidation,'NOT_VERIFIED');assert.equal(a.learnerObserved,'NOT_OBSERVED');
});
check('captured evidence hashes / ten images / isolated vs anonymous boundary',()=>{
 for(const e of manifest.evidence)assert.equal(hash(fs.readFileSync(path.join(dir,e.file))),e.sha256);
 assert.equal(manifest.evidence.filter(e=>e.file.endsWith('.png')).length,10);
 const browser=load('evidence/browser-results.json');assert.equal(browser.sourceCommit,manifest.sourceCommit);
 assert.equal(browser.results.filter(r=>r.scope==='live-anonymous'&&r.loginGate&&r.itemVisible===0).length,2);
 assert.ok(browser.results.filter(r=>r.scope==='isolated-current-components').every(r=>r.normalAuth===false&&r.fullOriginalPresent===false));
});
const samples=JSON.parse(fs.readFileSync(arg('--samples'),'utf8'));
check('real sample judgment structures and pair zero (not semantic validation)',()=>{
 const find=n=>samples.find(s=>s.itemId===`2026#${n}`);
 const a=find(34),b=find(22),c=find(38);assert.ok(a&&b&&c);assert.equal(a.inquiry.distractors.find(d=>d.n===2).truth,'unknown');assert.equal(b.inquiry.distractors.find(d=>d.n===3).truth,'true');assert.ok(c.inquiry.distractors.every(d=>d.truth==='not_applicable'));assert.equal(a.v3Pairs.length,0);
 const choice=(s,n)=>s.inquiry.v3.choices.find(v=>v.n===n);
 assert.deepEqual([choice(a,2).content_truth,choice(a,2).requirement_fit],['unknown','fails']);
 assert.deepEqual([choice(b,3).content_truth,choice(b,3).requirement_fit],['true','fails']);
 assert.ok(c.inquiry.v3.choices.every(v=>v.content_truth==='n_a'));
 assert.deepEqual([choice(c,4).requirement_fit,choice(c,5).requirement_fit],['fails','satisfies']);
});
check('local Markdown links resolve',()=>{
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){const body=fs.readFileSync(path.join(dir,f),'utf8');for(const m of body.matchAll(/\]\((\.\.?\/[^)#]+)(?:#[^)]*)?\)/g)){assert.ok(fs.existsSync(path.resolve(dir,m[1])),`${f}: ${m[1]}`);}}
});
const result={observed_at:new Date().toISOString(),sourceCommit:manifest.sourceCommit,s0AcceptedCommit:manifest.s0AcceptedCommit,level:'L1 document + preserved/current component evidence',checks:records,unrun:['normal authenticated route/RLS','local PDF/full choices','actual TTS/audio','content validation','learner observation/transfer/grade effect','full CI/build/typecheck'],note:'These six artifact checks do not convert the 26 AT results into product PASS.'};
fs.writeFileSync(path.join(dir,'CHECKS.json'),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify(result,null,2));
