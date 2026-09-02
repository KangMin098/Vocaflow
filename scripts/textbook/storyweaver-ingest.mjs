// scripts/textbook/storyweaver-ingest.mjs
//
// **StoryWeaver 이야기 적재.** 초·중 창의 narrative 재고가 0편이라 그 자리를 메운다.
//
// ── 왜 스크립트인가 ──────────────────────────────────────────────────
// `/api/acp/enqueue` 가 정규 경로이지만 그건 관리자 세션이 필요하다. 이 스크립트는
// 같은 어댑터(`ingestStoryweaverArticle`)를 그대로 부르고 `admin_enqueue_article` 대신
// service-role INSERT 를 쓴다 — **글을 만드는 코드는 한 벌**이라 화면과 결과가 갈리지 않는다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// `(source, source_id)` 로 먼저 조회해 이미 있으면 건너뛴다. 몇 번 돌려도 같은 결과다.
// 건너뛴 수를 반드시 출력한다 — 조용히 건너뛰면 "다 넣었다" 와 "이미 있었다" 를 구별할 수 없다.
//
// ⚠️ **라이선스를 못 읽은 책은 넣지 않는다.** 어댑터가 `restricted` 를 돌려주면 그건
//   "CC 가 아니다" 가 아니라 "모른다" 이고, 모르는 것을 넣으면 나중에 발행 게이트가
//   그것을 **통과시킬 수도** 있다. 넣지 않는 편이 되돌리기 쉽다. 건너뛴 수를 출력한다.
//
// ⚠️ 기본은 dry-run 이다. `--commit` 없이는 DB 에 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/storyweaver-ingest.mjs --limit 12
//   pnpm dlx tsx scripts/textbook/storyweaver-ingest.mjs --commit --level 1 --limit 40

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
const COMMIT = process.argv.includes('--commit')
const LEVEL = arg('level') ?? '1'
const LIMIT = Number(arg('limit') ?? 12)
/**
 * `--process` — 넣은 뒤 `queued` 로 남은 것을 **화면과 같은 라우트**로 처리해 `ready` 로 올린다.
 *
 * 처리 로직을 여기 다시 쓰지 않는다. `/api/acp/dev-process` 가 normalize → analyzeArticle →
 * `word_count`·`register`·`status='ready'` 를 한 벌로 하고 있고, 그걸 베끼면 **화면에서 본 것과
 * 스크립트가 만든 것이 갈린다.** 부르기만 한다 (dev 서버가 3000 에 떠 있어야 한다).
 *
 * ⚠️ `queued` 로 두면 이 글들은 **어디에도 안 보인다** — 지문 재고 질의가
 *   `status in ('ready','published')` 로 세기 때문이다. 넣기만 하고 끝내면 "넣었는데 0" 이 된다.
 */
const PROCESS = process.argv.includes('--process')
const DEV_BASE = arg('base') ?? 'http://localhost:3000'
/**
 * `--band <이름>` — 통째로 넣지 않고 **그 학년 칸에 드는 조각만** 떼어 넣는다.
 *
 * 초5~6 칸(FK 3.5~5.5 ∩ 44~121어)이 후보 표본 400건 중 **0건**이었다. 난이도가 없어서가
 * 아니라 그 난이도의 글이 137~2,787어로 **너무 길어서**였다. L2·L3 을 앞에서 잘라 넣으면
 * 실측 28.6% 가 그 칸에 든다.
 *
 * ⚠️ **발췌는 CC BY 가 말하는 "변경" 이다** — 라이선스가 "indicate if changes were made" 를
 *   요구하므로 제목에 발췌임을 적고 `source_id` 에 쪽 범위를 남긴다. 그래야 원본과 다른
 *   글로 dedup 되고, 나중에 "이게 원문인가 조각인가" 를 물을 수 있다.
 */
const BAND = arg('band')

const { createClient } = await import('@supabase/supabase-js')
const {
  listStoryweaverFeed,
  ingestStoryweaverArticle,
  storyweaverPageText,
  stripPageNumbers,
  excerptForBand,
  gradeBand,
} = await import('../../packages/library-pipeline/src/index.ts')

const targetBand = BAND ? gradeBand(BAND) : null
if (BAND && !targetBand) {
  console.error(`알 수 없는 학년 칸: ${BAND}`)
  process.exit(1)
}

