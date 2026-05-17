// scripts/lcp/fetch-book.ts
// LCP CLI — Gutenberg 책 1권 fetch (S2 INGEST 검증용)
// usage: pnpm tsx scripts/lcp/fetch-book.ts <gutenberg_id>
// 예: pnpm tsx scripts/lcp/fetch-book.ts 1661   # Sherlock Holmes

import { ingestFromGutenberg } from '@vocaflow/library-pipeline'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function main(): Promise<void> {
  const id = process.argv[2]
  if (!id) {
    console.error('usage: pnpm tsx scripts/lcp/fetch-book.ts <gutenberg_id>')
    process.exit(1)
  }

  console.log(`Fetching Gutenberg #${id}...`)
  const raw = await ingestFromGutenberg(id)

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

  // 검증용 파일 저장 (tmp/ 는 .gitignore)
  const outDir = resolve(process.cwd(), 'tmp/lcp')
  await mkdir(outDir, { recursive: true })
  const outPath = resolve(outDir, `gutenberg-${id}.json`)
  await writeFile(outPath, JSON.stringify(raw, null, 2), 'utf-8')
  console.log(`\nSaved: ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
