// scripts/research/factory-qualification/source-fixtures.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtures,calculate} from './source-fixtures.mjs';
import {sourceGuard} from './qualification.mjs';
const copy=id=>structuredClone(fixtures.find(f=>f.id===id).input);
test('all nine evidence-grounded metadata fixtures reproduce expected guard states',()=>assert.equal(calculate().fixtures.length,9));
test('2014 regime mutation restores 22/23 independently for A and B',()=>{for(const id of ['SG01','SG02']){const f=copy(id);assert.equal(sourceGuard(f).state,'fail');f.source.listening_end=22;f.source.reading_start=23;assert.equal(sourceGuard(f).state,'pass');}});
test('same exam key mutation removes A/B mismatch and correct form mutation removes odd/even mismatch',()=>{const f=copy('SG03');f.key.exam_id='2014A';assert.equal(sourceGuard(f).state,'pass');const g=copy('SG04');g.key.form='홀수';assert.equal(sourceGuard(g).state,'pass');});
test('changing M2009 label to matched header removes only identity conflict',()=>{const f=copy('SG05');assert.equal(sourceGuard(f).state,'fail');f.source.expected_exam_id='M2106';f.key.exam_id='M2106';assert.equal(sourceGuard(f).state,'pass');});
test('removing false transcript-as-key claim leaves unknown unverified document, not pass',()=>{const f=copy('SG06');f.key.kind='unverified_document';f.key.content_verified=false;assert.equal(sourceGuard(f).state,'unknown');});
test('pinned old version with latest reference requires review but removing latest reference is guard-only pass',()=>{const f=copy('SG07');assert.equal(sourceGuard(f).state,'unknown');delete f.latest_analysis;assert.equal(sourceGuard(f).state,'pass');});
test('correct generation revision restores exact version binding, actual latest then remains unknown',()=>{const f=copy('SG08');f.generated_binding.analysis.revision=3;assert.equal(sourceGuard(f).state,'pass');f.latest_analysis={revision:5};assert.equal(sourceGuard(f).state,'unknown');});
test('unresolved answer document cannot pass because of filename; unknown remains until verified inventory supplied',()=>{const f=copy('SG09');assert.equal(sourceGuard(f).state,'unknown');f.key.kind='answer_key';assert.equal(sourceGuard(f).state,'fail');});
