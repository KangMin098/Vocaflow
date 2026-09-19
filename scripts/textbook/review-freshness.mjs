// scripts/textbook/review-freshness.mjs
//
// **검수 판정이 「지금 문항」에 대한 것인가 — 판(digest)으로 가른다.**
//
// `review-staleness.mjs` 는 드레인 산출물에 남은 **해설 원문**으로 낡음을 짚었다. 그것은
// 기록이 남은 것만 볼 수 있는 하한이었고, 그래서 그 스크립트 자신이 「판 열이 없는 한 일반적인
// 대조는 불가능하다」고 적었다. 2026-09-14 에 그 열이 생겼다(`reviewed_digest`).
//
// 이 자는 **DB 만 보고** 전수를 가른다:
//   · current — 지금 판을 보고 내린 판정. **이것만 조판을 통과시킨다.**
//   · stale   — 다른 판을 보고 내렸다. 다시 봐야 한다.
//   · unknown — 어느 판인지 모른다(열이 생기기 전 행). 통과로도 차단으로도 세지 않는다.
//
// 판정은 지우지 않는다 — 사람이 읽고 내린 기록이다. 무효가 되는 것이 아니라 **다른 판에
// 대한 기록**이 될 뿐이다.
//
// **읽기만 한다**(SELECT 뿐). 몇 번을 돌려도 결과가 같다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/review-freshness.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, 'apps/web/.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const { createClient } = await import('@supabase/supabase-js')
const { reviewDigest, tallyFreshReviews, freshnessOf } = await import('@vocaflow/library-pipeline')

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 검수 행 전량 ────────────────────────────────────────────────────
// ⚠️ 페이지로 나눠 읽는다 — 이 저장소는 필터 없는 전수 조회가 1000행에서 조용히 잘려
//   「이미 끝난 유형이 남은 몫 상단에 올라오는」 사고를 겪었다.
const reviews = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('csat_item_reviews')
    .select('item_id, persona, verdict, reviewed_digest')
    .range(from, from + 999)
  if (error) {
    console.error('검수 조회 실패:', error.message)
    process.exit(1)
  }
  reviews.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

if (!reviews.length) {
  console.log('검수 기록이 없다.')
  process.exit(0)
}

// ── 그 문항들의 지금 판 ─────────────────────────────────────────────
const ids = [...new Set(reviews.map((r) => r.item_id))]
const current = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, payload, answer_key')
    .in('id', ids.slice(i, i + 200))
  if (error) {
    console.error('문항 조회 실패:', error.message)
    process.exit(1)
  }
  // ⚠️ 조회에서 빠진 문항은 지금 판을 **모르는** 것이다. 넣지 않으면 freshnessOf 가
  //   'unknown' 을 낸다 — 「같다」로 뭉개지 않는다.
  for (const r of data ?? []) current.set(r.id, reviewDigest(r.payload, r.answer_key))
}

const t = tallyFreshReviews(reviews, current)

const byFreshness = { current: 0, stale: 0, unknown: 0 }
for (const r of reviews) byFreshness[freshnessOf(r, current)] += 1

console.log(`검수 행 ${reviews.length} · 문항 ${ids.length}`)
console.log('')
console.log('행 기준')
for (const k of ['current', 'stale', 'unknown']) {
  const label = { current: '지금 판', stale: '다른 판', unknown: '판 모름' }[k]
  const pct = ((byFreshness[k] / reviews.length) * 100).toFixed(1)
  console.log(`  ${label}  ${String(byFreshness[k]).padStart(5)}  ${pct.padStart(5)}%`)
}
console.log('')
console.log('문항 기준 — **조판을 통과시키는 것은 「지금 판 3인 pass」뿐이다**')
console.log(`  지금 판 3인 통과   ${t.passed}`)
console.log(`  지금 판 3인이 봄   ${t.settled}`)
console.log(`  다시 봐야 함       ${t.stale}`)
console.log(`  판 모름            ${t.unknown}`)

if (t.unknown > 0) {
  console.log('')
  console.log(`⚠️ 판을 모르는 문항 ${t.unknown}건은 2026-09-14 이전 판정이다.`)
  console.log('   「같다」가 아니라 「모른다」이므로 통과로도 차단으로도 세지 않는다 —')
  console.log('   그 문항들은 export 를 다시 돌려 새 청크로 받는다.')
}
