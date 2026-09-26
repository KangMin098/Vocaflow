// scripts/csat/argsme-gate.mts
//
// **args.me 재저작 드레인 산출물 재검사** — `chunk-NNN.out.json` 을 전부 기계로 다시 잰다.
//
// ── 왜 이 스크립트가 있는가 ───────────────────────────────────────────
// 2026-09-23 에 어휘 게이트가 버그였다(NGSL 로더가 CSV 첫 칸만 읽어 굴절형 8,933개를
// 버렸다 → 목록 3,767낱말). 생성 에이전트들이 **그 버그를 통과하려고** is·are·was·were
// 를 피해 썼고, 결과물의 be동사 밀도가 0.00~0.21/100어가 됐다(정상 영어 3~5, 기출 2.8).
// 어휘 칸은 통과하는데 **영어가 아닌 것**이 나왔다.
//
// 그래서 이 게이트는 「통과/탈락」만 찍지 않고 **be동사 밀도·굴절형 밀도를 함께 찍는다.**
// 게이트를 피해 쓰면 그 회피가 다른 숫자에 남는다 — 그걸 보는 것이 이 파일의 목적이다.
//
// ⚠️ 이 게이트가 정당한 글을 떨어뜨리면 **글이 아니라 게이트를 고친다**(AGENTS.md).
//
// 사용:
//   pnpm exec tsx scripts/csat/argsme-gate.mts
//   pnpm exec tsx scripts/csat/argsme-gate.mts --chunk 003   # 한 청크만
//   pnpm exec tsx scripts/csat/argsme-gate.mts --json out.json

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'scripts/csat/argsme-drain'
const argv = process.argv.slice(2)
const ONLY = argv.includes('--chunk') ? argv[argv.indexOf('--chunk') + 1] : null
const JSON_OUT = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null

// ── 어휘 목록 (argsme-extract.mts 와 같은 로더 — 첫 칸만 읽지 않는다) ──
function loadList(path: string): string[] {
  const out: string[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    for (const cell of line.split(',')) {
      const w = cell.trim().toLowerCase()
      if (w && /^[a-z][a-z'-]*$/.test(w)) out.push(w)
    }
  }
  return out
}
const DATA = 'packages/library-pipeline/data/ngsl'
const KNOWN = new Set<string>([
  ...loadList(join(DATA, 'NGSL_1.2_lemmatized_for_research.csv')),
  ...loadList(join(DATA, 'NAWL_1.2_lemmatized_for_research.csv')),
])

function tokens(t: string): string[] {
  return (t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 1)
}

function offListPct(t: string): number {
  const toks = tokens(t)
  if (!toks.length) return 100
  let off = 0
  for (const w of toks) {
    if (KNOWN.has(w)) continue
    const stems = [
      w.replace(/ies$/, 'y'),
      w.replace(/(es|s)$/, ''),
      w.replace(/(ed|ing)$/, ''),
      w.replace(/(ed|ing)$/, 'e'),
    ]
    if (stems.some((s) => s.length > 2 && KNOWN.has(s))) continue
    off++
  }
  return (off / toks.length) * 100
}

// ── 회피의 흔적 ───────────────────────────────────────────────────────
/**
 * be동사 밀도(/100어). 기출 실측 중앙 2.8. **0에 가까우면 게이트를 피해 쓴 글이다.**
 * 정상 영어에서 be동사를 한 편(164어) 내내 한 번도 안 쓰는 일은 사실상 없다.
 */
const BE = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'am'])
function beDensity(t: string): number {
  const toks = tokens(t)
  if (!toks.length) return 0
  return (toks.filter((w) => BE.has(w)).length / toks.length) * 100
}

/** 수동태·완료·비교급처럼 굴절이 필요한 자리를 쓰는지 — 회피의 두 번째 지표. */
const FUNC = new Set([
  'their', 'them', 'these', 'those', 'which', 'whose', 'has', 'have', 'had',
  'does', 'did', 'than', 'more', 'most', 'better', 'best',
])
function funcDensity(t: string): number {
  const toks = tokens(t)
  if (!toks.length) return 0
  return (toks.filter((w) => FUNC.has(w)).length / toks.length) * 100
}

