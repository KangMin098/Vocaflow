// scripts/acp/harvest-voa-sitemap.mjs
//
// **VOA 사이트맵 수확기 — RSS 창(아카이브의 1.4%) 밖으로 나가는 유일한 경로.**
//
// ── 왜 (실측 2026-09-07) ────────────────────────────────────────────────
// VOA 는 14 피드 × RSS 를 다 걷고도 266편에서 멈춰 있었다. 배치 표에는 「창 전량 소진」
// 으로 찍혔고 그 말이 「아카이브를 다 봤다」로 읽혔다. 실제로는 **RSS 의 `?count=` 가
// 200 에서 하드 천장**이고, 그 위를 요청하면 오류가 아니라 **기본값 20 으로 조용히
// 되돌아간다**(500·1000·5000 전부 20건). 아카이브는 67,316편이다 — 보고 있던 것은 1.4%.
//
//   count=200 → item 200   ·   count=500 → item 20   ·   count=5000 → item 20
//
// `robots.txt` 가 사이트맵을 스스로 광고하고, 같은 파일이 `/*?p=*`(목록 페이지네이션)와
// `/s?k=*`(검색)를 금지한다. 사이트맵이 **허용된 유일한 대량 경로**다.
//
// ── 이 수확기의 성질 ────────────────────────────────────────────────────
// · **전수 열거다.** 4 요청 · 1.4MB(gz) 로 67,316 URL 을 다 받는다. 페이지 개념이 없으므로
//   2026-08-16 IA 사고(정렬 없는 페이지 넘김 → 214건 중복 + 동수 누락)가 구조적으로 불가능하다.
// · **전문은 절반만 온다.** 표본 40편 중 20편이 200어 이상 transcript, 18편은 `div.wsw`
//   자체가 없는 오디오/영상 쪽이다. URL 모양으로는 못 가른다 — GET 해 봐야 안다.
//   그래서 **전문 없음을 실패로 세지 않고 커서에 적는다.** 안 적으면 매 실행 같은 3만 쪽을
//   다시 GET 한다.
// · **난이도 등급은 취득 불가다.** 기사 메타·JSON-LD 어디에도 Level 이 없고, Level 1/2/3
//   쪽은 세 쪽이 같은 코너 목록을 나열한다. 저장소가 그 축을 이미 실측하고 철회했다
//   (선언 Level 3 이 Level 2 보다 쉬웠다 · 오탐 6/6). **되살리지 않는다.**
//   대신 JSON-LD `articleSection` 이 기사마다 정확히 오고, 그건 난이도가 아니라 **문종 축**이다.
// · **신규 유입은 0 으로 본다.** 2025-03 중단 후 2026-03 재개했으나 재개분(하루 1편)은
//   `wsw` 없는 뉴스캐스트라 지문이 아니다. 이 소스는 살아 있는 피드가 아니라 **정지한 서고**다.
//
// ── 이 경로가 조용히 죽는 자리 둘 (미리 피해 둔 것) ──────────────────────
// 1. **열쇠.** `source_id` 는 `sourceKey('voa', {url})` 한 곳에서만 만든다. 예전에 적재기가
//    해시로 물러서서 249행이 `voa:ewolkz` 가 됐고 중복 차단이 **한 번도** 작동하지 않았다.
// 2. **`applySourceLevelCap`.** 그 함수는 `preferredFeedMix` 에 없는 feed 에 quota 0 을 주고,
//    오류 없이 전량을 버린다. 이 수확기는 사이트맵 전수 열거 + 자체 판정이라 **큐레이션
//    spec 을 타지 않는다** — 새 코너(`explorations` 등)를 더해도 사라지지 않는다.
//
// ── 재실행 안전 ─────────────────────────────────────────────────────────
// **그렇다.** 커서(`scripts/acp/data/voa-sitemap-cursor.json`)에 **판정한 article id 를 전부**
// 적는다 — 적재분과 전문 없는 쪽 둘 다. DB 의 `(source, source_id)` 유니크가 두 번째 그물이다.
// 커서는 **판정 뒤에** 쓴다(받자마자 쓰면 중간에 죽었을 때 안 본 것을 본 것으로 센다).
// `--fresh` 로만 처음부터 다시 훑는다.
//
// ⚠️ 기본은 **읽기 전용**. `--commit` 이 있어야 담는다.
// ⚠️ 남의 서버에 실제 요청이 나간다. 기본 간격 700ms.
//
// 실행:
//   pnpm dlx tsx scripts/acp/harvest-voa-sitemap.mjs --plan             # 열거만 (기사 GET 0)
//   pnpm dlx tsx scripts/acp/harvest-voa-sitemap.mjs --limit 40         # 표본 GET · 안 담는다
//   pnpm dlx tsx scripts/acp/harvest-voa-sitemap.mjs --limit 500 --commit
//   … [--order spread|newest|oldest] [--sections education,science-technology] [--include-reference]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
const PLAN_ONLY = process.argv.includes('--plan')
const FRESH = process.argv.includes('--fresh')
const INCLUDE_REFERENCE = process.argv.includes('--include-reference')
/** 편마다 한 줄 — 코너 판정과 FK 가 맞는지 눈으로 대조할 때. */
const DUMP = process.argv.includes('--dump')
const LIMIT = Number(arg('limit', '40'))
const DELAY_MS = Number(arg('delay', '700'))
const ORDER = arg('order', 'spread')
const ONLY_SECTIONS = (arg('sections') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { createClient } = await import('@supabase/supabase-js')
// ⚠️ 배럴(`src/index.ts`)이 아니라 **모듈을 직접** 부른다. 배럴은 어댑터 30여 개를 한꺼번에
//   끌어오므로 다른 사람이 손보는 중인 어댑터 하나가 이 수확기를 못 돌게 만든다.
const lib = {
  ...(await import('../../packages/library-pipeline/src/ingest-article/voa.ts')),
  ...(await import('../../packages/library-pipeline/src/ingest-article/harvest-cursor.ts')),
  ...(await import('../../packages/library-pipeline/src/textbook/readability.ts')),
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// VOA WAF 는 비브라우저 UA 를 403 한다 — 사이트맵도 예외가 아니다.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const CURSOR_FILE = lib.harvestCursorPath('acp', 'voa', 'sitemap')

// ── 0-b. 코너 수리 모드 (`--repair-feeds`) ───────────────────────────────
//
// `voa-unsectioned` 로 들어간 행의 코너를 **제목에서 다시 읽는다**(네트워크 0 — 제목은 이미 있다).
// 옛 아카이브는 `articleSection` 이 비고 코너가 제목 앞에 대문자로 붙는다
// (`THIS IS AMERICA - …`). 이 규칙을 넣기 전에 담긴 행이 그 자리에 남아 있다.
// 재실행 안전: 제목에서 코너를 못 읽으면 그대로 둔다(없는 코너를 지어내지 않는다).
if (process.argv.includes('--repair-feeds')) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('library_articles')
      .select('id, title, feed_id')
      .eq('source', 'voa')
      .eq('feed_id', 'voa-unsectioned')
      .range(from, from + 999)
    if (error) throw new Error('조회 실패: ' + error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const fixes = rows
    .map((r) => ({ id: r.id, title: r.title, to: lib.voaFeedIdFor(null, r.title) }))
    .filter((f) => f.to !== 'voa-unsectioned')
  console.log(
    `voa-unsectioned ${rows.length}행 · 제목에서 코너를 읽어낸 것 **${fixes.length}**${COMMIT ? '' : ' — 읽기 전용'}`,
  )
  const byTarget = new Map()
  for (const f of fixes) byTarget.set(f.to, (byTarget.get(f.to) ?? 0) + 1)
  for (const [k, n] of [...byTarget].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${n}`)
  if (COMMIT) {
    let done = 0
    for (const f of fixes) {
      const { error } = await db.from('library_articles').update({ feed_id: f.to }).eq('id', f.id)
      if (!error) done++
    }
    console.log(`고침 ${done}`)
  }
  process.exit(0)
}

// ── 0. 발행일 수리 모드 (`--repair-dates`) ───────────────────────────────
//
// **정규식 2개를 고쳐도 이미 들어온 행은 그대로다.** 실측 2026-09-07 — VOA 266행 중
// **실제 발행일을 가진 행이 0** 이었다:
//   · 236행 NULL  — `article:published_time` 메타는 없고, `<time datetime>` 폴백 값에
//                   엔티티가 살아 있어(`…22:02:29&#x2B;00:00`) `new Date()` 가 Invalid Date.
//   · 30행 오기입 — 전부 `2026-07-05 01:11:0x`(한 분 안에 찍힌 배치 스탬프)다. 2017년 기사에
//                   2026년 날짜가 붙어 있으니 **NULL 보다 나쁘다** — 최신 글로 정렬된다.
// 판정 기준은 `published_at IS NULL OR published_at > created_at` — 우리가 담기 전에 발행된
// 글이므로 그 반대는 있을 수 없다.
//
// 재실행 안전: **그렇다.** 고칠 것이 없으면 0행을 고치고 끝난다. `--commit` 없이는 세기만 한다.
if (process.argv.includes('--repair-dates')) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('library_articles')
      .select('id, source_url, published_at, created_at, title')
      .eq('source', 'voa')
      .range(from, from + 999)
    if (error) throw new Error('조회 실패: ' + error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const broken = rows.filter(
    (r) => r.source_url && (!r.published_at || new Date(r.published_at) > new Date(r.created_at)),
  )
  console.log(
    `VOA ${rows.length}행 중 발행일이 없거나 담은 날보다 미래인 행 **${broken.length}**` +
      ` (NULL ${broken.filter((r) => !r.published_at).length} · 미래 ${broken.filter((r) => r.published_at).length})` +
      `${COMMIT ? '' : ' — 읽기 전용'}`,
  )
  let fixed = 0
  let unfixable = 0
  for (const r of broken.slice(0, LIMIT)) {
    try {
      const { article } = await lib.fetchVoaArticle(r.source_url)
      if (!article.published_at || Number.isNaN(article.published_at.getTime())) {
        unfixable++
      } else if (COMMIT) {
        const { error } = await db
          .from('library_articles')
          .update({ published_at: article.published_at.toISOString() })
          .eq('id', r.id)
        if (error) unfixable++
        else fixed++
      } else fixed++
    } catch {
      // 원본이 사라졌거나 오디오 쪽이 됐다 — 날짜만 못 고칠 뿐 본문은 이미 있다.
      unfixable++
    }
    await sleep(DELAY_MS)
  }
  console.log(`고침 ${fixed} · 못 고침 ${unfixable} (원문에서 날짜를 못 읽음)`)
  process.exit(0)
}

// ── 1. 사이트맵 전수 열거 ────────────────────────────────────────────────
async function listSitemap() {
  const entries = []
  let skipped = 0
  for (const url of lib.VOA_ARTICLE_SITEMAPS) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`사이트맵 실패 ${res.status}: ${url}`)
    const xml = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
    const got = lib.parseVoaSitemapXml(xml)
    entries.push(...got.entries)
    skipped += got.skipped
  }
  return { entries, skipped }
}

const { entries, skipped } = await listSitemap()
// 사이트맵 4개가 겹칠 수 있다 — 열쇠로 한 번 더 접는다(중복 0 이 정상이지만 확인해 둔다).
const byId = new Map()
for (const e of entries) if (!byId.has(e.source_id)) byId.set(e.source_id, e)
console.log(
  `사이트맵 ${lib.VOA_ARTICLE_SITEMAPS.length}개 · URL ${entries.length} · 고유 열쇠 ${byId.size}` +
    (skipped ? ` · 열쇠 유도 실패 ${skipped} (URL 판형 변경 의심)` : ' · 열쇠 유도 실패 0'),
)

// ── 2. 보유분 + 커서 차집합 ──────────────────────────────────────────────
// ⚠️ PostgREST 는 기본 1,000행만 준다. range 로 끝까지 읽지 않으면 잘린 만큼이
//   매번 "새 것" 으로 보여 다시 GET 된다(2026-08-30 PLOS 900편 헛 GET 이 그 결과다).
const haveIds = new Set()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'voa')
    .range(from, from + 999)
  if (error) throw new Error('보유 목록 조회 실패: ' + error.message)
  for (const r of data ?? []) if (r.source_id) haveIds.add(r.source_id)
  if (!data || data.length < 1000) break
}

