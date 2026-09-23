// scripts/csat/length-recheck.mts
//
// **어수를 이유로 버린 원문을 전부 다시 본다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 소스GET 조사 내내 나는 **140~200어**를 1차 필터로 썼다. 그 밖은 아예 세지 않았다.
// 그런데 저장소의 정본(`compose-unit.ts`)은 유형 계열마다 다른 창을 갖는다:
//
//   수능 짧은 지문  90~200      ← 내 창(140~200)보다 **넓다**
//   수능 장문       260~400     ← 통째로 안 봤다
//   학교 문단       40~200      ← 안 봤다
//   학교 문장       6~40        ← 안 봤다
//   초등 3종        지문 없음   ← 길이 자체가 무의미하다
//
// **어떤 원문이 어떤 유형에 쓰일지는 미리 모른다.** 그러니 길이로 먼저 자르면
// 「이 원천은 못 쓴다」가 아니라 「내가 한 유형만 봤다」가 된다.
// 실제로 그렇게 버린 것: args.me 382,545편 중 351,300편, 그리고 Noba·OBP·ANU 같은
// 긴 글 원천 전부(「목표의 22배」라고 적었다).
//
// 이 도구는 **길이 필터를 걷고** 정본 창으로 분류만 한다. 버리지 않는다.
//
// 사용:
//   pnpm dlx tsx scripts/csat/length-recheck.mts --zip <args.me zip>        (덤프)
//   pnpm dlx tsx scripts/csat/length-recheck.mts --dir <표본 디렉터리>      (수집 표본)
//
// 읽기 전용.

