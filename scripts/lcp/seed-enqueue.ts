// scripts/lcp/seed-enqueue.ts
// LCP CLI — curated-seed.json 의 책들을 admin_enqueue_book RPC로 batch enqueue.
//
// usage:
//   pnpm tsx scripts/lcp/seed-enqueue.ts                         # 전체 enqueue
//   pnpm tsx scripts/lcp/seed-enqueue.ts --source=standard_ebooks # SE만
//   pnpm tsx scripts/lcp/seed-enqueue.ts --source=gutenberg       # Gutenberg만
//   pnpm tsx scripts/lcp/seed-enqueue.ts --dry-run                # 실제 enqueue 안 함
//
// 환경변수: NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
//
// admin_enqueue_book는 멱등 (UNIQUE source+source_id) — 이미 있으면 기존 ID 반환.

import { createClient } from '@supabase/supabase-js'
import seed from '../../packages/library-pipeline/src/seed/curated-seed.json' assert { type: 'json' }

interface SeedEntry {
  source: string
  source_id: string
  title: string
  author: string
  author_birth_year?: number
  author_death_year?: number
  license: string
  estimated_cefr?: string
  genre?: string
  tags?: string[]
}

interface CliArgs {
  source: string | null
  dryRun: boolean
}

function parseArgs(): CliArgs {
  let source: string | null = null
  let dryRun = false
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') dryRun = true
    else if (a.startsWith('--source=')) source = a.slice('--source='.length)
  }
  return { source, dryRun }
}

async function main(): Promise<void> {
  const { source, dryRun } = parseArgs()

  const list = (seed as SeedEntry[]).filter((b) =>
    source ? b.source === source : true,
  )

  console.log(
    `[seed-enqueue] ${list.length} books${source ? ` (source=${source})` : ''}${dryRun ? ' [DRY RUN]' : ''}`,
  )

  if (dryRun) {
    for (const b of list) {
      console.log(`  - ${b.source}/${b.source_id} — ${b.title} (${b.author})`)
    }
    console.log(`\n${list.length} entries listed (no DB write).`)
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required',
    )
    process.exit(1)
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let added = 0
  let existing = 0
  let failed = 0

  for (const b of list) {
    try {
      const { data, error } = await client.rpc('admin_enqueue_book', {
        p_source: b.source,
        p_source_id: b.source_id,
        p_title: b.title,
        p_author: b.author ?? null,
        p_author_birth_year: b.author_birth_year ?? null,
        p_author_death_year: b.author_death_year ?? null,
        p_license: b.license ?? 'PD-US',
      })

      if (error) {
        console.error(`  [FAIL] ${b.title}: ${error.message}`)
        failed += 1
        continue
      }
      if (data) {
        // 이미 있는지 모르므로 항상 OK 로깅 (멱등 RPC)
        console.log(`  [OK]   ${b.title} → ${data}`)
        added += 1
      } else {
        console.log(`  [SKIP] ${b.title}`)
        existing += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [FAIL] ${b.title}: ${msg}`)
      failed += 1
    }
  }

  console.log(
    `\n✓ ${added} enqueued / ${existing} pre-existing / ${failed} failed`,
  )
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
