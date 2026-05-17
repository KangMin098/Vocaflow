// scripts/lcp/segment-book.ts
// LCP CLI — 1권 ingest → normalize → segment 통합 검증
// usage: pnpm tsx scripts/lcp/segment-book.ts <gutenberg_id>

import {
  ingestFromGutenberg,
  normalizeBook,
  segmentBook,
} from '@vocaflow/library-pipeline'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function main(): Promise<void> {
  const id = process.argv[2]
  if (!id) {
    console.error('usage: pnpm tsx scripts/lcp/segment-book.ts <gutenberg_id>')
    process.exit(1)
  }

  console.log(`[1/3] Fetch Gutenberg #${id}...`)
  const raw = await ingestFromGutenberg(id)

  console.log('[2/3] Normalize...')
  const norm = normalizeBook(raw)
  console.log(
    `  body: ${raw.raw_content.length.toLocaleString()} → ${norm.body.length.toLocaleString()} bytes (boilerplate removed)`,
  )
  console.log(`  hash: ${norm.body_hash.slice(0, 16)}...`)

  console.log('[3/3] Segment...')
  const chapters = segmentBook(norm)
  console.log(`  chapters: ${chapters.length}`)
  for (const ch of chapters.slice(0, 5)) {
    console.log(
      `    [${ch.chapter_idx}] ${ch.chapter_title ?? '(no title)'} — ${ch.word_count.toLocaleString()} words, ${ch.paragraph_offsets.length} paragraphs, ${ch.sentence_offsets.length} sentences`,
    )
  }
  if (chapters.length > 5) {
    console.log(`    ... and ${chapters.length - 5} more`)
  }

  const outDir = resolve(process.cwd(), 'tmp/lcp')
  await mkdir(outDir, { recursive: true })
  const outPath = resolve(outDir, `segmented-${id}.json`)
  await writeFile(
    outPath,
    JSON.stringify(
      {
        raw: { ...raw, raw_content: '<truncated>' },
        body_hash: norm.body_hash,
        chapters,
      },
      null,
      2,
    ),
    'utf-8',
  )
  console.log(`\nSaved: ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
