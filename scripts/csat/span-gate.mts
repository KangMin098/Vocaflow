// scripts/csat/span-gate.mts
//
// **긴 글에서 자른 토막에 args.me 와 똑같은 게이트를 걸어 원천을 비교한다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// args.me 는 140~200어 글이 31,245편인데 게이트 통과가 **461편(1.5%)** 이었다.
// 탈락 사유가 자족성 35.6% · 표기 28.5% · 어휘 34.5% 로 고르게 퍼졌다 —
// 「짧게 쓰인 글」의 문제는 길이가 아니라 **쓰임새**다(남에게 하는 말이고, 급히 썼다).
//
// 그러면 반대쪽을 봐야 한다: **잘 편집된 긴 글을 문장 경계로 자른 토막**은
// 같은 게이트를 얼마나 통과하는가. 통과율이 args.me 보다 높으면 공급 전략이 뒤집힌다.
//
// 게이트는 `argsme-extract.mts` 와 **같은 정의를 쓴다** — 다른 자로 재면 비교가 무의미하다.
//
// 사용: pnpm dlx tsx scripts/csat/span-gate.mts --dir <스크래치패드>
// 읽기 전용.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const DIR = resolve(argOf('dir', '.'))
const OUT = resolve(argOf('out', 'docs/reports/data/sources-span-gate.json'))

