// scripts/textbook/frym-ingest.mjs
//
// **Frontiers for Young Minds 적재** — 중3 칸을 메우는 유일한 후보.
//
// ── 왜 이 소스인가 (실측 2026-09-05) ─────────────────────────────────
// 학년 칸 재고를 재면 **중3 칸만 비어 있다**(4축 통과 기준):
//
//     초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**
//
// 게다가 채워진 칸들의 **시중 자리가 14.9~34.3** — 지금 재고는 시중보다 쉬운 쪽으로
// 치우쳐 있다. FrYM 은 둘을 함께 겨냥한다(실측 8/8 통과 · 7편이 중3).
//
// ── ⚠️ 초록이 아니라 전문을 받는다 (2026-09-07) ──────────────────────
// **그때 적혀 있던 것**(지우지 않고 남긴다):
//
//   > ── 발췌가 없다 ──
//   > 초록이 **완결된 한 편**이라 100~153어로 창(100~200) 안에 그대로 든다.
//   > 그래서 `--band` 도 발췌기도 쓰지 않는다 — 자를 것이 없다.
//
// 그 전제가 틀렸다. 적재된 153편 전량이 98~165어인데 그중 51%가 "In this article, we will…"
// 로 **예고하고 끝난다** — 2026-09-06 판정에서 **34편이 `fragmentary` 로 반려**됐다
// (전체 반려율 9.6% 대비 frym 22.2%). 끝 문장을 지워 창을 지키는 것은 34편 중 10편뿐이라
// 잘라내기로는 못 고친다. 이제 `ingestFrymArticle` 이 `/full` 본문을 준다
// (편당 966~1,692어 · 실측 8편) — 그래서 **여기에 발췌 단계가 생긴다.**
// 근거와 그림 참조 처리는 `packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts`.
//
// ── 발췌: `--band` 를 주면 그 칸, 안 주면 드는 칸 ────────────────────
// `--band 중3` 이면 그 칸만 노린다. 안 주면 `fitExcerptToAnyBand` 가 **쉬운 칸부터** 본다.
// **발췌는 변경이다** — CC BY 는 변경을 밝히라고 하므로 제목에 적고, `source_id` 에
// 문단 범위를 남겨 원본과 다른 행으로 dedup 되게 한다(storyweaver-ingest 와 같은 규칙).
//
// ── 게이트는 다른 소스와 같은 것을 댄다 ──────────────────────────────
// `curriculumFit`(어휘) + `standaloneFit`(자립성). **같은 자를 대지 않으면 같은 구멍이 생긴다** —
// PD 발췌에서 세 축을 통과하고도 지문이 아닌 글이 69% 였다.
//
// ── 증분 커서 (2026-09-07 추가) ──────────────────────────────────────
// **없었다.** offset 목록이라 매 실행이 최신 `--limit` 편만 보고 오류 없이 끝났고,
// 미방문 1,667편에 한 번도 닿지 못했다. 이제 Crossref `cursor=*` 딥페이징 +
// `scripts/textbook/data/frym-<feed>-cursor.json` 에 진행을 남긴다.
// 커서에는 **거절한 편도** 적는다 — 그래야 "최적합 제외" 를 다시 GET 하지 않는다.
//
// 재실행 안전: **그렇다.** ① `(source, source_id)` 로 먼저 조회해 건너뛰고
//   ② 커서는 판정 뒤에만 쓰며 ③ dry-run 은 커서를 전진시키지 않는다.
//   중간에 죽으면 마지막으로 저장된 페이지부터 다시 본다(결과 동일).
// ⚠️ 기본은 dry-run. `--commit` 없이는 DB 에도 커서에도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --limit 20
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --band 중3 --limit 20
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --commit --process --limit 60
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --commit --fresh --limit 20   ← 처음부터 다시 훑기

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
const PROCESS = process.argv.includes('--process')
const LIMIT = Number(arg('limit') ?? 20)
const FEED = arg('feed') ?? 'recent'
const BAND = arg('band')
const DEV_BASE = arg('base') ?? 'http://localhost:3000'

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const {
  listFrymFeedPage,
  ingestFrymArticle,
  harvestCursorPath,
  readHarvestCursor,
  writeHarvestCursor,
  stableId,
  sourceKey,
  applyArticleCurationSpec,
  curriculumFit,
  standaloneFit,
  excerptForBand,
  fitExcerptToAnyBand,
  gradeBand,
  READING_LEVEL_BANDS,
} = await import('../../packages/library-pipeline/src/index.ts')

