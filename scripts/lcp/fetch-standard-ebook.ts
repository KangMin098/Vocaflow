// scripts/lcp/fetch-standard-ebook.ts
// LCP CLI — Standard Ebooks 책 1권 fetch (Phase 13 S2 INGEST 검증용)
// usage: pnpm tsx scripts/lcp/fetch-standard-ebook.ts <author-slug>/<title-slug>
// 예: pnpm tsx scripts/lcp/fetch-standard-ebook.ts h-g-wells/the-time-machine

import { ingestFromStandardEbooks } from '@vocaflow/library-pipeline'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function main(): Promise<void> {
  const sourceId = process.argv[2]
  if (!sourceId) {
    console.error(
      'usage: pnpm tsx scripts/lcp/fetch-standard-ebook.ts <author-slug>/<title-slug>',
    )
    process.exit(1)
  }

  console.log(`Fetching Standard Ebooks ${sourceId}...`)
  const raw = await ingestFromStandardEbooks(sourceId)

  const krSafe =
    raw.author_death_year !== undefined &&
    raw.author_death_year < new Date().getFullYear() - 70

  console.log(`  ✓ Title:   ${raw.title}`)
  console.log(
    `  ✓ Author:  ${raw.author ?? '(unknown)'} (${raw.author_birth_year ?? '?'} ~ ${raw.author_death_year ?? '?'})`,
  )
  console.log(`  ✓ Lang:    ${raw.language}`)
  console.log(`  ✓ License: ${raw.license}`)
  console.log(`  ✓ Bytes:   ${raw.raw_content.length.toLocaleString()}`)
  console.log(`  ✓ KR safe: ${krSafe ? 'YES' : 'NO'}`)

  const outDir = resolve(process.cwd(), 'tmp/lcp')
  await mkdir(outDir, { recursive: true })
  const safe = sourceId.replace(/\//g, '__')
  const outPath = resolve(outDir, `standard-ebooks-${safe}.json`)
  await writeFile(outPath, JSON.stringify(raw, null, 2), 'utf-8')
  console.log(`\nSaved: ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
