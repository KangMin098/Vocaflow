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
