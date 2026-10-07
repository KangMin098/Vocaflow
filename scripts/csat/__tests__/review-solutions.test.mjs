// scripts/csat/__tests__/review-solutions.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import {validateBlindSolutions} from '../lib-review-solutions.mjs'
const rows = [{run_id:'run-a',item_id:'item-a',kind:'blind'}, {run_id:'run-b',item_id:'item-b',kind:'blind'}]
const solution = (i) => ({run_id:`run-${i}`,item_id:`item-${i}`,answer:2,note:'The pronoun refers to the earlier subject, which rules out the other choices.'})
test('fully bound actual solutions pass and retain the supplied evidence', () => {
 const notes=[solution('a'),solution('b')]
 assert.equal(validateBlindSolutions(notes,rows),notes)
})
test('a missing final note rejects the whole batch before a caller can write its first row', () => {
 let writes=0
 assert.throws(() => { for(const note of validateBlindSolutions([solution('a'),{...solution('b'),note:undefined}],rows))writes++ }, /reasoning/)
 assert.equal(writes,0)
 assert.throws(() => validateBlindSolutions([{...solution('a'),note:'undefined'}],rows),/reasoning/)
})
test('wrong item binding, duplicate runs and excluded runs cannot become solve evidence', () => {
 assert.throws(() => validateBlindSolutions([{...solution('a'),item_id:'item-b'}],rows),/mismatch/)
 assert.throws(() => validateBlindSolutions([solution('a'),solution('a')],rows),/Duplicate/)
 assert.throws(() => validateBlindSolutions([solution('a')],[{...rows[0],excluded:true}]),/excluded/)
})
test('invalid answers and absent or empty batches are rejected', () => {
 for(const answer of [0,6,2.5,'2',null])assert.throws(()=>validateBlindSolutions([{...solution('a'),answer}],rows),/integer/)
 for(const notes of [null,[],{},[null]])assert.throws(()=>validateBlindSolutions(notes,rows))
})
test('damaged encoding rejects the entire immutable solve batch without rejecting readable Korean', () => {
 let writes=0
 const broken={...solution('b'),note:'u19 sister媛\u0080 Cheryl???\u0080?좏빐 applied라는 손상된 기록'}
 assert.throws(()=>{for(const note of validateBlindSolutions([solution('a'),broken],rows))writes++},/encoding/)
 assert.equal(writes,0)
 assert.throws(()=>validateBlindSolutions([{...solution('a'),note:'A long enough explanation containing the replacement character �.'}],rows),/encoding/)
 const korean={...solution('a'),note:'u19에서 언니가 대신 신청했다고 명시하므로 직접 신청했다는 선지의 주체가 다르다.'}
 assert.equal(validateBlindSolutions([korean],rows)[0],korean)
})
