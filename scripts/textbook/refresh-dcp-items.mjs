// scripts/textbook/refresh-dcp-items.mjs
//
// **문항 생성 규칙이 바뀌었을 때 빠진 문항만 채운다.**
//
// ── 왜 "덮어쓰기" 가 아니라 "채우기" 인가 ────────────────────────────
// `csat_dcp_items` 는 유일키가 `(kind, ref_id, type, paragraph_idx)` 다.
// 즉 **없는 것만 넣으면** 기존 문항의 id 가 그대로 남는다. 지우고 다시 만들면
// id 가 바뀌어 학습 기록이 끊어진다(`csat_item_attempts` 는 지금 0행이지만,
// 그건 오늘의 사정일 뿐 규칙으로 삼을 것이 아니다).
//
// ⚠️ book 은 건드리지 않는다 — 이 변경은 기사 쪽 규칙(삽입 문단 상한)에서 왔다.
//
// 재실행 안전: 같은 문항은 유일키가 막는다. 몇 번 돌려도 결과가 같다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/refresh-dcp-items.mjs            # 몇 개 늘지만 본다
//   pnpm dlx tsx scripts/textbook/refresh-dcp-items.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { generateDcpItems } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, article_v_level, display_only, content, status')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
if (error) throw new Error('기사 조회 실패: ' + error.message)

// 이미 있는 조합 — 나눠 받는다(1,000행 제한에 조용히 잘린 적이 있다).
const existing = new Set()
const ids = (arts ?? []).map((a) => a.id)
for (let i = 0; i < ids.length; i += 20) {
  const { data } = await db
    .from('csat_dcp_items')
    .select('ref_id, type, paragraph_idx')
    .eq('kind', 'article')
    .in('ref_id', ids.slice(i, i + 20))
    .limit(20000)
  for (const r of data ?? []) existing.add(`${r.ref_id}|${r.type}|${r.paragraph_idx}`)
}

const rows = []
let skipped = 0
for (const a of arts ?? []) {
  // ND 는 본문을 실을 수 없다 — 문항도 만들지 않는다.
  if (a.display_only) continue
  for (const it of generateDcpItems(a.content, a.id)) {
    const key = `${a.id}|${it.type}|${it.paragraph_idx}`
    if (existing.has(key)) {
      skipped++
      continue
    }
    rows.push({
      kind: 'article',
      ref_id: a.id,
      type: it.type,
      item_role: 'practice',
      payload: it.payload,
      answer_key: it.answer_key,
      paragraph_idx: it.paragraph_idx,
      v_level: a.article_v_level,
    })
  }
}

const byType = { order: 0, insert: 0 }
for (const r of rows) byType[r.type]++
console.log(`대상 기사 ${(arts ?? []).length}편 · 이미 있는 문항 ${skipped}`)
console.log(`**새로 넣을 문항 ${rows.length}** (순서 ${byType.order} · 삽입 ${byType.insert})`)

if (!commit) {
  console.log('\n--commit 을 붙이면 넣는다. 기존 문항은 유일키가 지킨다(덮어쓰지 않는다).')
  process.exit(0)
}
if (!rows.length) process.exit(0)

let saved = 0
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200)
  const { error: e } = await db
    .from('csat_dcp_items')
    .upsert(batch, { onConflict: 'kind,ref_id,type,paragraph_idx', ignoreDuplicates: true })
  if (e) {
    console.log(`  ✗ ${i}~${i + batch.length}: ${e.message}`)
    continue
  }
  saved += batch.length
}
console.log(`넣은 문항 ${saved}`)
console.log('\n교재 풀에 반영되려면 그 글이 published 여야 한다(csat_stage_catalog 조건).')
