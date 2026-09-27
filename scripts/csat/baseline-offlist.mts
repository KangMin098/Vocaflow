// scripts/csat/baseline-offlist.mts
//
// **기출 지문의 off-list 기준선을 다시 잰다 — 앞선 8.4% 가 버그 위에서 나온 값이기 때문이다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// `sources-discovery-v3.md` §0-1 이 기출 139편으로 「off-list 중앙 8.4% · p75 13.0%」를
// 기준선으로 세웠고, 나는 그 위에 게이트 상한 13% 를 올렸다.
// 그런데 2026-09-23 에 내 단어 목록 로더가 NGSL/NAWL CSV 의 **첫 칸만** 읽는 버그가
// 드러났다(목록 12,700 → 3,767). `is are was were their them better best children an`
// 이 전부 off-list 로 집계되는 상태였다.
//
// 기준선이 같은 방식으로 측정됐다면 8.4% 도 부풀려진 값이고, 그 위에 세운 상한 13% 는
// **너무 느슨하다.** 그래서 같은 지문을 **고친 목록**으로 다시 재고 두 값을 나란히 낸다.
//
// 지문은 DB 가 아니라 저장소 안에 있다 — `choice-blind/chunk-*.json` 의 `passage`.
//
// 사용: pnpm dlx tsx scripts/csat/baseline-offlist.mts
// 읽기 전용.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DATA = 'packages/library-pipeline/data/ngsl'
const FILES = ['NGSL_1.2_lemmatized_for_research.csv', 'NAWL_1.2_lemmatized_for_research.csv']

/** `firstOnly` 가 버그 재현이다 — 두 값을 나란히 내기 위해 남겨 둔다. */
function loadList(firstOnly: boolean): Set<string> {
  const set = new Set<string>()
  for (const f of FILES) {
    for (const line of readFileSync(join(DATA, f), 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue
      const cells = firstOnly ? [line.split(',')[0]] : line.split(',')
      for (const c of cells) {
        const w = (c ?? '').trim().toLowerCase()
        if (/^[a-z][a-z'-]*$/.test(w)) set.add(w)
      }
    }
  }
  return set
}
const BUGGY = loadList(true)
const FIXED = loadList(false)

function offListPct(t: string, known: Set<string>): number {
  const toks = (t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 1)
  if (!toks.length) return 100
  let off = 0
  for (const w of toks) {
    if (known.has(w)) continue
    const stems = [w.replace(/ies$/, 'y'), w.replace(/(es|s)$/, ''), w.replace(/(ed|ing)$/, ''), w.replace(/(ed|ing)$/, 'e')]
    if (stems.some((s) => s.length > 2 && known.has(s))) continue
    off++
  }
  return (off / toks.length) * 100
}
const wordsIn = (t: string): number => (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
/** be동사 밀도 — 문체가 뒤틀렸는지 보는 지표. 기출 값이 정상 범위의 정의다. */
const bePer100 = (t: string): number =>
  ((t.match(/\b(is|are|was|were|been|being|am)\b/gi) ?? []).length / Math.max(1, wordsIn(t))) * 100

// ── 지문 모으기 ───────────────────────────────────────────────────────
const passages: string[] = []
const DIR = 'scripts/csat/choice-blind'
for (const f of readdirSync(DIR).filter((x) => /^chunk-\d+\.json$/.test(x))) {
  const j = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { id?: string; passage?: string }[] | { items?: unknown[] }
  const arr = (Array.isArray(j) ? j : ((j as { items?: unknown[] }).items ?? [])) as { passage?: string }[]
  for (const it of arr) {
    const p = (it.passage ?? '').replace(/\s+/g, ' ').trim()
    if (wordsIn(p) >= 80) passages.push(p)
  }
}
if (!passages.length) throw new Error('지문을 못 찾았다 — choice-blind/chunk-*.json 을 확인하라')

const q = (a: number[], x: number): number => {
  const s = [...a].sort((p, r) => p - r)
  return s[Math.min(s.length - 1, Math.floor(s.length * x))]
}
const fmt = (n: number): string => n.toFixed(1)

const words = passages.map(wordsIn)
const buggy = passages.map((p) => offListPct(p, BUGGY))
const fixed = passages.map((p) => offListPct(p, FIXED))
const be = passages.map(bePer100)

console.log(`기출 지문 ${passages.length}편 (저장소 choice-blind)\n`)
console.log(`어수          p25 ${q(words, 0.25)} · 중앙 ${q(words, 0.5)} · p75 ${q(words, 0.75)}`)
console.log(`목록 크기     버그 ${BUGGY.size.toLocaleString()} → 고침 ${FIXED.size.toLocaleString()}`)
console.log('')
console.log(`off-list (버그 로더)  p25 ${fmt(q(buggy, 0.25))}% · 중앙 ${fmt(q(buggy, 0.5))}% · p75 ${fmt(q(buggy, 0.75))}%`)
console.log(`off-list (고친 로더)  p25 ${fmt(q(fixed, 0.25))}% · 중앙 ${fmt(q(fixed, 0.5))}% · p75 ${fmt(q(fixed, 0.75))}%`)
console.log('')
console.log(`be동사/100어          p25 ${fmt(q(be, 0.25))} · 중앙 ${fmt(q(be, 0.5))} · p75 ${fmt(q(be, 0.75))}`)
console.log(`  ↑ 이 값이 「정상 영어」의 정의다. 생성 지문이 이보다 훨씬 낮으면 문체가 뒤틀린 것이다.`)

writeFileSync(
  'docs/reports/data/csat-baseline-offlist.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString().slice(0, 10),
      contract: 'csat-baseline/v1',
      source: 'scripts/csat/choice-blind/chunk-*.json (저장소 보유 기출 지문)',
      n: passages.length,
      words: { p25: q(words, 0.25), median: q(words, 0.5), p75: q(words, 0.75) },
      listSize: { buggy: BUGGY.size, fixed: FIXED.size },
      offList: {
        buggy: { p25: q(buggy, 0.25), median: q(buggy, 0.5), p75: q(buggy, 0.75) },
        fixed: { p25: q(fixed, 0.25), median: q(fixed, 0.5), p75: q(fixed, 0.75) },
      },
      bePer100Words: { p25: q(be, 0.25), median: q(be, 0.5), p75: q(be, 0.75) },
    },
    null,
    2
  )
)
console.log('\n기록: docs/reports/data/csat-baseline-offlist.json')
