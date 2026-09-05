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
// ── 발췌가 없다 ──────────────────────────────────────────────────────
// 초록이 **완결된 한 편**이라 100~153어로 창(100~200) 안에 그대로 든다.
// 그래서 `--band` 도 발췌기도 쓰지 않는다 — 자를 것이 없다.
//
// ── 게이트는 다른 소스와 같은 것을 댄다 ──────────────────────────────
// `curriculumFit`(어휘) + `standaloneFit`(자립성). **같은 자를 대지 않으면 같은 구멍이 생긴다** —
// PD 발췌에서 세 축을 통과하고도 지문이 아닌 글이 69% 였다.
//
// 재실행 안전: `(source, source_id)` 로 먼저 조회해 이미 있으면 건너뛴다. 건너뛴 수를 출력한다.
// ⚠️ 기본은 dry-run. `--commit` 없이는 DB 에 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --limit 20
//   pnpm dlx tsx scripts/textbook/frym-ingest.mjs --commit --process --limit 60

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
const DEV_BASE = arg('base') ?? 'http://localhost:3000'

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const { listFrymFeed, ingestFrymArticle, curriculumFit, standaloneFit, PASSAGE_WORDS } =
  await import('../../packages/library-pipeline/src/index.ts')

// 5xx·연결 실패에 물러섰다가 다시 온다. 2026-09-05 에 프로젝트가 RESTARTING 이라
// 152편이 적재만 되고 처리가 조용히 '0건' 으로 끝났다 — 그때 필요했던 것이 이것이다.
const db = createScriptClient()

const list = await listFrymFeed(FEED, LIMIT)
console.log(`FrYM 목록 ${list.length}건 (${FEED})${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}\n`)

let added = 0
let existed = 0
let outOfSpec = 0
let vocabBlocked = 0
let notStandalone = 0
let failed = 0

for (const item of list) {
  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'frym')
    .eq('source_id', item.source_id)
    .maybeSingle()
  if (dup) {
    existed++
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

  const words = (article.content.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
  if (words < PASSAGE_WORDS.min || words > PASSAGE_WORDS.max) {
    // 발췌하지 않는다 — 초록은 완결된 한 편이라 자르면 물음만 남거나 답만 남는다.
    outOfSpec++
    continue
  }

  // 중3 칸을 겨냥하므로 중등 자를 댄다.
  const vf = curriculumFit(article.content, 'middle')
  if (!vf.pass) {
    vocabBlocked++
    console.log(`  ⊘ ${vf.reason} — ${article.title.slice(0, 42)}`)
    continue
  }
  const sf = standaloneFit(article.content)
  if (!sf.pass) {
    notStandalone++
    console.log(`  ⊘ ${sf.reason} — ${article.title.slice(0, 42)}`)
    continue
  }

  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: article.source,
      source_id: article.source_id,
      title: article.title,
      author: article.author,
      source_url: article.source_url,
      published_at: article.published_at ? article.published_at.toISOString() : null,
      license: article.license,
      content: article.content,
      status: 'queued',
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 62)}`)
      continue
    }
  }
  added++
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(words).padStart(4)}어  밖 ${String(vf.coverage.outsidePct).padStart(5)}%  ` +
      `자리 ${String(vf.marketPercentile ?? '—').padStart(5)}  ${article.title.slice(0, 44)}`
  )
}

console.log(
  `\n추가 ${added} · 이미 있음 ${existed} · 어수창 밖 ${outOfSpec} · ` +
    `어휘 ${vocabBlocked} · 자립성 ${notStandalone} · 실패 ${failed}`
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
