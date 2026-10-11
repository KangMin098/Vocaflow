// scripts/csat/__tests__/lib-fragments.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { findQuote } from '../../../apps/web/src/lib/csat/quote-match.ts'
import { fragments, locateChoice, shortQuoted } from '../lib-fragments.mjs'

const passage = 'Each tour lasts four hours. Visitors may bring family ties to the event. They just aren’t ready yet.'

test('조각 앞뒤의 인용 부호 · 대시를 떼어 지문에서 찾는다(2026-10-11 · 평가원 오답 312 회복)', () => {
  assert.deepEqual(fragments("근거는 'Each tour lasts four hours.' —"), ['Each tour lasts four hours'])
  assert.ok(findQuote(passage, fragments("‘Each tour lasts four hours.’")[0]))
})

test('말줄임표로 끊은 인용은 조각마다 따로', () => {
  assert.deepEqual(fragments("'Visitors may bring family ... They just aren’t ready yet'").sort(), ['They just aren’t ready yet', 'Visitors may bring family'].sort())
})

test('짧은 인용 어구는 두 낱말 이상 · 아포스트로피에서 끊지 않는다', () => {
  assert.deepEqual(shortQuoted("'family ties' 와 'tour' 와 ‘they just aren’t’"), ['they just aren’t', 'family ties'])
})

test('짧은 어구는 지문에 낱말 경계로 딱 한 번 나올 때만 앵커가 된다', () => {
  const ch = { verdict: 'distractor', how_to_reject: "2번 줄의 'family ties' 와 대응한다" }
  assert.deepEqual(locateChoice(ch, passage, findQuote), { quote: 'family ties', from: 'reject' })
  const twice = passage + ' Again family ties matter.'
  assert.equal(locateChoice(ch, twice, findQuote), null)
})
