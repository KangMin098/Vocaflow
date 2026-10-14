// scripts/research/csat-reading/v13-principle-validate.mjs
// Read-only identity, denominator and anchor validation; no semantic verdict generation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contentHash} from '../../csat/lib-inquiry-review.mjs';
const r=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex'),d='docs/research/csat-reading/data/v13/';
const s=r(d+'principle-selection.json'),v=r(d+'principle-review.json'),l=r(d+'principle-ledger.json'),c=r(d+'principle-cross-type.json');
assert.equal(s.denominator,110);assert.equal(s.eligible,1);assert.equal(s.selected.length,1);assert.equal(l.items.length,110);assert.equal(l.items.filter(i=>i.reviewed).length,1);assert.equal(new Set(l.items.map(i=>i.pair_id)).size,110);
assert.equal(sha(fs.readFileSync(s.source_path)),s.source_sha256);
assert.equal(sha(fs.readFileSync(d+'principle-selection.json')),v.source.selection_sha256);
for(const source of Object.values(v.source).filter(x=>x?.path))assert.equal(sha(fs.readFileSync(source.path)),source.sha256);
for(const e of v.endpoints){assert.equal(sha(fs.readFileSync(e.input_path)),e.input_sha256);assert.equal(e.key.answer,2);assert.ok(Object.values(e.field_complete).every(Boolean));}
assert.equal(v.endpoint_paths.length,2);for(const p of v.endpoint_paths){assert.deepEqual(p.A.allows.filter(n=>p.B.allows.includes(n)),p.intersection);assert.equal(p.all5.length,5);assert.ok(p.B.allows.length>1);}
const items=c.input_files.flatMap(f=>{assert.equal(sha(fs.readFileSync(f.path)),f.sha256);const x=r(f.path);return x.items??x});
assert.equal(c.cases.length,5);assert.equal(new Set(c.cases.flatMap(x=>x.items.map(i=>i.id))).size,10);
for(const p of c.cases)for(const i of p.items){const input=items.find(x=>x.id===i.id),audit=r(i.source_audit).items.find(x=>x.id===i.id);assert.equal(sha(JSON.stringify(input)),i.input_object_sha256);assert.equal(sha(JSON.stringify(audit)),i.source_audit_object_sha256);assert.ok(i.anchor.start>=0&&i.anchor.end<=input.passage.length);assert.equal(input.choices.length,5);assert.equal(i.all_five_candidates_read,true);}
assert.equal(c.summary.student_transfer_trials,0);assert.equal(v.summary.unchanged_full_original_wording_confirmed,0);
const extension=r(d+'principle-extension-registration.json');assert.equal(extension.denominator,110);assert.equal(extension.eligible,0);assert.equal(extension.selected.length,0);assert.equal(extension.ledger.length,110);assert.equal(sha(fs.readFileSync(extension.source.path)),extension.source.sha256);
const control=r(d+'principle-control-review.json');assert.equal(control.question_originals_read,2);assert.equal(control.same_form_answer_sheets_verified,0);assert.equal(control.source_complete_pair_count,0);assert.equal(sha(fs.readFileSync(control.input.path)),control.input.sha256);assert.equal(sha(fs.readFileSync(d+'principle-control-registration.json')),control.registration_sha256);
const current=r(d+'principle-current-ledger.json');assert.equal(current.items.length,110);assert.equal(current.items.filter(i=>i.review_attempted).length,2);assert.equal(current.items.filter(i=>i.both_original_and_key_checked).length,1);assert.equal(current.items.filter(i=>!i.review_attempted).length,108);assert.equal(current.previous_ledger_sha256,sha(fs.readFileSync(d+'principle-ledger.json')));assert.equal(current.control_review_sha256,sha(fs.readFileSync(d+'principle-control-review.json')));
const bindings=r(d+'principle-writer-bindings.json');for(const b of bindings.items){const x=r(b.writer_file),item=(Array.isArray(x)?x:x.items).find(i=>i.id===b.id);assert.equal(contentHash(item),b.content_hash);assert.equal(b.content_hash,b.compare_inquiry_hash);assert.equal(b.match,true);}
console.log('PASS:110 ledger rows;1 source-checked pair;2 candidate intersections;5 cross cases/10 development items;hashes/anchors preserved. Semantic claims remain single-AI R1.');
