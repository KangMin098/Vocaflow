// scripts/lcp/backfill-se-chapter-hrefs.mjs
//
// Standard Ebooks 기존 적재 도서의 챕터별 원본 deep-link(source_href) 백필.
//   ingest(SE TOC 매핑 신규) → normalize → segment 까지만 재실행하여 chapter_idx → source_href 를
//   얻고, library_chapters_master.source_href 만 UPDATE (본문/어휘 미변경 — analyze/insert 미호출).
//
// 챕터 분할 로직(findChapterBoundaries · mergeShortChapters)을 그대로 재사용하므로 적재된
//   chapter_idx 와 1:1 정합 (마커는 href 만 append — 경계 감지 불변).
//
// 실행:  pnpm dlx tsx scripts/lcp/backfill-se-chapter-hrefs.mjs [--commit] [book_id]
//        --commit 없으면 dry-run (매핑 통계만 출력). book_id 주면 그 책만.
//
// 안전: source_href 컬럼만 UPDATE. 매핑된 챕터만 SET (미매핑은 NULL 유지 → 렌더가 도서 TOC fallback).

import fs from 'node:fs'
import path from 'node:path'

// .env.local 로드
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const onlyBookId = process.argv.find((a) => /^[0-9a-f-]{36}$/i.test(a)) ?? null

const { createClient } = await import('@supabase/supabase-js')
const pipeline = await import('@vocaflow/library-pipeline')
const { ingestFromStandardEbooks, normalizeBook, segmentBook } = pipeline

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let q = db
  .from('library_books')
  .select('id, title, source_id, chapter_count')
  .eq('source', 'standard_ebooks')
  .order('title', { ascending: true })
if (onlyBookId) q = q.eq('id', onlyBookId)
const { data: books, error: booksErr } = await q
if (booksErr) {
  console.error('books query failed:', booksErr.message)
  process.exit(1)
}

console.log(`\n${commit ? '[COMMIT]' : '[DRY-RUN]'} Standard Ebooks 챕터 href 백필 — ${books.length}권\n`)

let totalMapped = 0
let totalChapters = 0
for (const b of books) {
  try {
    const raw = await ingestFromStandardEbooks(b.source_id)
    const normd = normalizeBook(raw)
    const chapters = segmentBook(normd)

    // 적재된 DB 챕터 (UPDATE 대상 — 이게 진실. seg 는 href 공급원일 뿐)
    const { data: dbCh, error: dbErr } = await db
      .from('library_chapters_master')
      .select('chapter_idx, chapter_title, group_label')
      .eq('library_book_id', b.id)
      .order('chapter_idx', { ascending: true })
    if (dbErr) throw new Error(`db chapters: ${dbErr.message}`)
    const dbRows = dbCh ?? []

    // seg → (group,title) → href 맵 (href 있는 챕터만). 중복 키는 모호 → 제외.
    const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    const keyOf = (g, t) => norm(g) + '' + norm(t)
    const titleMap = new Map()
    const dupKeys = new Set()
    for (const c of chapters) {
      if (!c.source_href || !c.chapter_title) continue
      const k = keyOf(c.group_label, c.chapter_title)
      if (titleMap.has(k)) dupKeys.add(k)
      else titleMap.set(k, c.source_href)
    }
    const countAligned = chapters.length === dbRows.length

    // DB 챕터별 href 결정: (1) (group,title) 조인 → (2) count 정합 시 idx 조인 fallback
    const updates = []
    for (const r of dbRows) {
      let href = null
      if (r.chapter_title) {
        const k = keyOf(r.group_label, r.chapter_title)
        if (titleMap.has(k) && !dupKeys.has(k)) href = titleMap.get(k)
      }
      if (!href && countAligned) {
        const seg = chapters[r.chapter_idx - 1]
        if (seg?.source_href) href = seg.source_href
      }
      if (href) updates.push({ idx: r.chapter_idx, href })
    }

    totalChapters += dbRows.length
    totalMapped += updates.length

    const drift = countAligned ? '' : `  ⚠ seg=${chapters.length}≠DB=${dbRows.length}→title-join`
    const zero = dbRows.length === 0 ? '  ⚠ 0 DB rows (미적재)' : ''
    console.log(
      `• ${b.title.padEnd(46)} mapped=${String(updates.length).padStart(3)}/${String(dbRows.length).padStart(3)}${drift}${zero}`,
    )

    if (commit && updates.length > 0) {
      for (const u of updates) {
        const { error: upErr } = await db
          .from('library_chapters_master')
          .update({ source_href: u.href })
          .eq('library_book_id', b.id)
          .eq('chapter_idx', u.idx)
        if (upErr) console.warn(`    idx ${u.idx} update failed: ${upErr.message}`)
      }
    }

    // 샘플 3개 (검증용)
    for (const u of updates.slice(0, 3)) console.log(`      [${u.idx}] ${u.href}`)
  } catch (e) {
    console.warn(`• ${b.title} — FAILED: ${e instanceof Error ? e.message : String(e)}`)
  }
  await sleep(2500) // SE rate-limit 예의 (≈ 5 req / 60s per book × 3 fetch)
}

console.log(
  `\n${commit ? '적용 완료' : 'dry-run 종료'} — 총 ${totalMapped}/${totalChapters} 챕터 매핑` +
    `${commit ? ' (source_href UPDATE)' : ' (미적용)'}\n`,
)
process.exit(0)
