// scripts/csat/__tests__/analysis-rules.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { namedReferentExclusions } from '../lib-analysis-rules.mjs'
import { buildUnits, precheckAnalysis, PRECHECK_VERSION } from '../lib-evidence-units.mjs'

const bad = [
  '밑줄이 든 문장이 다른 인물을 이름·호칭으로 따로 부르면 밑줄은 그 사람이 아니라고 지운다',
  '밑줄 문장이 다른 사람을 이름·명사구로 따로 부르는지 확인한다 — 따로 불린 사람은 그 밑줄이 아니다',
  '그 문장이 다른 인물을 이름·호칭으로 따로 부르면 밑줄은 그 인물이 아니다',
  '같은 문장 안에서 다른 인물이 이름으로 따로 불리면 밑줄은 그 사람이 아니다',
  '같은 문장에 다른 인물이 이름으로 따로 불리면 밑줄은 그 인물이 아니다',
  '밑줄이 든 문장이 다른 인물을 이름으로 따로 부르면 밑줄은 그 인물이 아니라고 지운다',
  '그 문장 안에서 다른 인물을 이름(the girl·Cora)으로 따로 부르면 밑줄은 그 사람이 아니다',
]

test('confirmed named-referent rule variants are rejected, including on_fail', () => {
  for (const text of bad) assert.deepEqual(namedReferentExclusions([{ on_fail: text }]), [text])
})

test('the correction forbids the invalid rule and remains admissible', () => {
  const valid = '같은 문장에 이름이 있다는 이유로 후보를 지우지 말고 after Dorothy dropped의 부사절을 별도 분리하여 주절 suspected·phoned의 주체와 비교한다.'
  assert.deepEqual(namedReferentExclusions([{ step: valid }]), [])
  assert.deepEqual(namedReferentExclusions([{ step: '같은 문장에 이름이 따로 나와도 밑줄은 그 사람이 아니라고 단정하지 않는다.' }]), [])
  assert.deepEqual(namedReferentExclusions([{ step: '이름을 따로 적고 문장 속 행위자·발화자·소유자를 비교한다.' }]), [])
})

test('a separate valid warning does not mask an invalid instruction', () => {
  assert.equal(namedReferentExclusions(`이름만으로 문장의 후보를 지우지 말고 별도 대조한다. ${bad[0]}`).length, 1)
})

test('DB precheck rejects a bad rule even when all references and quotes are valid', () => {
  const passage = 'The father realized that he had been wrong.'
  const { units } = buildUnits(passage)
  const analysis = { answer_locus: { quote: passage, sentence_index: [1] }, solve_procedure: [{ step: bad[0] }] }
  const result = precheckAnalysis(analysis, units)
  assert.equal(PRECHECK_VERSION, 3)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /V10/)
})
