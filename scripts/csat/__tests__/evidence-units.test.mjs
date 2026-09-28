// scripts/csat/__tests__/evidence-units.test.mjs
//
// 근거 단위 생성기(lib-evidence-units) 회귀. 학평 원문은 커밋하지 않는다(EBSi 재배포 금지) —
// 2026-09-29 검수 시험에서 문제가 된 **모양**을 합성 지문으로 재현하고, 로컬 코퍼스가 있으면
// 실사례의 단위 수(검수자 3인이 직접 세어 합의한 값)도 확인한다(없으면 skip).
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { buildUnits, checkUnits, unitsHash, unitsOfQuote, UNITS_VERSION } from '../lib-evidence-units.mjs'

const texts = (p, o) => buildUnits(p, o).units.map((u) => u.text)

test('plain prose splits on terminal punctuation followed by a capital', () => {
  assert.deepEqual(texts('Birds fly. They sing! Do they rest? Yes.'), ['Birds fly.', 'They sing!', 'Do they rest?', 'Yes.'])
})

test('abbreviations and decimals do not split; single-letter "initials" do (Gen X. / vitamin C.)', () => {
  assert.deepEqual(texts('Mr. Kim left at 2:00 p.m. on Friday. It cost 3.5 dollars, e.g. a lot.'), ['Mr. Kim left at 2:00 p.m. on Friday.', 'It cost 3.5 dollars, e.g. a lot.'])
  // 도표 선지 ⑤ 가 앞 단위에 삼켜졌던 사례(H2603G3#25 모양)
  assert.deepEqual(texts('The share of Gen X was twice that of Gen X. ⑤ The share of Gen Z rose.'), ['The share of Gen X was twice that of Gen X.', '⑤ The share of Gen Z rose.'])
})

test('circled numbers start a unit after terminal punctuation (position / chart types)', () => {
  const u = texts('The graph shows usage. ① Teens used it most. ② Adults used it least.', { typeId: 'R-CHART' })
  assert.deepEqual(u, ['The graph shows usage.', '① Teens used it most.', '② Adults used it least.'])
})

test('sentences inside curly quotes stay one unit; a unit may end right after the closing quote', () => {
  // H2304G3#32 모양(따옴표 안 두 문장) — 검수자가 7·8문장으로 갈렸던 경계를 규칙으로 고정
  assert.deepEqual(texts('He wrote, “Art is play. Play is art.” Critics agreed.'), ['He wrote, “Art is play. Play is art.”', 'Critics agreed.'])
  // H1904G3#33 모양(첫 문장 끝의 인용 의문문)
  assert.deepEqual(texts('It recalls the question, “Which came first, the chicken or the egg?” For bees, both sides arrived.'),
    ['It recalls the question, “Which came first, the chicken or the egg?”', 'For bees, both sides arrived.'])
})

test('unbalanced quotes disable the quote rule instead of swallowing the passage', () => {
  assert.equal(texts('He said “Stop. Go home. Then rest.').length, 3)
})

test('notice bullets and dash items become line units only in R-NOTICE', () => {
  // H2603G3#28 모양(줄바꿈 없는 안내문)
  const p = 'Contest Registration ∙ Teams of up to four. ∙ Sign up by March 31. Schedule - 2:00 p.m. Opening - 5:00 p.m. Awards'
  const u = buildUnits(p, { typeId: 'R-NOTICE' }).units
  assert.deepEqual(u.map((x) => x.text), ['Contest Registration', '∙ Teams of up to four.', '∙ Sign up by March 31.', 'Schedule', '- 2:00 p.m. Opening', '- 5:00 p.m. Awards'])
  assert.deepEqual(u.map((x) => x.kind), ['sentence', 'line', 'line', 'sentence', 'line', 'line'])
  // 산문의 대시는 목록이 아니다
  assert.equal(texts('Two things - speed and care - matter here. They do.', { typeId: 'R-BLANK' }).length, 2)
})

test('blanks never create a boundary', () => {
  assert.deepEqual(texts('In other words, the bowers ______ ; they are admired. So it goes.'), ['In other words, the bowers ______ ; they are admired.', 'So it goes.'])
})

test('self-check throws on missing text, overlap, order, or renumbering', () => {
  const p = 'One two. Three four.'
  const { units } = buildUnits(p)
  assert.doesNotThrow(() => checkUnits(p, units))
  assert.throws(() => checkUnits(p, [units[1]]), /번호|빠진/)
  assert.throws(() => checkUnits(p, [{ ...units[0], end: 12 }, units[1]].map((u, i) => ({ ...u, n: i + 1, id: `u${i + 1}` }))), /글자|겹치/)
  assert.throws(() => checkUnits(p, [units[1], units[0]].map((u, i) => ({ ...u, n: i + 1, id: `u${i + 1}` }))), /겹치|역순|빠진/)
  assert.throws(() => checkUnits(p, [units[0]]), /마지막/)
})

test('hash changes with version-bound boundaries, not with identical rebuilds', () => {
  const p = 'A b. C d. E f.'
  assert.equal(unitsHash(buildUnits(p)), unitsHash(buildUnits(p)))
  assert.notEqual(unitsHash(buildUnits(p)), unitsHash(buildUnits('A b. C d E f.')))
  assert.equal(buildUnits(p).version, UNITS_VERSION)
})

test('quote location maps to unit numbers across unit boundaries', () => {
  const p = 'First one. The key “claim” is here. And it continues. Last.'
  const { units } = buildUnits(p)
  assert.deepEqual(unitsOfQuote(p, units, 'The key "claim" is here'), [2])
  assert.deepEqual(unitsOfQuote(p, units, 'is here. And it'), [2, 3])
  assert.deepEqual(unitsOfQuote(p, units, 'not in passage'), [])
})

// ── 실사례(로컬 코퍼스가 있을 때만) — 검수자 3인이 직접 세어 합의한 단위 수 ─────
const CORPUS = path.resolve('scripts/csat/data/corpus-hakpyeong.json')
test('local corpus: all passages pass self-check and reviewer-agreed counts hold', { skip: !fs.existsSync(CORPUS) }, () => {
  const c = JSON.parse(fs.readFileSync(CORPUS, 'utf8'))
  for (const it of c.items) if (it.passage?.trim()) buildUnits(it.passage, { typeId: it.type_id })
  const expect = { 'H2304G3#32': 10, 'H1904G3#33': 8, 'H2010G3#34': 7, 'H1803G3#31': 6, 'H2603G3#25': 6 }
  for (const [id, n] of Object.entries(expect)) {
    const it = c.items.find((x) => x.id === id)
    assert.equal(buildUnits(it.passage, { typeId: it.type_id }).units.length, n, id)
  }
})
