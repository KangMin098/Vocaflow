// scripts/csat/harvest-nist.mjs
//
// **NIST 수확 — 이미 「채택」인데 0행이던 소스를 실제로 채운다.**
//
// @harvest-source: nist   ← `harvest-cursor-contract.test.ts` 가 이 선언으로 등록부를 검사한다
//
// ── 왜 이 소스인가 (정찰 실측 2026-09-08) ────────────────────────────
// `docs/reports/source-probe/tech-media.md` §0 의 결론: 「기술·매체」 칸에서 가장 싼 답은
// 새 소스가 아니라 **이미 채택해 놓고 한 편도 안 받은 NIST** 다.
//   · PD(미 연방정부 저작물) — 라이선스 위험 0. nasa·usgs·noaa 와 같은 근거
//   · 사이트맵 전수 열거 **9,013편**(뉴스 6,991 + 블로그 2,022)
//   · 창 180어 단위 기술·매체 명중률 **26.7%** = PLOS(7.3%)의 3.7배
//
// ── 구조는 `harvest-frontiers.mjs` 와 같다 — 버릴 것을 담지 않는다 ──
// 목록에서 받은 자리에서 ① 이미 판정 ② 중복 ③ 본문 ④ 길이 ⑤ 비ASCII ⑥ 창 게이트
// (`lib-fit.mjs`) ⑦ 소재 몫(`lib-topic.mjs`) 을 다 보고 **통과한 것만** 넣는다.
// 같은 자를 안 대면 같은 구멍이 생긴다.
//
// ⚠️ Frontiers 와 다른 점 둘:
//   1. **목록이 페이지가 아니라 전수 열거다.** Crossref 커서 대신 사이트맵 56쪽을 다 읽는다
//      (약 1분). 그래서 커서 `token` 은 늘 null 이고, 상태는 전부 `seen` 에 있다.
//   2. **라이선스 판정이 없다.** 소스 전체가 PD 라 항목별로 가를 것이 없다.
//      (PeerJ 처럼 NC 가 섞이는 소스였다면 여기에 게이트가 하나 더 있었을 것이다.)
//
// ── ⚠️ `applySourceLevelCap` 은 이 경로에 없다 (확인하고 적는다) ─────
// 그 캡은 `BulkArticlesTab` 이 `_curation-spec.ts` 의 `SourceKey` · `SOURCE_SPECS` 로 고른
// 항목에만 걸리는데, `nist` 는 그 목록에 **없다**(수확기가 DB 에 직접 넣는다 — `plos` ·
// `frontiers` · `gutenberg` 와 같은 경로). 그래서 Admin 대량 GET 의 선택지로 뜨지도,
// quota 0 을 받지도 않는다. 언젠가 그 화면에 올리려면 `SourceKey` + `SOURCE_SPECS` +
// `preferredFeedMix` **셋을 함께** 더해야 한다 — 하나라도 빠지면 조용히 0건이 된다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
//   사이트맵 열거  안전. 매 실행 전수를 다시 읽는다(쪽 번호를 기억하지 않으므로 어긋날 수 없다)
//   중복 판정      안전. `(source, source_id)` 로 DB 조회 — 건너뛴 수를 출력한다
//   본문 GET       안전. 부수효과 없음
//   게이트 채점    안전. 통과분만 적재하므로 실패분이 재고로 남지 않는다
//   적재           `--commit` 없이는 DB 에도 커서에도 쓰지 않는다(기본 dry-run).
//                  빈 본문·짧은 본문은 넣지 않고 건너뛴 수를 출력한다
//   커서           **판정 뒤에** 쓴다. 중간에 죽으면 다시 열거하는데 중복 판정이 걸러 준다
//
// ⚠️ **`seen` 에는 「처분이 끝난 것」만 넣는다.** 통과시켰는데 적재가 실패한 편을 `seen` 에
//   넣으면 다음 실행이 그것을 「이미 봤다」로 세어 **구멍이 영영 남는다**(CLAUDE.md §🤖).
//     넣는다  본문 컨테이너 없음 · 이미 있음 · 짧음 · 비ASCII · 창 게이트 탈락 · **적재 성공**
//     안 넣는다 본문 GET 실패(일시적일 수 있다) · 몫이 차서 미룬 것(우리 예산 사정이지 글의 흠이 아니다)
//
// 실행:
//   pnpm dlx tsx scripts/csat/harvest-nist.mjs --plan                    # 사이트맵 열거만(기사 GET 0)
//   pnpm dlx tsx scripts/csat/harvest-nist.mjs --feed news --max 12      # 표본 채점(읽기 전용)
//   pnpm dlx tsx scripts/csat/harvest-nist.mjs --feed news --max 20 --commit
//   pnpm dlx tsx scripts/csat/harvest-nist.mjs --feed news --fresh       # 커서 무시하고 처음부터

