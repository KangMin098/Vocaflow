// scripts/research/factory-i2-r5-qualification/verify-content.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { itemRevision, jsonbText, orderedChoices } from './verify-content.mjs'
const row = { stem: 'Select title', passage: 'Unique source passage.', choices: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'], answer: 2 }
const page = '21. Other source ① Earlier ② Earlier ③ Earlier ④ Earlier ⑤ Earlier. 24. Unique source passage. ① Alpha ② Beta ③ Gamma ④ Delta ⑤ Epsilon 3 8'
test('numbered choices after this passage match, earlier questions are ignored', () => {
  assert.deepEqual(orderedChoices(page, row.passage, row.choices), { matched: true, matchedCount: 5 })
})
test('swapping choices while retaining answer number fails both source order and revision binding', () => {
  const changed = { ...row, choices: [row.choices[1], row.choices[0], ...row.choices.slice(2)] }
  assert.equal(changed.answer, row.answer)
  assert.equal(orderedChoices(page, row.passage, changed.choices).matched, false)
  assert.notEqual(itemRevision(changed), itemRevision(row))
})
test('stem and answer edits also change the bound revision', () => {
  assert.notEqual(itemRevision({ ...row, stem: 'Edited' }), itemRevision(row))
  assert.notEqual(itemRevision({ ...row, answer: 1 }), itemRevision(row))
})
test('JSONB serialization handles byte-length ordering, escaping and spaced arrays', () => {
  assert.equal(jsonbText({ long: [1, 'x'], b: '"', a: null }), '{"a": null, "b": "\\\"", "long": [1, "x"]}')
  assert.throws(() => jsonbText({ n: 1.2 }), /Unsupported numeric/)
})
test('missing passage, malformed numbering and extra choice text fail closed', () => {
  assert.equal(orderedChoices(page, 'missing', row.choices).matched, false)
  assert.equal(orderedChoices(page.replace('① Alpha', '② Alpha'), row.passage, row.choices).matched, false)
  assert.equal(orderedChoices(page.replace('⑤ Epsilon', '⑤ Epsilon changed'), row.passage, row.choices).matched, false)
})
