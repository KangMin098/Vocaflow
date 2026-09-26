// scripts/csat/__tests__/near-dup.test.mjs
//
// 근사 중복 판별이 **재게재본은 잡고 같은 주제의 다른 글은 놓아 주는지**, 서명이 실행마다 같은지를 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { words, shingles, signature, estimate, nearPairs, clusters, PERMS } from '../near-dup.mjs'

const BASE = `Researchers at the university found that bees can learn to count up to four when they are rewarded
with sugar water. The team trained the insects over several weeks and tested them with new patterns that they had
never seen before. The results suggest that small brains can solve problems once thought to need large ones, and
the scientists now plan to study whether other insects share the same ability in the wild and in the laboratory.`

const REPOST = `This article was originally published by the university news office. ${BASE}
Republished under a Creative Commons license.`

const OTHER = `Bees are important pollinators for many crops, and farmers depend on them every season. A new report
warns that bee populations have fallen sharply because of pesticides and habitat loss, and it recommends planting
wildflowers along field edges so that colonies can find food between harvests and recover over the coming years.`

const sig = (t) => signature(shingles(words(t)))

test('낱말 분리 — 소문자 · 축약형 · 숫자 보존', () => {
  assert.deepEqual(words("It's 2026, OK?"), ["it's", '2026', 'ok'])
})

test('서명은 결정적이다 — 같은 글은 같은 서명', () => {
  assert.deepEqual([...sig(BASE)], [...sig(BASE)])
  assert.equal(sig(BASE).length, PERMS)
})

test('짧아서 shingle 이 없으면 서명이 없다', () => {
  assert.equal(sig('only four words here'), null)
})

test('재게재본(머리말·꼬리말 추가)은 높은 자카드', () => {
  assert.ok(estimate(sig(BASE), sig(REPOST)) >= 0.6, `${estimate(sig(BASE), sig(REPOST))}`)
})

test('같은 주제의 다른 글은 낮은 자카드', () => {
  assert.ok(estimate(sig(BASE), sig(OTHER)) < 0.1)
})

test('nearPairs · clusters — 재게재본만 한 묶음', () => {
  const docs = [BASE, OTHER, REPOST].map((t, i) => ({ id: String(i), sig: sig(t) }))
  const { pairs } = nearPairs(docs, { min: 0.5 })
  assert.deepEqual(pairs.map((p) => [p.a, p.b]), [[0, 2]])
  assert.deepEqual(clusters(docs.length, pairs), [[0, 2]])
})
