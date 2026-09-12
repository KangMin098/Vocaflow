// scripts/dict/antonym-gate-probe.mjs
//
// **반대말을 채우면 어휘 문항(수능 30번)이 실제로 늘어나는가.**
//
// ── 왜 이걸 먼저 재는가 ──────────────────────────────────────────────
// 사전의 빈 컬럼은 여럿인데, 채우는 비용은 컬럼마다 다르고 **채워도 아무것도 안 늘어나는
// 컬럼이 있다.** `mnemonic_ko` 는 40,332개가 비었지만 어떤 생성기도 그걸 안 쓴다.
// 반면 `antonyms` 는 `buildVocabChoice` 가 낱말을 반대말로 바꿔 지문 안에 모순을 만드는
// 재료라, 비어 있으면 그 문항이 아예 안 나온다.
//
// 그래서 "얼마나 비었나" 가 아니라 **"채우면 몇 문항이 느나"** 를 잰다.
// 방법은 반대말이 이미 있는 것처럼 가정하고 한 번 더 돌려 차이를 보는 것이다.
//
// ⚠️ 위쪽 추정치다 — 가정한 반대말이 실제로 존재한다는 보장이 없다. 형용사·동사·부사만
//   후보로 세는 이유가 그것이다(명사는 반대말이 없는 경우가 대부분이라 세면 부풀려진다).
//
// 재실행 안전: 읽기만 한다.
//
// 실행: pnpm dlx tsx scripts/dict/antonym-gate-probe.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { buildVocabChoice } = await import('@vocaflow/library-pipeline')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const antOf = new Map()
const posOf = new Map()
const gradable = new Set()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, antonyms, primary_pos')
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word ?? '').toLowerCase()
    if (!w) continue
    if (Array.isArray(r.antonyms) && r.antonyms.length) antOf.set(w, r.antonyms.map(String))
    if (r.primary_pos) {
      posOf.set(w, String(r.primary_pos))
      // 반대말이 실제로 있을 만한 품사만. 명사까지 세면 위쪽 추정이 크게 부풀려진다.
      if (['adjective', 'verb', 'adverb'].includes(String(r.primary_pos))) gradable.add(w)
    }
  }
  if (data.length < 1000) break
}
console.log(`사전 ${posOf.size.toLocaleString()} · 반대말 보유 ${antOf.size.toLocaleString()} · 형용사/동사/부사 ${gradable.size.toLocaleString()}\n`)

/** 지금 사전 그대로. */
const lexNow = {
  antonymsOf: (w) => antOf.get(w.toLowerCase()) ?? [],
  posOf: (w) => posOf.get(w.toLowerCase()) ?? null,
}
/**
 * 형용사·동사·부사에 반대말이 **하나 있다고 가정**한 사전.
 * 값은 아무 문자열이나 되면 안 되고 생성기가 실제로 치환에 쓰므로, 원래 낱말과
 * 겹치지 않는 표식을 준다 — 문항 수를 세는 것이 목적이지 문항을 쓰려는 게 아니다.
 */
const lexIfFilled = {
  antonymsOf: (w) => {
    const k = w.toLowerCase()
    const has = antOf.get(k)
    if (has) return has
    return gradable.has(k) ? [`un${k}`] : []
  },
  posOf: (w) => posOf.get(w.toLowerCase()) ?? null,
}

const { data: arts, error } = await db
  .from('library_articles')
  .select('id, article_v_level, display_only, content')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
if (error) throw new Error('지문 조회 실패: ' + error.message)

let paras = 0
let now = 0
let filled = 0
const gainedBand = new Map()
for (const a of arts ?? []) {
  if (a.display_only) continue
  for (const p of String(a.content).split(/\n+/)) {
    const ss = p.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
    if (ss.length < 2) continue
    paras++
    const n = buildVocabChoice(ss, lexNow) ? 1 : 0
    const f = buildVocabChoice(ss, lexIfFilled) ? 1 : 0
    now += n
    filled += f
    if (f > n) {
      const b = `V${a.article_v_level ?? '?'}`
      gainedBand.set(b, (gainedBand.get(b) ?? 0) + 1)
    }
  }
}

const pct = (n) => `${((100 * n) / Math.max(1, paras)).toFixed(1)}%`
console.log(`문단 ${paras.toLocaleString()}`)
console.log(`  지금 사전으로        ${now.toLocaleString()} (${pct(now)})`)
console.log(`  반대말이 다 있다면    ${filled.toLocaleString()} (${pct(filled)})`)
console.log(`  차이               +${(filled - now).toLocaleString()} (${((100 * (filled - now)) / Math.max(1, now)).toFixed(1)}% 증가)`)
console.log('\n밴드별 증가분:')
for (const [b, n] of [...gainedBand].sort()) console.log(`  ${b.padEnd(5)} +${n}`)

fs.writeFileSync(
  'scripts/dict/antonym-gate-probe.json',
  JSON.stringify(
    { measured_at: new Date().toISOString(), paras, now, filled, gain: filled - now, byBand: [...gainedBand] },
    null,
    2,
  ),
)
console.log('\n→ scripts/dict/antonym-gate-probe.json')
