// scripts/compose/discover-sweep.mjs
//
// ACP §20 — **등록한 소스 전부에 피드 찾기를 돌려, 놓치고 있는 것을 센다.**
//
// 왜 필요한가 (2026-08-19):
//   피드 찾기에 조건 하나가 잘못 있어서(`알림이 하나도 없을 때만 안내 페이지를 본다`)
//   코리아헤럴드의 섹션 피드 8개 중 7개를 사흘 동안 못 보고 있었다. 고친 뒤 한 발행사만
//   확인했는데, **같은 결함은 발행사마다 똑같이 작용했을 것이다.** 한 곳씩 손으로 여는 대신
//   전부 돌려서 "등록된 것 대비 찾을 수 있는 것" 을 표로 낸다.
//
//   이건 일회성 점검이 아니다. 발행사는 피드를 새로 만들거나 옮긴다 — 주기적으로 돌리면
//   조용히 늘어난 섹션과 조용히 죽은 주소가 같이 드러난다.
//
// ⚠️ 발행사 서버에 실제 요청이 나간다(소스당 6~14회). 자주 돌리지 않는다.
//    CrawlGate 를 소스 사이에 공유해 호스트별 간격 규칙이 그대로 지켜지게 한다.
//
// 읽기 전용 — 등록하지 않는다. 등록은 register-feed.mjs 로 따로 한다(무엇을 왜 켰는지
//    남기기 위해서다).
//
// 실행: pnpm dlx tsx scripts/compose/discover-sweep.mjs [--source <키>]...

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { COMPOSE_USER_AGENT, CrawlGate, FACT_SOURCES, classifyTopic, discoverFeeds, isFeedCollectable } =
  await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const deps = {
  async fetchText(url, headers) {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 15_000)
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': COMPOSE_USER_AGENT, ...headers },
        signal: c.signal,
        redirect: 'follow',
      })
      return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
    } catch {
      return { ok: false, status: 0, text: '' }
    } finally {
      clearTimeout(t)
    }
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

/** 제목으로 적합률 — 새로 찾은 피드를 등록할지 정하려면 숫자가 있어야 한다. */
function fitness(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const titles = []
  for (const b of blocks) {
    const m = b.match(/<title(?:\s[^>]*)?>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i)
    const t = (m?.[1] ?? m?.[2] ?? '').trim()
    if (t) titles.push(t)
  }
  if (!titles.length) return null
  const fit = titles.filter((t) => classifyTopic(t) === 'fit').length
  const unfit = titles.filter((t) => classifyTopic(t) === 'unfit').length
  return { n: titles.length, fit: (100 * fit) / titles.length, unfit: (100 * unfit) / titles.length }
}

/** 피드에 실린 기사 주소 집합 — 같은 피드인지 판정하는 근거. */
function itemUrls(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const out = new Set()
  for (const b of blocks) {
    const m =
      b.match(/<link>\s*(?:<!\[CDATA\[)?([^<\]]+)/i) ?? b.match(/<link[^>]+href="([^"]+)"/i)
    if (m?.[1]) out.add(m[1].trim())
  }
  return out
}

/**
 * 이미 등록한 피드와 **같은 것**인가.
 *
 * ⚠️ 주소 문자열만 견주면 안 된다. 실측 2026-08-19: BBC 는 `feeds.bbci.co.uk/news/...` 로
 * 등록돼 있는데 발견은 `bbc.co.uk/news/...` 를 준다 — 주소는 다르고 내용은 같다. 그걸
 * "새로 보임" 이라고 보고하면 운영자가 **같은 기사를 두 번 걷는 피드**를 켜게 된다.
 * DW 는 한 술 더 떠 `/rdf/rss-en-all` 과 `/atom/rss-en-all` 로 **형식만 다른 같은 피드**를 준다.
 *
 * 그래서 두 가지로 본다: ① 경로가 같으면 같은 피드(호스트만 다른 배포용 주소),
 * ② 실린 기사 주소가 80% 넘게 겹치면 같은 피드(형식만 다른 경우).
 */
function sameFeed(candUrl, candItems, knownUrl, knownItems) {
  try {
    if (new URL(candUrl).pathname === new URL(knownUrl).pathname) return true
  } catch {
    /* 주소 형식이 이상하면 겹침으로만 본다 */
  }
  if (!candItems.size || !knownItems.size) return false
  let hit = 0
  for (const u of candItems) if (knownItems.has(u)) hit++
  return hit / Math.min(candItems.size, knownItems.size) >= 0.8
}

