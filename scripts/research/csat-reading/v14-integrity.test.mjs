// scripts/research/csat-reading/v14-integrity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {rejectPrivatePayload,rejectDamagedText} from './v14-integrity.mjs';
test('public guard rejects deeply nested original candidate and Gold',()=>{
 for(const key of ['passage','choices','correct_answer','full_response','fov_rows','normalized_candidate'])assert.throws(()=>rejectPrivatePayload({package:[{[key]:'restricted'}]}),/Private payload/);
});
test('encoding loss cannot pass as readable educational criteria',()=>{
 assert.throws(()=>rejectDamagedText({rubric:'?? ???'}),/Damaged text/);
 assert.throws(()=>rejectDamagedText({gold:'단어\uFFFD'}),/Damaged text/);
});
test('Hangul and a genuine single question mark remain valid',()=>{
 assert.doesNotThrow(()=>rejectDamagedText({prompt:'누구에 대한 주장인가?',criterion:'후보 의미와 본문 근거를 구분한다.'}));
});
test('public guard permits metadata references and aggregate judgment metrics',()=>{
 assert.doesNotThrow(()=>rejectPrivatePayload({private_detail:{path:'local/a.json',sha256:'opaque'},task_fit:{n:40,raw_agreement:1},item_id:'2018#22'}));
});