const DATA = 'packages/library-pipeline/data/ngsl'
function loadList(path: string): string[] {
  const out: string[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    // ⚠️ 이 CSV 는 `표제어,굴절형,굴절형…` 이다. 첫 칸만 읽으면 굴절형 8,933개가 버려져
    // is·are·was·were·their·them·better·best·children·an·does·did 가 전부 off-list 로 잡힌다
    // (실측 2026-09-23: 목록 3,767 → 12,700). 그 상태로 잰 off-list 는 전부 과대였다.
    for (const cell of line.split(',')) {
      const w = cell.trim().toLowerCase()
      if (w && /^[a-z][a-z'-]*$/.test(w)) out.push(w)
    }
  }
  return out
}
const KNOWN = new Set<string>([
  ...loadList(join(DATA, 'NGSL_1.2_lemmatized_for_research.csv')),
  ...loadList(join(DATA, 'NAWL_1.2_lemmatized_for_research.csv')),
])

// ── argsme-extract.mts 와 동일한 게이트 ───────────────────────────────
const NOT_SELF_CONTAINED: RegExp[] = [
  /\bopponent/i, /\bround\s*[1-5]\b/i, /\b(first|next|final|last) round\b/i,
  /\bvote (pro|con|for me)\b/i, /\bforfeit/i, /\brebuttal/i,
  /\byou (said|claimed|stated|argued|mentioned)\b/i,
  /\bthe resolution\b/i, /\bi (accept|negate|affirm)\b/i,
  /\bcontention\s*[1-5]\b/i, /\bin this debate\b/i,
  /\bas (i|we) (said|stated) (earlier|above|before)\b/i,
  // 긴 글을 자를 때만 생기는 자족성 파괴자 — 앞뒤 문맥을 가리키는 표현.
  /\bas (discussed|described|shown|noted|seen) (above|below|earlier|in (the )?(previous|next))/i,
  /\b(this|the (following|next|previous)) (chapter|section|table|figure|appendix)\b/i,
  /\bsee (also |table |figure |chapter |section |above|below)/i,
  /\bet al\.?\b/i, /\[\d+\]/, /\(\d{4}[a-z]?\)/, /\bibid\b/i, /\bop\.\s*cit\b/i,
]
const sentencesOf = (t: string): string[] =>
  t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => (s.match(/[A-Za-z]+/g) ?? []).length >= 4)

const wordsIn = (s: string): number => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

function qualityFail(t: string): boolean {
  const sents = sentencesOf(t)
  if (sents.length < 4) return true
  let lower = 0, noEnd = 0, shout = 0
  for (const s of sents) {
    const first = s.match(/[A-Za-z]/)?.[0] ?? ''
    if (first && first === first.toLowerCase()) lower++
    if (!/[.!?]["')\]]?$/.test(s)) noEnd++
    if ((s.match(/\b[A-Z]{3,}\b/g) ?? []).length >= 2) shout++
  }
  const n = sents.length
  return (lower / n) * 100 > 5 || (noEnd / n) * 100 > 10 || (shout / n) * 100 > 5
}

function offListPct(t: string): number {
  const toks = (t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 1)
  if (!toks.length) return 100
  let off = 0
  for (const w of toks) {
    if (KNOWN.has(w)) continue
    const stems = [w.replace(/ies$/, 'y'), w.replace(/(es|s)$/, ''), w.replace(/(ed|ing)$/, ''), w.replace(/(ed|ing)$/, 'e')]
    if (stems.some((s) => s.length > 2 && KNOWN.has(s))) continue
    off++
  }
  return (off / toks.length) * 100
}

/** 문장 경계로 자른 140~200어 토막. 겹치지 않는다. */
function spansOf(text: string): string[] {
  const sents = sentencesOf(text)
  const out: string[] = []
  let buf: string[] = []
  let w = 0
  for (const s of sents) {
    buf.push(s)
    w += wordsIn(s)
    if (w >= 140) {
      if (w <= 200) out.push(buf.join(' '))
      buf = []
      w = 0
    }
  }
  return out
}

interface Row {
  source: string
  docs: number
  spans: number
  g1: number
  g2: number
  g3: number
  passed: number
  pass_pct: number
  spans_per_doc: number
  passed_per_doc: number
  off_median: number
}
const rows: Row[] = []

for (const file of readdirSync(DIR).filter((f) => /samples.*\.json$/.test(f))) {
  let arr: { text?: unknown }[] = []
  try {
    const j = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
    arr = Array.isArray(j) ? j : (j.samples ?? [])
  } catch { continue }
  const texts = arr.map((x) => (typeof x?.text === 'string' ? x.text : '')).filter((t) => wordsIn(t) >= 200)
  if (!texts.length) continue

  let spans = 0, g1 = 0, g2 = 0, g3 = 0, passed = 0
  const offs: number[] = []
  for (const t of texts) {
    for (const s of spansOf(t)) {
      spans++
      if (NOT_SELF_CONTAINED.some((re) => re.test(s))) { g1++; continue }
      if (qualityFail(s)) { g2++; continue }
      const off = offListPct(s)
      if (off > 13) { g3++; continue }
      passed++
      offs.push(off)
    }
  }
  if (!spans) continue
  offs.sort((a, b) => a - b)
  rows.push({
    source: file.replace(/-samples.*\.json$/, ''),
    docs: texts.length,
    spans,
    g1, g2, g3, passed,
    pass_pct: Number(((passed / spans) * 100).toFixed(1)),
    spans_per_doc: Number((spans / texts.length).toFixed(1)),
    passed_per_doc: Number((passed / texts.length).toFixed(1)),
    off_median: Number((offs[Math.floor(offs.length / 2)] ?? 0).toFixed(1)),
  })
}

rows.sort((a, b) => b.passed_per_doc - a.passed_per_doc)
const pad = (s: string | number, n: number): string => String(s).padStart(n)
console.log('args.me 기준선: 140~200어 글 31,245편 → 통과 461편 (1.5%) · 통과분 off-list 중앙 11.7%')
console.log('기출 기준선: off-list 중앙 8.4% · p75 13.0%\n')
console.log('원천              편수   토막   자족탈락  표기탈락  어휘탈락   통과   통과율   통과/편   off중앙')
for (const r of rows) {
  console.log(
    `${r.source.padEnd(17)}${pad(r.docs, 5)}${pad(r.spans, 7)}${pad(r.g1, 10)}${pad(r.g2, 10)}${pad(r.g3, 10)}` +
      `${pad(r.passed, 7)}${pad(r.pass_pct + '%', 9)}${pad(r.passed_per_doc, 10)}${pad(r.off_median + '%', 10)}`
  )
}
writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), contract: 'span-gate/v1', argsmeBaseline: { band: 31245, passed: 461, passPct: 1.5, offMedian: 11.7 }, rows }, null, 2))
console.log(`\n기록: ${OUT}`)