const targetBand = BAND ? gradeBand(BAND) : null
if (BAND && !targetBand) {
  console.error(
    `알 수 없는 학년 칸: ${BAND} — 쓸 수 있는 것: ${READING_LEVEL_BANDS.map((b) => b.id).join(' · ')}`
  )
  process.exit(1)
}

/**
 * 발췌기는 **문단 배열**을 받는다. 본문은 문단마다 줄이 나뉘어 온다.
 *
 * ⚠️ **소제목 줄을 뺀다.** `htmlToPlainText` 가 `<h2>` 를 한 줄로 남기는데, 그대로 넘기면
 *   발췌가 "The Big Energy Question In the wild, vampire bats often run…" 처럼
 *   제목과 첫 문장을 한 문단으로 이어 붙인다. 소제목은 문장부호로 끝나지 않고 짧다 —
 *   그 둘을 **함께** 요구해 좁게 잡는다(본문 문장은 거의 다 마침표로 끝난다).
 */
function bodyParagraphs(content) {
  return String(content)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /[.!?"'”’]$/.test(s) || s.split(/\s+/).length > 14)
}

// 5xx·연결 실패에 물러섰다가 다시 온다. 2026-09-05 에 프로젝트가 RESTARTING 이라
// 152편이 적재만 되고 처리가 조용히 '0건' 으로 끝났다 — 그때 필요했던 것이 이것이다.
const db = createScriptClient()

// ── 증분 커서 ─────────────────────────────────────────────────────────
// **2026-09-07 이전에는 이것이 없었다.** `listFrymFeed` 가 offset 으로 훑고 커서를
// 남기지 않아, 매 실행이 최신 `--limit` 편만 보고 **오류 없이 정상 종료**했다.
// 미방문 1,667편에 한 번도 닿지 못한 채로. 규약·형식은
// `packages/library-pipeline/src/ingest-article/harvest-cursor.ts`.
//
// **재실행 안전** — 커서는 한 페이지를 **판정한 뒤에** 쓴다. 중간에 죽으면 그 페이지를
// 다시 보는데, 이미 넣은 것은 `(source, source_id)` 로 걸러지므로 결과가 같다.
// `--fresh` 를 주면 처음부터 다시 훑는다(커서 파일을 지우지는 않고 무시한다).
const CURSOR_FILE = arg('cursor-file') ?? harvestCursorPath('textbook', 'frym', FEED)
const FRESH = process.argv.includes('--fresh')
let cursor = FRESH
  ? { version: 1, source: 'frym', feed: FEED, updated_at: new Date(0).toISOString(), token: null, seen: [], exhausted: false }
  : readHarvestCursor(CURSOR_FILE, 'frym', FEED)
const seen = new Set(cursor.seen)
console.log(
  `커서 ${CURSOR_FILE.replace(process.cwd() + path.sep, '')} — ` +
    `판정 완료 ${seen.size}건 · ${cursor.exhausted ? '소진됨(--fresh 로 재훑기)' : cursor.token ? '이어서' : '처음부터'}`,
)

// 커서 위치에서 **아직 판정하지 않은** 후보를 --limit 만큼 모은다.
// 페이지를 넘길 때마다 커서를 저장하므로, 게이트에서 다 걸러도 진행은 남는다.
const list = []
let listPages = 0
while (list.length < LIMIT && !cursor.exhausted && listPages < 40) {
  const { items: page, nextCursor } = await listFrymFeedPage(FEED, 100, cursor.token)
  listPages++
  // 큐레이션 spec 은 그대로 태운다 — 예전 `listFrymFeed` 가 하던 일이다.
  //   **페이지 안에서만** 적용한다(전역 상위 N 이 아니라) — 딥페이징은 순서가 진행이지 순위가 아니다.
  const items = applyArticleCurationSpec(page, 'frym', FEED)
  for (const it of items) {
    if (seen.has(stableId('frym', { doi: it.source_id.replace(/^frym:/, '') }))) continue
    list.push(it)
  }
  cursor = { ...cursor, token: nextCursor, exhausted: nextCursor === null }
  if (!COMMIT) break // dry-run 은 커서를 전진시키지 않는다 — 안 본 것을 본 것으로 세지 않는다.
  writeHarvestCursor(CURSOR_FILE, cursor)
  if (nextCursor === null) break
  await new Promise((z) => setTimeout(z, 300))
}
list.length = Math.min(list.length, LIMIT)

console.log(
  `FrYM 목록 ${list.length}건 (${FEED} · ${listPages}쪽)${COMMIT ? '' : ' — dry-run (쓰지 않는다 · 커서도 전진하지 않는다)'}\n`,
)

let added = 0
let existed = 0
/** 전문에서 어느 칸에도 드는 조각을 못 떼어 낸 편. **세서 말한다** — 조용히 넘기면 수율을 모른다. */
let outOfSpec = 0
let vocabBlocked = 0
let notStandalone = 0
let failed = 0

/**
 * **판정이 끝난 편**을 커서에 적는다 — 넣은 것뿐 아니라 **거절한 것도** 적는다.
 * 사용자 요구가 그것이다("이미 과거에 확보·제외·최적합 제외 등 중복 작업이 안 되도록").
 * ⚠️ 네트워크 실패(`failed`)는 적지 않는다 — 그건 판정이 아니라 사고다. 다음 회차가 다시 본다.
 */
const judged = new Set()
const mark = (it) => judged.add(stableId('frym', { doi: it.source_id.replace(/^frym:/, '') }))

for (const item of list) {
  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'frym')
    .eq('source_id', item.source_id)
    .maybeSingle()
  if (dup) {
    existed++
    mark(item)
    continue
  }

  let article
  try {
    article = await ingestFrymArticle(item.url)
  } catch (e) {
    // 라이선스를 글에서 못 읽은 것도 여기로 온다 — **넣지 않는 편이 되돌리기 쉽다.**
    failed++
    console.log(`  ✗ ${String(e.message).slice(0, 66)}`)
    continue
  }
  await new Promise((z) => setTimeout(z, 600))

  // ── 발췌 ────────────────────────────────────────────────────────────
  // 전문은 966~1,692어라 통째로는 창(100~200) 밖이다. 문단 경계에서만 자르고,
  // **자른 뒤 다시 잰다**(발췌는 FK 를 −3.74 ~ +2.05 움직인다 — `textbook/excerpt.ts`).
  const paragraphs = bodyParagraphs(article.content)
  const ex = targetBand
    ? excerptForBand(paragraphs, targetBand)
    : fitExcerptToAnyBand(paragraphs)
  if (!ex) {
    outOfSpec++
    mark(item)
    console.log(`  ⊘ 창에 드는 조각이 없다 — ${article.title.slice(0, 46)}`)
    continue
  }

  const row = {
    // 문단 범위를 열쇠에 남긴다 — 원본과 다른 글로 dedup 되고,
    //   나중에 "이게 전문인가 조각인가" 를 물을 수 있다.
    source_id: sourceKey('frym', { doi: article.source_id.replace(/^frym:/, '') }, { start: ex.start, end: ex.end }),
    // **CC BY 는 변경을 밝히라고 한다.** 발췌는 변경이다 — 제목에 적는다.
    title: `${article.title} (${ex.start === 0 ? '앞부분' : `${ex.start + 1}문단부터`} 발췌)`,
    content: ex.text,
    note: `FK ${ex.fk} · ${ex.band} · ${ex.words}어 · ${ex.end - ex.start}문단`,
  }
  // 발췌본은 열쇠가 다르므로 중복 검사를 다시 한다.
  const { data: dup2 } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'frym')
    .eq('source_id', row.source_id)
    .maybeSingle()
  if (dup2) {
    existed++
    mark(item)
    continue
  }

  // 어휘 자는 **발췌가 든 칸**이 정한다 — 초등 자와 중등 자는 문턱도 분포도 다르다.
  const school = (targetBand ?? READING_LEVEL_BANDS.find((b) => b.id === ex.band))?.school ?? 'middle'
  const vf = curriculumFit(row.content, school)
  if (!vf.pass) {
    vocabBlocked++
    mark(item)
    console.log(`  ⊘ ${vf.reason} — ${row.title.slice(0, 42)}`)
    continue
  }
  const sf = standaloneFit(row.content)
  if (!sf.pass) {
    notStandalone++
    mark(item)
    console.log(`  ⊘ ${sf.reason} — ${row.title.slice(0, 42)}`)
    continue
  }

  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: article.source,
      source_id: row.source_id,
      title: row.title,
      author: article.author,
      source_url: article.source_url,
      published_at: article.published_at ? article.published_at.toISOString() : null,
      license: article.license,
      content: row.content,
      status: 'queued',
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 62)}`)
      continue
    }
  }
  added++
  mark(item)
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(ex.words).padStart(4)}어  ${row.note.padEnd(34)}` +
      `밖 ${String(vf.coverage.outsidePct).padStart(5)}%  ` +
      `자리 ${String(vf.marketPercentile ?? '—').padStart(5)}  ${article.title.slice(0, 40)}`
  )
}

