// scripts/dict-fill/p4-extract-targets.ts
// Extract new (post-corpus-import) shared_dictionary stubs in lemma_band 1k-9k
// into chunked JSONL files for Phase 2 LLM enrichment.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const OUTPUT_DIR = resolve(__dirname, '../../data/dict-fill/p4/chunks')
const CHUNK_SIZE = 30
const TARGET_BANDS = ['1k','2k','3k','4k','5k','6k','7k','8k','9k'] as const

interface TargetWord {
  word: string
  lemma_band: string
  frequency_band: string
  inflections: { forms?: { form: string; freq: number }[] } | null
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE env required'); process.exit(1) }
  const sb = createClient(url, key)

  console.log('Fetching target words…')
  const all: TargetWord[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await sb.from('shared_dictionary')
      .select('word, lemma_band, frequency_band, inflections')
      .is('meaning_ko', null)
      .in('lemma_band', TARGET_BANDS as unknown as string[])
      .order('lemma_band', { ascending: true })
      .order('word', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    all.push(...(data as TargetWord[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Total targets: ${all.length}`)
  if (all.length === 0) { console.error('ABORT: no targets'); process.exit(1) }

  const bandCounts: Record<string, number> = {}
  for (const t of all) bandCounts[t.lemma_band] = (bandCounts[t.lemma_band] ?? 0) + 1
  console.log('Band distribution:')
  for (const b of TARGET_BANDS) console.log(`  ${b}: ${bandCounts[b] ?? 0}`)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const totalChunks = Math.ceil(all.length / CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i++) {
    const chunk = all.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const filename = `chunk-${String(i + 1).padStart(3, '0')}.jsonl`
    const filepath = resolve(OUTPUT_DIR, filename)
    const lines = chunk.map((w) => JSON.stringify({
      word: w.word,
      lemma_band: w.lemma_band,
      frequency_band: w.frequency_band,
      inflection_forms: (w.inflections?.forms ?? []).map((f) => f.form).slice(0, 10),
    })).join('\n')
    fs.writeFileSync(filepath, lines + '\n', 'utf-8')
  }
  console.log(`\nWrote ${totalChunks} chunks → ${OUTPUT_DIR}`)
  console.log(`Cost estimate: ~$${(all.length * 0.05).toFixed(2)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