const wanted = process.argv.filter((_, i) => process.argv[i - 1] === '--source')
const { data: registered, error } = await db.from('article_compose_feeds').select('source_key, url, enabled')
if (error) throw new Error('피드 조회 실패: ' + error.message)
const known = new Map()
for (const r of registered ?? []) {
  if (!known.has(r.source_key)) known.set(r.source_key, new Map())
  known.get(r.source_key).set(r.url, r.enabled)
}

const keys = (wanted.length ? wanted : Object.keys(FACT_SOURCES))
  .filter((k) => FACT_SOURCES[k] && isFeedCollectable(FACT_SOURCES[k]))
  .sort()

// 게이트를 공유한다 — 소스마다 새로 만들면 같은 호스트에 간격 없이 연달아 묻게 된다.
const gate = new CrawlGate()
let totalRequests = 0
const found = []

for (const key of keys) {
  const spec = FACT_SOURCES[key]
  const r = await discoverFeeds(spec, gate, deps, { maxCandidates: 14 })
  totalRequests += r.requests
  const mine = known.get(key) ?? new Map()
  const candidates = r.feeds.filter((f) => !mine.has(f.url))

  // 등록된 피드의 내용을 먼저 읽어 둔다 — 같은 피드인지 판정하려면 실린 기사를 봐야 한다.
  const knownItems = new Map()
  if (candidates.length) {
    for (const u of mine.keys()) {
      knownItems.set(u, itemUrls((await deps.fetchText(u, {})).text))
      totalRequests++
    }
  }

  const fresh = []
  let dupes = 0
  for (const f of candidates) {
    const xml = (await deps.fetchText(f.url, {})).text
    totalRequests++
    const items = itemUrls(xml)
    const dup = [...knownItems.entries()].find(([u, it]) => sameFeed(f.url, items, u, it))
    if (dup) {
      dupes++
      continue
    }
    fresh.push({ feed: f, fit: fitness(xml) })
    knownItems.set(f.url, items) // 새로 찾은 것끼리도 중복이면 한 번만 센다
  }

  console.log(
    `\n■ ${key.padEnd(15)} 등록 ${String(mine.size).padStart(2)} · 찾음 ${String(r.feeds.length).padStart(2)} · 새로 보임 ${fresh.length}${dupes ? ` (같은 피드 ${dupes} 제외)` : ''} · 요청 ${r.requests}`,
  )
  for (const { feed: f, fit } of fresh) {
    const tag = fit ? `적합 ${fit.fit.toFixed(0)}% · 부적합 ${fit.unfit.toFixed(0)}% · ${fit.n}건` : '항목 없음'
    console.log(`     + ${f.url}`)
    console.log(`       ${tag}`)
    found.push({ key, url: f.url, ...(fit ?? {}) })
  }
  if (!r.feeds.length) {
    for (const s of r.skipped.slice(0, 3)) console.log(`     · ${s.url} — ${s.reason}`)
  }
}

console.log(`\n총 요청 ${totalRequests} · 새로 보이는 피드 ${found.length}`)

// 등록할 만한 것 — 세 조건을 모두 넘어야 한다.
//   ① 적합 10% 이상 — `feed-fitness.mjs` 가 "학습 지문을 거의 물어오지 못한다" 고 보는 선과
//      **같은 값**을 쓴다. 스크립트마다 다른 선을 쓰면 한쪽은 죽었다 하고 한쪽은 권하게 된다.
//   ② 적합 > 부적합 — 부적합이 더 많으면 걷어 봐야 걸러내는 일만 는다.
//   ③ 부적합 20% 미만 — 등록한 한국 섹션들이 0~6% 였고, 뺀 것들(코리아타임스 world ·
//      코리아헤럴드 World)이 58~62% 였다. 그 사이를 넓게 비워 둔다.
const FIT_FLOOR = 10
const worth = found.filter((f) => f.n && f.fit >= FIT_FLOOR && f.fit > f.unfit && f.unfit < 20)
console.log(`\n■ 등록을 검토할 만한 것 ${worth.length}`)
for (const f of worth.sort((a, b) => b.fit - a.fit)) {
  console.log(`  ${f.key.padEnd(15)} 적합 ${f.fit.toFixed(1).padStart(5)}% · 부적합 ${f.unfit.toFixed(1).padStart(5)}%  ${f.url}`)
}
console.log('\n등록은 register-feed.mjs 로 한 건씩 한다 — 무엇을 왜 켰는지 남기기 위해서다.')