import fs from 'node:fs'
import path from 'node:path'

import { fitRecord, scoreArticle } from './lib-fit.mjs'
import { classify, TOPIC_KEYS, TOPIC_V } from './lib-topic.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const FRESH = process.argv.includes('--fresh')
const PLAN_ONLY = process.argv.includes('--plan')
/** 몫(quota)을 무시하고 게이트만 본다 — **명중률 실측용**. 적재에는 쓰지 않는다. */
const IGNORE_QUOTA = process.argv.includes('--ignore-quota')
const FEED = arg('feed') ?? 'news'
const MAX = Number(arg('max') ?? 12)
const STAGE = Number(arg('stage') ?? 3)
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 50000
/** 편당 GET 사이 간격(ms). NIST robots.txt 에 Crawl-delay 는 없으나 넉넉히 둔다. */
const GAP_MS = Number(arg('gap') ?? 700)
/** 사이트맵 쪽 사이 간격(ms). */
const LIST_GAP_MS = Number(arg('list-gap') ?? 600)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ⚠️ **배럴(`src/index.ts`)을 거치지 않는다.** 배럴을 부르면 어댑터 20여 개가 통째로
//   평가되고, 그중 하나가 깨지면 관계없는 이 스크립트가 함께 죽는다.
const {
  NIST_FEEDS,
  NIST_MAX_NON_ASCII,
  NIST_MIN_WORDS,
  NIST_SITEMAP_PAGES_MEASURED,
  fetchNistArticle,
  listNistFeed,
  nistFeed,
} = await import('../../packages/library-pipeline/src/ingest-article/nist.ts')
const { harvestCursorPath, readHarvestCursor, writeHarvestCursor } = await import(
  '../../packages/library-pipeline/src/ingest-article/harvest-cursor.ts'
)

const feed = nistFeed(FEED)
if (!feed) {
  console.error(`피드 '${FEED}' 를 모른다. 쓸 수 있는 것: ${NIST_FEEDS.map((f) => f.id).join(' · ')}`)
  process.exit(1)
}

// ── 목표 배합 (기출) + 현재 재고 ─────────────────────────────────────
const DATA = path.resolve('scripts/csat/data')
const dist = JSON.parse(fs.readFileSync(path.join(DATA, 'topic-distribution.json'), 'utf8'))
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const denom = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const share = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / denom]))

const gapFile = path.resolve('docs/reports/topic-gap.json')
if (!fs.existsSync(gapFile)) {
  console.error(
    '소재별 재고를 모른다 — 먼저 돌릴 것: node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json',
  )
  process.exit(1)
}
const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
const stock = Object.fromEntries(gap.rows.map((r) => [r.topic, r.estStock]))

console.log(`NIST 겨냥 수확 — 기술·매체 칸\n${'='.repeat(78)}`)
console.log(
  `  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 배합 기출 ${gap.examClassified}지문 · ` +
    `재고 ${gap.measuredAt.slice(0, 10)} 실측\n`,
)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'부족'.padStart(8)}${'배율'.padStart(8)}`)
console.log('  ' + '-'.repeat(50))
const quota = {}
for (const k of TARGET_KEYS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = stock[k] ?? 0
  quota[k] = Math.max(0, want - have)
  const ratio = (gap.rows.find((r) => r.topic === k)?.ratio ?? 0).toFixed(2)
  const flag = quota[k] > 0 ? (k === '기술·매체' ? '  ← 겨냥' : '') : '  (참)'
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${have.toLocaleString().padStart(8)}` +
      `${quota[k].toLocaleString().padStart(8)}${ratio.padStart(8)}${flag}`,
  )
}
console.log()

