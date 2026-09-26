// scripts/csat/__tests__/wikinews-shorts.test.mjs
//
// 단신 모음 쪼개기가 「Sources」 줄에서 자르고, 꼬리 조각을 꼭지로 세지 않고, 꼭지 source_id 가 파생물로 읽히지 않는지.

import test from 'node:test'
import assert from 'node:assert/strict'

import { isDigestTitle, splitDigest, briefTitle, briefSourceId } from '../source-get/_wikinews-shorts.mjs'
import { derivativeKind } from '../gate-rules.mjs'

const BODY = `Records at McGill University were made public because of a glitch, CBC reports.

The university responded quickly and removed the files.

Sources

Premier Danny Williams says the Prime Minister's attitude is a "culture of defeat".

The remarks were in response to a budget comment.

Source

Related news`

test('모음 제목을 알아본다', () => {
  assert.equal(isDigestTitle('Wikinews Shorts: June 13, 2007'), true)
  assert.equal(isDigestTitle('Wikinews Shorts for Canada: April 28, 2007'), true)
  assert.equal(isDigestTitle('Shorts film festival opens'), false)
})

test('Sources/Source 줄에서 꼭지로 자르고 꼬리 조각은 뺀다', () => {
  const { briefs, dropped } = splitDigest(BODY)
  assert.equal(briefs.length, 2)
  assert.match(briefs[0], /^Records at McGill/)
  assert.match(briefs[1], /budget comment\.$/)
  assert.deepEqual(dropped, ['Related news'])
})

test('꼭지 제목과 source_id', () => {
  const { briefs } = splitDigest(BODY)
  assert.equal(briefTitle('Wikinews Shorts: X', briefs[0]), 'Wikinews Shorts: X — Records at McGill University were made public because of a glitch, CBC reports.')
  const sid = briefSourceId('wikinews:66616', 0)
  assert.equal(sid, 'wikinews:66616#brief-1')
  assert.equal(derivativeKind({ source_id: sid }), null, '꼭지는 원천이다')
})
