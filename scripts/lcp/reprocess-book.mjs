// scripts/lcp/reprocess-book.mjs
//
// ⚠️ 이 스크립트는 **로직 파이프라인 전체 재실행**(CLI 일회성)용입니다.
//    routine dev 처리는 Admin "Dev 일괄 처리" 버튼 → /api/lcp/dev-process 가 담당하므로,
//    book_curation_jobs 큐 드레인 시에는 이 스크립트를 쓰지 마세요(로직 중복 = 비효율).
//    큐 드레인의 Claude Code 작업은 build-librivox-map.mjs(매핑) 만 사용합니다.
//    이 스크립트는 ingest/segment 로직을 코드로 고친 뒤 기존 도서를 일괄 재분절할 때만.
//
// LCP 도서 재처리 (CLI) — /api/lcp/dev-process 와 동일 동작을 HTTP/토큰 없이 직접 수행.
//   ingest → normalize → segment → analyze(skipLlm) → insert_book_analysis(교체) →
//   meta 갱신 → backfill_book_lemmas → compute_book_vrl/cefrj/coverage.
//
// 용도: SE ingest 수정(front/back-matter 제거 + subchapter 오매칭 fix) 적용 후
//       기존 적재 도서의 챕터 재분할(미주 제거·간지 병합).
//
// 실행:  pnpm dlx tsx scripts/lcp/reprocess-book.mjs <book_id> [--commit]
//        (tsx 로 실행 — 워크스페이스 TS 패키지 import. --commit 없으면 dry-run: segment 만)
//
// 안전: insert_book_analysis 가 기존 챕터/어휘를 DELETE 후 재INSERT (교체). skipLlm 으로 LLM 0.
//       cefr_level/confidence 는 보존(heuristic 덮어쓰기 방지) — 구조 필드만 갱신.

import fs from 'node:fs'
import path from 'node:path'

// 1) .env.local 로드 (정적 import 전에 set — 패키지가 lazy 하게 읽음)
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const bookId = process.argv[2]
const commit = process.argv.includes('--commit')
if (!bookId) {
  console.error('usage: tsx scripts/lcp/reprocess-book.mjs <book_id> [--commit]')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const pipeline = await import('@vocaflow/library-pipeline')
const {
  ingestFromGutenberg,
  ingestFromStandardEbooksResilient,
  ingestFromWikibooks,
  ingestFromWikisource,
  ingestFromLibriVox,
  ingestFromOpenStax,
  ingestFromSimpleWikipedia,
  ingestFromLit2Go,
  normalizeBook,
  segmentBook,
  analyzeBook,
} = pipeline

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const INGEST = {
  gutenberg: ingestFromGutenberg,
  standard_ebooks: ingestFromStandardEbooksResilient,
  wikibooks: ingestFromWikibooks,
  wikisource: ingestFromWikisource,
  librivox: ingestFromLibriVox,
  openstax: ingestFromOpenStax,
  simple_wikipedia: ingestFromSimpleWikipedia,
  lit2go: ingestFromLit2Go,
}

const { data: book, error: bErr } = await db
  .from('library_books')
  .select('id, source, source_id, title, status')
  .eq('id', bookId)
  .single()
if (bErr || !book) {
  console.error('Book not found:', bookId, bErr?.message)
  process.exit(1)
}
console.log(`[reprocess] ${book.title} (${book.source}/${book.source_id}) status=${book.status}`)

const ingest = INGEST[book.source]
if (!ingest) {
  console.error('Source not supported:', book.source)
  process.exit(1)
}

console.log('[ingest] fetching…')
const raw = await ingest(book.source_id)
console.log('[normalize]…')
const norm = normalizeBook(raw)
console.log('[segment]…')
const chapters = segmentBook(norm)

const wcs = chapters.map((c) => c.word_count)
const total = wcs.reduce((s, w) => s + w, 0)
const sorted = [...wcs].sort((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)] ?? 0
const max = sorted[sorted.length - 1] ?? 0
console.log(
  `[segment] chapters=${chapters.length} words=${total} median=${median} max=${max} (max/median=${median ? (max / median).toFixed(1) : 'n/a'}, max=${total ? Math.round((max / total) * 100) : 0}% of book)`,
)
console.log('[segment] first 3:', chapters.slice(0, 3).map((c) => `#${c.chapter_idx} ${c.word_count}w "${(c.chapter_title ?? '').slice(0, 40)}"`))
console.log('[segment] last 2 :', chapters.slice(-2).map((c) => `#${c.chapter_idx} ${c.word_count}w "${(c.chapter_title ?? '').slice(0, 40)}"`))

// 안전 가드
if (chapters.length === 0) { console.error('ABORT: 0 chapters'); process.exit(1) }
if (median > 0 && max > 6 * median) {
  console.warn(`⚠ GIANT_CHAPTER still present (max ${max} > 6×median ${median}) — 미주 제거 미흡? 검토 요망`)
}

if (!commit) {
  console.log('\n[dry-run] --commit 없음 → DB 미변경. 위 segment 결과만 확인.')
  process.exit(0)
}

console.log('\n[analyze] skipLlm=true (어휘 로컬 추출 + 사전 lookup, CEFR heuristic)…')
const result = await analyzeBook(bookId, norm, chapters, { skipLlm: true })
console.log(`[analyze] stored: chapters=${result.chapter_count} words=${result.word_count} vocab=${result.words.length}`)

// meta 갱신 — cefr_level/confidence 는 보존 (skipLlm heuristic 으로 덮어쓰지 않음)
const { error: upErr } = await db
  .from('library_books')
  .update({
    word_count: result.word_count,
    chapter_count: result.chapter_count,
    reading_minutes: result.reading_minutes,
    status: 'ready',
    status_message: null,
  })
  .eq('id', bookId)
if (upErr) { console.error('meta update failed:', upErr.message); process.exit(1) }

// 난이도/커버리지 재산정 + lemma backfill (best-effort)
for (const fn of ['backfill_book_lemmas', 'compute_book_vrl', 'compute_book_chapter_v_levels', 'compute_book_cefrj', 'compute_book_coverage']) {
  const { error } = await db.rpc(fn, { p_book_id: bookId })
  console.log(`[rpc] ${fn}: ${error ? 'ERR ' + error.message : 'ok'}`)
}

const { data: after } = await db
  .from('library_books')
  .select('chapter_count, word_count, book_v_level, cefr_band, status')
  .eq('id', bookId)
  .single()
console.log('\n[done]', JSON.stringify(after))
