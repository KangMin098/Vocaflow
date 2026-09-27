// scripts/csat/__tests__/gate-retention.test.mjs
//
// **보관 축은 게시 축과 갈라져 있어야 한다.** 둘이 붙으면 「게시 불가」가 「미보관」으로 읽혀
// "확보한 원문 전량에 보관 판정이 있는가" 에 답할 수 없게 된다(2026-09-23 그렇게 됐다).
// 그래서 여기서 못박는 것은 값 몇 개가 아니라 **두 축이 서로 독립이라는 성질**이다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { retentionOf, RETENTION, decide } from '../gate-rules.mjs'

test('raw 도 읽고 가른다 — 판정 없는 원본은 보관이 아니라 미결정이다(2026-09-24)', () => {
  // 예전에는 판정과 무관하게 전량 추출 대기로 셌다. 그래서 31,220편이 아무도 안 읽은 채
  // 「보관」으로 보였다. 30편을 전문으로 읽으니 13편이 버릴 논문이었다.
  assert.equal(retentionOf({ purpose: 'raw' }), 'undecided')
  for (const v of ['use', 'narrative']) {
    assert.equal(retentionOf({ purpose: 'raw', retain: v }), 'keep-pending-extraction')
    assert.equal(retentionOf({ purpose: 'raw', verdict: v }), 'keep-pending-extraction')
  }
  assert.equal(retentionOf({ purpose: 'raw', retain: 'reject' }), 'discard')
  assert.equal(retentionOf({ purpose: 'raw', verdict: 'reject' }), 'discard')
  // 보관 판정(retain)이 있으면 그것이 이긴다 — raw 의 게이트 verdict 는 옛 전문 판정이다.
  assert.equal(retentionOf({ purpose: 'raw', verdict: 'use', retain: 'reject' }), 'discard')
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
  const raw = { purpose: 'raw', verdict: 'use', retain: 'use', genre: 'science', codes: [] }
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

test('파생물(발췌·도입부·개작)은 원천이 아니다 — 회차·보관 판정에서 뺀다', async () => {
  const { derivativeKind } = await import('../gate-rules.mjs')
  assert.equal(derivativeKind({ source_id: 'x', feed_id: 'plos-extract' }), 'extract')
  assert.equal(derivativeKind({ source_id: 'adapt:0123:1' }), 'adapt')
  assert.equal(derivativeKind({ source_id: 'A-flat minor#lead-trim' }), 'lead')
  assert.equal(derivativeKind({ source_id: 'europe_pmc:PMC11474320#p1-2' }), 'paragraphs')
  // 원천 — 판정 대상
  assert.equal(derivativeKind({ source_id: 'wikipedia:1050773', feed_id: null }), null)
  assert.equal(derivativeKind({ source_id: 'plos:10.1371/journal.pone.0001', feed_id: 'harvest' }), null)
})

test('csat_fit.derived_from 이 있으면 열쇠 모양과 무관하게 파생물이다 — 원천 우선 수집 · originals-backfill', async () => {
  const { derivativeKind } = await import('../gate-rules.mjs')
  // frym 초록 행은 원본 열쇠(`frym:<DOI>`)를 차지하고 있어 모양으로는 못 가른다
  const abstract = { id: 'u1', source_id: 'frym-full:10.3389/frym.2020.00001', kind: 'abstract' }
  assert.equal(derivativeKind({ source_id: 'frym:10.3389/frym.2020.00001', derived_from: abstract }), 'abstract')
  // kind 가 비었으면 'derived' — 연결이 있다는 사실만으로 파생물이다
  assert.equal(derivativeKind({ source_id: 'space_place:mars', derived_from: { id: 'u2' } }), 'derived')
  // 연결이 없거나 비었으면 예전 규칙 그대로
  assert.equal(derivativeKind({ source_id: 'frym-full:10.3389/frym.2020.00001', derived_from: null }), null)
  assert.equal(derivativeKind({ source_id: 'europe_pmc:PMC1#p1-2', derived_from: {} }), 'paragraphs')
})
