// scripts/dict-fill/01-export-job.ts
// Dict-fill Sprint Phase 1/2 — input JSONL 생성.
//
// 사용:
//   tsx scripts/dict-fill/01-export-job.ts --tier top1k --chunk-size 50
//   tsx scripts/dict-fill/01-export-job.ts --tier top5k --chunk-size 50
//   tsx scripts/dict-fill/01-export-job.ts --tier top1k --dry-run
//
// 출력: exports/dict-fill/p{1|2}-input-NNofMM.jsonl + manifest.json

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

interface CliOpts { tier: 'top1k' | 'top5k' | 'top5kplus'; chunkSize: number; dryRun: boolean }

function parseArgs(): CliOpts {
  const args = process.argv.slice(2)
  const tierIdx = args.indexOf('--tier')
  const chunkIdx = args.indexOf('--chunk-size')
  const tier = (tierIdx >= 0 ? args[tierIdx + 1] : 'top1k') as CliOpts['tier']
  const chunkSize = chunkIdx >= 0 ? parseInt(args[chunkIdx + 1], 10) : 50
  const dryRun = args.includes('--dry-run')
  if (tier !== 'top1k' && tier !== 'top5k' && tier !== 'top5kplus') {
    console.error(`invalid --tier: ${tier} (expect top1k | top5k | top5kplus)`)
    process.exit(1)
  }
  if (chunkSize < 1 || chunkSize > 200) {
    console.error(`invalid --chunk-size: ${chunkSize} (expect 1..200)`)
    process.exit(1)
  }
  return { tier, chunkSize, dryRun }
}

interface DictRow {
  word: string
  pos: string
  cefr_level: string | null
  meaning_ko: string
  meanings_ko: Array<{ pos: string; meaning: string }> | null
  frequency_rank: number | null
}

async function fetchTargets(tier: CliOpts['tier']): Promise<DictRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }
  const sb = createClient(url, key)

  const rangeMax = tier === 'top1k' ? 1000 : (tier === 'top5k' ? 5000 : null)
  const rangeMin = tier === 'top1k' ? 0 : (tier === 'top5k' ? 1001 : 5001)

  // Paginate past 1000-row cap
  const PAGE = 1000
  const rows: DictRow[] = []
  let offset = 0
  while (true) {
    let query = sb.from('shared_dictionary')
      .select('word, pos, cefr_level, meaning_ko, meanings_ko, frequency_rank')
      .gte('frequency_rank', rangeMin)
      .is('example_en', null)
      .order('frequency_rank', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (rangeMax !== null) query = query.lte('frequency_rank', rangeMax)
    const { data, error } = await query
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    rows.push(...(data as DictRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const rows = await fetchTargets(opts.tier)
  console.log(`fetched ${rows.length} target rows (tier=${opts.tier})`)

  if (rows.length === 0) {
    console.log('nothing to do')
    return
  }

  const chunks = chunk(rows, opts.chunkSize)
  console.log(`chunks: ${chunks.length} × ~${opts.chunkSize} words`)

  if (opts.dryRun) {
    console.log('\n(dry-run only — pass without --dry-run to write files)')
    return
  }

  const outDir = resolve(__dirname, '../../exports/dict-fill')
  fs.mkdirSync(outDir, { recursive: true })

  const phasePrefix = opts.tier === 'top1k' ? 'p1' : (opts.tier === 'top5k' ? 'p2' : 'p3')
  const total = chunks.length
  const manifest = { tier: opts.tier, chunkSize: opts.chunkSize, total, words: rows.length, chunks: [] as string[] }

  chunks.forEach((c, idx) => {
    const nn = String(idx + 1).padStart(2, '0')
    const mm = String(total).padStart(2, '0')
    const filename = `${phasePrefix}-input-${nn}of${mm}.jsonl`
    const lines = c.map((r) => JSON.stringify({
      word: r.word, pos: r.pos, cefr: r.cefr_level,
      meaning_ko: r.meaning_ko, meanings_ko: r.meanings_ko ?? [],
      frequency_rank: r.frequency_rank,
    }))
    fs.writeFileSync(resolve(outDir, filename), lines.join('\n') + '\n', 'utf8')
    manifest.chunks.push(filename)
    console.log(`  wrote ${filename} (${c.length} words)`)
  })

  fs.writeFileSync(resolve(outDir, `${phasePrefix}-manifest.json`), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`\nmanifest: ${phasePrefix}-manifest.json`)
}

main().catch((err) => {
  console.error('01-export-job failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
