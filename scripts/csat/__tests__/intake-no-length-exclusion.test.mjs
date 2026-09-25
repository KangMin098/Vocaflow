// scripts/csat/__tests__/intake-no-length-exclusion.test.mjs
//
// **원문을 버리는 것은 판정뿐이다**(docs/source-check/criteria.md §0).
// 「길이로 원문을 제외하지 않는다」(2026-09-23)는 적격 판정에만 반영되고 수집기에는 남아 있었다 —
// `harvest-plos` 는 800자 미만·창 0개면 적재 자체를 안 했고, `source-doc-import` 는 300어 미만을 건너뛰었다
// (2026-09-24 발견). 버린 원문은 흔적이 없어 아무 검사도 못 잡으므로, 코드 모양으로 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')

test('harvest-plos 는 길이·창 점수로 적재를 건너뛰지 않는다', () => {
  const s = read('scripts/csat/harvest-plos.mjs')
  assert.doesNotMatch(s, /if \(text\.length < \d+\) continue/)
  assert.doesNotMatch(s, /if \(sc\.pass <= 0\) continue/)
})

test('NIST·Frontiers 수확기는 길이·창 점수로 원문을 처분하지 않는다', () => {
  for (const f of ['scripts/csat/harvest-nist.mjs', 'scripts/csat/harvest-frontiers.mjs']) {
    const s = read(f)
    assert.doesNotMatch(s, /MIN_WORDS\) \{\s*\n\s*n\.shortSkip\+\+\s*\n\s*disposed\.add/, f)
    assert.doesNotMatch(s, /if \(sc\.pass <= 0\) \{\s*\n\s*n\.fitFail\+\+\s*\n\s*disposed\.add/, f)
  }
})

test('source-doc-import 는 어수로 적재를 건너뛰지 않는다', () => {
  const s = read('scripts/csat/source-doc-import.mjs')
  assert.doesNotMatch(s, /if \(W\([^)]*\) < \d+\) \{[^}]*continue/)
})

test('plos-extract 는 보관 판정 없는 원본을 자르지 않고, 발췌본에 판정을 스스로 찍지 않는다', () => {
  const s = read('scripts/csat/plos-extract.mjs')
  assert.match(s, /retentionOf\(/)
  assert.doesNotMatch(s, /verdict: 'use',\s*\n\s*genre: 'science'/)
})

test('적재기는 전문 판정만 받는다 — 부분 읽기(basis)는 거부한다', () => {
  const s = read('scripts/csat/gate-mixed-import.mjs')
  assert.match(s, /r\.basis !== undefined && r\.basis !== 'full'/)
})
