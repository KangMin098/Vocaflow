// scripts/csat/pdf-columns2.mjs
//
// **2단 조판 복원 2판 — 페이지마다 따로 찾지 않고, 문서 전체의 단 격자를 먼저 정한다.**
//
// 1판(pdf-columns.mjs)은 페이지마다 독립으로 여백을 찾았고, 못 찾으면 1단으로 두었다.
// 그 결과 14회차에서 **병합된 줄이 0~22개** 남았다 — 그 줄들은 두 단이 한 줄에 붙어 있어
// 지문 추출이 통째로 실패한다(2018·2024·2025 의 18·19번이 그랬다).
//
// 수능 문제지의 단 격자는 **문서 안에서 고정**이다. 그래서:
//   ① 확신 있는 페이지들에서만 여백 위치를 모은다
//   ② 그 최빈값을 문서의 절단 열로 정한다
//   ③ 검출 실패한 페이지에도 그 열을 적용한다 — 단, 그 열의 점유가 낮을 때만
//      (도표·듣기 안내처럼 진짜 1단인 페이지는 그대로 둬야 한다)
//
// ⚠️ 홀수형·짝수형이 한 PDF 에 이어 붙은 회차가 있다(2023·2024·2026).
//    지문은 같고 선택지 순서만 다르므로, 정답표가 쓴 형(form_used)에 맞춰 골라야 한다.
//    이 스크립트는 형 경계 표시만 남기고, 고르는 일은 lib-passage.mjs 가 한다.
//
// 실행: pnpm dlx tsx scripts/csat/pdf-columns2.mjs [출력폴더]

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const OUT_DIR = process.argv[2] ?? path.resolve('scripts/csat/data/columns2')

const PDFS = { '2014B': '2014_영어B-홀수형_문제.pdf', '2014A': '2014_영어A-홀수형_문제.pdf' }

function findPdf(exam) {
  if (PDFS[exam]) return PDFS[exam]
  const files = fs.readdirSync(SRC)
  return files.find((f) => f.startsWith(exam) && f.toLowerCase().endsWith('.pdf') && !f.includes('정답표')) ?? null
}

/** 한 페이지의 열 점유 프로필 */
function occupancy(pageLines) {
  const lines = pageLines.filter((l) => l.trim().length)
  if (!lines.length) return null
  const width = Math.max(...lines.map((l) => l.length))
  const occ = new Array(width).fill(0)
  for (const l of lines) for (let i = 0; i < l.length; i += 1) if (l[i] !== ' ') occ[i] += 1
  return { occ, width, n: lines.length }
}

/** 이 페이지에서 확신할 수 있는 여백 구간을 찾는다. 없으면 null */
function findGutter(pageLines, { minRun = 4, window = [0.28, 0.72] } = {}) {
  const p = occupancy(pageLines)
  if (!p || p.n < 10 || p.width < 70) return null
  const { occ, width, n } = p
  // 머리글·꼬리글이 여백을 가로지른다. 2% 로는 못 잡는 페이지가 있어 4% 로 연다.
  const thr = Math.max(1, Math.floor(n * 0.04))
  const lo = Math.floor(width * window[0])
  const hi = Math.floor(width * window[1])
  let best = null, run = null
  for (let i = lo; i <= hi; i += 1) {
    if (occ[i] <= thr) { if (run) run.e = i; else run = { s: i, e: i } }
    else { if (run && (!best || run.e - run.s > best.e - best.s)) best = run; run = null }
  }
  if (run && (!best || run.e - run.s > best.e - best.s)) best = run
  if (!best || best.e - best.s + 1 < minRun) return null
  return Math.floor((best.s + best.e) / 2)
}

/** 주어진 열이 이 페이지에서도 여백인가 (진짜 1단 페이지를 자르지 않기 위해) */
function isGutterAt(pageLines, cut, slack = 2) {
  const p = occupancy(pageLines)
  if (!p) return false
  const { occ, width, n } = p
  if (cut >= width) return true // 이 페이지가 그 열까지 안 감 = 자를 것 없음
  let hits = 0
  for (let i = Math.max(0, cut - slack); i <= Math.min(width - 1, cut + slack); i += 1) hits += occ[i]
  return hits / (n * (slack * 2 + 1)) <= 0.10
}

