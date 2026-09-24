// scripts/csat/__tests__/lib-plos-sections.test.mjs
//
// 보관 판정 입력은 **서론·고찰만** 담아야 한다. 방법·결과가 섞이면 판정자가 수치 나열을 읽고
// 버리고, 고찰이 빠지면 읽을 단락을 못 보고 버린다(앞 800어 판정이 보관할 논문의 70%를 버렸다).

import test from 'node:test'
import assert from 'node:assert/strict'

import { plosSections } from '../lib-plos-sections.mjs'

const para = (w, n) => Array.from({ length: n }, () => w).join(' ') + '.'

test('줄 제목 — 서론·고찰만 남기고 방법·결과·참고문헌은 뺀다', () => {
  const body = ['Abstract', para('abs', 50), 'Introduction', para('intro', 120), 'Methods', para('meth', 300),
    'Results', para('res', 300), 'Discussion', para('disc', 120), 'References', para('ref', 100)].join('\n')
  const { text, found } = plosSections(body)
  assert.deepEqual(found, ['Introduction', 'Discussion'])
  assert.match(text, /intro/)
  assert.match(text, /disc/)
  for (const gone of ['abs', 'meth', 'res', 'ref']) assert.doesNotMatch(text, new RegExp(`\\b${gone}\\b`))
})

test('한 줄로 접힌 본문 — 문장 끝 뒤의 절 제목에서 되살린다', () => {
  const body = `Introduction ${para('Intro', 120)} Methods ${para('Meth', 200)} Discussion ${para('Disc', 120)} References ${para('Ref', 50)}`
  const { text, found } = plosSections(body)
  assert.deepEqual(found, ['Introduction', 'Discussion'])
  assert.doesNotMatch(text, /\bMeth\b/)
  assert.doesNotMatch(text, /\bRef\b/)
})

test('문장 안의 소문자 discussion 은 절 제목이 아니다', () => {
  const body = `Introduction ${para('Alpha', 250)} This discussion Continues here ${para('b', 100)}`
  assert.deepEqual(plosSections(body).found, ['Introduction'])
})

test('절이 없는 짧은 글(논평)은 통째로 준다 · 조용히 비우지 않는다', () => {
  const body = para('essay', 1500)
  const { text, found, words } = plosSections(body)
  assert.deepEqual(found, [])
  assert.match(text, /전문/)
  assert.ok(words >= 1500)
})

test('절이 없는 긴 글은 앞 700어 + 뒤 1,200어', () => {
  const { text, words } = plosSections(para('long', 6000))
  assert.match(text, /앞부분/)
  assert.ok(words <= 1902 + 10)
})
