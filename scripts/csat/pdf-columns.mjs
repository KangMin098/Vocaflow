// scripts/csat/pdf-columns.mjs
//
// **2단 조판을 단(column) 단위로 되살리는 추출기.**
//
// 왜 필요한가 — 기존 .txt 는 읽기 순서 추출이라 빈칸 자리, (A)(B)(C) 토막 경계,
// 선택지 순열이 흩어진다. H2(빈칸 위치)·H5(순서 토막 단서)가 추출률 44~45% 로 판정 보류였다.
//
// 방법 — `pdftotext -layout` 은 두 단을 **같은 줄에 나란히** 놓지만 가운데 여백을 보존한다.
//   ...to co-operate. However,        (A) Indeed, it is almost impossible to think
//   여백의 문자 열 위치를 페이지마다 찾아 자르면 단이 온전히 복원된다.
//
// ⚠️ 머리글·꼬리글은 여백을 가로지른다. 그래서 "점유 0" 이 아니라 "점유 ≤ 2%" 로 찾는다.
// ⚠️ 1단 페이지(듣기 등)는 여백이 없으므로 그대로 둔다.
// ⚠️ Xpdf 판 pdftotext 는 한글 경로를 못 연다 — 임시 ASCII 경로로 복사해서 쓴다.
//
// 실행: pnpm dlx tsx scripts/csat/pdf-columns.mjs [출력폴더]

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const OUT_DIR = process.argv[2] ?? path.resolve('scripts/csat/data/columns')

// 회차 → 문제지 PDF. 정답표 PDF 와 구분해야 한다.
const PDFS = {
  '2014B': '2014_영어B-홀수형_문제.pdf',
  '2014A': '2014_영어A-홀수형_문제.pdf',
}

function findPdf(exam) {
  if (PDFS[exam]) return PDFS[exam]
  const files = fs.readdirSync(SRC)
  const cand = files.filter(
    (f) => f.startsWith(exam) && f.toLowerCase().endsWith('.pdf') && !f.includes('정답표'),
  )
  return cand[0] ?? null
}

/** 한 페이지를 단으로 나눈다. 여백을 못 찾으면 1단으로 보고 그대로 돌려준다. */
export function splitPage(pageLines) {
  const lines = pageLines.filter((l) => l.trim().length)
  if (lines.length < 8) return pageLines
  const width = Math.max(...lines.map((l) => l.length))
  if (width < 70) return pageLines

  const occ = new Array(width).fill(0)
  for (const l of lines) for (let i = 0; i < l.length; i += 1) if (l[i] !== ' ') occ[i] += 1

  // 머리글·꼬리글이 여백을 가로지르므로 0 이 아니라 2% 이하를 '비었다' 로 본다
  const empty = Math.max(1, Math.floor(lines.length * 0.02))
  const lo = Math.floor(width * 0.33), hi = Math.floor(width * 0.67)
  let best = null, run = null
  for (let i = lo; i <= hi; i += 1) {
    if (occ[i] <= empty) { if (run) run.e = i; else run = { s: i, e: i } }
    else { if (run && (!best || run.e - run.s > best.e - best.s)) best = run; run = null }
  }
  if (run && (!best || run.e - run.s > best.e - best.s)) best = run
  if (!best || best.e - best.s < 3) return pageLines // 1단

  const cut = Math.floor((best.s + best.e) / 2)
  const left = [], right = []
  for (const l of pageLines) {
    left.push(l.slice(0, cut).replace(/\s+$/, ''))
    right.push(l.slice(cut).replace(/\s+$/, ''))
  }
  // 빈 줄이 연달아 늘어나는 것만 정리 — 빈칸 자리를 지우면 안 되므로 줄 안의 공백은 건드리지 않는다
  const trim = (a) => {
    while (a.length && !a[0].trim()) a.shift()
    while (a.length && !a[a.length - 1].trim()) a.pop()
    return a
  }
  return [...trim(left), '', ...trim(right)]
}

function extract(exam) {
  const pdf = findPdf(exam)
  if (!pdf) return null
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csatcol-'))
  const src = path.join(tmp, 'in.pdf'), dst = path.join(tmp, 'out.txt')
  try {
    fs.copyFileSync(path.join(SRC, pdf), src)
    execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
    const raw = fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
    const pages = raw.split('\f')
    const out = []
    for (const p of pages) {
      const ls = p.split('\n')
      if (!ls.some((l) => l.trim())) continue
      out.push(...splitPage(ls), '')
    }
    return out.join('\n')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('pdf-columns.mjs')) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const exams = ['2014B', '2014A', ...Array.from({ length: 12 }, (_, i) => String(2015 + i))]
  let ok = 0
  for (const exam of exams) {
    const pdf = findPdf(exam)
    if (!pdf) { console.log(`  ${exam.padEnd(6)} PDF 없음`); continue }
    try {
      const text = extract(exam)
      fs.writeFileSync(path.join(OUT_DIR, `${exam}.txt`), text)
      const lines = text.split('\n').length
      const hasBlankSet = /\[\s*3[12]\s*[~～]\s*3[45]\s*\]|^\s*31\s*\./m.test(text)
      console.log(`  ${exam.padEnd(6)} ${String(lines).padStart(5)}줄  ${hasBlankSet ? '' : '⚠ 31번 못 찾음'}  ← ${pdf}`)
      ok += 1
    } catch (e) {
      console.log(`  ${exam.padEnd(6)} 실패: ${String(e.message).slice(0, 60)}`)
    }
  }
  console.log(`\n${ok}/${exams.length} 회차 → ${OUT_DIR}`)
}
