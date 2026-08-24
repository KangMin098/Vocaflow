// scripts/csat/ingest-mock.mjs
//
// **6·9월 모의평가를 코퍼스에 넣는다 — 규칙 도출에 한 번도 쓰이지 않은 순수 홀드아웃.**
//
// 지금까지 이 저장소의 홀드아웃은 **2014A 한 회차**뿐이었고, 그래서
// "유형별 명제는 회차당 문항이 1~4개라 n=14 가 구조적 상한" 이라고 적어 두었다.
// 모의평가를 넣으면 그 상한이 풀린다 — 평가원이 같은 설계로 내는 시험이기 때문이다.
//
//   202606  2026학년도 6월 모의평가  (문제 + 정답표)
//   202609  2026학년도 9월 모의평가  (문제 + 정답표)
//   202706  2027학년도 6월 모의평가  (문제 + 정답표)
//   202509  2025학년도 9월 모의평가  (문제만 — 정답표 없음, 형식 검사에서만 쓴다)
//
// ⚠️ **이 회차들은 어떤 규칙 도출에도 쓰이지 않았다.** 그러므로 여기에 HARD 10 을 걸면
//    사후 서술이 아니라 **예측**이다. 예측이 깨지면 그 규칙은 수능 전용 관행이지
//    평가원 설계의 일반 규칙이 아니라는 뜻이고, 그것도 발견이다.
//
// 실행: pnpm dlx tsx scripts/csat/ingest-mock.mjs

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/모의평가'
const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const DIR = path.resolve('scripts/csat/data')
const COL = path.join(DIR, 'columns2')

const EXAMS = [
  { id: 'M2606', q: '202606_영어영역_문제지.pdf', k: '202606_영어영역_정답표.pdf' },
  { id: 'M2609', q: '202609_영어영역_문제지.pdf', k: '202609_영어영역_정답표.pdf' },
  { id: 'M2706', q: '202706_영어영역_문제지.pdf', k: '202706_영어영역_정답표.pdf' },
  { id: 'M2509', q: '202509_영어영역_문제지.pdf', k: null },
]

