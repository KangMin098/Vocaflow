// scripts/csat/__tests__/wikinews-shorts.test.mjs
//
// 단신 모음 쪼개기가 「Sources」 줄에서 자르고, 꼬리 조각을 꼭지로 세지 않고, 꼭지 source_id 가 파생물로 읽히지 않는지.

import test from 'node:test'
import assert from 'node:assert/strict'

import { isDigestTitle, isBriefSourceId, splitDigest, briefTitle, briefSourceId, isResidue, needsManualSplit, splitByGroups, paragraphs } from '../source-get/_wikinews-shorts.mjs'
import { derivativeKind } from '../gate-rules.mjs'

const BODY = `Records at McGill University were made public because of a glitch in a new search system, CBC reports.

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
  assert.equal(briefTitle('Wikinews Shorts: X', briefs[0]), 'Wikinews Shorts: X — Records at McGill University were made public because of a glitch in a new search system, CBC reports.')
  const sid = briefSourceId('wikinews:66616', 0)
  assert.equal(sid, 'wikinews:66616#brief-1')
  assert.equal(derivativeKind({ source_id: sid }), null, '꼭지는 원천이다')
})

test('기사가 아닌 꼬리는 꼭지가 아니다 (첫 적용 때 들어간 5행 · 실측)', () => {
  for (const t of [
    'Google map of the earthquake',
    'External link\n\nTêtes à claques Le cannibale',
    'Sunday 14th December 2008\n\nSunday 14th December 2008',
    'This story has been moved to a full article',
    'External links\n\nCNN Pipeline, accessed on June 28, 2007.',
  ]) assert.equal(isResidue(t), true, t)
  // 가장 짧은 진짜 단신(23낱말)은 꼭지다
  assert.equal(isResidue('Three barges that were loaded with corn broke from a towboat and crashed into the bridge. The bridge was closed for inspection after the crash.'), false)
})

test('꼭지 제목·source_id 는 모음으로 다시 읽히지 않는다 (재실행 예행 실측)', () => {
  assert.equal(isDigestTitle('Wikinews Shorts: April 23, 2008 — An attack on a U.S. base.'), false)
  assert.equal(isDigestTitle('UK Wikinews Shorts: December 22, 2009'), true)
  assert.equal(isDigestTitle('Obituaries: January 21-27, 2008'), true)
  assert.equal(isDigestTitle('Obituaries:March 4, 2008'), true)
  assert.equal(isDigestTitle('Queensland state election shorts: January 30, 2012'), true)
  assert.equal(isDigestTitle('UK Wikinews Shorts: December 22, 2009 — A man was arrested.'), false)
  assert.equal(isDigestTitle('Hunter S. Thompson obituary spawns "murder" theory'), false)
  assert.equal(isDigestTitle("Media round-up: April Fools' Day 2008"), false)
  assert.equal(isBriefSourceId('wikinews:104498#brief-1'), true)
  assert.equal(isBriefSourceId('wikinews:104498'), false)
})

test("따옴표 붙은 'Sources 줄에서도 자른다 (wikinews:130347 실측)", () => {
  const body = "Hakimullah had earlier issued statements denying the reported death of the other leader today.\n\n'Sources\n\nHurricane Felicia has weakened to a tropical storm, but residents of Hawaii are continuing to monitor it."
  assert.equal(splitDigest(body).briefs.length, 2)
})

test('2012년 1월 형식(머리말 · Sources 줄 없음)은 자동으로 쪼개지 않는다', () => {
  const body = 'If you believe any of these stories deserves more in-depth coverage, feel free to write a full article on the issues raised.\n\nMSF have announced a partial withdrawal from Libya over torture of detainees.\n\nThe UN estimates some 8,500 loyalists are held.\n\nMick Jagger has withdrawn from the tea party in Davos, Switzerland this week.'
  assert.equal(needsManualSplit(body), true)
  assert.equal(needsManualSplit(BODY), false, 'Sources 줄이 있으면 자동')
  // 자동으로 돌리더라도 머리말은 꼭지에 남지 않는다
  assert.doesNotMatch(splitDigest(body).briefs[0], /^If you believe/)
})

test('머리말이 없어도 Sources 줄이 없는 모음은 손으로 (2008년 3월 부고 모음 실측)', () => {
  const body = 'The following deaths were reported yesterday.\n\nErnest Gary Gygax, co-creator of Dungeons & Dragons, died at his home yesterday at the age of 69.\n\nElla Nathanael, Greek actress died yesterday from lung cancer at the age of 67.'
  assert.equal(needsManualSplit(body), true)
  assert.equal(splitDigest(body).briefs.length, 1, '자동으로 돌리면 본문 전체가 꼭지 하나 — 그래서 막는다')
})

test('적어 둔 경계로 쪼갠다 — 모든 문단을 정확히 한 번씩 덮어야 한다', () => {
  const body = 'Head line to drop.\n\nFirst story sentence one has enough words to count here.\n\nFirst story continues with its second paragraph right here.\n\nSecond story is a different topic with enough words to count.'
  const ok = splitByGroups(body, [[1, 2], [3]], [0])
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.briefs.length, 2)
  assert.match(ok.briefs[0], /second paragraph/)
  assert.equal(splitByGroups(body, [[1], [3]], [0]).problems.length, 1, '빠진 문단')
  assert.equal(splitByGroups(body, [[1, 2], [2, 3]], [0]).problems.length, 1, '겹친 문단')
  assert.equal(paragraphs(body).length, 4)
})

test('다시 쪼갠 꼭지 source_id(#brief-N.M)도 원천이다', () => {
  assert.equal(derivativeKind({ source_id: 'wikinews:350068#brief-1.3' }), null)
})
