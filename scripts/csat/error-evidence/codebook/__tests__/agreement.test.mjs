// scripts/csat/error-evidence/codebook/__tests__/agreement.test.mjs
//   node --test scripts/csat/error-evidence/codebook/__tests__/agreement.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { agreement } from '../agreement.mjs'

const table = (cells) => cells.flatMap(([a, b, n]) => Array.from({ length: n }, () => [a, b]))

test('교과서 2×2 — po 0.70 · κ 0.40 · AC1 0.406', () => {
  // A 예 25 · B 예 30 / 50: 예-예 20 · 예-아니오 5 · 아니오-예 10 · 아니오-아니오 15
  const r = agreement(table([['y', 'y', 20], ['y', 'n', 5], ['n', 'y', 10], ['n', 'n', 15]]), ['y', 'n'])
  assert.equal(r.n, 50)
  assert.equal(r.po, 0.7)
  assert.ok(Math.abs(r.kappa - 0.4) < 1e-9)
  assert.ok(Math.abs(r.ac1 - (0.7 - 0.495) / 0.505) < 1e-9)
})

test('prevalence 역설 — 한 범주로 쏠리면 관찰 일치가 높아도 κ 는 낮고 AC1 은 높다', () => {
  const r = agreement(table([['y', 'y', 45], ['y', 'n', 2], ['n', 'y', 3], ['n', 'n', 0]]), ['y', 'n'])
  assert.equal(r.po, 0.9)
  assert.ok(r.kappa < 0.1, `κ ${r.kappa}`)
  assert.ok(r.ac1 > 0.85, `AC1 ${r.ac1}`)
})

test('완전 일치 · 빈 입력', () => {
  const r = agreement(table([['a', 'a', 3], ['b', 'b', 2]]), ['a', 'b', 'c'])
  assert.equal(r.po, 1)
  assert.equal(r.kappa, 1)
  assert.equal(r.ac1, 1)
  assert.deepEqual(agreement([], ['a']), { n: 0, po: null, kappa: null, ac1: null })
})
