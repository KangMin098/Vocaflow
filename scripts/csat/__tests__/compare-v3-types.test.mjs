// scripts/csat/__tests__/compare-v3-types.test.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildPairTypeIndex, isInquiryInputFilename, requirePairTypes } from '../lib-compare-types.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const skeletonDir = join(root, 'apps/web/src/lib/csat/skeleton-data')
const docs = readdirSync(skeletonDir).filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => JSON.parse(readFileSync(join(skeletonDir, f), 'utf8')))
const pub = JSON.parse(readFileSync(join(root, 'apps/web/src/lib/csat/compare-v3-data.json'), 'utf8'))

test('작성 입력 파일명은 숫자/하이픈을 포함하고 out/review/비JSON은 제외한다', () => {
  for (const f of ['chunk-inq-01.json', 'chunk-v3-v3-05.json', 'chunk-v3-42.json']) assert.equal(isInquiryInputFilename(f), true, f)
  for (const f of ['chunk-v3-42.out.json', 'review-v3p-01.json', 'chunk-v3-42Xjson', 'chunk-v3-42.json.bak']) assert.equal(isInquiryInputFilename(f), false, f)
})

test('원문 입력 없이도 공개 골격으로 유형을 찾고, 작성 입력과 충돌하면 거부한다', () => {
  const skeleton = [{ items: [{ id: 'A#1', type_id: 'R-GIST' }, { id: 'B#2', type_id: 'R-CLAIM' }] }]
  const pair = { pair_id: 'A#1~B#2', left: { id: 'A#1' }, right: { id: 'B#2' } }
  assert.deepEqual(requirePairTypes(pair, buildPairTypeIndex(skeleton)), { left: 'R-GIST', right: 'R-CLAIM' })
  assert.throws(() => buildPairTypeIndex(skeleton, [{ items: [{ id: 'A#1', type_id: 'R-TITLE' }] }]), /충돌/)
  assert.throws(() => requirePairTypes(pair, new Map([['A#1', 'R-GIST']])), /metadata가 없다/)
  assert.throws(() => buildPairTypeIndex([{ items: [{ id: 'A#1', type_id: null }] }]), /metadata가 없다/)
})

test('실제 공개 정본의 모든 유형이 상대 공개 골격과 일치한다', () => {
  const types = buildPairTypeIndex(docs)
  const entries = Object.entries(pub.pairs)
  assert.equal(entries.length, pub.count)
  assert.ok(entries.length > 0)
  for (const [pid, p] of entries) {
    const expected = requirePairTypes({ pair_id: pid, left: { id: p.left }, right: { id: p.right } }, types)
    assert.deepEqual(p.types, expected, pid)
  }
})
