// scripts/csat/measure-column-restore.mjs
//
// **2단 복원의 `minRun` 을 바꾸면 어느 회차가 나아지고 어느 회차가 나빠지는가.**
//
// 이 저장소가 이미 배운 교훈이 하나 있다 — **어느 한쪽을 고르면 반드시 절반이 깨진다.**
// 표시 폭 보정을 켰더니 모평 넷은 발문이 늘고(38→42) 2026학년도 6·9월은 줄었다(45→43).
// 그래서 `restoreColumnsBest` 는 회차마다 재서 고른다.
//
// `minRun` 도 같다. 지금 4인데, 실측으로 **12회차에서 3칸짜리 여백을 버려** 페이지가 안 갈린다
// (M2406 11.2% · M2506 10.4% · 2022 8.5% …). 3으로 내리면 그 페이지들이 살아나지만,
// 다른 회차에서 **여백이 아닌 3칸 틈**을 여백으로 오인해 멀쩡한 페이지를 자를 수 있다.
//
// **그래서 바꾸기 전에 31회차 전부를 잰다.** 이 스크립트는 아무것도 쓰지 않는다.
//
// 점수는 `ingest-mock` 이 쓰는 것과 같은 자다:
//   유형이 **하나로** 배정되는 발문 하나에 10점(둘 이상이면 1점) + 분리 품질
//   (분리 품질 = 서로 다른 문항 머리 수 × 10 − 한 줄에 두 문항 번호가 붙은 줄 수 × 30)
// 곧 **문항이 제대로 갈라졌는가**를 재는 것이고, 그것이 이 복원의 목적 그대로다.
//
// 실행: node scripts/csat/measure-column-restore.mjs [비교할 minRun, 기본 3]

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { restoreColumns } from './lib-columns.mjs'

const ALT = Number(process.argv[2] ?? 3)
const DIR = path.resolve('scripts/csat/data')
const TYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types.map((t) => ({
  ...t,
  re: new RegExp(t.match.replace(/^\/|\/$/g, '')),
}))

const MOCK_SRC = [
  'C:/Users/Administrator/Documents/영어/모의평가',
  'C:/Users/Administrator/Documents/수능영어기출/모의평가',
].find((d) => fs.existsSync(d))
const SUN_SRC = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/수능영어기출/최종',
].find((d) => fs.existsSync(d))

// `pdftotext -v` 는 0이 아닌 코드로 끝나기도 한다 — 그것으로 존재를 판정하면 있는데도 없다고 한다.
// 파일이 실제로 있는지만 본다.
const PDFTOTEXT =
  ['C:/Program Files/Git/mingw64/bin/pdftotext.exe', 'C:/Program Files/Git/mingw64/bin/pdftotext'].find((p) =>
    fs.existsSync(p),
  ) ?? 'pdftotext'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-measure-'))
function rawOf(pdf) {
  const out = path.join(tmp, 'o.txt')
  try {
    execFileSync(PDFTOTEXT, ['-layout', pdf, out], { stdio: 'ignore' })
  } catch {
    /* pdftotext 는 CMap 경고로 0이 아닌 코드를 내기도 한다 — 산출물이 있으면 쓴다 */
  }
  return fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
}

/** 발문 후보 — `12. …` 로 시작하는 줄(줄 가운데 포함) */
function stemsOf(text) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    for (const m of line.matchAll(/(?:^|\s{2,})(\d{1,2})\s*[.．]\s*(\S.{5,})/g)) {
      const no = Number(m[1])
      if (no >= 1 && no <= 45) out.push({ no, stem: m[2].trim() })
    }
  }
  return out
}
const classify = (stem) => TYPES.filter((t) => t.re.test(String(stem).replace(/\s+/g, '')))

/** 분리 품질 — 문항 머리가 몇 개나 서로 다르게 섰나 − 한 줄에 두 문항이 붙은 줄 */
function splitQuality(text) {
  const heads = new Set()
  let merged = 0
  for (const line of text.split(/\r?\n/)) {
    const ns = [...line.matchAll(/(?:^|\s{2,})(\d{1,2})\s*[.．]\s/g)].map((m) => Number(m[1]))
    for (const n of ns) if (n >= 1 && n <= 45) heads.add(n)
    if (ns.length >= 2) merged += 1
  }
  return heads.size * 10 - merged * 30
}

const score = (text) =>
  stemsOf(text).reduce((a, q) => a + (classify(q.stem).length === 1 ? 10 : 1), 0) + splitQuality(text)

