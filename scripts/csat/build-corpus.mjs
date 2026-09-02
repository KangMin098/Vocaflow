// scripts/csat/build-corpus.mjs
//
// **수능 기출 + 평가원 모의평가를 하나의 문항 원장으로 합친다.**
//
// 지금까지 이 저장소의 기출 자료는 갈래가 넷이었다 — `questions.json`(수능 발문) ·
// `answers.json`(수능 정답) · `mock-questions.json`(모평 발문) · `mock-answers.json`(모평 정답).
// 지문·선지는 어디에도 모여 있지 않고 검사 스크립트마다 `lib-passage.mjs` 로 그때그때 떠 왔다.
// 유형별 분석을 사람이(=Claude Code 배치가) 문항 단위로 하려면 **한 문항이 한 레코드**여야 한다.
//
// ⚠️ **여기서 "전체" 라는 말을 쓰려면 분모를 적어야 한다.** 이 스크립트는 빠진 것을 채우지 않고
//    빠진 자리를 세어 `corpus-report.json` 에 남긴다 — 문제지가 없는 회차, 정답표가 없는 회차,
//    지문·선지를 못 뜬 문항. 채운 척하면 뒤의 "99점 커버" 주장이 통째로 거짓이 된다.
//
// 실행: node scripts/csat/build-corpus.mjs
// 산출: data/corpus.json · data/corpus-report.json

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, setBlockFor, passageOf, choicesOf } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const TYPES = new Map(read('classified.json').types.map((t) => [t.id, t]))

const suneung = read('questions.json')
const suneungKeys = read('answers.json')
const mock = read('mock-questions.json')
const mockKeys = read('mock-answers.json')

// 수능 발문에는 유형이 안 붙어 있다 — 분류 산출물에서 물려받는다
const classified = new Map(
  read('classified.json').rows.map((r) => [`${r.exam}#${r.no}`, { type: r.type, hit_count: r.hit_count }]),
)

const keyOf = new Map()
for (const a of suneungKeys.answers) keyOf.set(`${a.exam}#${a.no}`, a)
for (const a of mockKeys.answers) keyOf.set(`${a.exam}#${a.no}`, a)

/** 회차 성격 — 수능인가 모평인가, 몇 학년도 몇 월인가 */
function examMeta(exam) {
  if (exam.startsWith('M')) {
    const yy = exam.slice(1, 3)
    const mm = exam.slice(3, 5)
    return { kind: 'mock', year: 2000 + Number(yy), month: Number(mm), label: `20${yy}학년도 ${Number(mm)}월 모의평가` }
  }
  const year = Number(exam.slice(0, 4))
  const form = exam.length > 4 ? exam.slice(4) : null
  return { kind: 'suneung', year, month: 11, form, label: `${year}학년도 수능${form ? ` ${form}형` : ''}` }
}

/**
 * 문항의 영어 지문과 선지.
 *
 * 장문 세트(41~45)는 지문이 문항 번호 밑이 아니라 `[41~42]` 머리글 밑에 한 번만 있어서
 * 세트 블록을 따로 봐야 한다. 그걸 안 하면 장문 10문항의 지문이 전부 빈다.
 */
function bodyOf(exam, no) {
  const blocks = itemBlocks(exam, no)
  if (!blocks.length) return { passage: null, choices: null }
  const block = blocks[0]
  let passage = passageOf(block)
  const set = setBlockFor(exam, no)
  if (set && (!passage || passage.length < 200)) {
    const sp = passageOf(set)
    if (sp && sp.length > (passage?.length ?? 0)) passage = sp
  }
  return { passage: passage || null, choices: choicesOf(block) }
}

const items = []
const rows = [
  ...suneung.questions.map((q) => ({ ...q, ...(classified.get(`${q.exam}#${q.no}`) ?? {}) })),
  ...mock.rows,
]

for (const q of rows) {
  const meta = examMeta(q.exam)
  const key = keyOf.get(`${q.exam}#${q.no}`) ?? null
  const { passage, choices } = bodyOf(q.exam, q.no)
  items.push({
    id: `${q.exam}#${String(q.no).padStart(2, '0')}`,
    exam: q.exam,
    exam_label: meta.label,
    exam_kind: meta.kind,
    year: meta.year,
    month: meta.month,
    no: q.no,
    // 영역은 **원본을 믿지 않고 번호에서 다시 계산한다.** 수능 추출과 모평 추출이
    // 서로 다른 규칙을 썼다 — 2014 회차는 41~45 를 '독해' 로, 모평은 '장문' 으로 적어 놓았다.
    // 규칙이 둘이면 유형별 집계가 회차마다 다른 분모를 쓰게 된다.
    section: q.no <= 17 ? '듣기' : q.no <= 40 ? '독해' : '장문',
    type_id: q.type ?? null,
    type_name: q.type ? (TYPES.get(q.type)?.name ?? null) : null,
    stem: q.stem,
    passage,
    choices,
    answer: key?.answer ?? null,
    answers: key?.answers ?? null,
    points: key?.points ?? null,
    high_score: q.high_score === true || key?.points === 3,
    rescued: q.rescued === true,
  })
}

items.sort((a, b) => (a.exam < b.exam ? -1 : a.exam > b.exam ? 1 : a.no - b.no))

// ── 커버리지 — 분모를 명시한다 ───────────────────────────────────────
const byExam = new Map()
for (const it of items) {
  const e = byExam.get(it.exam) ?? { exam: it.exam, label: it.exam_label, kind: it.exam_kind, n: 0, typed: 0, keyed: 0, passaged: 0, choiced: 0, points: 0 }
  e.n += 1
  if (it.type_id) e.typed += 1
  if (it.answer) { e.keyed += 1; e.points += it.points ?? 0 }
  if (it.passage) e.passaged += 1
  if (it.choices) e.choiced += 1
  byExam.set(it.exam, e)
}

const exams = [...byExam.values()].sort((a, b) => (a.exam < b.exam ? -1 : 1))
const sum = (f) => items.reduce((a, it) => a + (f(it) ? 1 : 0), 0)
const report = {
  built_at: new Date().toISOString().slice(0, 10),
  exams: exams.length,
  items: items.length,
  expected: exams.length * 45,
  typed: sum((it) => it.type_id),
  keyed: sum((it) => it.answer),
  passaged: sum((it) => it.passage),
  choiced: sum((it) => it.choices),
  // 듣기는 지문이 문제지에 없다(대본은 따로) — 지문 분모에서 뺀다
  reading: sum((it) => it.section !== '듣기'),
  reading_passaged: sum((it) => it.section !== '듣기' && it.passage),
  by_exam: exams,
}

fs.writeFileSync(path.join(DIR, 'corpus.json'), JSON.stringify({ report, items }, null, 1))
fs.writeFileSync(path.join(DIR, 'corpus-report.json'), JSON.stringify(report, null, 1))

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0')
console.log(`  회차 ${report.exams} · 문항 ${report.items} (기대 ${report.expected})`)
console.log(`  유형 배정 ${report.typed} (${pct(report.typed, report.items)}%)`)
console.log(`  정답·배점 ${report.keyed} (${pct(report.keyed, report.items)}%)`)
console.log(`  독해 지문  ${report.reading_passaged}/${report.reading} (${pct(report.reading_passaged, report.reading)}%)`)
console.log(`  선지 5개   ${report.choiced} (${pct(report.choiced, report.items)}%)`)
console.log('→ corpus.json · corpus-report.json')
