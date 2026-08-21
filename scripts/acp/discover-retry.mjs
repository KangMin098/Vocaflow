// scripts/acp/discover-retry.mjs
//
// **홈페이지가 피드를 안 알리는 발행사를, 짐작하지 않고 한 번 더 찾는다.**
//
// ── 왜 (실측 2026-08-21) ─────────────────────────────────────────────
// `candidate-probe.mjs` 의 discover 가 8곳에서 실패했다. 실패 이유는 하나다 —
// 홈 HTML 에 `<link rel="alternate" type="application/rss+xml">` 이 없다.
// 그렇다고 `/feed/` `/rss` 를 넣어 보면 그건 짐작이고, 이 저장소는 그러다
// **11개 중 9개가 404** 였던 일이 세 번 있다.
//
// 그래서 **발행사가 스스로 공개한 색인**만 쓴다:
//   ① robots.txt 의 `Sitemap:` 줄 — 표준이고, 발행사가 직접 적은 것이다
//   ② sitemap 안의 `<url>` 중 피드로 보이는 것
//   ③ WordPress REST (`/wp-json`) — 홈 HTML 이 `link rel="https://api.w.org/"` 로
//      **스스로 알린 경우에만** 따라간다. 없으면 시도하지 않는다.
//
// ③ 이 짐작이 아닌 이유: 주소를 우리가 지어내는 게 아니라 문서에 적힌 것을 따라간다.
// 셋 다 없으면 `unknown` 으로 남긴다 — **없다고 단정하지 않는다.** 사람이 사이트를
// 열어 확인할 몫이고, 그때까지 배선하지 않는다.
//
// ⚠️ UA 위장 금지 — 403/429 는 `blocked` 로 남기고 끝낸다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행: pnpm dlx tsx scripts/acp/discover-retry.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { parseRssFeed } = await import('@vocaflow/library-pipeline')
const { fetchWithTimeout } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

/** candidate-probe 에서 discover 가 실패한 8곳. `why` 는 그래도 다시 보는 이유. */
const TARGETS = [
  ['worldbank-blogs', 'https://blogs.worldbank.org/', '논증문 후보 — 다만 홈에 All rights reserved'],
  ['unesco-courier', 'https://courier.unesco.org/en', '논증문 후보 (CC BY-SA IGO 주장)'],
  ['nasa-spaceplace', 'https://spaceplace.nasa.gov/', '초등 저레벨 PD 후보'],
  ['ck12', 'https://www.ck12.org/', '중고교 교재 — CC BY-NC 라 어차피 restricted'],
  ['cdc', 'https://www.cdc.gov/', 'nih 대체 PD 후보'],
  ['nps', 'https://www.nps.gov/', 'PD 자연·역사 서사 후보'],
  ['openstax', 'https://openstax.org/', '저장소에 ingestFromPressbooks 경로가 이미 있다'],
  ['eurekalert', 'https://www.eurekalert.org/', '대학 보도자료 허브 — 라이선스 미확인'],
]

const get = async (url, accept) => {
  const res = await fetchWithTimeout(url, { accept, timeoutMs: 25_000 })
  return { status: res.status, body: await res.text(), url: res.url }
}

/** robots.txt 가 스스로 적어 둔 sitemap 주소들. */
async function sitemapsFromRobots(origin) {
  try {
    const { status, body } = await get(new URL('/robots.txt', origin).toString(), 'text/plain')
    if (status >= 400) return { maps: [], note: `robots.txt HTTP ${status}` }
    const maps = [...body.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1])
    return { maps, note: maps.length ? null : 'robots.txt 에 Sitemap 줄 없음' }
  } catch (e) {
    return { maps: [], note: `robots.txt 실패: ${e instanceof Error ? e.message : e}` }
  }
}

