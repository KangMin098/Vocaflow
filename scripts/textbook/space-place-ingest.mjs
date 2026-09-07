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
  spacePlaceParagraphs,
  excerptForBand,
  gradeBand,
  passesCurriculumGate,
  PASSAGE_WORDS,
} = await import('../../packages/library-pipeline/src/index.ts')

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

for (const item of list) {
  let article
  try {
    article = await ingestSpacePlaceArticle(item.url)
  } catch (e) {
    failed++
    console.log(`  ✗ ${String(e.message).slice(0, 62)}`)
    continue
  }
  await new Promise((z) => setTimeout(z, 700))

  const words = (article.content.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
  let row = {
    source_id: article.source_id,
    title: article.title,
    content: article.content,
    note: null,
  }

  if (words < PASSAGE_WORDS.min || words > PASSAGE_WORDS.max) {
    if (!targetBand) {
      outOfSpec++
      continue
    }
    // 통째로는 창 밖 — 문단 경계에서 그 칸에 드는 조각을 만든다.
    const paras = spacePlaceParagraphs(
      await (await fetch(item.url, { headers: { 'user-agent': UA } })).text()
    )
    const ex = paras.length ? excerptForBand(paras, targetBand) : null
    if (!ex) {
      outOfSpec++
      continue
    }
    row = {
      // 문단 범위를 열쇠에 남긴다 — 원본과 다른 글로 dedup 되고 나중에 되짚을 수 있다.
      source_id: `${article.source_id}#p${ex.start + 1}-${ex.end}`,
      // **PD 라도 변경은 밝힌다** — 학습자가 이게 전문인지 조각인지 알아야 한다.
      title: `${article.title} (${ex.start === 0 ? '앞부분' : `${ex.start + 1}문단부터`} 발췌)`,
      content: ex.text,
      note: `FK ${ex.fk} · ${ex.band} · ${ex.words}어`,
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
  `\n추가 ${added} · 이미 있음 ${existed} · 규격 밖 ${outOfSpec} · **어휘 가드 차단 ${vocabBlocked}** · 실패 ${failed}`
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