const cursor = FRESH
  ? lib.emptyHarvestCursor('voa', 'sitemap')
  : lib.readHarvestCursor(CURSOR_FILE, 'voa', 'sitemap')
const judged = new Set(cursor.seen)

const candidates = [...byId.values()].filter(
  (e) => !haveIds.has(e.source_id) && !judged.has(e.source_id.replace(/^voa:/, '')),
)
console.log(
  `보유 ${haveIds.size} · 커서에 판정 기록 ${judged.size} · **미확보 ${candidates.length}**` +
    (FRESH ? ' (--fresh: 커서 무시)' : ''),
)

if (PLAN_ONLY) {
  const years = new Map()
  for (const e of candidates) {
    const y = (e.lastmod ?? '').slice(0, 4) || '미상'
    years.set(y, (years.get(y) ?? 0) + 1)
  }
  console.log('\n미확보 연도 분포 (lastmod):')
  for (const [y, n] of [...years].sort()) console.log(`  ${y}  ${String(n).padStart(6)}`)
  console.log('\n--plan 이므로 기사 GET 0. --limit N 을 주면 표본을 받는다.')
  process.exit(0)
}

// ── 3. 순서 ──────────────────────────────────────────────────────────────
// `spread` = 균등 간격. 아카이브가 20년치라 최신순만 보면 **한 시기만** 재게 된다 —
//   FK 분포를 재는 표본이 그러면 아카이브를 대표하지 못한다.
const sorted = [...candidates].sort((a, b) => (a.lastmod ?? '').localeCompare(b.lastmod ?? ''))
let queue
if (ORDER === 'newest') queue = sorted.slice().reverse().slice(0, LIMIT)
else if (ORDER === 'oldest') queue = sorted.slice(0, LIMIT)
else {
  const step = Math.max(1, Math.floor(sorted.length / Math.max(1, LIMIT)))
  queue = []
  for (let i = 0; i < sorted.length && queue.length < LIMIT; i += step) queue.push(sorted[i])
}

