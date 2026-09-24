// scripts/textbook/space-place-ingest.mjs
//
// **NASA Space Place 적재** — 두 관문(robots · 저작권 고지)을 다 통과한 유일한 소스.
//
// 라이선스: nasa.gov 이용 규정이 **교재를 이름으로 지목한다** —
//   "text-book authors may use NASA content without needing explicit permission …
//    used in a factual manner that does not imply endorsement."
//
// ── 통째로 넣을 것과 잘라 넣을 것 ────────────────────────────────────
// 실측(표본 29편): 어수 p25 250 · 중앙 354 · p75 609 · FK 중앙 6.63(초6~중1).
// **난이도는 초·중 한가운데인데 길이가 창(100~200어) 밖**이라 대부분 발췌가 필요하다.
//
//   창 안이면            → 그대로 넣는다
//   창 밖이면 `--band`   → 문단 경계에서 잘라 그 칸에 드는 조각을 만든다
//
// ⚠️ **자른 뒤 다시 잰다** — 발췌는 난이도를 움직인다(실측 −3.74 ~ +2.05).
//   `excerptForBand` 가 그 규칙을 갖고 있으므로 여기서 다시 짜지 않는다.
//
// ⚠️ **어휘 가드를 함께 건다.** FK 만으로는 학술 어휘를 못 거른다 —
//   NASA 사진 설명글이 FK 는 낮은데 교육과정 밖이 64% 였다. 같은 NASA 라도 이 소스는
//   어린이용으로 쓰였지만, **믿지 않고 잰다.**
//
// ── 원천 먼저 (2026-09-24) ───────────────────────────────────────────
// 발췌는 원천이 아니다(docs/source-check/criteria.md §1). 이제 글마다 **전문을 원천 행**
// (`space_place:<slug>`)으로 먼저 담고, `--band` 발췌는 조각 행(`#p<a>-<b>` ·
// `csat_fit.derived_from.kind = 'excerpt'`)으로 덧붙인다. 어휘 가드는 조각만 가른다.
// 예전 발췌만 있던 글의 원천은 `scripts/textbook/originals-backfill.mjs` 가 채운다.
//
// 재실행 안전: `(source, source_id)` 로 먼저 조회해 이미 있으면 건너뛴다. 건너뛴 수를 출력한다.
// ⚠️ 기본은 dry-run. `--commit` 없이는 DB 에 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/space-place-ingest.mjs --limit 20
//   pnpm dlx tsx scripts/textbook/space-place-ingest.mjs --commit --process --band 초6~중1

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
const BAND = arg('band')
const DEV_BASE = arg('base') ?? 'http://localhost:3000'

const { createClient } = await import('@supabase/supabase-js')
const {
  listSpacePlaceFeed,
  ingestSpacePlaceArticle,
  isShortBodyError,
  spacePlaceParagraphs,
  excerptForBand,
  gradeBand,
  passesCurriculumGate,
  PASSAGE_WORDS,
} = await import('../../packages/library-pipeline/src/index.ts')
const { ensureOriginal, fragmentCsatFit } = await import('./_originals.mjs')

