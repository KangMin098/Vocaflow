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
//   ACP(PD)       본문을 그대로 발행한다 → 48시간 보류 없음 · 독립 2계통 불필요 ·
//                 재저작 게이트 6종 불필요. **법적 병목이 없다.** 누적 165편 발행.
//   Compose(비PD) 사실만 뽑아 새로 쓴다 → 48시간 + 2계통 + 게이트 6종. 6편, 발행 0.
//
// 즉 "병목을 없애라" 의 답은 **병목이 없는 쪽을 돌리는 것**인데, 그쪽이 멈춰 있었다.
// Compose 에서 같은 처방을 이미 썼다(드레인 5단계에 헤드리스 경로 신설).
//
// ⚠️ 기관 서버에 실제 요청이 나간다. 하루 1회면 충분하다.
// ⚠️ 기본은 **읽기 전용** — 무엇이 밀려 있는지만 센다. `--commit` 이 있어야 담는다.
// 재실행 안전: 이미 있는 것은 건너뛴다(RPC 와 같은 기준 — source + source_id).
//
// 실행:
//   pnpm dlx tsx scripts/acp/collect-daily.mjs                 # 밀린 양과 피드별 적합률
//   pnpm dlx tsx scripts/acp/collect-daily.mjs --commit        # 담는다
//   … [--source voa] [--feed words-and-their-stories] [--limit 5]

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
const onlyFeed = arg('feed')
const PER_FEED = Number(arg('limit') ?? 3)

/**
 * 카테고리를 몇 페이지까지 걸어 들어갈지 (continuation 지원 피드만).
 *
 * ⚠️ 기본 1 이다 — 매일 도는 경로의 부하를 늘리지 않는다. 대량 확보는 명시적으로 켠다.
 *   `--pages 0` 이면 소진까지(`cont === null`) 간다.
 *
 * 왜 필요한가 (실측 2026-08-30): 위키미디어 어댑터는 카테고리 **첫 페이지만** 읽고 있었다.
 *   Featured Articles 6,993편 중 손에 닿는 것이 ~20편이었고, 그걸 다 담으면 "새 것 0" 이
 *   떠서 **소진처럼 보였다.** 페이지를 걸어야 나머지 99.7% 가 보인다.
 */
const PAGES = Number(arg('pages') ?? 1)
/** 페이지 사이 간격 — 기관 API 에 몰아치지 않는다. */
const PAGE_DELAY_MS = Number(arg('page-delay') ?? 350)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/**
 * 소스별 **피드(=섹션)** 목록.
 *
 * ⚠️ 처음에는 소스마다 `FEEDS[0]` 하나만 썼다. 그래서 **VOA 의 학습자 전용 피드가 통째로
 *   빠져 있었다** — `words-and-their-stories`·`lets-learn-english` 는 이 서비스가 노리는
 *   바로 그 자리인데 `as-it-is`(일반 뉴스) 하나만 걷고 있었다. The Conversation 도
 *   `all`(정치 포함) 대신 `science`·`health` 를 고를 수 있다.
 *
 *   비PD 쪽에서 얻은 교훈이 그대로 적용된다 — **어느 발행사냐보다 그 안의 어느 섹션이냐가
 *   학습 적합률을 가른다**(코리아타임스 실측 17배).
 *
 * ⚠️ 여기 적힌 것은 PD/CC 공급원(supply 역할)만이다. 상업 뉴스는 본문을 그대로 발행하는
 *   이 경로로 오면 안 되고, 그 경계는 `rolesOf` 가 코드로 지킨다.
 */
