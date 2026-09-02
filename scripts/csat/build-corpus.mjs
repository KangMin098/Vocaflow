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
/**
 * **단 나누기가 실패해 한 글자도 못 뜬 문항**을 손으로 받아 적은 것(`bodies-manual.json`).
 * `answers-manual.json` 과 같은 취급 — 출처와 검산을 파일 안에 적어 둔다.
 * **자동 추출이 성공한 지문은 덮지 않는다** — 덮게 두면 손으로 적은 것이 파서 개선을 가린다.
 */
// 파일이 없어도 돌아야 한다 — 새 체크아웃이나 다른 세션에서 이 스크립트가 죽으면
// 코퍼스 재생성이 통째로 막힌다(손으로 적은 것은 **보완**이지 전제가 아니다).
const manualBody = new Map(
  (fs.existsSync(path.join(DIR, 'bodies-manual.json')) ? (read('bodies-manual.json').entries ?? []) : []).map(
    (e) => [`${e.exam}#${e.no}`, e],
  ),
)

function bodyOf(exam, no) {
  const man = manualBody.get(`${exam}#${no}`)
  const blocks = itemBlocks(exam, no)
  if (!blocks.length) {
    return man ? { passage: man.passage ?? null, choices: man.choices ?? null } : { passage: null, choices: null }
  }
  // `itemBlocks` 는 후보를 여럿 준다(줄머리 · 줄 가운데 · 세트 머리글). 첫 번째가 늘 옳지는
  // 않다 — 문항 번호가 옆 단 꼬리에 붙어 첫 후보가 빈손인 경우가 있다. **가장 실한 것**을 쓴다.
  // ⚠️ **더 긴 쪽을 고르면 안 된다.** 후보 블록에는 옆 문항의 것이 섞여 들어올 수 있고,
  //    옆 문항 지문이 더 길면 그쪽이 이긴다 — 2026-09-02 에 31번 지문이 32·34번에 복사됐다.
  //    후보는 `itemBlocks` 가 **확실한 것부터** 준다(줄머리 → 줄 가운데 → 장문 세트 머리글).
  //    그러니 **앞 후보가 빈손일 때만** 뒤로 넘어간다. "더 나은" 이 아니라 "없을 때" 다.
  let passage = null
  let choices = null
  for (const b of blocks) {
    if (!passage) passage = passageOf(b) || null
    if (!choices) choices = choicesOf(b)
    if (passage && choices) break
  }
  const set = setBlockFor(exam, no)
  if (set && (!passage || passage.length < 200)) {
    const sp = passageOf(set)
    if (sp && sp.length > (passage?.length ?? 0)) passage = sp
  }
  // 자동 추출이 빈손일 때만 손으로 적은 것을 쓴다
  if (man && !passage) return { passage: man.passage ?? null, choices: choices ?? man.choices ?? null }
  return { passage: passage || null, choices }
}

/** 빈칸이 지문 안에 있어야 하는 유형 — 빈칸 위치가 곧 정답 근거다 */
const BLANK_TYPES = new Set(['R-BLANK', 'R-BLANK2', 'R-SUMMARY', 'X-BLANK', 'X-BLANK2'])

/**
 * **선지가 지문 안에 기호로 박히는 유형.** 여기서는 지문에 ①~⑤ 가 있는 것이 정상이다.
 * 실측(2026-09-02): R-INSERT 52/52 · R-GRAMMAR 30/30 · R-CHART 28/30 · R-IRRELEVANT 26/28.
 */
const SYMBOL_CHOICE_TYPES = new Set([
  'R-INSERT', 'R-ORDER', 'R-IRRELEVANT', 'R-GRAMMAR', 'R-VOCAB', 'R-CHART', 'R-REFER',
  'X-ORDER', 'X-REFER', 'X-VOCAB',
])

/**
 * **지문을 믿어도 되는가.** 넷 중 하나라도 걸리면 드레인이 원문 블록을 함께 싣는다.
 *
 *   ① 한글이 남았다 — 발문 꼬리·각주·옆 단이 섞였다
 *   ② 홀로 선 마침표(` . `) — 옆 단 조각이 문장 사이로 들어왔다
 *      (실측 2023#34: `it is not that . I that the realities…`)
 *   ③ 한 글자짜리 낱말이 a·A·I 가 아니다 — 단 자르기가 낱말 가운데를 지났다
 *      (실측 M2306#31: `computer r artist`)
 *   ④ 빈칸 유형인데 빈칸 표시가 없다 — 빈칸이 빈 줄로 와서 위치가 사라졌다
 *      (실측 M2309#34: `may have to order to` — 빈칸과 `in` 이 함께 증발)
 *
 * ④가 가장 중요하다. 빈칸추론은 **빈칸 위치가 정답 근거**라, 위치를 모르면 분석이
 * 성립하지 않는데도 지문은 멀쩡해 보인다. 사람 눈에 안 띄는 실패라 기계가 잡아야 한다.
 */
