// scripts/csat/listening/__tests__/audit-readiness.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAudit, loadSources, itemId } from '../audit-readiness.mjs'

test('itemId 는 안정 형식', () => assert.equal(itemId('2023', 1), '2023-L01'))

test('결정적이고 실측 불변식을 지킨다', () => {
  const a = buildAudit(loadSources(), 'T')
  const b = buildAudit(loadSources(), 'T')
  assert.deepEqual(a, b)
  assert.equal(a.totals.classified, 248)
  assert.equal(a.totals.transcripts, 272)
  assert.equal(a.totals.classifiedAndTranscript, 119)
  assert.equal(a.totals.withChoices, 0)
  assert.equal(a.totals.withAudio, 0)
  assert.equal(a.perType.filter((t) => t.inClassified18).length, 18)
  assert.equal(new Set(a.items.map((r) => r.id)).size, a.items.length)
  for (const r of a.items) assert.equal(r.audio.rights, 'unverified')
})
