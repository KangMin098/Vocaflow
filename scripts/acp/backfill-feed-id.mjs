// scripts/acp/backfill-feed-id.mjs
//
// **`feed_id` 가 NULL 인 글을 피드 목록과 대조해 되찾는다.**
//
// ── 왜 (실측 2026-08-20) ─────────────────────────────────────────────
// `collect-daily.mjs` 가 삽입 시 `feed_id` 를 빠뜨렸다. 결과가 둘이다:
//
//   ① `resolveArticleRegister(source, feed_id)` 가 피드별 register 를 못 찾고 소스
//      기본값으로 떨어진다 — VOA 의 `lets-learn-english`(narrative)와
//      `words-and-their-stories`(expository)가 전부 `news` 가 된다.
//   ② 피드별로 무엇이 들어왔는지 셀 수 없다. 어느 섹션을 켤지 정하는 근거가 사라진다.
//
// 되찾는 방법은 하나뿐이다 — **피드를 다시 열어 주소를 대조한다.** 주소는 삽입 때
// 저장했으므로 대조가 성립한다. 피드에서 이미 밀려난 오래된 글은 못 찾는데, 그건
// 정직하게 남겨 둔다(짐작으로 채우면 register 가 조용히 틀린다).
//
// ⚠️ register 는 `feed_id` 에서 나오므로, 채운 뒤 **함께 갱신**한다. 안 그러면
//   feed_id 만 맞고 register 는 여전히 소스 기본값이다.
//
// 재실행 안전: NULL 인 것만 건드린다. 이미 값이 있으면 손대지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/backfill-feed-id.mjs            # 몇 편을 되찾을 수 있는지만
//   pnpm dlx tsx scripts/acp/backfill-feed-id.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// `collect-daily.mjs` 와 **같은 피드 정의**를 쓴다 — 따로 적으면 한쪽만 고쳐진다.
const FEEDS = [
  ...lib.VOA_FEEDS.map((f) => ({ source: 'voa', id: f.id, run: () => lib.listVoaFeed(f.url, f.id) })),
  ...lib.NASA_FEEDS.map((f) => ({ source: 'nasa', id: f.id, run: () => lib.listNasaFeed(f.url, f.id) })),
  ...lib.THE_CONVERSATION_FEEDS.map((f) => ({
    source: 'the_conversation',
    id: f.id,
    run: () => lib.listTheConversationFeed(f.url, f.id),
  })),
  ...lib.SIMPLE_WIKIPEDIA_FEEDS.map((f) => ({
    source: 'simple_wikipedia',
    id: f.id,
    run: () => lib.listSimpleWikipediaFeed(f.category, f.id),
  })),
  ...lib.USGS_FEEDS.map((f) => ({ source: 'usgs', id: f.id, run: () => lib.listUsgsFeed(f.id) })),
  ...lib.NOAA_FEEDS.map((f) => ({ source: 'noaa', id: f.id, run: () => lib.listNoaaFeed(f.id) })),
]

const { data: rows, error } = await db
  .from('library_articles')
  .select('id, source, source_url, feed_id')
  .is('feed_id', null)
  .is('compose_batch_id', null)
  .not('source_url', 'is', null)
if (error) throw new Error('조회 실패: ' + error.message)

const missing = rows ?? []
const bySource = {}
for (const r of missing) bySource[r.source] = (bySource[r.source] ?? 0) + 1
console.log(`feed_id 가 없는 글 ${missing.length}편`)
for (const [s, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  · ${String(s).padEnd(20)} ${n}`)
}
if (!missing.length) process.exit(0)

const byUrl = new Map(missing.map((r) => [r.source_url, r]))
const found = new Map() // article id → feed id
console.log('\n피드를 다시 열어 주소를 대조한다:')

for (const f of FEEDS) {
  let items = []
  try {
    items = await f.run()
  } catch (e) {
    console.log(`  ✗ ${f.source}/${f.id} — 목록 실패: ${e instanceof Error ? e.message : e}`)
    continue
  }
  let hit = 0
  for (const it of items) {
    const row = byUrl.get(it.url)
    // 같은 주소가 여러 피드에 있으면 **먼저 만난 것을 지킨다** — 덮어쓰면 실행할 때마다
    //   결과가 달라져 register 가 흔들린다.
    if (row && row.source === f.source && !found.has(row.id)) {
      found.set(row.id, f.id)
      hit++
    }
  }
  if (hit > 0) console.log(`  + ${f.source}/${String(f.id).padEnd(24)} ${hit}편`)
}

console.log(`\n되찾을 수 있는 것 ${found.size} / ${missing.length}`)
const lost = missing.length - found.size
if (lost > 0) {
  console.log(`못 찾은 ${lost}편은 피드에서 이미 밀려난 글이다 — 짐작으로 채우지 않는다.`)
}
if (!commit) {
  console.log('\n--commit 을 붙이면 채운다 (register 도 함께 갱신).')
  process.exit(0)
}

let saved = 0
for (const [id, feedId] of found) {
  const row = missing.find((r) => r.id === id)
  const { error: e } = await db
    .from('library_articles')
    .update({
      feed_id: feedId,
      // register 는 feed_id 에서 나온다 — 같이 갱신하지 않으면 반쪽만 고쳐진다.
      register: lib.resolveArticleRegister(row.source, feedId),
    })
    .eq('id', id)
  if (e) console.log(`  ✗ ${id}: ${e.message}`)
  else saved++
}
console.log(`채운 글 ${saved}`)
