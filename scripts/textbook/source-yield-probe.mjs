// scripts/textbook/source-yield-probe.mjs
//
// **교재 지문이 될 수 있는 글이 소스 GET 으로 몇 편 나오는가** — 소스별·유형별 실측.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 교재 문항은 `csat_stage_catalog`(= 발행된 `library_articles`) 에서만 나온다.
// 즉 교재 재고의 상한은 **지문 재고**이고, 지문 재고의 상한은 **소스 GET 수확량**이다.
// 그런데 이 저장소는 지금까지 "피드가 배선돼 있다" 만 알고
// **한 번 GET 하면 몇 편이 실제로 손에 들어오는지** 를 잰 적이 없다.
//
// 짐작하면 두 방향으로 틀린다:
//   과대 — 피드에 100건 있어도 큐레이션 spec 이 걸러 내고 maxItems 가 자른다.
//   과소 — 이미 가진 것을 빼야 "새로" 얻는 양이 나온다.
//
// 그래서 **관리자 화면이 부르는 바로 그 함수**(list*Feed)를 그대로 부른다.
// 화면과 다른 경로로 재면 화면에서 안 나오는 숫자를 재게 된다.
//
// ⚠️ 이 숫자는 "지문 후보" 이지 "교재 문항" 이 아니다. 후보 → 발행 → 문항 사이에
//   게이트가 더 있다(어수 규격·license_class·display_only). 그 감쇠는 stock-probe 소관.
//
// 재실행 안전: 읽기만 한다. DB 에 쓰지 않고 외부에는 GET 만 한다.
//   관리자 화면과 달리 seed_catalog upsert 를 **하지 않는다** — 계측이 재고를 바꾸면 안 된다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/source-yield-probe.mjs
//   pnpm dlx tsx scripts/textbook/source-yield-probe.mjs --source voa
//   pnpm dlx tsx scripts/textbook/source-yield-probe.mjs --out <경로.json>

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
const onlySource = arg('source')
const outPath = arg('out')

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')
// 배럴에 없어 소스에서 직접 가져온다. 맨 fetch 로 MediaWiki 를 두드리면
// User-Agent 가 없어 429 가 돌아온다 (실측 2026-08-21).
const { fetchWithTimeout } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

const {
  VOA_FEEDS, listVoaFeed,
  NASA_FEEDS, listNasaFeed,
  NIH_FEEDS, listNihFeed,
  WIKINEWS_FEEDS, listWikinewsFeed,
  THE_CONVERSATION_FEEDS, listTheConversationFeed,
  OWID_FEEDS, listOwidFeed,
  SIMPLE_WIKIPEDIA_FEEDS, listSimpleWikipediaFeed,
  WIKIPEDIA_FEEDS, listWikipediaFeed,
  WIKIVOYAGE_FEEDS, listWikivoyageFeed,
  USGS_FEEDS, listUsgsFeed,
  NOAA_FEEDS, listNoaaFeed,
  FACTBOOK_COUNTRIES, listFactbookFeed,
  listElifeFeed,
  listPlosFeed,
  FUTURITY_FEEDS,
  listFuturityFeed,
  PLOS_FEEDS,
  resolveArticleRegister,
} = lib

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// ── 이미 가진 것 — 새로 얻는 양을 세려면 빼야 한다 ──────────────────
const { data: haveRows, error: haveErr } = await db
  .from('library_articles')
  .select('source_id')
  .not('source_id', 'is', null)
if (haveErr) throw new Error('보유 지문 조회 실패: ' + haveErr.message)
const HAVE = new Set((haveRows ?? []).map((r) => r.source_id))

/** 피드 하나 = 계측 단위. `run()` 은 관리자 화면이 부르는 함수를 그대로 부른다. */
const TARGETS = []
const add = (source, feedId, label, run, probeUrl = null) =>
  TARGETS.push({ source, feedId, label, run, probeUrl })

for (const f of VOA_FEEDS) add('voa', f.id, f.label, () => listVoaFeed(f.url, f.id), f.url)
for (const f of NASA_FEEDS) add('nasa', f.id, f.label, () => listNasaFeed(f.url, f.id), f.url)
for (const f of NIH_FEEDS) add('nih', f.id, f.label, () => listNihFeed(f.url, f.id), f.url)
for (const f of WIKINEWS_FEEDS) add('wikinews', f.id, f.label, () => listWikinewsFeed(f.url, f.id), f.url)
for (const f of THE_CONVERSATION_FEEDS)
  add('the_conversation', f.id, f.label, () => listTheConversationFeed(f.url, f.id), f.url)
for (const f of OWID_FEEDS) add('owid', f.id, f.label, () => listOwidFeed(f.url, f.id), f.url)
for (const f of SIMPLE_WIKIPEDIA_FEEDS)
  add('simple_wikipedia', f.id, f.label, () => listSimpleWikipediaFeed(f.category, f.id))
for (const f of WIKIPEDIA_FEEDS)
  add('wikipedia', f.id, f.label, () => listWikipediaFeed(f.category, f.id))
for (const f of WIKIVOYAGE_FEEDS)
  add('wikivoyage', f.id, f.label, () => listWikivoyageFeed(f.category, f.id))
for (const f of USGS_FEEDS) add('usgs', f.id, f.label, () => listUsgsFeed(f.id))
for (const f of NOAA_FEEDS) add('noaa', f.id, f.label, () => listNoaaFeed(f.id))
// Futurity — 2026-08-21 배선. CC BY 4.0 대학 연구 기사.
for (const f of FUTURITY_FEEDS)
  add('futurity', f.id, f.label, () => listFuturityFeed(f.url, f.id), f.url)
