// scripts/textbook/caption-probe.mjs
//
// **"이건 문장이 아니라 캡션이다" 를 규칙으로 가를 수 있는지 먼저 잰다.**
//
// ── 왜 재고 나서 고치는가 ────────────────────────────────────────────
// Cycle 4 수율 표본에서 캡션이 섞여 나왔다:
//   "Cindy Evans during a Artemis II Lunar Science Team simulation at Johnson Space Center."
// 문장처럼 생겼고 마침표도 있는데 **정형동사가 없다.** 이대로 두면 교재에 캡션이 실린다.
//
// 그런데 필터는 **오탐이 크면 고치는 것보다 나쁘다** — 멀쩡한 지문을 버려 재고가 준다.
// 품사 태거 없이 "정형동사 없음" 을 정확히 판정할 수는 없으므로, 이 프로브는
// **후보 규칙이 실제로 무엇을 잡는지** 표본으로 보여 준다. 정밀도가 낮으면 규칙을 버린다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행: pnpm dlx tsx scripts/textbook/caption-probe.mjs

import fs from 'node:fs'
import { fetchAllPaged } from './volume-pool.mjs'
import path from 'node:path'

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

/**
 * 정형동사 표지 — **이 중 하나라도 있으면 절이 있다고 본다.**
 *
 * 닫힌 집합(be·have·do·조동사)은 확실하다. 문제는 일반동사인데, 영어 과거형이
 * 불규칙이라 목록으로 못 덮는다. 그래서 목록은 **"있으면 문장"** 판정에만 쓰고
 * **"없으면 캡션"** 으로 바로 결론내지 않는다 — 아래에서 구조 신호를 함께 본다.
 */
const FINITE = new Set([
  'is','are','was','were','am','be','been','being',
  'has','have','had','do','does','did',
  'will','would','can','could','may','might','must','shall','should',
  // 매우 흔한 불규칙·규칙 과거/현재형. 목록의 목적은 재현율이 아니라 **오탐 억제**다.
  'said','made','found','took','gave','went','came','saw','got','knew','thought',
  'became','began','brought','built','held','kept','left','led','met','put','ran',
  'sent','showed','told','used','wrote','won','lost','set','felt','grew','fell',
  'includes','include','included','provides','provide','provided','shows','show',
  'helps','help','helped','uses','allows','allow','allowed','causes','cause','caused',
  'means','mean','meant','needs','need','needed','works','work','worked','lives','live',
  'appears','appear','appeared','remains','remain','remained','seems','seem','seemed',
  'says','say','adds','add','added','notes','note','noted','explains','explain','explained',
])

/** `-ed`·`-s` 로 끝나 동사일 수 있는 낱말. 확정이 아니라 **의심**이다. */
const VERBISH = /^[a-z]+(?:ed|es|s)$/

function tokens(s) {
  return s.split(/\s+/).map((t) => t.replace(/[^A-Za-z'-]/g, '')).filter(Boolean)
}

/** 규칙 A — 정형동사 표지가 하나도 없다. */
function noFiniteMarker(s) {
  return !tokens(s).some((t) => FINITE.has(t.toLowerCase()))
}

/** 규칙 B — `-ed`/`-s` 로 끝나는 낱말조차 없다(동사 후보가 아예 없다). */
function noVerbish(s) {
  return !tokens(s).some((t) => VERBISH.test(t.toLowerCase()))
}

/**
 * 규칙 C — 캡션의 **구조 신호**.
 *   ① 고유명사로 시작한다(사람·기관 이름).
 *   ② 전치사가 이끄는 꼬리로 끝난다("… at Johnson Space Center.").
 * 둘 다 있으면 캡션일 공산이 크다. 이것만으로는 부족해 A·B 와 함께 쓴다.
 */
const TAIL_PREP = /\b(?:at|in|on|during|near|aboard|from|of)\s+(?:[A-Z][\w'-]*\s*){1,5}[.!?]$/
function captionShape(s) {
  const t = tokens(s)
  if (t.length < 4) return false
  const startsProper = /^[A-Z]/.test(t[0]) && /^[A-Z]/.test(t[1] ?? '')
  return startsProper && TAIL_PREP.test(s.trim())
}

// ⚠️ 페이징 없이 읽으면 1,000행에서 잘려 **리포트 수치가 조용히 틀린다**(원글 6,633편).
const arts = await fetchAllPaged(db, (q) =>
  q
    .from('library_articles')
    .select('id, source, article_v_level, display_only, content')
    .not('content', 'is', null)
    .order('id'))

const rules = {
  'A: 정형표지 없음': noFiniteMarker,
  'B: A + 동사후보도 없음': (s) => noFiniteMarker(s) && noVerbish(s),
  'C: A + 캡션 구조': (s) => noFiniteMarker(s) && captionShape(s),
}
const hits = { 'A: 정형표지 없음': [], 'B: A + 동사후보도 없음': [], 'C: A + 캡션 구조': [] }
const counts = { total: 0 }
for (const k of Object.keys(rules)) counts[k] = 0

const bySource = new Map()

for (const a of arts ?? []) {
  if (a.display_only) continue
  const sentences = String(a.content)
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s && /[.!?]$/.test(s) && s.split(/\s+/).length >= 6)

  for (const s of sentences) {
    counts.total++
    for (const [name, fn] of Object.entries(rules)) {
      if (!fn(s)) continue
      counts[name]++
      if (hits[name].length < 12) hits[name].push({ src: a.source, v: a.article_v_level, s })
      if (name === 'C: A + 캡션 구조') {
        bySource.set(a.source, (bySource.get(a.source) ?? 0) + 1)
      }
    }
  }
}

console.log(`문장 ${counts.total.toLocaleString()}개 (6어 이상 · ND 제외)\n`)
for (const name of Object.keys(rules)) {
  const n = counts[name]
  console.log(`${name.padEnd(24)} ${String(n).padStart(6)}건  ${((100 * n) / counts.total).toFixed(2)}%`)
}

for (const name of Object.keys(rules)) {
  console.log(`\n── ${name} — 표본 ──`)
  for (const h of hits[name].slice(0, 8)) {
    console.log(`  [${h.src} V${h.v}] ${h.s.slice(0, 118)}`)
  }
}

console.log('\n── 규칙 C 소스별 ──')
for (const [src, n] of [...bySource].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src.padEnd(20)} ${n}`)
}

fs.writeFileSync(
  'scripts/textbook/caption-probe.json',
  JSON.stringify({ measured_at: new Date().toISOString(), counts, hits, bySource: [...bySource] }, null, 2),
)
console.log('\n→ scripts/textbook/caption-probe.json')