/** 그림책 쪽 글을 순서대로. 발췌기는 문단 배열을 받는다 — 쪽이 곧 문단이다. */
async function storyPages(slug) {
  const res = await fetch(`https://storyweaver.org.in/api/v1/stories/${slug}/read`, {
    headers: { 'user-agent': 'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app)' },
  })
  if (!res.ok) return null
  const j = await res.json()
  return (j?.data?.pages ?? [])
    .filter((p) => p.pageType === 'StoryPage')
    .map((p) => stripPageNumbers(storyweaverPageText(p.html ?? '')))
    .filter(Boolean)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const list = await listStoryweaverFeed(`level-${LEVEL}`, LIMIT)
console.log(`Level ${LEVEL} 목록 ${list.length}건${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}\n`)

/**
 * **같은 이야기가 이미 `library_books` 에 있을 수 있다.**
 *
 * StoryWeaver 는 2026-06 에 **도서(LCP) 경로로 먼저 배선돼 있었다** — 20권이 발행돼 있다.
 * 이 스크립트는 **글(ACP) 경로**라 표가 다르고, 교재 지문 재고를 세는 질의가
 * `library_articles` 만 보므로 글로도 넣어야 한다. 하지만 둘 다 들어가면 학습자가
 * 같은 이야기를 서가와 지문 양쪽에서 만난다.
 *
 * 지우는 것은 데이터 결정이라 여기서 하지 않는다. **세어서 말한다** —
 * 모르고 지나가는 것과 알고 두는 것은 다르다.
 */
const { data: bookRows } = await db
  .from('library_books')
  .select('source_url')
  .eq('source', 'storyweaver')
const bookUrls = new Set((bookRows ?? []).map((b) => b.source_url).filter(Boolean))

let added = 0
let existed = 0
let noLicense = 0
let failed = 0
let alsoBook = 0
/** 발췌해도 그 칸에 못 든 책. **세서 말한다** — 조용히 건너뛰면 수율을 모른다. */
let outOfBand = 0

for (const item of list) {
  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'storyweaver')
    .eq('source_id', item.source_id)
    .maybeSingle()
  if (dup) {
    existed++
    continue
  }

  let article
  try {
    article = await ingestStoryweaverArticle(item.url)
  } catch (e) {
    failed++
    console.log(`  ✗ ${String(e.message).slice(0, 60)}`)
    continue
  }

  if (article.license === 'restricted') {
    // "모른다" 를 "허용" 으로 바꾸지 않는다. 넣지 않는 편이 되돌리기 쉽다.
    noLicense++
    console.log(`  ⊘ 라이선스 미확인 — 건너뜀: ${article.title.slice(0, 46)}`)
    continue
  }

  // ── 발췌 모드 ──────────────────────────────────────────────────────
  // 통째로는 창 밖인 책에서 그 학년 칸에 드는 조각만 떼어 낸다.
  let row = {
    source_id: article.source_id,
    title: article.title,
    content: article.content,
    note: null,
  }
  if (targetBand) {
    // 목록 항목은 `id` 를 갖지 않는다 — 주소에서 slug 를 뽑는다.
    //   처음에 `item.id` 를 썼다가 24건 전부 "쪽을 못 읽었다" 로 나왔다.
    const slug = String(item.url).match(/stories\/([a-z0-9-]+)/i)?.[1]
    const pages = slug ? await storyPages(slug) : null
    if (!pages?.length) {
      failed++
      console.log(`  ✗ 쪽을 못 읽었다: ${article.title.slice(0, 46)}`)
      continue
    }
    const ex = excerptForBand(pages, targetBand)
    if (!ex) {
      outOfBand++
      continue
    }
    row = {
      // 쪽 범위를 열쇠에 남긴다 — 원본과 다른 글로 dedup 되고,
      //   나중에 "이게 원문인가 조각인가" 를 물을 수 있다.
      source_id: `${article.source_id}#p${ex.start + 1}-${ex.end}`,
      // **CC BY 는 변경을 밝히라고 한다.** 발췌는 변경이다 — 제목에 적는다.
      title: `${article.title} (${ex.start === 0 ? '앞부분' : `${ex.start + 1}쪽부터`} 발췌)`,
      content: ex.text,
      note: `FK ${ex.fk} · ${ex.band} · ${ex.words}어 · ${ex.end - ex.start}쪽`,
    }
    // 발췌본은 열쇠가 다르므로 중복 검사를 다시 한다.
    const { data: dup2 } = await db
      .from('library_articles')
      .select('id')
      .eq('source', 'storyweaver')
      .eq('source_id', row.source_id)
      .maybeSingle()
    if (dup2) {
      existed++
      continue
    }
  }

  const words = row.content.split(/\s+/).filter(Boolean).length
  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: article.source,
      source_id: row.source_id,
      title: row.title,
      author: article.author,
      source_url: article.source_url,
      published_at: null,
      license: article.license,
      content: row.content,
      status: 'queued',
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 60)}`)
      continue
    }
  }
  if (bookUrls.has(article.source_url)) alsoBook++
  added++
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(words).padStart(4)}어  ${article.license.padEnd(11)} ` +
      `${row.note ? row.note.padEnd(30) : ''}${row.title.slice(0, 44)}`
  )
}

console.log(
  `\n추가 ${added} · 이미 있음 ${existed} · 라이선스 미확인 건너뜀 ${noLicense} · 실패 ${failed}`
)
if (alsoBook)
  console.log(
    `⚠️  그중 ${alsoBook}편은 이미 library_books 에도 있다 — 같은 이야기를 서가와 지문 양쪽에서 만난다.`
  )
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')

if (PROCESS) {
  const { data: queued } = await db
    .from('library_articles')
    .select('id, title')
    .eq('source', 'storyweaver')
    .eq('status', 'queued')
  console.log(`\n처리 대상 ${queued?.length ?? 0}건 → ${DEV_BASE}/api/acp/dev-process`)

  let done = 0
  let procFailed = 0
  for (const a of queued ?? []) {
    let res
    try {
      res = await fetch(`${DEV_BASE}/api/acp/dev-process`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ article_id: a.id }),
      })
    } catch (e) {
      procFailed++
      if (procFailed <= 2)
        console.log(`  ✗ 연결 실패 — dev 서버가 떠 있나? ${String(e.message).slice(0, 50)}`)
      continue
    }
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.ok) {
      done++
      if (done <= 3) console.log(`  ✓ ${j.cefr_level ?? '-'}  ${a.title.slice(0, 42)}`)
    } else {
      procFailed++
      if (procFailed <= 3) console.log(`  ✗ ${res.status} ${JSON.stringify(j).slice(0, 100)}`)
    }
  }
  console.log(`\n처리 ${done} · 실패 ${procFailed}`)
}