// 목록이 코드 안에 있는 소스 — 네트워크 없이 즉답이지만 GET 대상인 것은 같다.
add('factbook', 'all', `국가 개요 ${FACTBOOK_COUNTRIES.length}개국`, async () => listFactbookFeed())
// 질의형 소스 — 피드가 아니라 검색이다. 상류 총량은 아래에서 따로 잰다.
add('elife', 'recent', 'eLife digest (최신)', () => listElifeFeed(20))
for (const f of PLOS_FEEDS) add('plos', f.id, f.label, () => listPlosFeed(f.id, 20))

const targets = onlySource ? TARGETS.filter((t) => t.source === onlySource) : TARGETS

console.log(`소스 GET 수확량 실측 — 피드 ${targets.length}개 · 보유 지문 ${HAVE.size}편\n`)

const results = []
for (const t of targets) {
  const started = Date.now()
  let items = null
  let error = null
  try {
    items = await t.run()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const ms = Date.now() - started

  const list = items ?? []
  const fresh = list.filter((i) => !HAVE.has(i.source_id))

  // 0건일 때 원인을 가른다 — 피드가 빈 것과 spec 이 다 거른 것은 대응이 다르다.
  //   원본 0건  → 피드가 죽었다. 목록에서 빼거나 주소를 고친다.
  //   원본 >0   → 큐레이션 spec 이 전부 거절했다. 임계값을 다시 본다.
  let raw = null
  if (t.probeUrl && (error || list.length === 0)) {
    try {
      const res = await fetchWithTimeout(t.probeUrl)
      const body = await res.text()
      raw = { status: res.status, items: (body.match(/<(item|entry)[\s>]/g) ?? []).length }
    } catch (e) {
      raw = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const row = {
    source: t.source,
    feed_id: t.feedId,
    label: t.label,
    register: resolveArticleRegister(t.source, t.feedId),
    ok: error === null,
    error,
    got: list.length,
    fresh: fresh.length,
    dup: list.length - fresh.length,
    raw,
    ms,
  }
  results.push(row)
  const mark = error ? '✗' : fresh.length === 0 ? '·' : '✓'
  console.log(
    `${mark} ${t.source}:${t.feedId}`.padEnd(46) +
      (error
        ? `실패 — ${error}`
        : `${list.length}건 (신규 ${fresh.length} · 보유 ${row.dup}) ${ms}ms`) +
      (raw ? `  [원본 ${raw.error ? raw.error : `${raw.items}건/HTTP ${raw.status}`}]` : ''),
  )
}

// ── 상류 총량 — 질의형 소스는 "이번 GET" 이 아니라 "얼마나 남았나" 가 중요하다 ──
const upstream = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const probeUpstream = async (source, label, url, pick, accept) => {
  try {
    const res = await fetchWithTimeout(url, { accept: accept ?? 'application/json' })
    if (!res.ok) throw new Error(String(res.status))
    upstream.push({ source, label, total: pick(JSON.parse(await res.text())) })
  } catch (e) {
    upstream.push({ source, label, total: null, error: e instanceof Error ? e.message : String(e) })
  }
}

console.log('\n상류 총량 (질의형 소스 — 소진까지 남은 양):')
await probeUpstream(
  'plos',
  'PLOS 전체 (CC-BY 논문)',
  'https://api.plos.org/search?q=*:*&rows=0&wt=json',
  (j) => j?.response?.numFound ?? null,
)
await probeUpstream(
  'elife',
  'eLife 전체 (digest 보유는 부분집합)',
  'https://api.elifesciences.org/articles?per-page=1',
  (j) => j?.total ?? null,
  'application/vnd.elife.article-list+json; version=1',
)
for (const [src, api, feeds] of [
  ['simple_wikipedia', 'https://simple.wikipedia.org/w/api.php', SIMPLE_WIKIPEDIA_FEEDS],
  ['wikipedia', 'https://en.wikipedia.org/w/api.php', WIKIPEDIA_FEEDS],
  ['wikivoyage', 'https://en.wikivoyage.org/w/api.php', WIKIVOYAGE_FEEDS],
]) {
  for (const f of feeds) {
    await sleep(1500) // MediaWiki 연속 질의 429 회피 (실측)
    await probeUpstream(
      src,
      `${f.label} (${f.category})`,
      `${api}?action=query&prop=categoryinfo&titles=${encodeURIComponent(f.category)}&format=json`,
      (j) => {
        const pages = j?.query?.pages ?? {}
        const p = Object.values(pages)[0]
        return p?.categoryinfo?.pages ?? null
      },
    )
  }
}
upstream.push({
  source: 'factbook',
  label: '국가 개요 (코드에 고정)',
  total: FACTBOOK_COUNTRIES.length,
})
for (const u of upstream) {
  console.log(
    `  ${u.source}`.padEnd(22) +
      `${u.label}`.padEnd(52) +
      (u.total == null ? `? (${u.error})` : `${u.total.toLocaleString()}편`),
  )
}

const payload = { measured_at: new Date().toISOString(), have: HAVE.size, feeds: results, upstream }
const dest = outPath ?? 'scripts/textbook/source-yield.json'
fs.writeFileSync(dest, JSON.stringify(payload, null, 2))
console.log(`\n→ ${dest}`)
