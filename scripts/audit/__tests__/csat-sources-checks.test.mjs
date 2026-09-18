// scripts/audit/__tests__/csat-sources-checks.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { compositionContradictions, auditFailures } from '../csat-sources-checks.mjs'

test('a raw PLOS reject cannot disappear behind the excerpt label', () => {
  const codes = compositionContradictions({ purpose: 'raw', verdict: 'reject', genre: 'fragmentary', publishable: false, blockedBy: 'oversize-raw' }, 'excerpt')
  assert.deepEqual(codes, ['reject_composable'])
  assert.deepEqual(auditFailures({ findings: { [codes[0]]: { count: 319 } } }), ['reject_composable'])
})

test('reading-library poetry is distinguished from the raw rejection bypass', () => {
  assert.deepEqual(compositionContradictions({ purpose: 'library', verdict: 'reject', genre: 'poetry-drama' }, 'usable'), ['library_poetry_composable'])
  assert.deepEqual(auditFailures({ findings: { library_poetry_composable: { count: 7 } } }), [])
})

test('harmful genre is checked even when verdict incorrectly says use', () => {
  assert.deepEqual(compositionContradictions({ purpose: 'csat', verdict: 'use', genre: 'bias' }, 'usable'), ['harmful_composable'])
})

test('already blocked or unjudged rows are not counted as a composition bypass', () => {
  for (const grade of ['blocked', 'unjudged', 'unknown', 'excerpt-blind']) {
    assert.deepEqual(compositionContradictions({ purpose: 'raw', verdict: 'reject', genre: 'pseudoscience' }, grade), [])
  }
  assert.deepEqual(auditFailures({ findings: {} }), [])
})

test('missing, stale and diverging caches fail audit; fresh snapshots pass', () => {
  assert.deepEqual(auditFailures({ findings: { cache_stale: { count: 1 } } }), ['cache_stale'])
  assert.deepEqual(auditFailures({ findings: {}, snapshot: { inventoryDelta: 90, candidateDelta: 90, gradeDelta: {} } }), ['snapshot_drift'])
  assert.deepEqual(auditFailures({ findings: {}, snapshot: { inventoryDelta: 0, candidateDelta: 0, gradeDelta: { usable: 0 } } }), [])
})
