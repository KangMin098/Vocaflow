// scripts/textbook/nasa-date-backfill.mjs
//
// **발행일이 비어 있는 NASA 글에 날짜를 되메운다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `ingest-article/nasa.ts` 가 날짜를 `article:published_time` 과 `<time datetime>` 에서만
// 찾고 있었다. `image-article`·`image-detail` 쪽에는 둘 다 없고 `parsely-pub-date` ·
// `og:updated_time` 에 담긴다 — 그래서 **초·중 창 NASA 지문 110편 중 92편이 발행일 없음**
// 으로 들어와 있었다(원문 축 B5 가 잡아냈다).
//
// 어댑터는 고쳤지만 **이미 들어온 글은 저절로 채워지지 않는다.** 이 스크립트가 그 몫이다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// `published_at IS NULL` 인 것만 고른다. 값이 있는 글은 **건드리지 않는다** — 이미 맞게
// 들어온 발행일을 나중에 받은 수정 시각으로 덮으면 그게 더 나쁘다.
// 몇 번 돌려도 결과가 같고, 중간에 끊겨도 다음 실행이 남은 것부터 잇는다.
//
// ⚠️ **기본은 dry-run 이다.** `--commit` 없이는 DB 에 쓰지 않는다.
//   `og:updated_time` 밖에 없는 쪽은 *고친* 시각이라 발행일과 다를 수 있다 —
//   그 몫이 몇 편인지 따로 세어 출력한다. 눈으로 보고 나서 쓰라는 뜻이다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/nasa-date-backfill.mjs            # dry-run
//   pnpm dlx tsx scripts/textbook/nasa-date-backfill.mjs --commit
//   pnpm dlx tsx scripts/textbook/nasa-date-backfill.mjs --limit 20

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
const LIMIT = Number(arg('limit') ?? 500)

const { createClient } = await import('@supabase/supabase-js')
const { NASA_DATE_PATTERNS } = await import('../../packages/library-pipeline/src/ingest-article/nasa.ts')
const { extractFirst } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const UA = 'Vocaflow-DateBackfill/1.0 (+https://vocaflow.app; contact killerapp51@empal.com)'

const { data: rows, error } = await db
  .from('library_articles')
  .select('id, title, source_url')
  .eq('source', 'nasa')
  .is('published_at', null)
  .not('source_url', 'is', null)
  .limit(LIMIT)
if (error) throw new Error('조회 실패: ' + error.message)

console.log(`발행일 없는 NASA 글 ${rows.length}편${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}\n`)

let filled = 0
let fromUpdated = 0
let miss = 0
let failed = 0

for (const r of rows) {
  let html = ''
  try {
    const res = await fetch(r.source_url, { headers: { 'user-agent': UA } })
    if (!res.ok) {
      failed++
      console.log(`  ✗ HTTP ${res.status}  ${r.title?.slice(0, 52)}`)
      continue
    }
    html = await res.text()
  } catch (e) {
    failed++
    console.log(`  ✗ ${String(e.message).slice(0, 40)}  ${r.title?.slice(0, 45)}`)
    continue
  }

  const raw = extractFirst(html, NASA_DATE_PATTERNS)
  if (!raw) {
    miss++
    continue
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    miss++
    continue
  }

  // 발행 시각이 아니라 **고친** 시각으로 채운 것이 몇 편인지 따로 센다 — 같은 값이 아니다.
  const onlyUpdated = !/parsely-pub-date|article:published_time/i.test(html)
  if (onlyUpdated) fromUpdated++

  if (COMMIT) {
    // `published_at IS NULL` 을 조건에 다시 건다 — 조회와 쓰기 사이에 다른 세션이
    // 채웠을 수 있다. 이 저장소는 워크스페이스를 여러 세션이 나눠 쓴다.
    const { error: e2 } = await db
      .from('library_articles')
      .update({ published_at: d.toISOString() })
      .eq('id', r.id)
      .is('published_at', null)
    if (e2) {
      failed++
      console.log(`  ✗ 쓰기 실패 ${e2.message.slice(0, 40)}`)
      continue
    }
  }
  filled++
  if (filled <= 6) {
    console.log(
      `  ${COMMIT ? '✓' : '·'} ${d.toISOString().slice(0, 10)}${onlyUpdated ? ' (수정시각)' : '          '}  ${r.title?.slice(0, 46)}`
    )
  }
  await new Promise((z) => setTimeout(z, 350)) // 남의 서버다.
}

console.log(
  `\n채움 ${filled} · 그중 수정시각으로 채운 것 ${fromUpdated} · 날짜 못 찾음 ${miss} · 실패 ${failed}`
)
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')
