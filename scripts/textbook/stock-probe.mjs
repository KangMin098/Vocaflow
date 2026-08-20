// scripts/textbook/stock-probe.mjs
//
// **검수 대기 글을 발행하면 교재 재고가 얼마나 느는지** 미리 잰다.
//
// 교재 풀은 `csat_stage_catalog` 에서 오는데 그 뷰가 `WHERE status='published'` 다.
// 즉 `ready` 162편은 사람이 발행해야 들어온다. 발행은 되돌리기 번거로우므로,
// **넣기 전에 얼마나 늘지 알고 결정한다.**
//
// 문항을 실제로 생성해 보되 **저장하지 않는다** — 같은 생성기(`generateDcpItems`)를
// 쓰므로 발행 후 값과 같다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/stock-probe.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { generateDcpItems, toCsatOrder, toCsatInsert, CSAT_ITEM_WORDS } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data, error } = await db
  .from('library_articles')
  .select('id, title, source, status, article_v_level, register, display_only, content')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
if (error) throw new Error('조회 실패: ' + error.message)

const rows = (data ?? []).filter((a) => (a.content ?? '').trim())

/** 문항 하나가 교재에 실릴 수 있는지 — 수능 규격 + 형식 변환 가능. */
function usable(it) {
  const body = it.type === 'order' ? it.payload.presented : it.payload.remaining
  const words = body.join(' ').split(/\s+/).filter(Boolean).length
  if (words < CSAT_ITEM_WORDS.min || words > CSAT_ITEM_WORDS.max) return false
  const csat =
    it.type === 'order'
      ? toCsatOrder(it.payload.presented, it.answer_key.source_order)
      : toCsatInsert(it.payload.remaining, it.payload.insert_sentence, it.answer_key.position)
  return csat !== null
}

const byStatusBand = new Map()
for (const a of rows) {
  // ND 는 본문을 실을 수 없다 — 발행해도 교재에 못 쓴다.
  if (a.display_only) continue
  const band = a.article_v_level
  if (band == null) continue
  const key = `${a.status}|${band}`
  if (!byStatusBand.has(key))
    byStatusBand.set(key, { status: a.status, band, 글: 0, order: 0, insert: 0, refs: new Set() })
  const bucket = byStatusBand.get(key)
  bucket.글++

  const items = generateDcpItems(a.content, a.id).filter(usable)
  const o = items.filter((i) => i.type === 'order').length
  const s = items.filter((i) => i.type === 'insert').length
  bucket.order += o
  bucket.insert += s
  if (s > 0) bucket.refs.add(a.id) // 삽입 원글 — 이게 단원 수의 병목이다
}

/** 단원 수 상한 — 단원마다 삽입 2개가 서로 다른 원글에서 와야 한다. */
const unitCap = (b) => Math.min(Math.floor(b.order / 2), Math.floor(b.insert / 2), Math.floor(b.refs.size / 2))

const rowsOut = [...byStatusBand.values()].sort((a, b) => a.band - b.band || a.status.localeCompare(b.status))
console.log(['상태'.padEnd(10), 'V', '글수', '순서', '삽입', '삽입원글', '단원상한'].join('  '))
for (const b of rowsOut) {
  console.log(
    [
      b.status.padEnd(10),
      String(b.band).padStart(2),
      String(b.글).padStart(4),
      String(b.order).padStart(4),
      String(b.insert).padStart(4),
      String(b.refs.size).padStart(8),
      String(unitCap(b)).padStart(8),
    ].join('  '),
  )
}

// 발행 전후 비교 — 이 표가 "발행할 값이 있는가" 에 답한다.
const sum = (pred) =>
  rowsOut.filter(pred).reduce(
    (acc, b) => {
      acc.order += b.order
      acc.insert += b.insert
      acc.units += unitCap(b)
      return acc
    },
    { order: 0, insert: 0, units: 0 },
  )
const now = sum((b) => b.status === 'published')
const after = sum(() => true)
console.log(`\n지금(published만)  순서 ${now.order} · 삽입 ${now.insert} · **단원 ${now.units}**`)
console.log(`ready 까지 발행하면 순서 ${after.order} · 삽입 ${after.insert} · **단원 ${after.units}**`)
console.log(`\n늘어나는 단원: ${after.units - now.units}`)
console.log('\n⚠ 밴드별로 따로 세는 이유 — 단원은 한 밴드 안에서만 조합된다(V5 교재에 V6 지문을 못 넣는다).')