/** 붙은 줄 — 두 단이 한 줄에 남아 있는 자리(적을수록 좋다) */
function glued(text) {
  const L = text.split(/\r?\n/)
  return L.filter((l) => /\S {6,}\S/.test(l) && l.length > 75 && /\S/.test(l.slice(72))).length
}

// ── 회차 목록 ─────────────────────────────────────────────────────────
const exams = []
if (SUN_SRC) {
  const files = fs.readdirSync(SUN_SRC)
  const FIXED = { '2014A': '2014_영어A-홀수형_문제.pdf', '2014B': '2014_영어B-홀수형_문제.pdf' }
  for (const e of ['2014A', '2014B', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']) {
    const f = FIXED[e] ?? files.find((x) => x.startsWith(e) && x.toLowerCase().endsWith('.pdf') && !x.includes('정답표'))
    if (f) exams.push({ exam: e, pdf: path.join(SUN_SRC, f) })
  }
}
if (MOCK_SRC) {
  for (const f of fs.readdirSync(MOCK_SRC).filter((x) => /^\d{6}_영어영역_문제지\.pdf$/.test(x))) {
    const c = f.slice(0, 6)
    exams.push({ exam: `M${c.slice(2, 4)}${c.slice(4, 6)}`, pdf: path.join(MOCK_SRC, f) })
  }
}

console.log(`\n  회차 ${exams.length} · minRun 4 vs ${ALT} — 아무것도 쓰지 않는다\n`)
console.log('  회차     점수(4)  점수(' + ALT + ')     차이   붙은줄 4→' + ALT)
console.log('  ' + '─'.repeat(56))

let better = 0
let worse = 0
let same = 0
const regressions = []
const picks = []
for (const { exam, pdf } of exams) {
  const raw = rawOf(pdf)
  if (!raw.trim()) {
    console.log(`  ${exam.padEnd(8)} (원문 추출 실패)`)
    continue
  }
  // 회차마다 좌표계를 고르는 것은 그대로 두고, **같은 좌표계 안에서** minRun 만 바꿔 잰다
  const best = (mr) => {
    const a = restoreColumns(raw, true, mr)
    const b = restoreColumns(raw, false, mr)
    return score(a) >= score(b) ? a : b
  }
  // **회차마다 고른다면?** 점수만 보면 2022 가 308→321 로 나아진 것처럼 보이는데
  // 붙은 줄은 0→31 로 늘었다 — 우리가 고치려는 바로 그 결함이다. 그래서 판정에 둘 다 건다:
  // **점수가 오르고 그리고 붙은 줄이 늘지 않을 때만** 바꾼다.
  const t4 = best(4)
  const tA = best(ALT)
  const s4 = score(t4)
  const sA = score(tA)
  const d = sA - s4
  if (d > 0) better += 1
  else if (d < 0) { worse += 1; regressions.push(`${exam} ${s4}→${sA}`) }
  else same += 1
  const g4 = glued(t4), gA = glued(tA)
  const pick = d > 0 && gA <= g4 ? ALT : 4
  if (pick === ALT) picks.push(exam)
  const mark = d > 0 ? "▲" : d < 0 ? "▼" : " "
  console.log(
    `  ${exam.padEnd(8)} ${String(s4).padStart(6)} ${String(sA).padStart(8)} ${mark}${String(d).padStart(6)}   ${String(glued(t4)).padStart(4)} → ${glued(tA)}`,
  )
}

console.log('  ' + '─'.repeat(56))
console.log(`  나아짐 ${better} · 그대로 ${same} · **나빠짐 ${worse}**`)
console.log(`
  ── 회차마다 고른다면 (점수 오르고 && 붙은 줄 안 늘 때만 ${ALT}) ──`)
console.log(`  minRun ${ALT} 를 쓸 회차 ${picks.length}: ${picks.join(" ") || "없음"}`)
console.log(`  나머지 ${exams.length - picks.length} 회차는 4 를 유지 — **구성상 퇴행 0**`)
if (worse) {
  console.log(`\n  ✗ 퇴행한 회차: ${regressions.join(' · ')}`)
  console.log('    한 회차라도 낮아지면 바꾸지 않는다 — 절반이 깨지는 것을 이 저장소가 이미 겪었다.')
} else {
  console.log('\n  ✓ 퇴행 0 — minRun 을 바꿔도 안전하다는 뜻이다(다음 단계: 코퍼스 재빌드 → 게이트 전량).')
}
fs.rmSync(tmp, { recursive: true, force: true })