// ── 커서 ─────────────────────────────────────────────────────────────
// ⚠️ **판정 뒤에 쓴다.** 받자마자 쓰면 중간에 죽었을 때 안 본 것을 본 것으로 센다.
const CURSOR_FILE = arg('cursor-file') ?? harvestCursorPath('csat', 'nist', FEED)
let cursor = FRESH
  ? { version: 1, source: 'nist', feed: FEED, updated_at: new Date(0).toISOString(), token: null, seen: [], exhausted: false }
  : readHarvestCursor(CURSOR_FILE, 'nist', FEED)
const seenSet = new Set(cursor.seen)

console.log(
  `  ${feed.label} (${feed.id}) — 정찰 실측 ${feed.measured.toLocaleString()}편 · 상한 ${MAX}` +
    `${COMMIT ? ' · **적재한다**' : ' (읽기 전용)'}${IGNORE_QUOTA ? ' · 몫 무시(명중률 실측)' : ''}`,
)
console.log(`  커서 ${path.relative(process.cwd(), CURSOR_FILE)} — 이미 판정 ${cursor.seen.length}편${FRESH ? ' (무시: --fresh)' : ''}\n`)

// ── ① 사이트맵 전수 열거 ─────────────────────────────────────────────
process.stderr.write('  사이트맵 열거 중…  ')
const listed = await listNistFeed(FEED, {
  gapMs: LIST_GAP_MS,
  onPage: (done, total, found) => process.stderr.write(`\r  사이트맵 ${done}/${total}쪽 · ${feed.prefix} ${found}편   `),
})
process.stderr.write('\r' + ' '.repeat(78) + '\r')
console.log(`  ── 사이트맵 열거 ${'─'.repeat(56)}`)
console.log(`    ${feed.prefix} **${listed.length.toLocaleString()}편** (색인 쪽수 실측 ${NIST_SITEMAP_PAGES_MEASURED} 기준)`)
const withMod = listed.filter((i) => i.lastmod).length
console.log(`    lastmod 있는 것 ${withMod.toLocaleString()} / ${listed.length.toLocaleString()}`)

if (PLAN_ONLY) {
  console.log(`\n    표본 주소 5개:`)
  for (const it of listed.slice(0, 5)) console.log(`      ${it.source_id}`)
  console.log(`\n  --plan 이었다 — 기사 GET 0 · DB 에도 커서에도 쓰지 않았다.`)
  process.exit(0)
}

// ── DB ───────────────────────────────────────────────────────────────
const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

// ── 집계 ─────────────────────────────────────────────────────────────
const n = {
  listed: listed.length,
  seenSkip: 0,
  dup: 0,
  bodyFail: 0,
  noContainer: 0,
  shortSkip: 0,
  nonAsciiSkip: 0,
  fitFail: 0,
  quotaFull: 0,
  inserted: 0,
}
/** 명중률 실측 — 창 단위가 정본이다(정찰 §3: 글 단위로 재면 1위 후보를 반려하게 된다). */
const hit = { articles: 0, windows: 0, techWindows: 0, byTopicWindows: {} }
const byTopic = {}
const samples = []
const failures = []
/** 이번 실행에서 **처분이 끝난** 경로. 통과분은 적재에 성공해야 여기 들어간다. */
const disposed = new Set()

// ② 이미 판정한 것 걸러 내기 (네트워크 0)
const fresh = []
for (const it of listed) {
  if (seenSet.has(it.path)) {
    n.seenSkip++
    continue
  }
  fresh.push(it)
}

