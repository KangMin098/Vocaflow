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

/**
 * **듣기 마지막 번호.** 2015학년도부터 17번이지만 **2014학년도는 22번까지가 듣기다**
 * (A/B 수준별 시행 회차). 이걸 17로 고정하면 2014 두 회차의 18~22번 듣기 10문항이
 * '독해' 로 들어와 분석 사정권을 오염시킨다 — 실측으로 걸렸다(지문 길이 5~24자).
 */
function listeningEnd(exam) {
  return exam.startsWith('2014') ? 22 : 17
}

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
    section: q.no <= listeningEnd(q.exam) ? '듣기' : q.no <= 40 ? '독해' : '장문',
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
    // 지문에 한글이 남아 있으면 발문·각주·옆 단이 섞여 들어온 것이다. 5% 안팎 남는다 —
    // 파서를 더 깎는 대신 **딱지를 붙여** 드레인이 원문 블록을 함께 싣게 한다.
    // 분석하는 쪽이 원문을 볼 수 있으면 파서의 마지막 5%는 병목이 아니다.
    body_suspect: Boolean(passage && (passage.match(/[가-힣]/g) ?? []).length >= 4),
    // **분석 파이프라인의 사정권.** 듣기는 제외한다 — 사용자 지시(2026-09-02).
    // 원장에서 빼지 않고 딱지만 붙이는 이유: 회차 배점 합이 100 인지 보는 검사가
    // 듣기를 포함해야 성립하고, 듣기 대본 9회차가 새로 들어와 있어 나중에 되살릴 수 있다.
    in_scope: q.no > listeningEnd(q.exam),
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

// ── 사정권(듣기 제외) 회차별 집계 ─────────────────────────────────────
// 총점 100 = 듣기 37 + 독해·장문 63(2015학년도 이후 고정, 2014 는 64~65).
// 배점 단위가 2·3점이므로 **99점 이상 = 실점 0** 이다. 곧 이 파이프라인의 커버 목표는
// "독해 28문항 중 몇 %" 가 아니라 **회차마다 28/28** 이다. 반올림이 숨을 자리가 없다.
const scopeByExam = new Map()
for (const it of items) {
  if (!it.in_scope) continue
  const e = scopeByExam.get(it.exam) ?? { exam: it.exam, label: it.exam_label, kind: it.exam_kind, n: 0, typed: 0, keyed: 0, passaged: 0, choiced: 0, points: 0 }
  e.n += 1
  if (it.type_id) e.typed += 1
  if (it.answer) { e.keyed += 1; e.points += it.points ?? 0 }
  if (it.passage) e.passaged += 1
  if (it.choices) e.choiced += 1
  scopeByExam.set(it.exam, e)
}
const scopeExams = [...scopeByExam.values()].sort((a, b) => (a.exam < b.exam ? -1 : 1))

const report = {
  built_at: new Date().toISOString().slice(0, 10),
  scope: '독해·장문 — 듣기 제외 (듣기 마지막 번호: 2014학년도 22 · 그 외 17)',
  exams: exams.length,
  items: items.length,
  expected: exams.length * 45,
  typed: sum((it) => it.type_id),
  keyed: sum((it) => it.answer),
  passaged: sum((it) => it.passage),
  choiced: sum((it) => it.choices),
  in_scope: {
    items: sum((it) => it.in_scope),
    // 회차마다 독해 문항 수가 다르다 — 2014학년도는 듣기가 22번까지라 독해가 23문항이다.
    // 여기에 28 을 곱하면 2014 두 회차 때문에 영원히 98.8% 에서 멈춘다(그리고 원인을 못 찾는다).
    expected: exams.reduce((a, e) => a + (e.exam.startsWith('2014') ? 23 : 28), 0),
    typed: sum((it) => it.in_scope && it.type_id),
    keyed: sum((it) => it.in_scope && it.answer),
    passaged: sum((it) => it.in_scope && it.passage),
    choiced: sum((it) => it.in_scope && it.choices),
    body_suspect: sum((it) => it.in_scope && it.body_suspect),
    // 정답표가 온전한 회차만 배점 합이 의미 있다
    exams_fully_keyed: scopeExams.filter((e) => e.keyed === e.n).length,
    // 유형 정규식은 듣기 유형에 `L-` 을 붙인다. 사정권 안에 `L-` 이 남아 있으면
    // 듣기 경계를 잘못 그은 것이다 — 번호 규칙과 유형표가 서로를 감시한다.
    listening_type_in_scope: items.filter((it) => it.in_scope && it.type_id?.startsWith('L-')).map((it) => it.id),
    reading_type_out_of_scope: items.filter((it) => !it.in_scope && it.type_id && !it.type_id.startsWith('L-')).map((it) => it.id),
    by_exam: scopeExams,
  },
  by_exam: exams,
}

fs.writeFileSync(path.join(DIR, 'corpus.json'), JSON.stringify({ report, items }, null, 1))
fs.writeFileSync(path.join(DIR, 'corpus-report.json'), JSON.stringify(report, null, 1))

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0')
const s = report.in_scope
console.log(`  회차 ${report.exams} · 전체 문항 ${report.items} (기대 ${report.expected})`)
console.log(`  ── 사정권: ${report.scope} ──`)
console.log(`  문항       ${s.items} (기대 ${s.expected}, ${pct(s.items, s.expected)}%)`)
console.log(`  유형 배정  ${s.typed} (${pct(s.typed, s.items)}%)`)
console.log(`  정답·배점  ${s.keyed} (${pct(s.keyed, s.items)}%) · 정답표 온전 회차 ${s.exams_fully_keyed}/${report.exams}`)
console.log(`  지문       ${s.passaged} (${pct(s.passaged, s.items)}%)`)
console.log(`  선지 5개   ${s.choiced} (${pct(s.choiced, s.items)}%)`)
console.log('→ corpus.json · corpus-report.json')
