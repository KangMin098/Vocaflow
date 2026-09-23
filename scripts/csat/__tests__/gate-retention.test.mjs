// scripts/csat/__tests__/gate-retention.test.mjs
//
// **보관 축은 게시 축과 갈라져 있어야 한다.** 둘이 붙으면 「게시 불가」가 「미보관」으로 읽혀
// "확보한 원문 전량에 보관 판정이 있는가" 에 답할 수 없게 된다(2026-09-23 그렇게 됐다).
// 그래서 여기서 못박는 것은 값 몇 개가 아니라 **두 축이 서로 독립이라는 성질**이다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { retentionOf, RETENTION, decide } from '../gate-rules.mjs'

test('raw 는 판정이 무엇이든 추출 대기로 보관된다', () => {
  // plos 원본 31,220편이 여기 걸린다. 판정을 붙여도 게시가 열리지 않으므로
  // 보관 사유는 「읽고 남겼다」가 아니라 「추출 대기」로 남아야 되짚을 수 있다.
  for (const verdict of [undefined, 'use', 'narrative', 'reject']) {
    assert.equal(retentionOf({ purpose: 'raw', verdict }), 'keep-pending-extraction')
  }
})

test('내용 판정이 보관/미보관을 가른다', () => {
  assert.equal(retentionOf({ purpose: 'csat', verdict: 'use' }), 'keep')
  assert.equal(retentionOf({ purpose: 'library', verdict: 'narrative' }), 'keep')
  assert.equal(retentionOf({ purpose: 'csat', verdict: 'reject' }), 'discard')
})

test('아무 축도 답하지 않은 것은 undecided — 이 값이 관리 구멍을 센다', () => {
  assert.equal(retentionOf({ purpose: 'csat' }), 'undecided')
  assert.equal(retentionOf({}), 'undecided')
  assert.equal(retentionOf(), 'undecided')
})

test('보관 축은 게시 축과 독립이다 — 게시 불가가 미보관을 뜻하지 않는다', () => {
  // raw: 게시 불가지만 보관한다. 이 한 줄이 이 파일의 이유다.
  const raw = { purpose: 'raw', verdict: 'use', genre: 'science', codes: [] }
  assert.equal(decide(raw).publishable, false)
  assert.equal(decide(raw).blockedBy, 'oversize-raw')
  assert.equal(retentionOf(raw), 'keep-pending-extraction')

  // reject: 게시도 불가하고 보관도 안 한다. 같은 publishable=false 인데 보관 축이 갈린다.
  const rejected = { purpose: 'csat', verdict: 'reject', genre: 'mixed', codes: [] }
  assert.equal(decide(rejected).publishable, false)
  assert.equal(retentionOf(rejected), 'discard')
})

test('반환값은 언제나 알려진 어휘다', () => {
  const inputs = [
    { purpose: 'raw' }, { purpose: 'csat', verdict: 'use' }, { purpose: 'kids', verdict: 'reject' },
    { purpose: 'library', verdict: 'narrative' }, { purpose: undefined, verdict: undefined },
    { purpose: 'nonsense', verdict: 'nonsense' },
  ]
  for (const input of inputs) assert.ok(RETENTION.has(retentionOf(input)), JSON.stringify(input))
})
