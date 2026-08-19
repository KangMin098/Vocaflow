// scripts/acp/collect-daily.mjs
//
// ACP(PD 본문 수집) — **매일 돌리기 위한 헤드리스 경로.**
//
// ── 왜 만들었나 (실측 2026-08-19) ─────────────────────────────────────
// ACP 는 **2026-07-11 이후 39일 동안 한 편도 걷지 않았다.** 고장이 아니었다 — 수집 경로가
// 전부 HTTP 라우트(`/api/acp/enqueue` 는 admin 쿠키 필요, `dev-enqueue` 는 프로덕션 차단)라
// **사람이 브라우저를 열어야만 돌았고, 아무도 안 열었다.**
//
// 이게 왜 중요한가: 두 파이프라인의 병목이 완전히 다르다.
//
//   ACP(PD)      본문을 그대로 발행한다 → 48시간 보류 없음 · 독립 2계통 불필요 · 재저작
//                게이트 6종 불필요. **법적 병목이 없다.** 지금까지 165편을 발행했다.
//   Compose(비PD) 사실만 뽑아 새로 쓴다 → 48시간 + 2계통 + 게이트 6종. 6편, 발행 0.
//
// 즉 "병목을 없애라" 의 답은 **병목이 없는 쪽을 돌리는 것**인데, 그쪽이 멈춰 있었다.
// Compose 에서 같은 처방을 이미 썼다(드레인 5단계에 헤드리스 경로 신설).
//
// ⚠️ 발행사/기관 서버에 실제 요청이 나간다. 하루 1회면 충분하다.
// ⚠️ 기본은 **읽기 전용** — 무엇이 밀려 있는지만 센다. `--commit` 이 있어야 담는다.
// 재실행 안전: 이미 있는 주소(source_url)는 건너뛴다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/collect-daily.mjs                 # 밀린 양만 센다
//   pnpm dlx tsx scripts/acp/collect-daily.mjs --commit        # 담는다
//   … [--source voa] [--limit 5]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const onlySource = arg('source')
const PER_SOURCE = Number(arg('limit') ?? 6)

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/**
 * 소스별 목록·본문 함수.
 *
 * ⚠️ 여기 적힌 것은 **PD/CC 공급원(supply 역할)만**이다. 상업 뉴스는 이 경로로 오면 안 된다 —
 *   본문을 그대로 발행하는 경로이기 때문이다. 그 경계는 `rolesOf` 가 코드로 지키고 있고,
 *   이 목록은 그 경계 안쪽만 담는다.
 */
const SOURCES = [
  { key: 'voa', list: () => lib.listVoaFeed(lib.VOA_FEEDS[0].url, lib.VOA_FEEDS[0].id), ingest: (u) => lib.ingestVoaArticle(u) },
  { key: 'nasa', list: () => lib.listNasaFeed(lib.NASA_FEEDS[0].url, lib.NASA_FEEDS[0].id), ingest: (u) => lib.ingestNasaArticle(u) },
  { key: 'nih', list: () => lib.listNihFeed(lib.NIH_FEEDS[0].url, lib.NIH_FEEDS[0].id), ingest: (u) => lib.ingestNihArticle(u) },
  { key: 'simple_wikipedia', list: () => lib.listSimpleWikipediaFeed(), ingest: (u) => lib.ingestSimpleWikipediaArticle(u) },
  {
    key: 'the_conversation',
    list: () => lib.listTheConversationFeed(lib.THE_CONVERSATION_FEEDS[0].url, lib.THE_CONVERSATION_FEEDS[0].id),
    ingest: (u) => lib.ingestTheConversationArticle(u),
  },
  {
    key: 'wikinews',
    list: () => lib.listWikinewsFeed(lib.WIKINEWS_FEEDS[0].url, lib.WIKINEWS_FEEDS[0].id),
    ingest: (u) => lib.ingestWikinewsArticle(u),
  },
  { key: 'owid', list: () => lib.listOwidFeed(), ingest: (u) => lib.ingestOwidArticle(u) },
  { key: 'elife', list: () => lib.listElifeFeed(), ingest: (u) => lib.ingestElifeArticle(u) },
  { key: 'plos', list: () => lib.listPlosFeed(), ingest: (u) => lib.ingestPlosArticle(u) },
  { key: 'usgs', list: () => lib.listUsgsFeed(), ingest: (u) => lib.ingestUsgsArticle(u) },
  { key: 'noaa', list: () => lib.listNoaaFeed(), ingest: (u) => lib.ingestNoaaArticle(u) },
  { key: 'wikivoyage', list: () => lib.listWikivoyageFeed(), ingest: (u) => lib.ingestWikivoyageArticle(u) },
]

