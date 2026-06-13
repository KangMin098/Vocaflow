// scripts/lcp/reprocess-all-se.mjs
//
// SE 도서 일괄 재처리 — ingest 수정(front/back-matter 제거 + subchapter fix) 적용분 반영.
//   각 책: ingest → segment → (거대 챕터 잔존 검사) → analyze(skipLlm) → 저장 → 난이도 재산정.
//   안전: segment 후에도 max>6×median 거대 챕터면 commit SKIP + 플래그 (under-seg 등 별건 보호).
//         insert_book_analysis 가 DELETE→INSERT 단일 트랜잭션이라 실패 시 기존 데이터 보존.
//   대상: source=standard_ebooks AND status IN (ready, failed). published/archived 제외.
//
// 실행: tsx scripts/lcp/reprocess-all-se.mjs [--commit] [--limit N]
//   --commit 없으면 dry-run (segment 결과 보고만, DB 미변경).

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const force = process.argv.includes('--force') // giant 챕터 잔존해도 commit (미주 제거 우선)
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1] ?? '0', 10) : 0
const idsArg = process.argv.indexOf('--ids')
const ids =
  idsArg >= 0 ? (process.argv[idsArg + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null
const DELAY_MS = 3000 // SE 정중 (≈5/min 가이드 준수)

const { createClient } = await import('@supabase/supabase-js')
const { ingestFromStandardEbooks, normalizeBook, segmentBook, analyzeBook } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'],
  process.env['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false, autoRefreshToken: false } },
)

let q = db
  .from('library_books')
  .select('id, source_id, title, status, chapter_count')
  .eq('source', 'standard_ebooks')
  .order('title', { ascending: true })
// --ids 주면 그 책만 (status 무관), 아니면 ready/failed 전체
q = ids && ids.length > 0 ? q.in('id', ids) : q.in('status', ['ready', 'failed'])
const { data: books, error } = await q
if (error) {
  console.error('book list fetch failed:', error.message)
  process.exit(1)
}
const targets = limit > 0 ? books.slice(0, limit) : books
console.log(`[batch] ${targets.length} SE books · mode=${commit ? 'COMMIT' : 'DRY-RUN'}\n`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (n) => String(n).padStart(2, ' ')

const summary = { ok: [], skipped: [], failed: [], unchanged: [] }
let i = 0
for (const bk of targets) {
  i++
  const tag = `[${fmt(i)}/${targets.length}] ${bk.title}`
  try {
    const raw = await ingestFromStandardEbooks(bk.source_id)
    const norm = normalizeBook(raw)
    const chapters = segmentBook(norm)
    const n = chapters.length
    const wcs = chapters.map((c) => c.word_count)
    const total = wcs.reduce((s, w) => s + w, 0)
    const sorted = [...wcs].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    const max = sorted[sorted.length - 1] ?? 0
    const ratio = median ? max / median : 0
    const giant = n >= 3 && median > 0 && max > 6 * median
    const before = bk.chapter_count ?? 0

    if (n === 0) {
      console.log(`${tag} — SKIP: 0 chapters`)
      summary.skipped.push(`${bk.title} (0 chapters)`)
    } else if (giant && !force) {
      console.log(
        `${tag} — ⚠ SKIP: 거대 챕터 잔존 (${before}→${n}ch, max ${max}=median×${ratio.toFixed(0)}, ${Math.round((max / total) * 100)}%) — under-seg 의심, 수동 검토`,
      )
      summary.skipped.push(`${bk.title} (giant max×${ratio.toFixed(0)})`)
    } else if (!commit) {
      console.log(`${tag} — dry: ${before}→${n}ch (max×${ratio.toFixed(1)})`)
      if (before !== n) summary.ok.push(`${bk.title} (${before}→${n})`)
      else summary.unchanged.push(bk.title)
    } else {
      const result = await analyzeBook(bk.id, norm, chapters, { skipLlm: true })
      await db
        .from('library_books')
        .update({
          word_count: result.word_count,
          chapter_count: result.chapter_count,
          reading_minutes: result.reading_minutes,
          status: 'ready',
          status_message: null,
        })
        .eq('id', bk.id)
      for (const fn of ['backfill_book_lemmas', 'compute_book_vrl', 'compute_book_cefrj', 'compute_book_coverage']) {
        try { await db.rpc(fn, { p_book_id: bk.id }) } catch { /* best-effort */ }
      }
      console.log(
        `${tag} — ✓ ${before}→${n}ch, vocab ${result.words.length}${giant ? ` (⚠ giant×${ratio.toFixed(0)} 잔존 — under-seg 별건)` : ''}`,
      )
      if (giant) summary.skipped.push(`${bk.title} (committed, under-seg×${ratio.toFixed(0)} 잔존)`)
      else if (before !== n) summary.ok.push(`${bk.title} (${before}→${n})`)
      else summary.unchanged.push(bk.title)
    }
  } catch (e) {
    console.log(`${tag} — ✗ ERROR: ${e instanceof Error ? e.message : String(e)}`)
    summary.failed.push(`${bk.title}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (i < targets.length) await sleep(DELAY_MS)
}

console.log('\n========== SUMMARY ==========')
console.log(`변경/처리: ${summary.ok.length}`)
summary.ok.forEach((s) => console.log('  ✓ ' + s))
console.log(`변동 없음: ${summary.unchanged.length}`)
console.log(`스킵(거대 챕터/0): ${summary.skipped.length}`)
summary.skipped.forEach((s) => console.log('  ⚠ ' + s))
console.log(`실패: ${summary.failed.length}`)
summary.failed.forEach((s) => console.log('  ✗ ' + s))