const SOURCES = [
  {
    // VOA 는 페이지가 아니라 **창 크기**가 파라미터다 — `?count=N`. 배선된 URL 이 전부
    //   count=20 이라 20편이 전부인 것처럼 보였다(실측: count=200 → 200건).
    //   그래서 runPage 는 한 번에 다 받아오고 바로 끝낸다(cont=null).
    key: 'voa',
    feeds: lib.VOA_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listVoaFeed(f.url, f.id),
      runPage: async (cursor) => {
        if (cursor != null) return { items: [], cont: null }
        const items = await lib.listVoaFeed(lib.voaFeedUrlWithCount(f.url, 200), f.id, 200)
        return { items, cont: null }
      },
    })),
    ingest: (u) => lib.ingestVoaArticle(u),
  },
  {
    // NASA news 는 WordPress 라 `?paged=N` 으로 과거 글이 나온다(실측: paged=2·5 가 각각 다른 10편).
    //   iotd 는 paged 를 무시하고 같은 창을 다시 주므로 walker 의 "새 항목 0 → 중단" 이 받아 낸다.
    key: 'nasa',
    feeds: lib.NASA_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listNasaFeed(f.url, f.id),
      runPage: async (cursor) => {
        const page = cursor ?? 1
        const items = await lib.listNasaFeed(lib.nasaFeedUrlPaged(f.url, page), f.id, 60)
        return { items, cont: items.length > 0 ? page + 1 : null }
      },
    })),
    ingest: (u) => lib.ingestNasaArticle(u),
  },
  {
    key: 'nih',
    feeds: lib.NIH_FEEDS.map((f) => ({ id: f.id, run: () => lib.listNihFeed(f.url, f.id) })),
    ingest: (u) => lib.ingestNihArticle(u),
  },
  {
    key: 'the_conversation',
    feeds: lib.THE_CONVERSATION_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listTheConversationFeed(f.url, f.id),
    })),
    ingest: (u) => lib.ingestTheConversationArticle(u),
  },
  {
    key: 'wikinews',
    feeds: lib.WIKINEWS_FEEDS.map((f) => ({ id: f.id, run: () => lib.listWikinewsFeed(f.url, f.id) })),
    ingest: (u) => lib.ingestWikinewsArticle(u),
  },
  // ⚠️ 위키미디어 계열 셋은 **카테고리**를 첫 인자로 받는다(`listXFeed(category, feedId)`).
  //   여기서 `f.id` 를 넘기거나 아무것도 안 넘기면 `gcmtitle` 이 'featured'/undefined 가 되어
  //   API 가 **빈 결과를 정상 응답으로** 돌려준다 — 오류도 경고도 없이 0건이다.
  //   2026-08-20 까지 그렇게 돌고 있었고, 그중 `simple_wikipedia` 는 **초중급(B1) 공급의
  //   절반**이라(실측 34편 중 27편 B1 · 신뢰도 0.84) 진입 밴드가 통째로 멈춰 있었다.
  {
    key: 'wikipedia',
    feeds: lib.WIKIPEDIA_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listWikipediaFeed(f.category, f.id),
      // continuation 지원 — `--pages` 로 카테고리를 걸어 들어간다.
      runPage: (cursor) => lib.listWikipediaFeedPage(f.category, f.id, 20, cursor),
    })),
    ingest: (u) => lib.ingestWikipediaArticle(u),
  },
  {
    key: 'wikivoyage',
    feeds: lib.WIKIVOYAGE_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listWikivoyageFeed(f.category, f.id),
    })),
    ingest: (u) => lib.ingestWikivoyageArticle(u),
  },
  {
    // USGS·NOAA 는 Drupal 목록 HTML 이라 `?page=N` 으로 넘어간다(토큰이 아니라 쪽번호).
    //   재고 중 주제 적합도가 가장 높은 쪽이라(33~75%) 첫 페이지 상한이 곧 공급 천장이었다.
    key: 'usgs',
    feeds: lib.USGS_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listUsgsFeed(f.id),
      runPage: (cursor) => lib.listUsgsFeedPage(f.id, 24, cursor ?? 0),
    })),
    ingest: (u) => lib.ingestUsgsArticle(u),
  },
  {
    key: 'noaa',
    feeds: lib.NOAA_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listNoaaFeed(f.id),
      runPage: (cursor) => lib.listNoaaFeedPage(f.id, 24, cursor ?? 0),
    })),
    ingest: (u) => lib.ingestNoaaArticle(u),
  },
  {
    // 하드코딩된 `default` 하나를 쓰느라 `SIMPLE_WIKIPEDIA_FEEDS` 두 개를 통째로 무시했다.
    //   VOA 에서 겪은 것과 같은 실수다 — 소스당 첫 피드만 쓰면 나머지가 조용히 사라진다.
    key: 'simple_wikipedia',
    feeds: lib.SIMPLE_WIKIPEDIA_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listSimpleWikipediaFeed(f.category, f.id),
    })),
    ingest: (u) => lib.ingestSimpleWikipediaArticle(u),
  },
  { key: 'owid', feeds: [{ id: 'default', run: () => lib.listOwidFeed() }], ingest: (u) => lib.ingestOwidArticle(u) },
  {
    // eLife API 는 page 로 과거 기사를 준다. 예전에는 per-page 만 있어 **최신 20편**이
    //   상한이었고, 상류 19,461편 중 손에 있는 것이 2편이었다.
    //   VOA(count)·위키미디어(continuation)·PLOS(start)·NASA(paged) 에 이어 다섯 번째 같은 상한이다.
    key: 'elife',
    feeds: [{
      id: 'default',
      run: () => lib.listElifeFeed(),
      runPage: async (cursor) => lib.listElifeFeedPage(100, cursor ?? 1, 100),
    }],
    ingest: (u) => lib.ingestElifeArticle(u),
  },
  {
    // ⚠️ `listPlosFeed()` 를 인자 없이 부르고 있었다 → 언제나 `recent` 하나뿐이고
    //   **`essay` 피드(Essay·Perspective·Opinion·Unsolved Mystery = 논증문)가 통째로 빠졌다.**
    //   VOA·simple_wikipedia 에서 이미 두 번 겪은 "소스당 첫 피드만 쓰면 나머지가 조용히
    //   사라진다" 와 같은 실수다. 논증문은 The Conversation 이 CC BY-ND 라 문항을 못 만드는
    //   자리를 메우는 유일한 사용 가능 공급선이라(`argumentative-supply.test.ts`) 더 뼈아프다.
    key: 'plos',
    feeds: lib.PLOS_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listPlosFeed(f.id),
      // Solr `start` 오프셋. numFound 가 총량을 알려 주므로 끝을 추정하지 않는다.
      runPage: async (cursor) => {
        const { items, cont } = await lib.listPlosFeedPage(f.id, 50, cursor ?? 0)
        return { items, cont }
      },
    })),
    ingest: (u) => lib.ingestPlosArticle(u),
  },
  {
    // 어댑터·테스트·SOURCE_SPECS 는 있는데 **이 표에만 없었다** — 배치가 못 부르니
    //   확보량 0 이었다. CC BY 4.0 · 학술 소재 × 읽히는 문장(수능 소재-문체 조합에 가장 가깝다).
    //   WordPress 라 `?paged=N` 으로 과거 글이 나온다.
    key: 'futurity',
    feeds: lib.FUTURITY_FEEDS.map((f) => ({
      id: f.id,
      run: () => lib.listFuturityFeed(f.url, f.id),
      runPage: async (cursor) => {
        const page = cursor ?? 1
        const items = await lib.listFuturityFeed(lib.futurityFeedUrlPaged(f.url, page), f.id, 60)
        return { items, cont: items.length > 0 ? page + 1 : null }
      },
    })),
    ingest: (u) => lib.ingestFuturityArticle(u),
  },
]