console.log(
  `\nGET 예정 ${queue.length}편 (order=${ORDER} · 간격 ${DELAY_MS}ms)` +
    `${COMMIT ? '' : ' — 읽기 전용(--commit 을 붙이면 담는다)'}\n`,
)

// ── 4. GET → 판정 → 적재 ────────────────────────────────────────────────
const stat = {
  got: 0,
  noTranscript: 0,
  tooShort: 0,
  fetchFail: 0,
  reference: 0,
  sectionFiltered: 0,
  dup: 0,
  saved: 0,
  insertFail: 0,
}
const sections = new Map()
const fks = []
const failures = []
const newlyJudged = []

function bump(map, k) {
  map.set(k, (map.get(k) ?? 0) + 1)
}

/**
 * 커서를 중간에도 남긴다 — 500편짜리 회차가 중간에 죽어도 앞부분을 다시 GET 하지 않는다.
 *
 * ⚠️ **읽기 전용 실행은 커서를 쓰지 않는다.** 처음엔 썼다가 곧바로 사고를 봤다:
 *   `--limit 40` 표본을 돌리니 전문 22편을 **담지도 않은 채 「판정함」으로 적어** 다음
 *   `--commit` 실행이 그 22편을 영구히 건너뛰게 됐다. 빈 값이 「완료」로 세어져 구멍이
 *   영영 남는 것과 같은 결의 결함이다. 커서는 **실제로 처분한 회차만** 전진시킨다.
 */