const targets = onlySource ? SOURCES.filter((s) => s.key === onlySource) : SOURCES
if (!targets.length) {
  console.error(`알 수 없는 소스: ${onlySource}\n쓸 수 있는 것: ${SOURCES.map((s) => s.key).join(' · ')}`)
  process.exit(2)
}

// 이미 담긴 주소 — 재실행해도 늘지 않게 한다.
const { data: existing } = await db
  .from('library_articles')
  .select('source_url')
  .not('source_url', 'is', null)
const have = new Set((existing ?? []).map((r) => r.source_url))

console.log(`ACP 수집 ${commit ? '' : '(읽기 전용 — --commit 을 붙이면 담는다)'}\n`)

let totalNew = 0
let saved = 0
const failures = []

for (const s of targets) {
  let items = []
  try {
    items = await s.list()
  } catch (e) {
    failures.push(`${s.key}: 목록 실패 — ${e instanceof Error ? e.message : String(e)}`)
    console.log(`  ✗ ${s.key.padEnd(18)} 목록을 못 가져왔다`)
    continue
  }
  const fresh = items.filter((i) => i.url && !have.has(i.url))
  totalNew += fresh.length
  console.log(`  ${fresh.length > 0 ? '+' : '·'} ${s.key.padEnd(18)} 목록 ${String(items.length).padStart(3)} · 새 것 ${fresh.length}`)

  if (!commit) continue

  for (const item of fresh.slice(0, PER_SOURCE)) {
    try {
      const article = await s.ingest(item.url)

      // ⚠️ `admin_enqueue_article` RPC 를 쓰지 않는다. 그 함수는 첫 줄에서
      //   `is_admin_or_curator()` 를 확인하는데, 그건 **사용자 경로를 지키는 검사**이고
      //   service-role 키에는 `auth.uid()` 가 없어 언제나 거절된다(실측: 21건 전부 Forbidden).
      //   RPC 가 하는 일은 `(source, source_id)` 중복 확인 후 `queued` 로 넣는 것뿐이라
      //   같은 의미를 여기서 수행한다 — 마이그레이션 없이. 중복 판정 기준을 RPC 와 똑같이
      //   맞추는 것이 중요하다(주소가 아니라 source+source_id 다).
      const { data: dup } = await db
        .from('library_articles')
        .select('id')
        .eq('source', article.source)
        .eq('source_id', article.source_id)
        .maybeSingle()
      if (dup) {
        have.add(item.url)
        continue
      }
      const { error } = await db.from('library_articles').insert({
        source: article.source,
        source_id: article.source_id,
        title: article.title,
        author: article.author ?? null,
        source_url: article.source_url,
        // Invalid Date 방어 — NaN 이면 toISOString() 이 throw 한다.
        published_at:
          article.published_at && !Number.isNaN(article.published_at.getTime())
            ? article.published_at.toISOString()
            : null,
        license: article.license,
        content: article.content ?? '',
        audio_url: article.audio_url ?? null,
        status: 'queued',
      })
      if (error) failures.push(`${s.key} ${item.url}: ${error.message}`)
      else {
        saved++
        have.add(item.url)
      }
    } catch (e) {
      failures.push(`${s.key} ${item.url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

console.log(`\n밀려 있는 새 글 ${totalNew}${commit ? ` · 담은 것 ${saved} (소스당 최대 ${PER_SOURCE})` : ''}`)
if (failures.length) {
  console.log(`\n실패 ${failures.length}:`)
  for (const f of failures.slice(0, 12)) console.log(`  · ${f}`)
}
if (!commit && totalNew > 0) {
  console.log('\n이 경로에는 48시간 보류도 독립 2계통도 없다 — 담으면 바로 검수·발행으로 간다.')
}