// ── 커서 저장 ─────────────────────────────────────────────────────────
// **판정 뒤에** 쓴다. dry-run 은 쓰지 않는다 — 안 본 것을 본 것으로 세면 구멍이 영영 남는다.
if (COMMIT && judged.size > 0) {
  writeHarvestCursor(CURSOR_FILE, { ...cursor, seen: [...seen, ...judged] })
}

console.log(
  `\n추가 ${added} · 이미 있음 ${existed} · 발췌 실패 ${outOfSpec} · ` +
    `어휘 ${vocabBlocked} · 자립성 ${notStandalone} · 실패 ${failed}` +
    (targetBand ? ` (목표 칸 ${targetBand.id})` : ' (드는 칸 아무거나)')
)
console.log(
  `커서 — 판정 완료 ${seen.size} → ${COMMIT ? new Set([...seen, ...judged]).size : seen.size}` +
    ` · ${cursor.exhausted ? '목록 소진' : '이어서 볼 것 남음'}`,
)
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')

if (PROCESS) {
  // ⚠️ **error 를 버리지 않는다.** 처음엔 `const { data: queued } = …` 로 받아
  //   조회가 실패해도 "처리 대상 0건" 으로 조용히 끝났다 — DB 에는 152편이 `queued` 였는데.
  //   **0건은 "없다" 일 수도 "못 물어봤다" 일 수도 있고, 둘은 완전히 다른 상황이다.**
  const { data: queued, error: qErr } = await db
    .from('library_articles')
    .select('id, title')
    .eq('source', 'frym')
    .eq('status', 'queued')
    .limit(1000)
  if (qErr) throw new Error('대기 목록 조회 실패: ' + qErr.message)
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
        console.log(`  ✗ 연결 실패 — dev 서버가 떠 있나? ${String(e.message).slice(0, 44)}`)
      continue
    }
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.ok) {
      done++
      if (done <= 3) console.log(`  ✓ ${j.cefr_level ?? '-'}  ${a.title.slice(0, 44)}`)
    } else {
      procFailed++
      if (procFailed <= 3) console.log(`  ✗ ${res.status} ${JSON.stringify(j).slice(0, 88)}`)
    }
  }
  console.log(`\n처리 ${done} · 실패 ${procFailed}`)
}