function pdfText(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-'))
  const src = path.join(tmp, 'in.pdf'), dst = path.join(tmp, 'out.txt')
  try {
    fs.copyFileSync(path.join(SRC, file), src)
    execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
    return fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

// ── 2단 복원 (pdf-columns2 와 같은 알고리즘) ──────────────────────────
function occupancy(ls) {
  const live = ls.filter((l) => l.trim().length)
  if (!live.length) return null
  const width = Math.max(...live.map((l) => l.length))
  const occ = new Array(width).fill(0)
  for (const l of live) for (let i = 0; i < l.length; i += 1) if (l[i] !== ' ') occ[i] += 1
  return { occ, width, n: live.length }
}
function findGutter(ls, minRun = 4) {
  const p = occupancy(ls)
  if (!p || p.n < 10 || p.width < 70) return null
  const thr = Math.max(1, Math.floor(p.n * 0.04))
  const lo = Math.floor(p.width * 0.28), hi = Math.floor(p.width * 0.72)
  let best = null, run = null
  for (let i = lo; i <= hi; i += 1) {
    if (p.occ[i] <= thr) { if (run) run.e = i; else run = { s: i, e: i } }
    else { if (run && (!best || run.e - run.s > best.e - best.s)) best = run; run = null }
  }
  if (run && (!best || run.e - run.s > best.e - best.s)) best = run
  if (!best || best.e - best.s + 1 < minRun) return null
  return Math.floor((best.s + best.e) / 2)
}
function isGutterAt(ls, cut, slack = 2) {
  const p = occupancy(ls)
  if (!p) return false
  if (cut >= p.width) return true
  let hits = 0
  for (let i = Math.max(0, cut - slack); i <= Math.min(p.width - 1, cut + slack); i += 1) hits += p.occ[i]
  return hits / (p.n * (slack * 2 + 1)) <= 0.10
}
function rescueCut(ls) {
  const cols = []
  for (const l of ls) {
    const m = l.match(/^(.{40,}?)\s{2,}(\d{1,2}\s*[.．]\s)/)
    if (m) cols.push(m[1].length + m[0].slice(m[1].length).search(/\d/))
  }
  if (cols.length < 2) return null
  cols.sort((a, b) => a - b)
  const med = cols[Math.floor(cols.length / 2)]
  if (cols.filter((c) => Math.abs(c - med) <= 3).length / cols.length < 0.5) return null
  return Math.max(1, med - 1)
}
function cutPage(ls, cut) {
  const L = [], R = []
  for (const l of ls) { L.push(l.slice(0, cut).replace(/\s+$/, '')); R.push(l.slice(cut).replace(/\s+$/, '')) }
  const t = (a) => { while (a.length && !a[0].trim()) a.shift(); while (a.length && !a[a.length - 1].trim()) a.pop(); return a }
  return [...t(L), '', ...t(R)]
}
function restoreColumns(raw) {
  const pages = raw.split('\f').map((p) => p.split('\n')).filter((ls) => ls.some((l) => l.trim()))
  const found = pages.map((ls) => findGutter(ls)).filter((c) => c != null)
  const tally = new Map()
  for (const c of found) tally.set(c, (tally.get(c) ?? 0) + 1)
  let grid = null, bn = 0
  for (const [c, k] of tally) if (k > bn || (k === bn && c < grid)) { grid = c; bn = k }
  const out = []
  for (const ls of pages) {
    const p = occupancy(ls)
    let cut = null
    if (grid != null && p && isGutterAt(ls, grid)) { if (grid < p.width) cut = grid }
    else cut = findGutter(ls)
    if (cut == null) { const r = rescueCut(ls); if (r != null) { out.push(...cutPage(ls, r), ''); continue } out.push(...ls, ''); continue }
    out.push(...cutPage(ls, cut), '')
  }
  return out.join('\n')
}

// ── 정답표 ────────────────────────────────────────────────────────────
const CIRC = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
function parseKey(raw) {
  const flat = raw.replace(/\n/g, ' ')
  const out = new Map()
  // `1②  2` · `10 ①  2` · `25 ④, ⑤ 2` (복수정답)
  const re = /(?<!\d)(\d{1,2})\s*([①②③④⑤](?:\s*,\s*[①②③④⑤])*)\s+([23])(?!\d)/g
  let m
  while ((m = re.exec(flat))) {
    const no = +m[1]
    if (no < 1 || no > 45) continue
    const answers = [...m[2].matchAll(/[①②③④⑤]/g)].map((x) => CIRC[x[0]])
    if (!out.has(no)) out.set(no, { no, answer: answers[0], answers, points: +m[3], multi: answers.length > 1 })
  }
  return [...out.values()].sort((a, b) => a.no - b.no)
}

// ── 유형 배정 — 본 코퍼스의 정규식표를 그대로 쓴다 ───────────────────
const TYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types
  .map((t) => ({ ...t, re: new RegExp(t.match.replace(/^\/|\/$/g, '')) }))

const RE_SET = /^\s*\[\s*(\d{1,2})\s*[~～–—-]\s*(\d{1,2})\s*\]\s*(.*)$/

/**
 * 발문을 모은다. 두 가지를 처리해야 한다:
 *  ① **여러 줄로 이어지는 발문** — 빈 줄을 건너뛰고 한글 줄을 계속 붙인다.
 *    (`문맥상 낱말의 쓰임이 적절하지` / 빈 줄 / `않은 것은?`)
 *  ② **세트 머리글** `[31~34] 다음 빈칸에 …` — 31~34 는 자기 발문이 없고
 *    머리글이 발문이다. 이걸 안 물려주면 빈칸·순서·삽입 12문항이 통째로 미배정된다.
 */
function stemsOf(text) {
  const ls = text.split('\n')

  const collect = (from) => {
    let s = ''
    for (let j = from, blanks = 0; j < ls.length && j < from + 6; j += 1) {
      const l = ls[j].trim()
      if (!l) { if (++blanks > 2) break; continue }
      if (/^[①②③④⑤]/.test(l)) break
      if (/^\s*\d{1,2}\s*[.．]/.test(ls[j])) break
      if (RE_SET.test(ls[j])) break
      if (!/[가-힣]/.test(l)) break          // 영어 지문이 시작되면 발문 끝
      s += ' ' + l
    }
    return s
  }

  // ② 세트 머리글을 먼저 모은다
  const setStems = new Map()
  ls.forEach((l, i) => {
    const m = l.match(RE_SET)
    if (!m) return
    const from = +m[1], to = +m[2]
    if (from < 1 || to > 45 || to < from) return
    const stem = (m[3] + collect(i + 1)).trim()
    if (!/[가-힣]/.test(stem)) return
    for (let n = from; n <= to; n += 1) if (!setStems.has(n)) setStems.set(n, stem)
  })

  const out = new Map()
  for (let i = 0; i < ls.length; i += 1) {
    const m = ls[i].match(/^\s*(\d{1,2})\s*[.．]\s*(.*)$/)
    if (!m) continue
    const no = +m[1]
    if (no < 1 || no > 45 || out.has(no)) continue
    let stem = (m[2] + collect(i + 1)).trim()
    // 자기 발문에 한글이 없으면(= 지문이 바로 시작) 세트 머리글이 발문이다
    if (!/[가-힣]/.test(stem) && setStems.has(no)) stem = setStems.get(no)
    out.set(no, { no, stem, high_score: /\[\s*3\s*점\s*\]/.test(stem) })
  }
  // 문항 번호 줄이 아예 없는 세트 문항도 살린다
  for (const [no, stem] of setStems) if (!out.has(no)) out.set(no, { no, stem, high_score: false })

  return [...out.values()].sort((a, b) => a.no - b.no)
}

function classify(stem) {
  const norm = stem.replace(/\s+/g, '')
  const hits = TYPES.filter((t) => t.re.test(norm))
  return hits
}

// ── 실행 ──────────────────────────────────────────────────────────────
const questions = [], answers = [], report = []
for (const e of EXAMS) {
  const raw = pdfText(e.q)
  const cols = restoreColumns(raw)
  fs.writeFileSync(path.join(COL, `${e.id}.txt`), cols)

  const stems = stemsOf(cols)
  let assigned = 0, multi = 0, none = 0
  for (const q of stems) {
    const hits = classify(q.stem)
    if (hits.length === 1) assigned += 1
    else if (hits.length > 1) multi += 1
    else none += 1
    questions.push({
      exam: e.id, no: q.no, stem: q.stem, high_score: q.high_score,
      section: q.no <= 17 ? '듣기' : q.no <= 40 ? '독해' : '장문',
      type: hits.length ? hits[0].id : null, hit_count: hits.length,
    })
  }

  let keyRows = []
  if (e.k) {
    keyRows = parseKey(pdfText(e.k))
    for (const r of keyRows) answers.push({ exam: e.id, ...r })
  }
  report.push({ exam: e.id, file: e.q, stems: stems.length, assigned, multi, none, keys: keyRows.length })
  console.log(`  ${e.id}  발문 ${String(stems.length).padStart(2)}  배정 ${String(assigned).padStart(2)}  중복 ${multi}  미배정 ${none}  정답 ${keyRows.length}`)
}

fs.writeFileSync(path.join(DIR, 'mock-questions.json'), JSON.stringify({ report, rows: questions }, null, 1))
fs.writeFileSync(path.join(DIR, 'mock-answers.json'), JSON.stringify({ answers }, null, 1))
console.log()
console.log(`  문항 ${questions.length} · 정답 ${answers.length}`)
console.log(`→ mock-questions.json · mock-answers.json · columns2/M*.txt`)