import { readFileSync, readdirSync, openSync, readSync, closeSync, statSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import {
  CSAT_ITEM_WORDS,
  CSAT_LONG_ITEM_WORDS,
  SCHOOL_PARAGRAPH_WORDS,
  SCHOOL_SENTENCE_WORDS,
} from '@vocaflow/library-pipeline'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const ZIP = argOf('zip', '')
const DIR = argOf('dir', '')
const OUT = resolve(argOf('out', 'docs/reports/data/length-recheck.json'))

/** 정본 창. 여기서 다시 만들지 않고 패키지에서 가져온다 — 갈리면 조판과 판정이 다른 자를 쓴다. */
const WINDOWS = [
  { key: 'school_sentence', label: '학교 문장', ...SCHOOL_SENTENCE_WORDS },
  { key: 'school_paragraph', label: '학교 문단', ...SCHOOL_PARAGRAPH_WORDS },
  { key: 'csat_short', label: '수능 짧은 지문', ...CSAT_ITEM_WORDS },
  { key: 'csat_long', label: '수능 장문', ...CSAT_LONG_ITEM_WORDS },
] as const

/** 내가 썼던 창 — 얼마나 좁았는지 나란히 보여 주기 위해 남긴다. */
const MY_OLD = { min: 140, max: 200 }

const wordsIn = (t: string): number => (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

interface Tally {
  total: number
  /** 어느 창에도 안 드는 것 — 「너무 짧다(<6)」와 「창 사이·창 위」를 가른다. */
  tooShort: number
  aboveAll: number
  between: number
  byWindow: Record<string, number>
  oldBand: number
}
const newTally = (): Tally => ({
  total: 0, tooShort: 0, aboveAll: 0, between: 0,
  byWindow: Object.fromEntries(WINDOWS.map((w) => [w.key, 0])),
  oldBand: 0,
})

function tally(t: Tally, words: number): void {
  t.total++
  if (words >= MY_OLD.min && words <= MY_OLD.max) t.oldBand++
  let hit = false
  for (const w of WINDOWS) {
    if (words >= w.min && words <= w.max) { t.byWindow[w.key]++; hit = true }
  }
  if (hit) return
  const lowest = Math.min(...WINDOWS.map((w) => w.min))
  const highest = Math.max(...WINDOWS.map((w) => w.max))
  if (words < lowest) t.tooShort++
  else if (words > highest) t.aboveAll++
  else t.between++
}

function report(name: string, t: Tally): void {
  const pc = (n: number): string => `${((n / Math.max(1, t.total)) * 100).toFixed(1)}%`
  console.log(`\n── ${name} · ${t.total.toLocaleString()}편 ──`)
  console.log(`  내가 봤던 창 140~200        ${String(t.oldBand).toLocaleString().padStart(9)}  ${pc(t.oldBand)}`)
  for (const w of WINDOWS) {
    const n = t.byWindow[w.key] ?? 0
    console.log(`  ${w.label.padEnd(14)} ${String(w.min).padStart(3)}~${String(w.max).padEnd(4)} ${String(n).toLocaleString().padStart(9)}  ${pc(n)}`)
  }
  console.log(`  ── 어느 창에도 안 듦`)
  console.log(`     6어 미만                ${String(t.tooShort).toLocaleString().padStart(9)}  ${pc(t.tooShort)}`)
  console.log(`     창 사이(201~259)        ${String(t.between).toLocaleString().padStart(9)}  ${pc(t.between)}`)
  console.log(`     400어 초과              ${String(t.aboveAll).toLocaleString().padStart(9)}  ${pc(t.aboveAll)}`)
  const covered = t.total - t.tooShort - t.between - t.aboveAll
  console.log(`  ▶ **어느 창이든 드는 것     ${String(covered).toLocaleString().padStart(9)}  ${pc(covered)}**`)
  console.log(`     (400어 초과분은 버리는 게 아니라 **잘라 쓰는 것**이다 — 토막 수율은 span-gate 가 잰다)`)
}

const results: Record<string, Tally> = {}

// ── args.me 덤프 ──────────────────────────────────────────────────────
if (ZIP) {
  const fd = openSync(resolve(ZIP), 'r')
  const head = Buffer.alloc(30)
  readSync(fd, head, 0, 30, 0)
  const start = 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
  const size = statSync(resolve(ZIP)).size
  const comp = Buffer.alloc(size - start)
  readSync(fd, comp, 0, comp.length, start)
  closeSync(fd)
  const buf = inflateRawSync(comp, { maxOutputLength: 1024 * 1024 * 1024 })
  const t = newTally()
  // 레코드 경계를 바이트로 센다(888MB 는 문자열 상한을 넘는다).
  let from = 0
  for (let i = 0; i < 4096; i++) if (buf[i] === 0x5b) { from = i + 1; break }
  let depth = 0, st = -1, inStr = false, esc = false
  for (let i = from; i < buf.length; i++) {
    const c = buf[i]
    if (inStr) { if (esc) esc = false; else if (c === 0x5c) esc = true; else if (c === 0x22) inStr = false; continue }
    if (c === 0x22) { inStr = true; continue }
    if (c === 0x7b) { if (depth === 0) st = i; depth++ }
    else if (c === 0x7d) {
      depth--
      if (depth === 0 && st >= 0) {
        try {
          const r = JSON.parse(buf.toString('utf8', st, i + 1)) as { premises?: { text?: string }[] }
          tally(t, wordsIn((r.premises ?? []).map((p) => p.text ?? '').join(' ')))
        } catch { /* 래퍼 */ }
        st = -1
      }
    }
  }
  results['args.me'] = t
  report('args.me 덤프', t)
}

// ── 수집 표본 ─────────────────────────────────────────────────────────
if (DIR) {
  for (const f of readdirSync(resolve(DIR)).filter((x) => /samples.*\.json$/.test(x))) {
    let arr: { text?: unknown }[] = []
    try {
      const j = JSON.parse(readFileSync(join(resolve(DIR), f), 'utf8'))
      arr = Array.isArray(j) ? j : (j.samples ?? [])
    } catch { continue }
    const texts = arr.map((x) => (typeof x?.text === 'string' ? x.text : '')).filter(Boolean)
    if (!texts.length) continue
    const t = newTally()
    for (const x of texts) tally(t, wordsIn(x))
    const name = f.replace(/-samples.*\.json$/, '')
    results[name] = t
    report(name, t)
  }
}

if (!Object.keys(results).length) throw new Error('--zip 또는 --dir 이 필요하다')
writeFileSync(
  OUT,
  JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), contract: 'length-recheck/v1', windows: WINDOWS, myOldBand: MY_OLD, results }, null, 2)
)
console.log(`\n기록: ${OUT}`)