function suspectBody(passage, typeId) {
  if (!passage) return false
  if ((passage.match(/[가-힣]/g) ?? []).length >= 4) return true
  if (/\s\.\s/.test(passage)) return true
  if (/(?:^|\s)(?![aAI](?:$|\s))[A-Za-z](?=$|\s)/.test(passage)) return true
  if (BLANK_TYPES.has(typeId) && !passage.includes('______')) return true
  // ⑤ 지문 안에 **다른 문항의 번호**가 박혀 있다 — 단이 안 갈린 페이지에서 두 문항이 한 줄에
  //    붙어 같은 블록을 쓰게 된 것이다(실측: M2306 의 `37.        39.` 한 줄 → 37·39 지문 동일).
  if (/(?:^|\s)\d{1,2}\.\s+[A-Z]/.test(passage)) return true
  // ⑥ **선지 기호가 지문에 있는데 그럴 유형이 아니다.**
  //    삽입·순서·어법·어휘·도표·무관은 ①~⑤ 가 본문에 박히는 것이 설계다. 그 밖의 유형에서
  //    기호가 지문에 있으면 선지 블록이 지문 꼬리에 뭉개진 것이다 — 이때 `choices` 는
  //    비어 있지 않아서 `body_ok` 가 true 로 남는다(실측 2016#31: 선지 5개가 지문 끝에 붙어
  //    있었는데 딱지가 안 붙어 원문 블록이 안 실렸다. 서브에이전트가 손으로 복원해야 했다).
  if (!SYMBOL_CHOICE_TYPES.has(typeId) && /[①②③④⑤]/.test(passage)) return true
  return false
}

/** 순서 배열형 선지 — `(A) － (C) － (B)`. 전각 붙임표(－)와 반각을 다 받는다 */
const ORDER_CHOICE = /^\(([ABC])\)(?:\s*[-‐-―－]\s*\(([ABC])\)){2}/

/**
 * **선지가 이 문항의 것이 아니다.**
 *
 * `suspectBody` 는 지문만 본다. 그런데 단이 안 갈린 페이지에서는 지문이 아니라 **선지**가
 * 옆 문항 것으로 바뀐다 — 실측 M2406#40·M2306#40 은 지문이 `null` 인데 선지 다섯 개가
 * **37번 순서 배열**(`(A) － (C) － (B)` …)이었고, `body_suspect` 는 `false` 였다.
 * 지문이 없으니 지문 신호가 하나도 안 걸린 것이다. 그 상태로 나가면 분석자는
 * "요약 유형인데 선지가 순서 배열" 이라는 **말이 안 되는 문항**을 손에 쥔다.
 *
 * 딱지를 붙이면 export 가 회차 원문 창을 함께 실어 주고 게이트가 인용 검사를 느슨하게 잡는다.
 * 즉 **고치는 것이 아니라 모른다고 말하는 것**이다 — 조용히 틀린 것보다 낫다.
 */
function suspectChoices(choices, typeId) {
  const cs = (choices ?? []).map((c) => String(c))
  if (!cs.length) return false
  // ⑦ 순서 배열 선지인데 순서 유형이 아니다 (옆 문항 선지가 통째로 넘어왔다)
  if (!/ORDER/.test(typeId ?? '') && cs.filter((c) => ORDER_CHOICE.test(c)).length >= 3) return true
  // ⑧ 선지 끝에 발문 조각이 붙어 있다 — 블록 경계가 어긋났다는 뜻
  if (cs.some((c) => /(?:것은\?|고르시오|하시오)$/.test(c.trim()))) return true
  return false
}

/**
 * **장문 세트(41~45)의 번호별 고정 유형** — 발문을 못 뜬 문항의 대체 규칙.
 *
 * 이 저장소는 "번호로 유형을 가르지 않는다" 를 원칙으로 둔다(번호는 해마다 밀린다).
 * 장문 세트만 예외로 두는 근거는 **실측**이다 — 2019학년도 이후 사정권에서
 * 41=X-TITLE 22/22 · 42=X-VOCAB 22/22 · 43=X-ORDER **21/22** · 44=X-REFER **21/22** ·
 * 45=X-FACT 22/22. 어긋난 1건이 바로 이 규칙이 고치려는 그 문항이다(M2406#43·44 —
 * 개별 발문을 못 떠 세트 머리글 `다음 글을 읽고, 물음에 답하시오.` 가 셋 다에 붙었고
 * 셋 다 X-FACT 로 배정됐다. 서브에이전트가 raw_block 의 발문을 읽고 잡아냈다).
 *
 * **발문이 있는 문항은 건드리지 않는다** — 규칙이 실측을 덮으면 그때부터 이 표가 거짓말을 한다.
 */
const LONG_SET_TYPE = { 41: 'X-TITLE', 42: 'X-VOCAB', 43: 'X-ORDER', 44: 'X-REFER', 45: 'X-FACT' }
const GENERIC_SET_STEM = /^다음\s*글을\s*읽고,?\s*물음에\s*답하시오/

const items = []
const rows = [
  ...suneung.questions.map((q) => ({ ...q, ...(classified.get(`${q.exam}#${q.no}`) ?? {}) })),
  ...mock.rows,
]

for (const q of rows) {
  const meta = examMeta(q.exam)
  // 발문을 못 떠 세트 머리글만 붙은 장문 문항은 번호로 유형을 되찾는다(위 LONG_SET_TYPE 참조)
  if (q.no >= 41 && meta.year >= 2019 && GENERIC_SET_STEM.test((q.stem ?? '').trim()) && LONG_SET_TYPE[q.no]) {
    q.type = LONG_SET_TYPE[q.no]
  }
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
    // 지문이 미덥지 않다는 딱지. 파서를 더 깎는 대신 **딱지를 붙여** 드레인이 원문 블록을
    // 함께 싣게 한다 — 분석하는 쪽이 원문을 볼 수 있으면 파서의 마지막 몇 %는 병목이 아니다.
    // 신호 넷은 전부 실측에서 나왔다(2026-09-02, 서브에이전트 6종 보고):
    body_suspect: suspectBody(passage, q.type) || suspectChoices(choices, q.type),
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
