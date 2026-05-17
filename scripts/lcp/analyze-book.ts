// scripts/lcp/analyze-book.ts
// usage: pnpm tsx scripts/lcp/analyze-book.ts <gutenberg_id>

// .env.local 명시 로드 (tsx 가 자동 로드 안 함)
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

import {
  ingestFromGutenberg,
  normalizeBook,
  segmentBook,
  analyzeBook,
  getServiceClient,
} from '@vocaflow/library-pipeline'

async function main(): Promise<void> {
  const id = process.argv[2]
  if (!id) {
    console.error('usage: pnpm tsx scripts/lcp/analyze-book.ts <gutenberg_id>')
    process.exit(1)
  }

  // CLI 검증은 항상 skipLlm 강제 (비용 회피)
  const skipLlm = true
  console.log(
    'ℹ CLI 검증 모드 — skipLlm=true 강제 (vocab + readability 시그널만)\n',
  )

  console.log(`[1/4] Fetch Gutenberg #${id}...`)
  const raw = await ingestFromGutenberg(id)
  console.log(`  ${raw.title} by ${raw.author ?? '(unknown)'}`)

  console.log('[2/4] Normalize + Segment...')
  const norm = normalizeBook(raw)
  const chapters = segmentBook(norm)
  console.log(`  chapters: ${chapters.length}`)

  // library_books row 임시 생성
  const client = getServiceClient()
  const { data: book, error: insertError } = await client
    .from('library_books')
    .insert({
      source: 'gutenberg',
      source_id: id,
      source_url: raw.source_url,
      title: raw.title,
      author: raw.author ?? null,
      author_birth_year: raw.author_birth_year ?? null,
      author_death_year: raw.author_death_year ?? null,
      language: raw.language,
      license: raw.license,
      status: 'analyzing',
    })
    .select('id')
    .single()

  if (insertError || !book) {
    throw new Error(
      `library_books INSERT failed: ${insertError?.message ?? 'no row'}`,
    )
  }

  const bookId = book['id'] as string
  console.log(`  book_id: ${bookId}`)

  console.log('[3/4] Analyze...')
  const start = Date.now()
  const result = await analyzeBook(bookId, norm, chapters, { skipLlm })
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  const total = result.stats.hitCount + result.stats.missCount
  const hitPct = total > 0 ? ((result.stats.hitCount / total) * 100).toFixed(1) : '0.0'

  console.log('[4/4] Result:')
  console.log(
    `  CEFR:           ${result.cefr_level} (confidence: ${result.cefr_confidence})`,
  )
  console.log(`  word_count:     ${result.word_count.toLocaleString()}`)
  console.log(`  reading_min:    ${result.reading_minutes}`)
  console.log(
    `  vocabulary:     ${result.words.length.toLocaleString()} unique lemmas`,
  )
  console.log(
    `  dict hit:       ${result.stats.hitCount.toLocaleString()} / ${total.toLocaleString()} (${hitPct}%)`,
  )
  console.log(`  LLM cost:       $${result.llm_cost_usd.toFixed(4)}`)
  console.log(`  elapsed:        ${elapsed}s`)
  console.log('\n  Top 10 LV:')
  for (const w of result.words.slice(0, 10)) {
    console.log(
      `    [${w.base_learning_value.toFixed(3)}] ${w.word.padEnd(20)} (book_freq=${w.frequency_in_book}, ch=${w.chapter_idx})`,
    )
  }

  // library_books 메타 업데이트
  await client
    .from('library_books')
    .update({
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      word_count: result.word_count,
      chapter_count: result.chapter_count,
      reading_minutes: result.reading_minutes,
      llm_cost_usd: result.llm_cost_usd,
      status: 'ready',
    })
    .eq('id', bookId)

  console.log(`\n✓ library_books status='ready' (book_id=${bookId})`)
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