// ③ **본문 GET 앞에** 중복을 걸러 낸다 — 편당 GET 이 드는 소스라 순서가 비용을 정한다.
//
// ⚠️ **`.in(source_id, …)` 로 묻지 않는다.** 열쇠가 URL 경로(평균 90자)라 200개만 실어도
//   요청 줄이 22KB 가 되고 PostgREST 가 아니라 **fetch 가** 죽는다
//   (`Headers Overflow Error` — 실측 2026-09-08. 재시도 6회를 다 태우고 「중복 확인 실패」
//   한 줄로 끝나는데, 그 줄을 놓치면 **전량을 새 글로 보고 다시 담는다**).
//   대신 이 소스가 가진 열쇠를 **한 번 다 읽어** 집합으로 만든다 — 상한이 9,013행이라 싸다.
const have = new Set()
let dupCheckOk = true
{
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('library_articles')
      .select('source_id')
      .eq('source', 'nist')
      .range(from, from + PAGE - 1)
    if (error) {
      failures.push(`중복 확인 실패: ${error.message}`)
      dupCheckOk = false
      break
    }
    for (const r of data ?? []) have.add(r.source_id)
    if (!data || data.length < PAGE) break
  }
}
// **중복을 못 확인했으면 담지 않는다.** 빈 집합을 「없음」으로 읽으면 전량을 새 글로 보고
//   다시 담는다 — 오류 없이 재고가 두 배가 되는 그 꼴이다.
if (!dupCheckOk && COMMIT) {
  console.error('\n  ⚠️ 중복 확인에 실패했다 — 적재를 멈춘다(전량 재적재 위험). DB 를 확인하고 다시 돌릴 것.')
  process.exit(1)
}
const candidates = []
for (const f of fresh) {
  if (have.has(f.source_id)) {
    n.dup++
    disposed.add(f.path)
    continue
  }
  candidates.push(f)
}
console.log(`    이미 판정 ${n.seenSkip.toLocaleString()} · DB 에 이미 있음 ${n.dup.toLocaleString()} · 후보 ${candidates.length.toLocaleString()}\n`)

// ④ 편마다 본문을 받아 채점한다
const passed = []
for (const it of candidates) {
  const took = Object.values(byTopic).reduce((a, b) => a + b, 0)
  if (took >= MAX) break

  let got = null
  try {
    got = await fetchNistArticle(it.url)
  } catch (e) {
    const msg = String(e.message)
    if (/본문 컨테이너/.test(msg)) {
      // **글 자체의 성질**이다(오디오·행사 페이지). 다시 GET 할 이유가 없으므로 처분으로 친다.
      n.noContainer++
      disposed.add(it.path)
    } else {
      // 일시적일 수 있다 — `seen` 에 넣지 않는다(GET 한 번 vs 영영 구멍).
      n.bodyFail++
      failures.push(`본문 실패 ${it.path}: ${msg.slice(0, 90)}`)
    }
  }
  await sleep(GAP_MS)
  if (!got) continue

  if (got.words < NIST_MIN_WORDS) {
    n.shortSkip++
    disposed.add(it.path)
    continue
  }
  if (got.body.nonAsciiRatio > NIST_MAX_NON_ASCII) {
    n.nonAsciiSkip++
    disposed.add(it.path)
    continue
  }

  // ── 명중률 실측: **창 단위**로 센다. 게이트 통과 여부와 무관하게 기록한다 ──
  //    정찰 §3 의 자와 같은 방법이어야 26.7% 가 재현되는지 말할 수 있다.
  const sents = got.content.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 3)
  {
    let acc = []
    let count = 0
    for (const s of sents) {
      acc.push(s)
      count += (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
      if (count >= 180) {
        const w = classify(acc.join(' '), { title: got.title })
        hit.windows++
        hit.byTopicWindows[w.topic] = (hit.byTopicWindows[w.topic] ?? 0) + 1
        if (w.topic === '기술·매체') hit.techWindows++
        acc = []
        count = 0
      }
    }
  }
  hit.articles++

  const sc = scoreArticle(got.content)
  if (sc.pass <= 0) {
    n.fitFail++
    disposed.add(it.path)
    continue
  }
  // 제목은 소재의 가장 강한 단서다 — 분류기에 **반드시 함께 넘긴다**.
  const tp = classify(got.content.slice(0, 6000), { title: got.title })
  const room = (quota[tp.topic] ?? 0) - (byTopic[tp.topic] ?? 0)
  if (!IGNORE_QUOTA && room <= 0) {
    // **미룬 것이지 거절한 것이 아니다** — `seen` 에 넣으면 몫이 열려도 다시 못 본다.
    n.quotaFull++
    continue
  }
  byTopic[tp.topic] = (byTopic[tp.topic] ?? 0) + 1
  if (samples.length < 8) {
    samples.push({ title: got.title.slice(0, 58), topic: tp.topic, pass: sc.pass, words: got.words })
  }
  passed.push({
    source: 'nist',
    source_id: got.source_id,
    title: got.title,
    author: got.author,
    source_url: got.url,
    published_at: got.published_at,
    license: 'Public Domain (US Government)',
    content: got.content,
    status: 'queued',
    feed_id: 'harvest',
    feed_label: `겨냥 수확 · ${feed.label} · ${tp.topic}`,
    // 소재를 **적재 시점에 함께 적는다** — 안 적으면 전수 집계에서 이 행들이 빠진다.
    csat_fit: { ...fitRecord(got.content), topic: tp.topic, topicMargin: tp.margin, topicV: TOPIC_V },
    _path: it.path,
  })
  process.stderr.write(`\r  본문 ${hit.articles} · 받음 ${passed.length}   `)
}
process.stderr.write('\r' + ' '.repeat(78) + '\r')