const targetBand = BAND ? gradeBand(BAND) : null
if (BAND && !targetBand) {
  console.error(`알 수 없는 학년 칸: ${BAND}`)
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const UA = 'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research)'

const list = await listSpacePlaceFeed('all', LIMIT)
console.log(
  `NASA Space Place 목록 ${list.length}건${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}` +
    `${targetBand ? ` · 목표 ${targetBand.id}` : ''}\n`
)

let added = 0
let existed = 0
let outOfSpec = 0
let vocabBlocked = 0
let failed = 0
let shortBody = 0
let emptyBody = 0
/** 원천 행 — 새로 담음(dry-run 은 담을 예정). 조각 수(`added`)와 따로 센다. */
let originalsAdded = 0

for (const item of list) {
  let article
  try {
    article = await ingestSpacePlaceArticle(item.url)
  } catch (e) {
    // 짧은 본문은 **버리지 않는다**(사용자 결정 2026-09-23 — 길이로 원문을 제외하지 않는다).
    //   본문이 있으면 아래 발췌·창 판정으로 그대로 흘린다 — 창이 가른다, 길이 하한이 아니라.
    //   빈 본문(0어)은 파서 고장 신호라 따로 세고, 판정으로 적지 않는다(파서를 고치면 되살아난다).
    if (isShortBodyError(e) && !e.isEmpty && e.article) {
      shortBody++
      article = e.article
    } else if (isShortBodyError(e)) {
      emptyBody++
      console.log(`  ✗ 빈 본문(파서 확인) ${item.url}`)
      continue
    } else {
      failed++
      console.log(`  ✗ ${String(e.message).slice(0, 62)}`)
      continue
    }
  }
  await new Promise((z) => setTimeout(z, 700))

  const words = (article.content.match(/[A-Za-z][A-Za-z'-]*/g) || []).length

  // ── 원천 먼저 (2026-09-24) — 전문을 원천 행으로 ─────────────────────
  // 게이트·발췌보다 **앞에** 둔다. 어휘 가드·창은 조각을 가를 뿐 원천을 버리지 않는다.
  let parent
  try {
    parent = await ensureOriginal(db, { article }, { commit: COMMIT })
  } catch (e) {
    failed++
    console.log(`  ✗ ${String(e.message).slice(0, 72)}`)
    continue
  }
  if (parent.status === 'existed') existed++
  else if (parent.status === 'empty') emptyBody++
  else originalsAdded++
  console.log(
    `  ${COMMIT ? '✓' : '·'} 원천 ${String(parent.words).padStart(4)}어  ${parent.status.padEnd(8)} ${article.title.slice(0, 44)}`
  )

  // 조각은 `--band` 를 주고 전문이 그 칸의 창 밖일 때만 만든다. 그 밖에는 원천이 곧 지문 후보다.
  if (!targetBand || (words >= PASSAGE_WORDS.min && words <= PASSAGE_WORDS.max)) continue

  let row = null

  // ⚠️ **길이는 확보 여부를 가르지 않는다**(2026-09-23 사용자 결정 · DD-79).
  //   예전에는 창(100~200어) 밖이고 `--band` 가 없으면 `outOfSpec` 으로 **버렸다** —
  //   이 소스의 어수 중앙값이 354 이므로 그 규칙이 대부분을 버리고 있었다.
  //   원문은 지문이 아니다. 자를지 말지는 교재 생성이 유형별 창으로 정한다
  //   (`compose-unit.itemWordSpec` — 문장 6~40 · 학교 문단 40~200 · 수능 90~200 · 장문 260~400).
  //   `--band` 를 준 경우에만 **덧붙여** 발췌를 만든다. 못 만들어도 전문은 담는다.
  {
    // 통째로는 그 칸의 창 밖 — 문단 경계에서 그 칸에 드는 조각을 만든다.
    const paras = spacePlaceParagraphs(
      await (await fetch(item.url, { headers: { 'user-agent': UA } })).text()
    )
    const ex = paras.length ? excerptForBand(paras, targetBand) : null
    if (!ex) {
      // 조각을 못 만들어도 **원천은 이미 담았다** — 길이로 버리지 않는다.
      outOfSpec++
      continue
    } else {
      row = {
        // 문단 범위를 열쇠에 남긴다 — 원본과 다른 글로 dedup 되고 나중에 되짚을 수 있다.
        source_id: `${article.source_id}#p${ex.start + 1}-${ex.end}`,
        // **PD 라도 변경은 밝힌다** — 학습자가 이게 전문인지 조각인지 알아야 한다.
        title: `${article.title} (${ex.start === 0 ? '앞부분' : `${ex.start + 1}문단부터`} 발췌)`,
        content: ex.text,
        note: `FK ${ex.fk} · ${ex.band} · ${ex.words}어`,
      }
    }
  }

  // **어휘 가드** — FK 가 통과시켜도 교육과정 밖이 많으면 그 학년 지문이 아니다.
  // 문턱은 학교급마다 다르다(시중 실측 p90: 초등 43.3% · 중등 44.0%) — 목표 칸이
  // 초등이면 초등 자를 댄다. 칸을 안 정하고 부르면 중등 자가 기본이다.
  const gate = passesCurriculumGate(
    row.content,
    targetBand?.id?.startsWith('초') ? 'elementary' : 'middle'
  )
  if (!gate.pass) {
    vocabBlocked++
    console.log(`  ⊘ ${gate.reason} — ${row.title.slice(0, 42)}`)
    continue
  }

  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'space_place')
    .eq('source_id', row.source_id)
    .maybeSingle()
  if (dup) {
    existed++
    continue
  }

  const w = (row.content.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
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
      csat_fit: fragmentCsatFit(article, parent, 'excerpt'),
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 60)}`)
      continue
    }
  }
  added++
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(w).padStart(4)}어  밖 ${String(gate.coverage.outsidePct).padStart(5)}%  ` +
      `${(row.note ?? '').padEnd(28)}${row.title.slice(0, 40)}`
  )
}

console.log(
  `\n원천 ${originalsAdded} · 조각 추가 ${added} · 이미 있음(원천) ${existed} · 규격 밖 ${outOfSpec} · **어휘 가드 차단 ${vocabBlocked}** · 실패 ${failed} · 짧은 본문(창 판정으로) ${shortBody} · 빈 본문(파서 확인) ${emptyBody}`
)
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')

if (PROCESS) {
  const { data: queued } = await db
    .from('library_articles')
    .select('id, title')
    .eq('source', 'space_place')
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
        console.log(`  ✗ 연결 실패 — dev 서버가 떠 있나? ${String(e.message).slice(0, 44)}`)
      continue
    }
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.ok) {
      done++
      if (done <= 3) console.log(`  ✓ ${j.cefr_level ?? '-'}  ${a.title.slice(0, 42)}`)
    } else {
      procFailed++
      if (procFailed <= 3) console.log(`  ✗ ${res.status} ${JSON.stringify(j).slice(0, 90)}`)
    }
  }
  console.log(`\n처리 ${done} · 실패 ${procFailed}`)
}
