// scripts/textbook/factory-lineage.test.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { sourceRightsHash } from './frym-benchmark/gold-s-import-gate.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'
import { assembleReadingUnit, isBlocked, buildColophon, renderVolumeDocument } from '@vocaflow/library-pipeline'
import { assertCompatibleOrderLineages, assertOrderLineage, assertSameLineage, currentReadingLineage, loadCurrentReadingLineages, verifyCurrentItemLineages } from './factory-lineage.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const h = c => c.repeat(64)

function fixture() {
  const parent = { id: '00000000-0000-4000-8000-000000000002', content: 'Original claim.', updated_at: '2026-10-08T00:00:00Z', source: 'frym', license: 'CC BY', license_class: 'cc_by', display_only: false, copyright_safe_in_kr: true }
  const article = { id: '00000000-0000-4000-8000-000000000001', source_id: `reading:${parent.id}:target`, adapted_from_id: parent.id, content: Array(17).fill('The student text explains evidence and cause with a clear example.').join(' '), updated_at: '2026-10-08T01:00:00Z', status: 'ready', source: parent.source, license: parent.license, license_class: parent.license_class, display_only: false, copyright_safe_in_kr: true }
  const order = { order_id: 'order-1', order_revision: 1, order_hash: h('a') }
  const audit = { request_id: 'request-1', article_id: article.id, source_id: parent.id, order_id: order.order_id, order_revision: order.order_revision, order_hash: order.order_hash, evidence_hash: h('c'), certificate_hash: h('d'), eligibility_hash: h('e'), trust_policy_hash: h('f'), benchmark_version: 'v1', benchmark_snapshot_hash: h('0'), result_status: 'ready', request_payload: { article_id: article.id, child_source_id: article.source_id, source_id: parent.id, product_order_id: order.order_id, order_revision: order.order_revision, order_hash: order.order_hash, evidence_hash: h('c'), certificate_hash: h('d'), eligibility_hash: h('e'), trust_policy_hash: h('f'), benchmark_version: 'v1', benchmark_snapshot_hash: h('0'), source_content_sha256: sha(parent.content), child_content_sha256: sha(article.content), source_updated_at: parent.updated_at, article_updated_at: article.updated_at, rights_hash: sourceRightsHash(parent) } }
  audit.request_hash = hash(audit.request_payload)
  audit.request_payload.request_hash = audit.request_hash
  const authority = { valid_until: '2026-11-01T00:00:00Z', trust_policy_hash: audit.trust_policy_hash, benchmark_version: audit.benchmark_version, benchmark_snapshot_hash: audit.benchmark_snapshot_hash, revoked_certificate_hashes: [], revoked_eligibility_hashes: [] }
  return { parent, article, order, audit, authority, now: '2026-10-08T02:00:00Z' }
}

test('one promoted reading child binds the order and audit evidence', () => {
  const value = currentReadingLineage(fixture())
  assert.equal(value.product_order_id, 'order-1')
  assert.equal(value.adaptation_hash, sha(fixture().article.content))
  assertSameLineage(value, { ...value })
  assertOrderLineage([{ payload: { factory_lineage: value } }, { payload: { factory_lineage: value } }])
})

test('mixed order, stale source, revoked rights, and mixed item fail closed', () => {
  const f = fixture()
  const value = currentReadingLineage(f)
  assert.throws(() => currentReadingLineage({ ...f, order: { ...f.order, order_revision: 2 } }), /PRODUCT_ORDER_STALE/)
  assert.throws(() => currentReadingLineage({ ...f, article: { ...f.article, content: 'Changed.' } }), /PROMOTED_BODY_STALE/)
  assert.throws(() => currentReadingLineage({ ...f, parent: { ...f.parent, display_only: true } }), /SOURCE_RIGHTS_STALE/)
  assert.throws(() => currentReadingLineage({ ...f, authority: { ...f.authority, revoked_certificate_hashes: [f.audit.certificate_hash] } }), /PROMOTION_AUTHORITY_STALE_OR_REVOKED/)
  assert.throws(() => currentReadingLineage({ ...f, now: '2026-11-02T00:00:00Z' }), /PROMOTION_AUTHORITY_STALE_OR_REVOKED/)
  assert.throws(() => assertOrderLineage([{ payload: { factory_lineage: value } }, { payload: { factory_lineage: { ...value, evidence_hash: h('1') } } }]), /FACTORY_LINEAGE_STALE_OR_MIXED/)
})

