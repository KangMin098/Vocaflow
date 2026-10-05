// scripts/csat/error-evidence/codebook/__tests__/codebook-rules.test.mjs
//   node --test scripts/csat/error-evidence/codebook/__tests__/codebook-rules.test.mjs
// 검증기가 허용하는 규칙 식별자 = 그 회차 코드북 본문의 규칙 표(하드코딩 회귀 방지)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { citesValidRule, makeRuleCheck, rulesFromCodebook } from '../codebook-rules.mjs'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../docs/csat-learner/codebook')
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8')
const range = (n) => new Set(Array.from({ length: n }, (_, i) => `R${i + 1}`))

test('코드북 판본마다 규칙 집합이 본문 표와 같다', () => {
  assert.deepEqual(rulesFromCodebook(read('CODEBOOK.md')), range(11)) // rev3
  assert.deepEqual(rulesFromCodebook(read('CODEBOOK.rev4.md')), range(12))
  assert.deepEqual(rulesFromCodebook(read('CODEBOOK.rev4.1.md')), range(12))
  assert.deepEqual(rulesFromCodebook(read('CODEBOOK.rev4.2.md')), range(12))
  assert.deepEqual(rulesFromCodebook(read('CODEBOOK.rev4.3.md')), range(12))
})

test('현재 최대 규칙은 허용하고, 없는 규칙 · 흐름 단계는 거부한다', () => {
  const check = makeRuleCheck(rulesFromCodebook(read('CODEBOOK.rev4.1.md')))
  assert.equal(citesValidRule('Q4a · R12 ② · R6 ④', check), true)
  assert.equal(citesValidRule('Q2 · R1 · Q5 · R.inference · R11', check), true) // 코드 이름은 식별자가 아니다
  assert.equal(citesValidRule('Q6 · §6 R vs E', check), true)
  assert.equal(citesValidRule('R13', check), false)
  assert.equal(citesValidRule('R999', check), false)
  assert.equal(citesValidRule('Q0a', check), false)
  assert.equal(citesValidRule('Q9', check), false)
  assert.equal(citesValidRule('§6', check), false) // 식별자가 하나도 없으면 거부
})

test('판본별로 분리된다 — rev3 코드북은 R12 를 거부한다', () => {
  const rev3 = makeRuleCheck(rulesFromCodebook(read('CODEBOOK.md')))
  assert.equal(citesValidRule('Q4a · R12', rev3), false)
  assert.equal(citesValidRule('Q4a · R11', rev3), true)
})

test('새 규칙이 표에 추가되면 자동으로 인식한다', () => {
  const fixture = read('CODEBOOK.rev4.1.md').replace('| R11 | `B.no_verification` |', '| R13 | 새 규칙(fixture) | 내용 |\n| R11 | `B.no_verification` |')
  const check = makeRuleCheck(rulesFromCodebook(fixture))
  assert.equal(citesValidRule('Q4a · R13', check), true)
})