const targets = onlySource ? SOURCES.filter((s) => s.key === onlySource) : SOURCES
if (!targets.length) {
  console.error(`알 수 없는 소스: ${onlySource}\n쓸 수 있는 것: ${SOURCES.map((s) => s.key).join(' · ')}`)
  process.exit(2)
}

// 이미 담긴 것 — 재실행해도 늘지 않게 한다.
//
// ⚠️ 주소로만 대조하면 **이미 가진 글을 다시 가져온다.** 실측 2026-08-30:
//   PLOS 목록이 만드는 URL 은 `plosJournalSlug()` 추정값이라 저장된 정규 URL 과 다르다
//   (저널 매핑에 없는 학술지는 전부 'plosone' 으로 떨어진다 → 리다이렉트 후 실제 주소가
//   달라진다). 그래서 909편을 보유한 상태에서 목록이 "새 것 1,531" 을 보고했고,
//   배치는 그 900여 편을 **전부 다시 GET 한 뒤에야** (source, source_id) 중복 검사에서
//   버렸다 — 남의 서버를 900번 헛치고 10분을 버린다.
//
//   항목은 이미 `source_id`(PLOS 는 DOI)를 들고 있고 그건 주소와 달리 안 변한다.
//   그걸로도 대조하면 GET 전에 걸러진다.
//   ⚠️ 그리고 더 단순한 원인이 하나 더 있었다 — **PostgREST 는 기본 1,000행만 돌려준다.**
//   지문이 1,000편을 넘어선 뒤부터 이 집합은 **조용히 잘려 있었고**, 잘린 만큼이 매번
//   "새 것" 으로 보여 다시 GET 됐다. 3,182편 시점에 plos/essay 가 946편을 보유한 채
//   "새 것 1,530" 을 보고한 게 그 결과다. 그래서 range 로 끝까지 읽는다.
const existing = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('library_articles')
    .select('source_url, source_id')
    .range(from, from + 999)
  if (error) throw new Error('보유 목록 조회 실패: ' + error.message)
  existing.push(...(data ?? []))
  if (!data || data.length < 1000) break
}
const have = new Set(existing.map((r) => r.source_url).filter(Boolean))
const haveIds = new Set(existing.map((r) => r.source_id).filter(Boolean))

