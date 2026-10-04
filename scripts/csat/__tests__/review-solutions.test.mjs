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
