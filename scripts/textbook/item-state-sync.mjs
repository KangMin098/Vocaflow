// scripts/textbook/item-state-sync.mjs
//
// **문항 상태 곁 표를 채운다** — `csat_item_state`.
//
// ── 왜 필요한가 (실측 2026-09-23 · DD-69 B6) ────────────────────────
// `csat_dcp_items` 는 **880,337행인데 status 도 reason 도 없다.** 그래서 「이 문항이 쓸 수
// 있는가 · 왜 못 쓰는가」를 화면이 매번 다시 계산하고, 그 결과는 어디에도 안 남는다.
// 다음 세션은 그 계산을 처음부터 다시 한다.
//
// 이 스크립트는 **이미 있는 판정에서 상태를 파생한다** — 새로 판단하지 않는다:
//   · `csat_item_reviews` 에 `fail`/`revise` 가 남은 문항 → blocked(review_fail·review_revise)
//   · 그 문항들 중 판정이 전부 pass 로 바뀐 것          → 행을 지운다(막힘 해제)
//
// ⚠️ **해설 구멍은 여기서 안 센다.** `answer_key->>explanation_ko` 를 880,337행에서 훑는 것은
//   인덱스가 없어 분 단위다. ⑥ 해설 화면이 집계표(mv)로 칸 단위를 이미 보여 주므로, 문항
//   단위가 필요해지는 날 `--explain` 을 따로 연다. **지금 못 하는 것을 하는 척하지 않는다.**
//
// **재실행 안전.** 몇 번을 돌려도 같은 상태가 되고(upsert + 해제 삭제), 바꾼 수와
// **건너뛴 수를 출력한다.** `--commit` 없이는 아무것도 쓰지 않는다.
//
// 실행:
//   node --env-file=apps/web/.env.local scripts/textbook/item-state-sync.mjs            (예행)
//   node --env-file=apps/web/.env.local scripts/textbook/item-state-sync.mjs --commit

import { loadEnv } from './volume-pool.mjs'

loadEnv()

const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/** PostgREST 는 한 응답에 1,000행까지만 준다 — 끝까지 받는다. */
async function all(run, label) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await run(from, from + 999)
    if (error) {
      console.error(`${label} 조회 실패: ${error.message}`)
      process.exit(2)
    }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

// ── 1) 지금 막고 있는 판정 ──────────────────────────────────────────
// `unique (item_id, persona)` 라 한 문항의 한 페르소나에 행이 하나뿐이다 — 최신을 고를 것이 없다.
const reviews = await all(
  (from, to) =>
    db.from('csat_item_reviews').select('item_id, persona, verdict, findings').order('item_id').range(from, to),
  '문항 검수 판정',
)

const byItem = new Map()
for (const r of reviews) {
  const arr = byItem.get(r.item_id)
  if (arr) arr.push(r)
  else byItem.set(r.item_id, [r])
}

/** `findings` 첫 줄 — 사유 문장. 없으면 판정 이름으로 대신한다(빈 사유는 CHECK 가 막는다). */
function why(rs) {
  for (const r of rs) {
    const f = Array.isArray(r.findings) ? r.findings[0] : null
    if (typeof f === 'string' && f.trim()) return f.trim().slice(0, 300)
    if (f && typeof f === 'object') {
      for (const k of ['says', 'detail', 'message', 'note', 'what']) {
        if (typeof f[k] === 'string' && f[k].trim()) return f[k].trim().slice(0, 300)
      }
    }
  }
  const kinds = [...new Set(rs.map((r) => r.verdict))].join('·')
  return `3인 검수에서 ${kinds} 판정이 남아 있다 — 사유가 기록되지 않았다`
}

const want = new Map() // item_id → { status, reason_code, reason }
for (const [id, rs] of byItem) {
  const bad = rs.filter((r) => r.verdict !== 'pass')
  if (bad.length === 0) continue // 막는 것이 없다 — 행을 두지 않는다
  want.set(id, {
    item_id: id,
    status: 'blocked',
    // `fail` 이 하나라도 있으면 그쪽이 무겁다.
    reason_code: bad.some((r) => r.verdict === 'fail') ? 'review_fail' : 'review_revise',
    reason: why(bad),
  })
}

// ── 2) 지금 표에 있는 것 ────────────────────────────────────────────
const existing = await all(
  (from, to) =>
    db
      .from('csat_item_state')
      .select('item_id, status, reason_code, reason')
      .in('reason_code', ['review_fail', 'review_revise'])
      .order('item_id')
      .range(from, to),
  '문항 상태',
)
const have = new Map(existing.map((r) => [r.item_id, r]))

// ── 3) 무엇이 달라지나 ──────────────────────────────────────────────
const toUpsert = []
let same = 0
for (const [id, w] of want) {
  const h = have.get(id)
  // ⚠️ 같은지 비교할 때 **키 순서를 믿지 않는다** — 필드를 하나씩 본다.
  //   이 저장소는 `JSON.stringify` 로 jsonb 를 비교하다 전량 재적재를 두 번 낸 적이 있다.
  if (h && h.status === w.status && h.reason_code === w.reason_code && h.reason === w.reason) {
    same++
    continue
  }
  toUpsert.push(w)
}

// 판정이 전부 pass 로 바뀐 문항 — 막힘을 **해제**한다(행을 지운다).
const toClear = [...have.keys()].filter((id) => !want.has(id))

console.log(
  `검수 판정 ${reviews.length}행 · 문항 ${byItem.size} — 막힌 문항 ${want.size}\n` +
    `  새로/다시 쓸 것 ${toUpsert.length} · 이미 같아서 건너뜀 ${same} · 해제할 것 ${toClear.length}`,
)
for (const r of toUpsert.slice(0, 5)) {
  console.log(`  · ${r.item_id.slice(0, 8)} ${r.reason_code} — ${r.reason.slice(0, 70)}`)
}

if (!COMMIT) {
  console.log('\n--commit 없이는 아무것도 쓰지 않는다.')
  process.exit(0)
}

// ── 4) 적재 ─────────────────────────────────────────────────────────
for (let i = 0; i < toUpsert.length; i += 500) {
  const chunk = toUpsert.slice(i, i + 500)
  const { error } = await db.from('csat_item_state').upsert(chunk, { onConflict: 'item_id' })
  if (error) {
    console.error(`적재 실패(${i}~): ${error.message}`)
    process.exit(3)
  }
}
if (toClear.length) {
  for (let i = 0; i < toClear.length; i += 500) {
    const chunk = toClear.slice(i, i + 500)
    const { error } = await db.from('csat_item_state').delete().in('item_id', chunk)
    if (error) {
      console.error(`해제 실패(${i}~): ${error.message}`)
      process.exit(4)
    }
  }
}

console.log(`\n적재 ${toUpsert.length} · 해제 ${toClear.length} · 건너뜀 ${same}`)
console.log('이어서 다시 돌리면 「새로/다시 쓸 것 0」 이 찍혀야 한다 — 그것이 재실행 안전의 증거다.')