function flushCursor(exhausted) {
  if (!COMMIT) return
  // ⚠️ **디스크의 커서를 다시 읽어 합친다 — 실행 시작 시점의 사본을 덮어쓰지 않는다.**
  //   실측 2026-09-07: 두 회차가 겹쳐 돌았더니(앞 회차가 죽은 줄 알았는데 살아 있었다)
  //   나중에 쓴 쪽이 **판정 1,940 → 830 으로 커서를 되돌렸다.** DB 행은 유니크 제약이
  //   지켰지만, 「전문 없음」 기록이 날아가 다음 회차가 같은 900여 쪽을 다시 GET 하게 된다.
  //   합집합으로 쓰면 겹쳐 돌아도 **더해질 뿐 빠지지 않는다.**
  const onDisk = lib.readHarvestCursor(CURSOR_FILE, 'voa', 'sitemap')
  lib.writeHarvestCursor(CURSOR_FILE, {
    ...cursor,
    seen: [...onDisk.seen, ...cursor.seen, ...newlyJudged],
    token: null, // 사이트맵은 전수 열거라 다음-페이지 토큰이 없다
    exhausted,
  })
}

for (const [i, e] of queue.entries()) {
  const id = e.source_id.replace(/^voa:/, '')
  let parsed
  try {
    parsed = await lib.fetchVoaArticle(e.url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // ⚠️ **전문 없음은 실패가 아니다.** 아카이브의 45%가 오디오/영상 쪽이고, URL 모양으로는
    //   가려낼 수 없다. 커서에 적어 두는 것이 이 수확기의 핵심 절약이다.
    if (/no transcript body/.test(msg)) stat.noTranscript++
    else if (/too short/.test(msg)) stat.tooShort++
    else {
      stat.fetchFail++
      failures.push(`${e.url}: ${msg.slice(0, 90)}`)
    }
    newlyJudged.push(id)
    if ((i + 1) % 50 === 0) flushCursor(false)
    await sleep(DELAY_MS)
    continue
  }

  const { article, articleSection } = parsed
  // 섹션이 먼저, 없으면 제목 앞머리의 옛 코너 표기(`THIS IS AMERICA - …`).
  const feedId = lib.voaFeedIdFor(articleSection, article.title)
  bump(sections, feedId)
  stat.got++

  const fk = lib.fkGrade(article.content)
  const words = article.content.split(/\s+/).length
  if (typeof fk === 'number') fks.push({ fk, feedId, id, words })
  if (DUMP) {
    console.log(
      `  ${id.padEnd(9)} ${feedId.padEnd(24)} FK ${String(fk?.toFixed(2) ?? '   -').padStart(6)}` +
        ` ${String(words).padStart(5)}어 ${(article.published_at?.toISOString().slice(0, 10) ?? '날짜없음').padEnd(10)}` +
        ` ${article.title.slice(0, 52)}`,
    )
  }

  const skipReference = !INCLUDE_REFERENCE && lib.isVoaReferencePiece(feedId, article.title)
  const skipSection = ONLY_SECTIONS.length > 0 && !ONLY_SECTIONS.includes(feedId)
  if (skipReference || skipSection) {
    if (skipReference) stat.reference++
    else stat.sectionFiltered++
    // 판정했으므로 커서에 적는다 — 배제도 판정이다(다시 GET 하지 않는다).
    newlyJudged.push(id)
    if ((i + 1) % 50 === 0) flushCursor(false)
    await sleep(DELAY_MS)
    continue
  }

  if (COMMIT) {
    // 중복 기준은 `admin_enqueue_article` RPC 와 같다 — 주소가 아니라 (source, source_id).
    // ⚠️ **편마다 SELECT 로 묻지 않는다.** 처음엔 그렇게 했다가 회당 속도가 5.2초/편이 됐다
    //   (왕복 두 번). 후보 목록은 이미 `haveIds` 로 걸렀고, 진짜 그물은 DB 의
    //   `library_articles_source_source_id_key` 유니크다 — 23505 를 중복으로 세면 된다.
    if (haveIds.has(article.source_id)) {
      stat.dup++
    } else {
      const { error } = await db.from('library_articles').insert({
        source: 'voa',
        source_id: article.source_id,
        title: article.title,
        author: article.author ?? null,
        source_url: article.source_url,
        published_at:
          article.published_at && !Number.isNaN(article.published_at.getTime())
            ? article.published_at.toISOString()
            : null,
        license: article.license,
        content: article.content ?? '',
        audio_url: article.audio_url ?? null,
        // ⚠️ NULL 로 두면 `resolveArticleRegister` 가 소스 기본값('news')으로 떨어진다
        //   (2026-08-20 에 37편이 그렇게 들어갔다). 섹션이 RSS 피드 자리를 대신한다.
        feed_id: feedId,
        status: 'queued',
      })
      if (error?.code === '23505') {
        stat.dup++
      } else if (error) {
        stat.insertFail++
        failures.push(`${e.url}: insert — ${error.message.slice(0, 90)}`)
      } else {
        stat.saved++
        haveIds.add(article.source_id)
      }
    }
  }

  newlyJudged.push(id)
  if ((i + 1) % 50 === 0) flushCursor(false)
  await sleep(DELAY_MS)
}

// 커서는 **판정 뒤에** 쓴다. 큐를 다 비웠고 후보도 남지 않았을 때만 소진이다.
flushCursor(candidates.length <= queue.length)

// ── 5. 보고 ─────────────────────────────────────────────────────────────
console.log(
  [
    `GET ${queue.length}`,
    `전문 ${stat.got}`,
    `전문없음 ${stat.noTranscript}`,
    `짧음 ${stat.tooShort}`,
    `요청실패 ${stat.fetchFail}`,
    `reference 제외 ${stat.reference}`,
    ONLY_SECTIONS.length ? `섹션 제외 ${stat.sectionFiltered}` : null,
    COMMIT ? `중복 ${stat.dup}` : null,
    COMMIT ? `**담음 ${stat.saved}**` : '(읽기 전용)',
    stat.insertFail ? `삽입실패 ${stat.insertFail}` : null,
  ]
    .filter(Boolean)
    .join(' · '),
)

if (sections.size) {
  console.log('\n코너(articleSection → feed_id) 분포:')
  for (const [k, n] of [...sections].sort((a, b) => b[1] - a[1])) {
    const tag = lib.VOA_REFERENCE_SECTIONS.includes(k) ? '  ← reference(지문 아님)' : ''
    console.log(`  ${k.padEnd(28)} ${String(n).padStart(4)}${tag}`)
  }
}

if (fks.length) {
  // ⚠️ FK 는 **전문 기준**이다(정찰·`reading-band-gap.md` 와 같은 자). 밴드 판정에 쓰는
  //   100~200어 창을 적용한 값이 아니므로, 여기 수치는 「대역 배정」이 아니라 「대역 추정」이다.
  const sortedFk = fks.map((f) => f.fk).sort((a, b) => a - b)
  const q = (p) => sortedFk[Math.min(sortedFk.length - 1, Math.floor(p * sortedFk.length))]
  const inBand = fks.filter((f) => f.fk >= 9.0 && f.fk <= 11.0).length
  console.log(
    `\nFK(전문) n=${fks.length} · 최소 ${q(0).toFixed(2)} · p25 ${q(0.25).toFixed(2)} · ` +
      `중앙 ${q(0.5).toFixed(2)} · p75 ${q(0.75).toFixed(2)} · 최대 ${q(0.999).toFixed(2)}`,
  )
  const buckets = new Map()
  for (const f of fks) bump(buckets, Math.floor(f.fk))
  console.log('FK 히스토그램 (정수 구간):')
  for (const [b, n] of [...buckets].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(b).padStart(3)}~${b + 1}  ${String(n).padStart(4)}  ${'█'.repeat(Math.min(40, n))}`)
  }
  console.log(
    `\n**FK 9.0~11.0(시중 고1 본책 중앙 9.62 대역) ${inBand}편 · ${((100 * inBand) / fks.length).toFixed(1)}%**`,
  )
  console.log(
    '⚠️ 고1 밴드는 아직 없다 — `READING_LEVEL_BANDS` 는 중3(FK 8.5~12.0)이 천장이다.\n' +
      '   여기서는 원문을 확보만 하고 밴드는 붙이지 않는다(docs/reports/reading-band-gap.md · 결정 대기).',
  )
}

if (failures.length) {
  console.log(`\n실패 ${failures.length}:`)
  for (const f of failures.slice(0, 12)) console.log(`  · ${f}`)
}

console.log(
  COMMIT
    ? `\n커서 ${path.relative(process.cwd(), CURSOR_FILE)} — 판정 ${cursor.seen.length + newlyJudged.length}` +
        ` (이번 회 +${newlyJudged.length}). 재실행하면 이 뒤부터 본다.`
    : `\n읽기 전용이라 커서를 쓰지 않았다 — 다시 돌리면 같은 ${queue.length}편을 본다.` +
        ` 담으려면 --commit.`,
)
