// scripts/csat/__tests__/design-drain-bind.test.mjs
//
// 설계 주석 드레인 결속 — 분석 버전이나 지문이 바뀐 뒤의 옛 판정을 새 분석에 붙이지 않는다(2026-10-11).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkBind, makeBind, passageHash } from '../design-drain-bind.mjs'

const analysis = { id: 'a-1', version: 3 }
const passage = 'One. Two. Three.'

test('같은 분석 · 같은 지문이면 통과', () => {
  assert.deepEqual(checkBind(makeBind(analysis, passage), { analysis, passage }), { ok: true })
})

test('분석 버전이 오르면 막는다 — 전에는 문장 수만 같으면 붙었다', () => {
  const r = checkBind(makeBind(analysis, passage), { analysis: { id: 'a-2', version: 4 }, passage })
  assert.equal(r.ok, false)
  assert.match(r.why, /분석 버전/)
})

test('문장 수가 같아도 지문이 바뀌면 막는다', () => {
  const r = checkBind(makeBind(analysis, passage), { analysis, passage: 'One. Two. Four.' })
  assert.equal(r.ok, false)
  assert.match(r.why, /지문/)
})

test('결속 없는 옛 산출물은 legacy 로 표시한다(import 는 이미 같은 값일 때만 통과시킨다)', () => {
  const r = checkBind(null, { analysis, passage })
  assert.equal(r.ok, false)
  assert.equal(r.legacy, true)
})

test('해시는 결정적이다', () => {
  assert.equal(passageHash(passage), passageHash('One. Two. Three.'))
  assert.notEqual(passageHash(passage), passageHash(passage + ' '))
})