console.log(`ACP 수집 ${commit ? '' : '(읽기 전용 — --commit 을 붙이면 담는다)'}\n`)
console.log(['소스/피드'.padEnd(34), '목록', '새 것', ' 적합%', '부적합%'].join(' '))

let totalNew = 0
const emptyFeeds = []
let saved = 0
const failures = []

for (const s of targets) {
  for (const feed of s.feeds) {
    if (onlyFeed && feed.id !== onlyFeed) continue
    const label = `${s.key}/${feed.id}`
    let items = []
    // 소진 여부를 말로 구분한다 — 'exhausted' 만이 "정말 다 봤다" 이고,
    // 'capped' 는 `--pages` 예산이 먼저 끝난 것이다. 둘을 섞으면 상한을 소진으로 오해한다.
    let walk = null
    try {
      if (feed.runPage && PAGES !== 1) {
        const seen = new Set()
        let cursor = null
        let pages = 0
        const budget = PAGES > 0 ? PAGES : Infinity
        while (pages < budget) {
          const page = await feed.runPage(cursor)
          pages++
          let added = 0
          for (const it of page.items) {
            if (it.url && !seen.has(it.url)) {
              seen.add(it.url)
              items.push(it)
              added++
            }
          }
          cursor = page.cont
          if (!cursor) break
          // ⚠️ 쪽번호 방식(USGS·NOAA)은 범위를 넘겨도 마지막 페이지를 200 으로 되돌려주는
          //   사이트가 있다. 토큰이 없으니 "새 항목이 하나도 안 늘었다" 를 끝으로 본다 —
          //   이 가드가 없으면 같은 페이지를 예산만큼 계속 친다(무해해 보이지만 남의 서버를 때린다).
          if (added === 0) {
            cursor = null
            break
          }
          if (pages < budget) await sleep(PAGE_DELAY_MS)
        }
        walk = { pages, state: cursor ? 'capped' : 'exhausted' }
      } else {
        items = await feed.run()
      }
    } catch (e) {
      failures.push(`${label}: 목록 실패 — ${e instanceof Error ? e.message : String(e)}`)
      console.log(`  ✗ ${label.padEnd(32)} 목록을 못 가져왔다`)
      continue
    }
    // 주소 **또는** source_id 로 이미 가진 것을 뺀다 — 둘 중 하나만 맞아도 보유한 글이다.
    const fresh = items.filter((i) => i.url && !have.has(i.url) && !(i.source_id && haveIds.has(i.source_id)))
    totalNew += fresh.length

    // ⚠️ **목록 0건은 "다 담았다" 와 다르다.** 이번(2026-08-20) 결함이 정확히 여기 숨었다 —
    //   위키미디어 셋에 카테고리를 안 넘겨 API 가 빈 결과를 200 으로 돌려줬고, 표에는
    //   `· 0 0` 으로만 찍혀 "새 것이 없구나" 로 읽혔다. 초중급 공급이 멈춘 걸 아무도 몰랐다.
    //   그래서 둘을 말로 구분한다. 조용한 0건을 만들지 않는다.
    if (items.length === 0) emptyFeeds.push(label)

    // 학습 적합률 — 어느 피드를 켤지 정하는 근거. 비PD 쪽 계측기와 같은 분류기를 쓴다.
    const n = items.length || 1
    const fit = items.filter((i) => lib.classifyTopic(i.title ?? '') === 'fit').length
    const unfit = items.filter((i) => lib.classifyTopic(i.title ?? '') === 'unfit').length
    console.log(
      [
        `  ${fresh.length > 0 ? '+' : '·'} ${label}`.padEnd(34),
        String(items.length).padStart(4),
        String(fresh.length).padStart(5),
        ((100 * fit) / n).toFixed(1).padStart(6),
        ((100 * unfit) / n).toFixed(1).padStart(7),
        walk ? `  ${walk.pages}p ${walk.state === 'exhausted' ? '소진' : '예산소진'}` : '',
      ].join(' '),
    )

    if (!commit) continue

    for (const item of fresh.slice(0, PER_FEED)) {
      try {
        const article = await s.ingest(item.url)

        // ⚠️ `admin_enqueue_article` RPC 를 쓰지 않는다. 그 함수는 첫 줄에서
        //   `is_admin_or_curator()` 를 확인하는데, 그건 **사용자 경로를 지키는 검사**이고
        //   service-role 키에는 `auth.uid()` 가 없어 언제나 거절된다(실측 21건 전부 Forbidden).
        //   RPC 가 하는 일은 `(source, source_id)` 중복 확인 후 `queued` 삽입뿐이라 같은
        //   의미를 여기서 수행한다 — 마이그레이션 없이. **중복 기준을 RPC 와 똑같이 맞추는
        //   것이 핵심이다**(주소가 아니라 source + source_id).
        const { data: dup } = await db
          .from('library_articles')
          .select('id')
          .eq('source', article.source)
          .eq('source_id', article.source_id)
          .maybeSingle()
        if (dup) {
          have.add(item.url)
          if (article.source_id) haveIds.add(article.source_id)
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
          // ⚠️ 이걸 빠뜨려 37편이 NULL 로 들어갔다(2026-08-20 실측). `feed_id` 가 없으면
          //   `resolveArticleRegister(source, feed_id)` 가 피드별 register 를 못 찾고
          //   소스 기본값으로 떨어진다 — VOA 의 `lets-learn-english`(narrative)·
          //   `words-and-their-stories`(expository) 가 전부 'news' 가 된다.
          //   게다가 피드별로 무엇이 들어왔는지 나중에 셀 수 없게 된다.
          feed_id: feed.id,
          status: 'queued',
        })
        if (error) failures.push(`${label} ${item.url}: ${error.message}`)
        else {
          saved++
          have.add(item.url)
          if (article.source_id) haveIds.add(article.source_id)
        }
      } catch (e) {
        failures.push(`${label} ${item.url}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
}

console.log(`\n밀려 있는 새 글 ${totalNew}${commit ? ` · 담은 것 ${saved} (피드당 최대 ${PER_FEED})` : ''}`)
if (emptyFeeds.length) {
  console.log(
    `\n⚠ 목록이 0건인 피드 ${emptyFeeds.length} — "새 것 없음" 과 다르다.` +
      ` 피드가 죽었거나 인자가 틀렸다(둘 다 오류를 안 낸다):`,
  )
  for (const f of emptyFeeds) console.log(`  · ${f}`)
}
if (failures.length) {
  console.log(`\n실패 ${failures.length}:`)
  for (const f of failures.slice(0, 12)) console.log(`  · ${f}`)
}
if (!commit && totalNew > 0) {
  console.log('\n이 경로에는 48시간 보류도 독립 2계통도 없다 — 담으면 바로 검수·발행으로 간다.')
}