/** sitemap(또는 sitemap index) 안에서 피드처럼 보이는 주소를 고른다. */
async function feedsFromSitemap(url, depth = 0) {
  if (depth > 1) return []
  try {
    const { status, body } = await get(url, 'application/xml')
    if (status >= 400) return []
    const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
    const feedish = locs.filter((u) => /(\/feed\/?$|\.rss$|\.atom$|rss\.xml$|atom\.xml$)/i.test(u))
    if (feedish.length) return feedish.slice(0, 4)
    // sitemap index 면 한 단계만 더 내려간다 — 전량 순회는 발행사에 부담이다.
    const nested = locs.filter((u) => /sitemap.*\.xml/i.test(u)).slice(0, 2)
    const out = []
    for (const n of nested) out.push(...(await feedsFromSitemap(n, depth + 1)))
    return out
  } catch {
    return []
  }
}

/** 홈 HTML 이 스스로 알린 WordPress REST 주소. 없으면 시도하지 않는다. */
function wpApiFromHtml(html) {
  const m = html.match(/<link[^>]+rel=["']https:\/\/api\.w\.org\/["'][^>]+href=["']([^"']+)["']/i)
  return m?.[1] ?? null
}

console.log('discover 재시도 — 발행사가 스스로 공개한 색인만 따라간다\n')
const results = []
for (const [id, home, why] of TARGETS) {
  const row = { id, home, why, verdict: 'unknown', found: null, note: null, items: null }

  let html = null
  try {
    const r = await get(home, 'text/html')
    if (r.status === 403 || r.status === 429) {
      row.verdict = 'blocked'
      row.note = `HTTP ${r.status} — UA 위장 대신 목록에서 뺀다`
    } else if (r.status >= 400) {
      row.verdict = 'dead'
      row.note = `홈 HTTP ${r.status}`
    } else {
      html = r.body
    }
  } catch (e) {
    row.verdict = 'dead'
    row.note = `홈 연결 실패: ${e instanceof Error ? e.message : e}`
  }

  if (html) {
    // ① robots.txt → sitemap → 피드
    const { maps, note } = await sitemapsFromRobots(home)
    row.note = note
    const found = []
    for (const map of maps.slice(0, 3)) found.push(...(await feedsFromSitemap(map)))

    // ② WordPress REST — 홈이 스스로 알린 경우만
    const wp = wpApiFromHtml(html)
    if (wp) found.push(wp + 'wp/v2/posts?per_page=5')

    for (const cand of found.slice(0, 5)) {
      try {
        const r = await get(cand, cand.includes('wp-json') ? 'application/json' : undefined)
        if (r.status >= 400) continue
        if (cand.includes('wp-json')) {
          const arr = JSON.parse(r.body)
          if (Array.isArray(arr) && arr.length) {
            row.verdict = 'wp-json'
            row.found = cand
            row.items = arr.length
            break
          }
          continue
        }
        const items = parseRssFeed(r.body)
        if (items.length) {
          row.verdict = 'rss'
          row.found = cand
          row.items = items.length
          break
        }
      } catch {
        // 색인에 적혀 있어도 죽은 주소가 있다 — 다음 후보를 본다.
      }
    }
    if (row.verdict === 'unknown' && !row.note) {
      row.note = maps.length ? 'sitemap 안에 피드 주소 없음' : '단서 없음'
    }
  }

  results.push(row)
  const mark = { rss: '✓', 'wp-json': '✓', blocked: '⛔', dead: '✗', unknown: '?' }[row.verdict]
  console.log(
    `${mark} ${id}`.padEnd(24) +
      (row.found ? `${row.items}건  ${row.found}` : (row.note ?? '')) +
      `\n    (${why})`,
  )
}

const usable = results.filter((r) => r.found)
console.log(
  `\n찾음 ${usable.length}/${TARGETS.length} · 차단 ${results.filter((r) => r.verdict === 'blocked').length} · 단서 없음 ${results.filter((r) => r.verdict === 'unknown').length}`,
)
console.log('⚠️ 찾았다고 배선하지 않는다 — 라이선스는 기사 페이지에서 따로 확인한다.')
fs.writeFileSync(
  'scripts/acp/discover-retry.json',
  JSON.stringify({ measured_at: new Date().toISOString(), results }, null, 2),
)
console.log('\n→ scripts/acp/discover-retry.json')
