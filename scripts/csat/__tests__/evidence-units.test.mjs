// scripts/csat/__tests__/evidence-units.test.mjs
//
// 근거 단위 생성기(lib-evidence-units) 회귀. 학평 원문은 커밋하지 않는다(EBSi 재배포 금지) —
// 2026-09-29 검수 시험에서 문제가 된 **모양**을 합성 지문으로 재현하고, 로컬 코퍼스가 있으면
// 실사례의 단위 수(검수자 3인이 직접 세어 합의한 값)도 확인한다(없으면 skip).
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { buildUnits, checkUnitRefs, checkUnits, precheckAnalysis, unitsHash, unitsOfQuote, UNITS_VERSION } from '../lib-evidence-units.mjs'

const texts = (p, o) => buildUnits(p, o).units.map((u) => u.text)

test('plain prose splits on terminal punctuation followed by a capital', () => {
  assert.deepEqual(texts('Birds fly. They sing! Do they rest? Yes.'), ['Birds fly.', 'They sing!', 'Do they rest?', 'Yes.'])
})

test('abbreviations and decimals do not split; single-letter "initials" do (Gen X. / vitamin C.)', () => {
  assert.deepEqual(texts('Mr. Kim left at 2:00 p.m. on Friday. It cost 3.5 dollars, e.g. a lot.'), ['Mr. Kim left at 2:00 p.m. on Friday.', 'It cost 3.5 dollars, e.g. a lot.'])
  // 도표 선지 ⑤ 가 앞 단위에 삼켜졌던 사례(H2603G3#25 모양)
  assert.deepEqual(texts('The share of Gen X was twice that of Gen X. ⑤ The share of Gen Z rose.'), ['The share of Gen X was twice that of Gen X.', '⑤ The share of Gen Z rose.'])
})

test('v2: a middle initial inside a name does not split; common nouns and sentence starters still do', () => {
  assert.deepEqual(texts('Behaviorists led by John B. Watson believed it. They were wrong.'), ['Behaviorists led by John B. Watson believed it.', 'They were wrong.'])
  assert.deepEqual(texts('Jeffrey A. Rodgers, a vice president, spoke. He left.'), ['Jeffrey A. Rodgers, a vice president, spoke.', 'He left.'])
  assert.deepEqual(texts('the paintings of Robert D. Parker’s studio. Then rain.'), ['the paintings of Robert D. Parker’s studio.', 'Then rain.'])
  // 실제 문장 끝(2026-10-01 코퍼스 오탐 3건 모양)
  assert.deepEqual(texts('at the height of World War I. By 1972, he retired.'), ['at the height of World War I.', 'By 1972, he retired.'])
  assert.deepEqual(texts('We meet in Meeting Room A. After that, lunch.'), ['We meet in Meeting Room A.', 'After that, lunch.'])
  assert.deepEqual(texts('a talent for the English I. Different words are used.'), ['a talent for the English I.', 'Different words are used.'])
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

// ── V9 번호 검사(checkUnitRefs) — 기계가 잡는 것과 못 잡는 것 ────────────
const P6 = 'It is important to note the goal. We found no link. Success was related to fun. The children felt it too. It appears that children tune in to winning. What children share is fun!'
const U6 = buildUnits(P6).units
const run = (a) => { const bad = [], warn = []; checkUnitRefs(a, U6, (id, m) => bad.push(m), (id, m) => warn.push(m), 'x'); return { bad, warn } }

test('V9: in-range but semantically wrong index passes — semantic errors are left to independent review (H1803G3#31 shape)', () => {
  const r = run({ answer_locus: { sentence_index: [1, 5], quote: 'children tune in to winning' }, choices: [{ n: 2, verdict: 'correct', confirmed_at: { sentence_index: [1, 6] } }] })
  assert.deepEqual(r.bad, [])
})

test('V9: nonexistent unit in locus, confirmed_at, or prose [uN] is an error', () => {
  const r = run({ answer_locus: { sentence_index: [9, 11], quote: 'children tune in to winning', reasoning: 'see [u12]' }, choices: [{ n: 1, confirmed_at: { sentence_index: [7] } }] })
  assert.equal(r.bad.filter((m) => /없는 단위/.test(m)).length, 4)
})

test('V9: quote located outside sentence_index is an error; "N번 문장" prose is a warning', () => {
  const r = run({ answer_locus: { sentence_index: [3, 4], quote: 'children tune in to winning', reasoning: '5번 문장이 근거' } })
  assert.equal(r.bad.length, 1)
  assert.match(r.bad[0], /\[u5\]/)
  assert.equal(r.warn.length, 1)
})

// ── 옛 분석(DB 행 · units_hash 없음)도 사전 검사에서 실패해야 한다 ─────────
test('precheck: legacy DB row whose quote unit is missing from sentence_index fails (H2603G3#37 shape)', () => {
  const P = 'Order starts here. (A) One idea. Then another. So on. And more. It does not expand into anything. Next part. Final link here.'
  const U = buildUnits(P).units
  const row = { item_id: 'H0000G3#37', answer_locus: { sentence_index: [3, 4, 5, 7], quote: 'does not expand into anything' }, choice_analysis: [{ n: 2, verdict: 'correct', confirmed_at: { sentence_index: [5, 7] } }] }
  const r = precheckAnalysis(row, U)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /\[u6\]/)
})
test('precheck: legacy row pointing to a nonexistent unit fails; correct row passes; missing list is an error', () => {
  const P = 'A one. B two. C three.'
  const U = buildUnits(P).units
  assert.ok(precheckAnalysis({ answer_locus: { sentence_index: [4], quote: 'C three' } }, U).errors.length >= 2)
  assert.deepEqual(precheckAnalysis({ answer_locus: { sentence_index: [3], quote: 'C three' }, choice_analysis: [{ n: 1, confirmed_at: { sentence_index: [3] } }] }, U).errors, [])
  assert.equal(precheckAnalysis({ answer_locus: { sentence_index: [1], quote: 'A one' } }, null).errors.length, 1)
})
