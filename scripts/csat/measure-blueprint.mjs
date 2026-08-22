// scripts/csat/measure-blueprint.mjs
//
// **유형별 출제 제약을 기출에서 실측한다 — 읽기 전용.**
//
// 설계도를 쓰기 전에 제약을 **재야** 한다. 짐작으로 "빈칸은 4문항" 이라 적으면
// 그건 설계도가 아니라 기억이다. 여기서 재는 것:
//   · 출현 위치(문항 번호)와 회차당 문항 수
//   · 배점(2점/3점) 분포
//   · 선택지 개수와 선택지 언어(한글/영어)
//   · 지문 길이(영어 단어 수)
//
// 문항 블록 = 그 문항 번호 줄부터 다음 문항 번호 줄 직전까지. 블록 안의
// `①②③④⑤` 로 선택지를, 영문 토큰으로 지문 길이를 센다.
// ⚠️ 듣기(1~17)는 지문이 **음성**이라 지면에 없다 — 길이를 재면 0 에 가깝다.
//    그래서 듣기는 길이 제약을 두지 않고, 그 사실 자체를 설계도에 적는다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-blueprint.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Documents/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/
const CHOICE_RE = /[①②③④⑤]/g
const HANGUL = /[가-힣]/

function keepSingleForm(lines) {
  const hol = [], jjak = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') hol.push(i)
    if (t === '짝수형') jjak.push(i)
  })
  if (!hol.length || !jjak.length) return lines
  const boundary = lines.findIndex((l, i) => i > hol[hol.length - 1] && i < jjak[0] && HEADER_RE.test(l))
  return boundary < 0 ? lines : lines.slice(0, boundary)
}

/**
 * 세트 지문의 구간을 찾는다 — `[41～42]` · `[43～45]` 같은 머리글 다음부터
 * 그 세트의 **첫 문항 번호 줄 직전까지**가 공유 지문이다.
 *
 * ⚠️ 장문은 지문이 문항 번호보다 **앞**에 온다. 이걸 모르고 "번호 줄부터 다음 번호 줄까지"
 *    로만 자르면 41~42 지문이 **40번 블록에 붙는다** — 첫 실측에서 요약문(40번) 지문 길이가
 *    451단어로 나온 것이 그 증상이었다(실제 요약문 지문은 그보다 훨씬 짧다).
 */
function setPassages(lines, anchors) {
  const out = [] //  { from, to, startLine, endLine }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[\s*(\d{1,2})\s*[~～∼－-]\s*(\d{1,2})\s*\]/)
    if (!m) continue
    const from = Number(m[1])
    const to = Number(m[2])
    if (!(from >= 1 && to <= 45 && from < to)) continue
    const firstAnchor = anchors.find((a) => a.no === from)
    if (!firstAnchor || firstAnchor.line <= i) continue
    out.push({ from, to, startLine: i + 1, endLine: firstAnchor.line })
  }
  return out
}

/** 문항 번호 줄의 위치를 찾는다 — 같은 번호는 처음 것만(지문 속 숫자 오탐 방지). */
function questionAnchors(lines) {
  const seen = new Set()
  const anchors = []
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(\d{1,2})\s*\.\s*/)
    if (!m) return
    const n = Number(m[1])
    if (n < 1 || n > 45 || seen.has(n)) return
    seen.add(n)
    anchors.push({ no: n, line: i })
  })
  return anchors.sort((a, b) => a.line - b.line)
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const typeOf = new Map(classified.rows.map((r) => [`${r.exam}#${r.no}`, r.type]))
const typeName = new Map(classified.types.map((t) => [t.id, t.name]))
const typeSec = new Map(classified.types.map((t) => [t.id, t.sec]))

const files = fs.readdirSync(SRC).filter((f) => /^\d{4}(_[A-Za-z]+)?\.txt$/.test(f)).sort()
const measured = []