// ⑤ 적재
if (COMMIT && passed.length) {
  const toWrite = passed.map(({ _path, ...row }) => row)
  const { error } = await db.from('library_articles').insert(toWrite)
  if (error) {
    failures.push(`적재 실패: ${error.message}`)
    for (const r of passed) byTopic[r.csat_fit.topic] = (byTopic[r.csat_fit.topic] ?? 1) - 1
    // **커서를 전진시키지 않는다.** 통과분이 `seen` 에 없어도 다시 목록에 안 나오는 꼴을 막는다.
    console.log('\n  ⚠️ 적재가 실패해 커서를 전진시키지 않았다 — 다음 실행이 이 후보들을 다시 본다.')
  } else {
    n.inserted = toWrite.length
    for (const r of passed) disposed.add(r._path)
  }
}

// ⑥ 커서는 **여기서** 전진한다 — 판정과 적재가 끝난 뒤.
if (COMMIT && !failures.some((f) => f.startsWith('적재 실패'))) {
  for (const d of disposed) seenSet.add(d)
  cursor = {
    ...cursor,
    token: null, // 전수 열거라 다음-쪽 토큰이 없다. 상태는 전부 seen 에 있다
    seen: [...seenSet],
    exhausted: candidates.length === 0,
  }
  writeHarvestCursor(CURSOR_FILE, cursor)
}

// ── 보고 ─────────────────────────────────────────────────────────────
console.log(`\n  ── 이번 실행 ${'─'.repeat(58)}`)
console.log(`    사이트맵 ${n.listed.toLocaleString()} · 이미 판정 ${n.seenSkip} · 이미 있음 ${n.dup}`)
console.log(
  `    본문 받음 ${hit.articles} · 본문 실패 ${n.bodyFail} · 컨테이너 없음 ${n.noContainer} · ` +
    `${NIST_MIN_WORDS}어 미만 ${n.shortSkip} · 비ASCII 초과 ${n.nonAsciiSkip}`,
)
console.log(`    창 게이트 탈락 ${n.fitFail} · 몫 참 ${n.quotaFull} · **적재 ${n.inserted}**`)
if (Object.keys(byTopic).length) {
  console.log(
    `    소재별 받음: ${Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
  )
}

console.log(`\n  ── 분류기 명중률 (창 180어 단위 · 정찰 26.7% 와 같은 자) ${'─'.repeat(18)}`)
if (hit.windows === 0) console.log('    창을 하나도 못 만들었다 — 잴 것이 없다.')
else {
  console.log(
    `    본문 ${hit.articles}편 → 창 ${hit.windows}개 · **기술·매체 ${hit.techWindows} (${((100 * hit.techWindows) / hit.windows).toFixed(1)}%)**`,
  )
  console.log(
    `    창 소재 분포: ${Object.entries(hit.byTopicWindows)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}(${((100 * v) / hit.windows).toFixed(0)}%)`)
      .join(' · ')}`,
  )
}

if (samples.length) {
  console.log(`\n  ── 표본 ${'─'.repeat(60)}`)
  for (const s of samples) console.log(`    [${s.topic}] 창 ${s.pass} · ${s.words}어 · ${s.title}`)
}
if (failures.length) {
  console.log(`\n  ⚠️ 실패 ${failures.length}건`)
  for (const f of failures.slice(0, 10)) console.log(`    · ${f}`)
}
if (!COMMIT) console.log(`\n  읽기 전용이었다 — DB 에도 커서에도 쓰지 않았다. 넣으려면 --commit`)
