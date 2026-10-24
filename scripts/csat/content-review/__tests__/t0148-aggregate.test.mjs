// scripts/csat/content-review/__tests__/t0148-aggregate.test.mjs
// 합성 키·합성 CSV 만 쓴다 — 실제 사람 점수 파일을 만들지 않는다.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CSV_COLUMNS, aggregate, readSheet } from '../t0148-aggregate-lib.mjs'

const blinds = Array.from({ length: 26 }, (_, i) => `W${String(i + 1).padStart(2, '0')}`)
const key = blinds.map((b, i) => ({ blind: b, group: i < 14 ? 'bad' : i < 16 ? 'good_unscoped_pass' : 'good_scoped' }))

function csv(fn, stage = 'locked2', scorer = 'S1') {
  const lines = [`# scorer=${scorer};stage=${stage}`, CSV_COLUMNS.join(',')]
  blinds.forEach((b, i) => {
    const r = fn(b, i)
    lines.push([b, r.A, r.B, r.w1 ?? '예', '', '', r.w2, r.memo ?? ''].join(','))
  })
  return lines.join('\r\n') + '\r\n'
}

const passing = (b, i) => (i < 14 ? { A: 8, B: 4, w2: '예' } : { A: 8, B: 8, w2: '아니오' })

test('기준 충족이면 RESUME_ALLOWED — 승격 문구는 자동 승격 아님', () => {
  const r = aggregate([readSheet(csv(passing))], key)
  assert.equal(r.verdict, 'RESUME_ALLOWED')
  assert.equal(r.H.H3.value, 4)
  assert.equal(r.H.H4.value, '14/14')
  assert.match(r.note, /자동 승격 없음/)
})

test('정상 집단 하락이 크면 NOT_MET(H2)', () => {
  const r = aggregate([readSheet(csv((b, i) => (i < 14 ? { A: 8, B: 4, w2: '예' } : { A: 8, B: 6, w2: '아니오' })))], key)
  assert.equal(r.verdict, 'NOT_MET')
  assert.equal(r.H.H2.pass, false)
})

test('빈 칸이 있거나 locked2 가 아니면 INCOMPLETE', () => {
  const blank = csv((b, i) => ({ ...passing(b, i), w2: i === 3 ? '' : passing(b, i).w2 }))
  assert.equal(aggregate([readSheet(blank)], key).verdict, 'INCOMPLETE')
  assert.equal(aggregate([readSheet(csv(passing, 'stage2'))], key).verdict, 'INCOMPLETE')
  assert.equal(aggregate([], key).verdict, 'INCOMPLETE')
})

test('키 집단 수가 14/12 가 아니면 INCOMPLETE', () => {
  const bad = key.map((k, i) => (i === 20 ? { ...k, group: 'bad' } : k))
  const r = aggregate([readSheet(csv(passing))], bad)
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.problems.some((p) => /키 집단 수/.test(p)))
})

test('사람 판정이 키와 어긋나면 H5 미해결 → NOT_MET, 재감수 키로 다시 계산', () => {
  const fn = (b, i) => (i === 20 ? { A: 8, B: 8, w2: '예' } : passing(b, i))
  const r = aggregate([readSheet(csv(fn))], key)
  assert.equal(r.verdict, 'NOT_MET')
  assert.deepEqual(r.mismatches, [{ blind: 'W21', key: 'good', human: 'bad' }])
  const r2 = aggregate([readSheet(csv(fn))], key, { W21: 'good' })
  assert.equal(r2.H.H5.pass, true)
})

test('채점자 2명이면 점수 차 ≤2 비율', () => {
  const s1 = readSheet(csv(passing, 'locked2', 'A'))
  const s2 = readSheet(csv((b, i) => (i === 0 ? { A: 4, B: 4, w2: '예' } : passing(b, i)), 'locked2', 'B'))
  const r = aggregate([s1, s2], key)
  assert.deepEqual(r.agreement, { pair: ['A', 'B'], withinTwo: 25, total: 26, ratio: 0.962 })
})

test('따옴표 안 쉼표·줄바꿈 메모를 읽는다', () => {
  const t = csv(passing).replace('W01,8,4,예,,,예,', 'W01,8,4,예,,,예,"메모, 둘째 줄\r\n""인용"""')
  const s = readSheet(t)
  assert.equal(s.problems.length, 0)
  assert.equal(s.rows[0].memo, '메모, 둘째 줄\n"인용"')
})