for (const f of files) {
  if (f === '2014_B.txt') {
    const a = fs.readFileSync(path.join(SRC, '2014_A.txt'))
    const b = fs.readFileSync(path.join(SRC, f))
    if (a.equals(b)) continue
  }
  const examId = f === '2014_A.txt' ? '2014B' : f === '2014_Aform.txt' ? '2014A' : f.slice(0, 4)
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r/g, '').split('\n'))
  const anchors = questionAnchors(lines)
  const sets = setPassages(lines, anchors)
  const wordsIn = (a, b) => (lines.slice(a, b).join('\n').match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
  /** 세트 공유 지문의 단어 수 — 세트에 속한 모든 문항이 같은 값을 갖는다. */
  const setWords = new Map()
  for (const s of sets) {
    const w = wordsIn(s.startLine, s.endLine)
    for (let n = s.from; n <= s.to; n++) setWords.set(n, w)
  }

  for (let i = 0; i < anchors.length; i++) {
    const { no, line } = anchors[i]
    let end = i + 1 < anchors.length ? anchors[i + 1].line : lines.length
    // 다음 세트 머리글이 이 블록 안에서 시작하면 거기서 끊는다 —
    // 그래야 뒤 세트의 지문이 앞 문항에 붙지 않는다.
    const nextSet = sets.find((s) => s.startLine - 1 > line && s.startLine - 1 < end)
    if (nextSet) end = nextSet.startLine - 1
    const block = lines.slice(line, end).join('\n')
    // 쪽 머리글·형 표시는 지문이 아니다
    const body = block
      .split('\n')
      .filter((l) => !HEADER_RE.test(l) && !/^\s*(홀수형|짝수형)\s*$/.test(l) && !/^\s*\d+\s*$/.test(l))
      .join('\n')

    const choices = (body.match(CHOICE_RE) ?? []).length
    const enWords = (body.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
    // 선택지 언어 — 첫 선택지 뒤 40자에 한글이 있으면 한글 선택지로 본다
    const firstChoice = body.indexOf('①')
    const choiceLang =
      firstChoice < 0 ? null : HANGUL.test(body.slice(firstChoice, firstChoice + 60)) ? 'ko' : 'en'

    measured.push({
      exam: examId,
      no,
      type: typeOf.get(`${examId}#${no}`) ?? null,
      high_score: /\[3점\]/.test(body),
      choices,
      choice_lang: choiceLang,
      en_words: setWords.has(no) ? setWords.get(no) : enWords,
      shared_passage: setWords.has(no),
      lines: end - line,
    })
  }
}

// ── 유형별 제약 프로파일 ────────────────────────────────────────────
const PRIMARY = (r) => r.exam !== '2014A' //  13개년 분모
const RECENT = new Set(['2022', '2023', '2024', '2025', '2026']) //  현행 형식 판단용

const byType = new Map()
for (const r of measured.filter(PRIMARY)) {
  if (!r.type) continue
  if (!byType.has(r.type)) byType.set(r.type, [])
  byType.get(r.type).push(r)
}

const med = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

const profiles = []
for (const [type, rows] of byType) {
  const recent = rows.filter((r) => RECENT.has(r.exam))
  const nos = [...new Set(rows.map((r) => r.no))].sort((a, b) => a - b)
  const recentNos = [...new Set(recent.map((r) => r.no))].sort((a, b) => a - b)
  const perExam = new Map()
  for (const r of rows) perExam.set(r.exam, (perExam.get(r.exam) ?? 0) + 1)
  const counts = [...perExam.values()]
  // 현행 설계도의 "회차당 문항 수" 는 **최근 5회차**로만 센다 —
  // 13년치를 합쳐 최댓값을 쓰면 번호가 이동한 유형이 이중으로 잡혀 합계가 45 를 넘는다(실측 51).
  const recentPerExam = new Map()
  for (const r of recent) recentPerExam.set(r.exam, (recentPerExam.get(r.exam) ?? 0) + 1)
  const recentCounts = [...recentPerExam.values()]
  const words = rows.filter((r) => r.en_words > 0).map((r) => r.en_words)

  profiles.push({
    type,
    name: typeName.get(type) ?? type,
    sec: typeSec.get(type) ?? '?',
    total: rows.length,
    exams: perExam.size,
    active: recent.length > 0, //  최근 5회차에 있는가 = 현행 유형
    nos,
    recent_nos: recentNos,
    per_exam_min: Math.min(...counts),
    per_exam_max: Math.max(...counts),
    recent_per_exam: recentCounts.length ? Math.max(...recentCounts) : 0,
    high_score: rows.filter((r) => r.high_score).length,
    choices_med: med(rows.map((r) => r.choices)),
    choice_lang: [...new Set(rows.map((r) => r.choice_lang).filter(Boolean))],
    words_med: med(words),
    words_min: words.length ? Math.min(...words) : null,
    words_max: words.length ? Math.max(...words) : null,
  })
}
profiles.sort((a, b) => (a.recent_nos[0] ?? a.nos[0] ?? 99) - (b.recent_nos[0] ?? b.nos[0] ?? 99))

console.log('유형          이름              현행 회차 문항/회차 번호(최근)   선택지 언어  영단어(중앙)  3점')
console.log('─'.repeat(104))
for (const p of profiles) {
  const per = p.active ? String(p.recent_per_exam) : `${p.per_exam_min}~${p.per_exam_max}`
  const rn = p.active ? p.recent_nos.join(',') : '(폐지)'
  console.log(
    `${p.type.padEnd(13)} ${p.name.padEnd(15)} ${(p.active ? '✔' : '✘').padEnd(4)} ${String(p.exams).padStart(3)} ` +
      `${per.padEnd(8)} ${rn.slice(0, 12).padEnd(13)} ${String(p.choices_med).padStart(3)} ` +
      `${(p.choice_lang.join('/') || '-').padEnd(6)} ${String(p.words_med ?? '-').padStart(6)}  ${String(p.high_score).padStart(3)}`,
  )
}

const active = profiles.filter((p) => p.active)
console.log('')
console.log(`유형 ${profiles.length} (현행 ${active.length} · 폐지 ${profiles.length - active.length})`)
const sum = active.reduce((s, p) => s + p.recent_per_exam, 0)
console.log(`현행 유형 회차당 문항 합계(최근 5회차 기준): ${sum} — 45 여야 정상`)

fs.writeFileSync(path.join(OUT_DIR, 'blueprint-measured.json'), JSON.stringify({ profiles, measured }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-measured.json')}`)
