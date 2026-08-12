// scripts/lcp/reprocess-many.mjs
//
// 기존 도서 일괄 재추출 — 추출 로직을 고친 뒤 DB 에 반영할 때.
//
// reprocess-book.mjs 는 책 1권용 CLI 다. 코드 수정이 수십~수백 권에 영향을 줄 때
// (예: 음절 하이픈 파편 차단 → 104권) 그걸 손으로 반복할 수는 없다.
//
// 대상 선택:
//   --defect '<결함 이름>'  book_extraction_audit 에서 그 결함 rows>0 인 도서
//   --ids <uuid,uuid,…>     명시 목록
//   (둘 다 없으면 아무것도 하지 않는다 — 전수 재추출은 실수로 돌리기엔 너무 비싸다)
//
// 각 권: ingest(웹→저장소 폴백) → normalize → segment → analyze(교체) → 파생지표 → 감사
//   insert_book_analysis 가 기존 챕터/어휘를 DELETE 후 재INSERT 하므로 멱등이다.
//
// 실행:
//   pnpm dlx tsx scripts/lcp/reprocess-many.mjs --defect '04 유령 어휘(본문에 없음)' [--limit N] [--delay MS]

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
  }
}

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const DEFECT = arg('defect', '')
const IDS = arg('ids', '')
const LIMIT = parseInt(arg('limit', '500'), 10)
const DELAY_MS = parseInt(arg('delay', '2500'), 10)

const {
  ingestFromStandardEbooksResilient,
  ingestFromGutenberg,
  normalizeBook,
  segmentBook,
  analyzeBook,
  getServiceClient,
} = await import('@vocaflow/library-pipeline')

const sb = getServiceClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 대상 수집
let targets = []
if (IDS) {
  const ids = IDS.split(',').map((s) => s.trim()).filter(Boolean)
  const { data } = await sb.from('library_books').select('id, title, source, source_id').in('id', ids)
  targets = data ?? []
} else if (DEFECT) {
  const { data: aud, error } = await sb
    .from('book_extraction_audit')
    .select('library_book_id')
    .eq('defect', DEFECT)
    .gt('rows', 0)
    .limit(5000)
  if (error) {
    console.error(`[reprocess] 감사 조회 실패: ${error.message}`)
    process.exit(1)
  }
  const ids = [...new Set((aud ?? []).map((r) => r.library_book_id))]
  // .in() 은 URL 길이 제한이 있어 청크로 나눈다
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb
      .from('library_books')
      .select('id, title, source, source_id')
      .in('id', ids.slice(i, i + 100))
      .in('status', ['ready', 'published'])
    targets.push(...(data ?? []))
  }
} else {
  console.error('[reprocess] --defect 또는 --ids 가 필요하다 (전수 재추출은 지원하지 않는다)')
  process.exit(1)
}

targets = targets.slice(0, LIMIT)
console.error(`[reprocess] 대상 ${targets.length}권 (delay=${DELAY_MS}ms)`)

async function ingest(book) {
  if (book.source === 'standard_ebooks') return ingestFromStandardEbooksResilient(book.source_id)
  if (book.source === 'gutenberg') return ingestFromGutenberg(book.source_id)
  throw new Error(`지원하지 않는 source: ${book.source}`)
}

let ok = 0
let fail = 0
const failures = []

for (const [idx, book] of targets.entries()) {
  const label = `${idx + 1}/${targets.length} ${(book.title ?? '').slice(0, 42)}`
  try {
    const raw = await ingest(book)
    const norm = normalizeBook(raw)
    const chapters = segmentBook(norm)
    if (!chapters.length) throw new Error('0 chapters — 분절 실패')

    const result = await analyzeBook(book.id, norm, chapters, { skipLlm: true })

    const { error: upErr } = await sb
      .from('library_books')
      .update({
        word_count: result.word_count,
        chapter_count: result.chapter_count,
        reading_minutes: result.reading_minutes,
        status_message: null,
      })
      .eq('id', book.id)
    if (upErr) throw new Error(`meta 갱신 실패: ${upErr.message}`)

    for (const fn of ['backfill_book_lemmas', 'compute_book_vrl', 'compute_book_chapter_v_levels',
                      'compute_book_cefrj', 'compute_book_coverage']) {
      try { await sb.rpc(fn, { p_book_id: book.id }) } catch { /* best-effort */ }
    }
    // 재추출했으니 감사도 갱신 — 수치가 낡은 채로 남으면 다음 판단을 그르친다
    try { await sb.rpc('audit_book_extraction', { p_book_id: book.id }) } catch { /* best-effort */ }

    ok++
    console.error(`  ✓ ${label} — ch=${result.chapter_count} vocab=${result.words.length}`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${book.title} :: ${msg}`)
    console.error(`  ✗ ${label} — ${msg.slice(0, 110)}`)
  }
  if (idx < targets.length - 1) await sleep(DELAY_MS)
}

console.error(`\n[reprocess] 완료 — 성공 ${ok} · 실패 ${fail}`)
if (failures.length) console.error(failures.slice(0, 20).join('\n'))
