// scripts/knowledge/__tests__/claims-lib.test.mjs — node --test scripts/knowledge/__tests__/claims-lib.test.mjs (Windows 는 폴더 경로를 못 받는다)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KIND_ATTRIBUTION, formatSegment, validateClaim } from '../claims-lib.mjs'

const TAX = new Map([
  ['skill:reading', 'skill'],
  ['age:high', 'age'],
  ['exam:csat', 'exam'],
])

const good = {
  videoId: 'Wn3kQRB5qbI',
  claimId: 'Wn3kQRB5qbI#1',
  kind: 'recommendation',
  method: '틀린 문항의 근거 문장을 다시 찾는다',
  procedure: ['오답 표시', '근거 문장 표시', '다음 날 다시 풀기'],
  skill: ['skill:reading'],
  audience: ['age:high'],
  conditions: ['exam:csat'],
  segment: { startSec: 192, endSec: 245, paraphrase: '오답은 근거 문장을 찾아 다시 푼다고 권함' },
  reviewScope: 'full',
  grade: 'A',
  verdict: 'import',
  reviewer: 'codex',
}

test('통과하는 import 주장', () => {
  assert.equal(validateClaim(good, TAX).ok, true)
})

test('수업 진행 관찰은 권고(stated)로 바뀌지 않는다', () => {
  assert.equal(KIND_ATTRIBUTION.observation, 'observed')
  assert.equal(KIND_ATTRIBUTION.recommendation, 'stated')
  assert.equal(KIND_ATTRIBUTION.inference, 'inferred')
})

test('A 는 대조 구간이 있어야 한다', () => {
  const r = validateClaim({ ...good, segment: null }, TAX)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('grade A')))
  assert.equal(validateClaim({ ...good, segment: null, grade: 'B' }, TAX).ok, true)
})

test('구간은 시작 < 종료 초', () => {
  assert.equal(validateClaim({ ...good, segment: { ...good.segment, endSec: 100 } }, TAX).ok, false)
})

test('import 는 실제 절차 단계가 있어야 한다 — 소개·구성 설명만으로는 안 된다', () => {
  assert.equal(validateClaim({ ...good, procedure: [] }, TAX).ok, false)
})

test('영역·대상·조건: 언급 없으면 미명시, 빈 배열·없는 id·차원 틀림은 거부', () => {
  assert.equal(validateClaim({ ...good, skill: '미명시', audience: '미명시', conditions: '미명시' }, TAX).ok, true)
  assert.equal(validateClaim({ ...good, skill: [] }, TAX).ok, false)
  assert.equal(validateClaim({ ...good, skill: ['skill:made-up'] }, TAX).ok, false)
  assert.equal(validateClaim({ ...good, skill: ['age:high'] }, TAX).ok, false)
})

test('보류·제외는 사유 필수, 판정 없는 줄은 거부', () => {
  assert.equal(validateClaim({ ...good, verdict: 'exclude' }, TAX).ok, false)
  assert.equal(validateClaim({ ...good, verdict: 'exclude', reason: '학습 절차 없음' }, TAX).ok, true)
  assert.equal(validateClaim({ ...good, verdict: undefined }, TAX).ok, false)
})

test('구간 재서술 길이 제한(원문 인용 방지)', () => {
  assert.equal(validateClaim({ ...good, segment: { ...good.segment, paraphrase: 'x'.repeat(301) } }, TAX).ok, false)
})

test('초 → m:ss–m:ss', () => {
  assert.equal(formatSegment({ startSec: 192, endSec: 245 }), '3:12–4:05')
})