// ── 자족성 (BRIEF 3) ──────────────────────────────────────────────────
const NOT_SELF_CONTAINED: RegExp[] = [
  /\bopponent'?s?\b/i,
  /\bthis (debate|round|resolution|motion)\b/i,
  /\brebuttal\b/i,
  /\byou (said|claimed|argued|stated)\b/i,
  /\bas I (said|noted|mentioned) (earlier|above|before)\b/i,
  /\bmy (opponent|argument|case)\b/i,
  /\bpro\b\s*\/\s*\bcon\b/i,
  /\[\d+\]/,
  /\bcon\s+(argues|claims|says)\b/i,
]

// ── 문장 ──────────────────────────────────────────────────────────────
function sentences(t: string): string[] {
  return t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Row {
  chunk: string
  idx: number
  id: string
  verdict: string
  words: number
  offList: number
  be: number
  func: number
  sents: number
  avgSent: number
  fails: string[]
}

function judge(chunk: string, idx: number, item: Record<string, unknown>): Row {
  const verdict = String(item.verdict ?? '')
  const passage = String(item.passage ?? '')
  const fails: string[] = []

  if (verdict === 'skip') {
    if (!String(item.skip_reason ?? '').trim()) fails.push('skip 인데 사유가 없다')
    return {
      chunk, idx, id: String(item.id ?? ''), verdict,
      words: 0, offList: 0, be: 0, func: 0, sents: 0, avgSent: 0, fails,
    }
  }

  const toks = tokens(passage)
  const words = toks.length
  const off = offListPct(passage)
  const be = beDensity(passage)
  const fn = funcDensity(passage)
  const sents = sentences(passage)
  const avg = sents.length ? words / sents.length : 0

  // 1 길이
  if (words < 140 || words > 200) fails.push(`길이 ${words}어 (140~200)`)
  // 2 어휘
  if (off > 10) fails.push(`off-list ${off.toFixed(1)}% (≤10)`)
  // 3 자족
  for (const re of NOT_SELF_CONTAINED) {
    if (re.test(passage)) { fails.push(`자족 위반 ${re.source}`); break }
  }
  // 4 논증 — 주장 문장이 있어야 한다(기계로는 존재만 본다)
  if (!String(item.claim ?? '').trim()) fails.push('claim 이 비었다')
  if (!String(item.topic_ko ?? '').trim()) fails.push('topic_ko 가 비었다')
  // 5 문장
  if (sents.length < 4 || sents.length > 8) fails.push(`문장 ${sents.length}개 (4~8)`)
  if (sents.length && (avg < 20 || avg > 26)) fails.push(`평균 ${avg.toFixed(1)}어 (20~26)`)
  for (const s of sents) {
    if (!/^["'(]?[A-Z]/.test(s)) { fails.push('대문자로 시작하지 않는 문장'); break }
  }
  if (sents.length && !/[.!?]["')]?$/.test(sents[sents.length - 1])) fails.push('마침표로 끝나지 않는다')
  // 1인칭·독자 호명
  if (/\b(I|we|our|us)\b/.test(passage)) fails.push('1인칭')
  if (/\byou(r)?\b/i.test(passage)) fails.push('독자 호명')

  // ★ 회피의 흔적 — 게이트 버그를 피해 쓴 글을 여기서 잡는다
  if (be < 1.0) fails.push(`be동사 밀도 ${be.toFixed(2)}/100어 — 회피 의심 (기출 2.8)`)

  return {
    chunk, idx, id: String(item.id ?? ''), verdict,
    words, offList: Number(off.toFixed(1)), be: Number(be.toFixed(2)),
    func: Number(fn.toFixed(2)), sents: sents.length,
    avgSent: Number(avg.toFixed(1)), fails,
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────
const outFiles = readdirSync(DIR)
  .filter((f) => f.endsWith('.out.json'))
  .filter((f) => !ONLY || f === `chunk-${ONLY}.out.json`)
  .sort()

if (!outFiles.length) {
  console.log('검사할 .out.json 이 없다')
  process.exit(0)
}

/** 입력 전체 색인 — id → { 청크 파일, sha256 }. 청크 경계가 두 번 바뀌었으므로 필수다. */
const INDEX = new Map<string, { file: string; sha: string }>()
for (const f of readdirSync(DIR).filter((x) => /^chunk-\d+\.json$/.test(x)).sort()) {
  const j = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
  for (const it of j.items ?? []) INDEX.set(String(it.id), { file: f, sha: String(it.sha256) })
}
console.log(`입력 색인 ${INDEX.size.toLocaleString()}편`)

const rows: Row[] = []
const chunkSummary: {
  chunk: string; items: number; write: number; skip: number
  pass: number; fail: number; medBe: number; medOff: number; aligned: boolean
}[] = []

for (const f of outFiles) {
  const chunk = f.slice(6, 9)
  const out = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
  const items: Record<string, unknown>[] = out.items ?? []

  // ⚠️ 밀림 검사 — **위치로 대조하지 않는다.**
  //    첫 판은 `chunk-NNN.out.json` ↔ `chunk-NNN.json` 을 같은 순서의 같은 배열로 보고
  //    위치 대조를 했는데, 12개 청크가 전부 「밀림」으로 나왔다. 밀린 것이 아니라
  //    **export 가 두 번 다른 청크 경계로 돌았다** — out-001 하나가 지금의 입력
  //    chunk-001~007 에 걸쳐 있다(2026-09-23 실측). 위치는 이미 의미가 없다.
  //    대신 id → sha256 을 **입력 전체에서** 찾아 대조한다. 이쪽이 진짜 방어다:
  //    id 만 복사돼도 sha256 이 본문에 묶여 있으므로 짝이 어긋나면 여기서 걸린다.
  let aligned = true
  for (const it of items) {
    const hit = INDEX.get(String(it.id))
    if (!hit || hit.sha !== String(it.sha256)) { aligned = false; break }
  }

  const local = items.map((it, i) => judge(chunk, i, it))
  rows.push(...local)

  const writes = local.filter((r) => r.verdict === 'write')
  const bes = writes.map((r) => r.be).sort((a, b) => a - b)
  const offs = writes.map((r) => r.offList).sort((a, b) => a - b)
  const med = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : 0)

  chunkSummary.push({
    chunk,
    items: local.length,
    write: writes.length,
    skip: local.filter((r) => r.verdict === 'skip').length,
    pass: local.filter((r) => !r.fails.length).length,
    fail: local.filter((r) => r.fails.length).length,
    medBe: med(bes),
    medOff: med(offs),
    aligned,
  })
}

console.log(`어휘 목록 ${KNOWN.size.toLocaleString()}낱말 · 청크 ${outFiles.length}개 · 항목 ${rows.length}개\n`)
console.log('청크  항목  write  skip  통과  탈락  be중앙  off중앙  배열')
for (const c of chunkSummary) {
  const flag = c.medBe < 1.0 ? ' ← 재생성' : ''
  console.log(
    `${c.chunk}   ${String(c.items).padStart(3)}  ${String(c.write).padStart(5)}  ` +
    `${String(c.skip).padStart(4)}  ${String(c.pass).padStart(4)}  ${String(c.fail).padStart(4)}  ` +
    `${c.medBe.toFixed(2).padStart(6)}  ${c.medOff.toFixed(1).padStart(6)}%  ` +
    `${c.aligned ? 'ok' : '밀림!'}${flag}`,
  )
}

const tally = new Map<string, number>()
for (const r of rows) {
  for (const f of r.fails) {
    const key = f.replace(/\d+(\.\d+)?/g, 'N')
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }
}
console.log('\n탈락 사유 (많은 순)')
for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`)
}

const writes = rows.filter((r) => r.verdict === 'write')
const clean = writes.filter((r) => !r.fails.length)
console.log(
  `\n합계 write ${writes.length} · 통과 ${clean.length} (${((clean.length / Math.max(1, writes.length)) * 100).toFixed(1)}%)`,
)
console.log(`재생성 대상 청크: ${chunkSummary.filter((c) => c.medBe < 1.0).map((c) => c.chunk).join(', ') || '없음'}`)

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), chunkSummary, rows }, null, 2))
  console.log(`\n→ ${JSON_OUT}`)
}