function cutPage(pageLines, cut) {
  const left = [], right = []
  for (const l of pageLines) {
    left.push(l.slice(0, cut).replace(/\s+$/, ''))
    right.push(l.slice(cut).replace(/\s+$/, ''))
  }
  const trim = (a) => {
    while (a.length && !a[0].trim()) a.shift()
    while (a.length && !a[a.length - 1].trim()) a.pop()
    return a
  }
  return [...trim(left), '', ...trim(right)]
}

export function extract(exam) {
  const pdf = findPdf(exam)
  if (!pdf) return null
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csatcol2-'))
  const src = path.join(tmp, 'in.pdf'), dst = path.join(tmp, 'out.txt')
  let raw
  try {
    fs.copyFileSync(path.join(SRC, pdf), src)
    execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
    raw = fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  const pages = raw.split('\f').map((p) => p.split('\n')).filter((ls) => ls.some((l) => l.trim()))

  // ① 확신 있는 페이지에서만 여백을 모은다
  const found = pages.map((ls) => findGutter(ls)).filter((c) => c != null)
  // ② 최빈값 — 격자는 문서 안에서 고정이다
  const tally = new Map()
  for (const c of found) tally.set(c, (tally.get(c) ?? 0) + 1)
  let grid = null, bestN = 0
  for (const [c, k] of tally) if (k > bestN || (k === bestN && c < grid)) { grid = c; bestN = k }

  const stat = { pages: pages.length, detected: found.length, grid, applied: 0, kept1col: 0 }
  const out = []
  for (const ls of pages) {
    // 격자 우선 — 단 격자는 문서 안에서 고정이므로 페이지별 검출보다 믿을 만하다.
    // 페이지별 검출은 표·도표 때문에 엉뚱한 열을 고르는 일이 있다(2023·2024 에서 관측:
    // 격자 우선으로 바꾸니 병합줄이 12→0 · 22→14 로 줄었다).
    const p = occupancy(ls)
    let cut = null
    if (grid != null && p && isGutterAt(ls, grid)) {
      // 격자가 이 페이지에서도 여백이다 → 격자로 자른다.
      // 격자가 페이지 폭 밖이면 이 페이지는 그 열까지 안 가므로 자를 것이 없다(1단).
      if (grid < p.width) { cut = grid; stat.applied += 1 }
    } else {
      cut = findGutter(ls)   // 격자가 안 맞는 페이지만 따로 찾는다
    }
    if (cut == null) { stat.kept1col += 1; out.push(...ls, ''); continue }
    out.push(...cutPage(ls, cut), '')
  }
  return { text: out.join('\n'), stat }
}

const isMain = process.argv[1] && process.argv[1].endsWith('pdf-columns2.mjs')
if (isMain) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const exams = ['2014B', '2014A', ...Array.from({ length: 12 }, (_, i) => String(2015 + i))]
  const mergedRe = /^.{55,}\s[0-9]{1,2}\.\s/
  console.log('회차    페이지  검출  격자  보정  1단유지   병합줄 (1판 → 2판)')
  console.log('-'.repeat(70))
  let totOld = 0, totNew = 0
  for (const exam of exams) {
    const r = extract(exam)
    if (!r) { console.log(`  ${exam}  PDF 없음`); continue }
    fs.writeFileSync(path.join(OUT_DIR, `${exam}.txt`), r.text)
    const oldP = path.resolve('scripts/csat/data/columns', `${exam}.txt`)
    const oldMerged = fs.existsSync(oldP)
      ? fs.readFileSync(oldP, 'utf8').split('\n').filter((l) => mergedRe.test(l)).length : -1
    const newMerged = r.text.split('\n').filter((l) => mergedRe.test(l)).length
    totOld += Math.max(0, oldMerged); totNew += newMerged
    const s = r.stat
    console.log(
      `  ${exam.padEnd(6)} ${String(s.pages).padStart(4)} ${String(s.detected).padStart(5)} ` +
      `${String(s.grid).padStart(5)} ${String(s.applied).padStart(5)} ${String(s.kept1col).padStart(7)}   ` +
      `${String(oldMerged).padStart(4)} → ${String(newMerged).padStart(4)}${newMerged < oldMerged ? '  ✓' : newMerged > oldMerged ? '  ✗' : ''}`,
    )
  }
  console.log('-'.repeat(70))
  console.log(`  병합줄 합계  ${totOld} → ${totNew}`)
  console.log(`\n→ ${OUT_DIR}`)
}
