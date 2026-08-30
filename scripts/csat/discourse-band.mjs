// scripts/csat/discourse-band.mjs
//
// **길이·어휘 대역을 통과해도 문항이 안 되는 이유를 재는 자.**
//
// ── 왜 필요한가 (실측 2026-08-30) ─────────────────────────────────────
// `corpus-window-yield.mjs` 는 모은 글에서 기출 대역(낱말수·문장당 낱말·낱말 길이)에
// 드는 창을 센다. R-BLANK 기준 16,887개가 나온다. 그런데 그 셋은 전부 **모양**이다.
//
// 수능 문항이 되려면 모양 말고 **논리**가 있어야 한다:
//   빈칸(R-BLANK)   빼도 되는 자리가 있어야 한다 → 앞뒤를 잇는 연결이 있어야 성립
//   순서(R-ORDER)   (A)(B)(C) 순서를 고정하는 **지시·조응**이 있어야 한다
//   삽입(R-INSERT)  그 문장이 **한 자리에만** 붙어야 한다 → 연결사·대명사가 자리를 지정
//   요지(R-GIST)    하나의 주장이 있어야 한다
//
// 연결사도 지시어도 없는 산문은 대역 안에 있어도 문항이 안 된다. 그래서 **담화 표지 밀도**를
// 기출에서 재고, 같은 방법(10/50/90 분위)으로 대역을 만든다 — 임계값을 짐작하지 않는다.
//
// ⚠️ 이것도 필요조건이다. 표지가 있다고 좋은 문항이 되는 건 아니다. 다만 표지가 **없으면**
//   안 되는 것은 확실하므로, 후보를 좁히는 데 쓴다.
//
// 실행:
//   pnpm dlx tsx scripts/csat/discourse-band.mjs                 # 기출 대역만 산출
//   pnpm dlx tsx scripts/csat/discourse-band.mjs --apply         # 코퍼스에 적용해 수확량
//   … [--type R-BLANK] [--limit 500] [--out <경로.json>]
//
// 재실행 안전: 읽기만 한다.

import fs from 'node:fs'
import path from 'node:path'

import { allRows, itemBlocks, passageOf } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const APPLY = process.argv.includes('--apply')
const onlyType = arg('type')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const outPath = arg('out')

const W = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []

/**
 * 담화 표지 — 문항 유형이 기대는 장치들.
 * 어형이 아니라 **기능**으로 묶는다(역접·인과·예시·재진술은 빈칸/요지가 기대는 축,
 * 지시·조응은 순서/삽입이 기대는 축).
 */
const CONNECTIVE =
  /\b(however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|instead|rather|although|though|whereas|while|because|since|so that|as a result|for example|for instance|in contrast|on the other hand|in other words|that is|in fact|indeed|by contrast|similarly|likewise|in addition|on the contrary|in short|in sum)\b/gi
const ANAPHORA =
  /\b(this|these|those|such|its|their|his|her|they|them|it)\b/gi

function discourseOf(text) {
  const w = W(text)
  const per100 = (n) => (100 * n) / Math.max(1, w.length)
  const conn = (text.match(CONNECTIVE) ?? []).length
  const ana = (text.match(ANAPHORA) ?? []).length
  const def = (text.match(/\bthe\b/gi) ?? []).length
  return {
    connPer100: per100(conn),
    anaPer100: per100(ana),
    defPer100: per100(def),
    /** 연결사와 지시어를 **둘 다** 갖는가 — 순서·삽입은 둘 다 없으면 성립하지 않는다. */
    hasBoth: conn > 0 && ana > 0 ? 1 : 0,
  }
}

// ── 기출에서 대역 산출 ──────────────────────────────────────────────
const byType = {}
for (const r of allRows()) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = cleanPassage(passageOf(b))
  if (!p || p.length < 150) continue
  if (looksInterleaved(p)) continue
  ;(byType[r.type] ??= []).push(discourseOf(p))
}

const q = (a, x) => {
  const s = [...a].sort((m, n) => m - n)
  return s[Math.floor(x * (s.length - 1))]
}

const bands = {}
for (const [t, rows] of Object.entries(byType)) {
  if (!t.startsWith('R-') || rows.length < 8) continue
  bands[t] = { n: rows.length }
  for (const k of ['connPer100', 'anaPer100', 'defPer100']) {
    const v = rows.map((x) => x[k])
    bands[t][k] = { lo: q(v, 0.1), mid: q(v, 0.5), hi: q(v, 0.9) }
  }
  bands[t].bothRate = rows.reduce((s, x) => s + x.hasBoth, 0) / rows.length
}