test('a newer valid promotion supersedes a historical audit without mixing orders', async () => {
  const f = fixture()
  const newer = structuredClone(f.audit)
  newer.request_id = 'request-2'
  newer.order_revision = 2
  newer.order_hash = h('2')
  newer.request_payload.order_revision = 2
  newer.request_payload.order_hash = h('2')
  delete newer.request_payload.request_hash
  newer.request_hash = hash(newer.request_payload)
  newer.request_payload.request_hash = newer.request_hash
  const order = { ...f.order, order_revision: 2, order_hash: h('2') }
  const tables = { reading_promotion_audit: [f.audit, newer], reading_product_order_revision: [order] }
  const db = { from(table) { return { select() { return {
    in(column, values) { return Promise.resolve({ data: (tables[table] ?? []).filter(row => values.includes(row[column])), error: null }) },
    eq(column, value) { return { maybeSingle() { return Promise.resolve({ data: table === 'reading_promotion_authority' && column === 'singleton' && value ? f.authority : null, error: null }) } } },
  } } } } }
  const map = await loadCurrentReadingLineages(db, [f.article], new Map([[f.parent.id, f.parent]]), f.now)
  assert.equal(map.get(f.article.id).order_revision, 2)
  assertCompatibleOrderLineages([{ payload: { factory_lineage: map.get(f.article.id) } }], 'order-1')
})

test('item, explanation, review, unit and render keep one current lineage', async () => {
  const f = fixture()
  const tables = { library_articles: [f.article, f.parent], reading_promotion_audit: [f.audit], reading_product_order_revision: [f.order] }
  const db = { from(table) { return { select() { return {
    in(column, values) { return Promise.resolve({ data: (tables[table] ?? []).filter(row => values.includes(row[column])), error: null }) },
    eq(column, value) { return { maybeSingle() { return Promise.resolve({ data: table === 'reading_promotion_authority' && column === 'singleton' && value ? f.authority : null, error: null }) } } },
  } } } } }
  const lineage = currentReadingLineage(f)
  const item = { id: 'item-1', ref_id: f.article.id, payload: { passage: f.article.content, factory_lineage: lineage }, answer_key: { answer: 1 } }
  await verifyCurrentItemLineages(db, [item], f.now)
  const explanation = { item_id: item.id, factory_lineage: structuredClone(lineage), text: 'The original evidence supports this answer.' }
  assertSameLineage(item.payload.factory_lineage, explanation.factory_lineage)
  const review = { item_id: item.id, factory_lineage: structuredClone(lineage) }
  assertSameLineage(item.payload.factory_lineage, review.factory_lineage)
  const unit = { items: [item] }
  const volume = { units: [unit] }
  assertCompatibleOrderLineages(volume.units.flatMap(part => part.items), 'order-1')
  const manifest = { productOrder: assertCompatibleOrderLineages([item], 'order-1'), itemEvidence: [{ itemId: item.id, lineage }] }
  assert.equal(manifest.itemEvidence[0].lineage.promotion_request_hash, f.audit.request_hash)
  const unitItems = [
    ...Array.from({ length: 5 }, (_, paragraph_idx) => ({ type: 'order', paragraph_idx, payload: { factory_lineage: lineage }, answer_key: {} })),
    ...Array.from({ length: 4 }, (_, paragraph_idx) => ({ type: 'insert', paragraph_idx, payload: { factory_lineage: lineage }, answer_key: {} })),
  ]
  const vocabulary = Array.from({ length: 40 }, (_, n) => ({ word: `word${n}`, meaning_ko: `뜻${n}`, v_level: 5, first_sentence: `Sentence ${n}.`, frequency_in_article: 40 - n }))
  const assembled = assembleReadingUnit({ ref_id: f.article.id, title: 'Student research explanation', word_count: f.article.content.split(/\s+/).length, v_level: 5, cefr_level: 'B2', display_only: false }, unitItems, vocabulary)
  assert.equal(isBlocked(assembled), false)
  if (!isBlocked(assembled)) {
    assertCompatibleOrderLineages(assembled.items, 'order-1')
    const html = renderVolumeDocument({ colophon: buildColophon({ title: 'Synthetic Reading', step: 5, schoolBand: '고1', vLevel: 5, autoPassed: 9, autoTotal: 10 }), step: 5, schoolBand: '고1', vLevel: 5, totalSteps: 7, unitCount: 1, itemCount: assembled.items.length, totalMinutes: 20, autoPassed: 9, autoTotal: 10, passageChip: '합성 검증', answerBias: { chi2: 0, cramersV: 0, biased: false }, proof: { passages: 1, defective: 0 }, unitsHtml: `<section class="unit"><p>${f.article.content}</p></section>`, answers: [{ no: 1, answer: 1, explanation: { text: explanation.text, from: 'batch' } }] })
    assert.match(html, /Synthetic Reading/)
  }
  assert.throws(() => assertSameLineage(item.payload.factory_lineage, { ...explanation.factory_lineage, order_revision: 2 }), /FACTORY_LINEAGE_STALE_OR_MIXED/)
  f.authority.revoked_eligibility_hashes = [f.audit.eligibility_hash]
  await assert.rejects(verifyCurrentItemLineages(db, [item], f.now), /FACTORY_LINEAGE_MISSING/)
})
