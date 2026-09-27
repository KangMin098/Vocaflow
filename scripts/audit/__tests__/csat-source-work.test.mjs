// scripts/audit/__tests__/csat-source-work.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { discoverWork, addWork } from '../csat-source-work.mjs'
import { auditFailures } from '../csat-sources-checks.mjs'
const clean = { analysisStatus: 'complete', contentStatus: 'accepted', blockers: [] }
test('healthy analyzed sources do not enter a batch', () => assert.deepEqual(discoverWork({}, clean, {}, false), []))
test('raw sources need extraction before judgment', () => {
  assert.deepEqual(discoverWork({ gate: { purpose: 'raw' } }, { ...clean, contentStatus: 'unjudged' }, {}, false), ['raw_extraction'])
})
test('CEFR exclusion is not a request to lower CEFR or run a pointless judgment', () => {
  assert.deepEqual(discoverWork({}, { ...clean, contentStatus: 'unjudged', blockers: ['cefr_above_band'] }, {}, false), ['policy_exclusion'])
})
test('quality candidates remain conditional and cache repair is independent', () => {
  assert.deepEqual(discoverWork({}, clean, { quality_flags: ['dup-paragraph'] }, true), ['cache_refresh', 'quality_review'])
  const matrix = {}
  addWork(matrix, 'quality_review', { id: 'a', source: 'nasa' }, clean, { linked_items: 4 })
  assert.equal(matrix.quality_review.group, 'C')
  assert.equal(matrix.quality_review.recordedLinkedItems, 4)
})
test('same-grade contract drift and orphan references fail CI', () => {
  assert.deepEqual(auditFailures({ findings: { cache_contract_drift: { count: 1 } }, orphanItemReferences: ['a'] }), ['cache_contract_drift', 'orphan_item_references'])
})
test('confirmed non-prose needs no fabricated analysis repair', () => {
  assert.deepEqual(discoverWork({}, { analysisStatus: 'missing', contentStatus: 'rejected', blockers: ['content_rejected', 'analysis_missing'] }, {}, false), ['policy_exclusion'])
})
test('길이는 제외 사유가 아니다 — 발췌 대기분은 excerptStatus 로만 센다 (2026-09-23)', () => {
  // 지문 창보다 긴 원문은 결함이 아니라 원문의 정상 상태다. 발췌는 교재 생성 단계가 한다.
  assert.deepEqual(
    discoverWork({}, { ...clean, excerptStatus: 'missing' }, {}, false),
    ['excerpt_materialization'],
  )
  assert.deepEqual(
    discoverWork({}, { ...clean, excerptStatus: 'candidate' }, {}, false),
    ['excerpt_materialization'],
  )
  // 창 상한 이하면 자를 것이 없다 — 큐에 넣지 않는다(짧다는 이유로 막지도 않는다).
  assert.deepEqual(discoverWork({}, { ...clean, excerptStatus: 'not-required' }, {}, false), [])
  // 내용이 반려면 길이와 무관하게 차단이다.
  assert.deepEqual(
    discoverWork({}, { analysisStatus: 'complete', contentStatus: 'rejected', excerptStatus: 'missing', blockers: [] }, {}, false),
    ['policy_exclusion'],
  )
  // `base_format` 은 더 이상 생산되지 않지만, 옛 캐시에 남아 있어도 제외 사유가 되면 안 된다.
  assert.deepEqual(
    discoverWork({}, { ...clean, excerptStatus: 'missing', blockers: ['base_format'] }, {}, false),
    ['excerpt_materialization'],
  )
})