console.log(`기출 담화 대역 — 유형 ${Object.keys(bands).length}종 (수능 14개년 + 모의 3회)\n`)
console.log(['유형'.padEnd(13), 'n'.padStart(4), '연결사/100'.padStart(16), '지시어/100'.padStart(16), '둘다'.padStart(6)].join(' '))
for (const [t, b] of Object.entries(bands).sort((a, b2) => b2[1].n - a[1].n)) {
  console.log(
    [
      t.padEnd(13),
      String(b.n).padStart(4),
      `${b.connPer100.lo.toFixed(2)}~${b.connPer100.hi.toFixed(2)}`.padStart(16),
      `${b.anaPer100.lo.toFixed(2)}~${b.anaPer100.hi.toFixed(2)}`.padStart(16),
      `${(100 * b.bothRate).toFixed(0)}%`.padStart(6),
    ].join(' '),
  )
}

const report = { builtAt: new Date().toISOString(), source: '수능 14개년 + 모의 3회', bands }

// ── 코퍼스 적용 ────────────────────────────────────────────────────
if (APPLY) {
  const TYPE = onlyType ?? 'R-BLANK'
  const db1 = bands[TYPE]
  if (!db1) {
    console.error(`\n${TYPE} 담화 대역이 없다 (표본 8 미만).`)
    process.exit(2)
  }

  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const shapeBands = JSON.parse(
    fs.readFileSync(path.resolve('scripts/csat/data/type-bands-all.json'), 'utf8'),
  ).bands[TYPE]

  const rows = []
  for (let from = 0; rows.length < LIMIT; from += 200) {
    const { data, error } = await db
      .from('library_articles')
      .select('id, content, display_only')
      .not('content', 'is', null)
      .range(from, from + 199)
    if (error) throw new Error('조회 실패: ' + error.message)
    if (!data || data.length === 0) break
    rows.push(...data.filter((r) => !r.display_only))
    if (data.length < 200) break
  }
  const corpus = rows.slice(0, LIMIT === Infinity ? undefined : LIMIT)

  const splitSentences = (s) =>
    s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 3)
  const inShape = (m) =>
    m.words >= shapeBands.words.lo && m.words <= shapeBands.words.hi &&
    m.sentLen >= shapeBands.sentLen.lo && m.sentLen <= shapeBands.sentLen.hi &&
    m.wordLen >= shapeBands.wordLen.lo && m.wordLen <= shapeBands.wordLen.hi

  let shapeOnly = 0
  let withDiscourse = 0
  for (const a of corpus) {
    const sents = splitSentences(a.content)
    const wp = sents.map(W)
    let i = 0
    while (i < sents.length) {
      let acc = []
      let j = i
      let hit = -1
      while (j < sents.length) {
        acc = acc.concat(wp[j])
        j++
        if (acc.length > shapeBands.words.hi) break
        if (acc.length < shapeBands.words.lo) continue
        const m = {
          words: acc.length,
          sentLen: acc.length / (j - i),
          wordLen: acc.reduce((s, x) => s + x.length, 0) / acc.length,
        }
        if (!inShape(m)) continue
        hit = j
        break
      }
      if (hit < 0) { i++; continue }
      shapeOnly++
      const text = sents.slice(i, hit).join(' ')
      const d = discourseOf(text)
      // 기출 10 분위 이상이면 통과 — 상한은 걸지 않는다(표지가 많은 건 흠이 아니다).
      if (d.connPer100 >= db1.connPer100.lo && d.anaPer100 >= db1.anaPer100.lo && d.hasBoth) {
        withDiscourse++
      }
      i = hit
    }
  }

  const rate = (100 * withDiscourse) / Math.max(1, shapeOnly)
  console.log(`\n[${TYPE}] 코퍼스 ${corpus.length}편`)
  console.log(`  모양 대역 통과        ${shapeOnly.toLocaleString()}`)
  console.log(`  + 담화 대역까지 통과  ${withDiscourse.toLocaleString()}  (${rate.toFixed(1)}%)`)
  console.log(`  기출 자신의 '둘 다' 보유율 ${(100 * db1.bothRate).toFixed(0)}% — 이 값보다 크게 낮으면 코퍼스가 기출보다 헐겁다는 뜻이다.`)
  report.applied = { type: TYPE, corpus: corpus.length, shapeOnly, withDiscourse, rate }
}

if (outPath) {
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
  console.log(`\n→ ${outPath}`)
}
