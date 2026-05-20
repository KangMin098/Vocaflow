// scripts/freq-corpus/03-import-to-db.ts
// Import frequency corpus into shared_dictionary.
//
// UPDATE matched lemmas; INSERT unmatched lemmas as stubs (pos='unknown', source='imported').
// Idempotent: rows whose frequency_sources already has 'freq_external_a' are skipped.
//
// CLI: tsx scripts/freq-corpus/03-import-to-db.ts [--dry-run] [--apply]

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const INPUT = resolve(__dirname, '../../data/freq-corpus/corpus.jsonl')
const SOURCE_KEY = 'freq_external_a'

interface InflectionEntry { form: string; freq: number }
interface LemmaEntry {
  lemma: string
  lemma_band: string
  frequency_band: string
  total_freq: number
  inflections: InflectionEntry[]
  inflection_count: number
}

function parseArgs(): { apply: boolean } {
  const args = process.argv.slice(2)
  return { apply: args.includes('--apply') }
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE env required'); process.exit(1) }
  const sb = createClient(url, key)

  const entries: LemmaEntry[] = fs.readFileSync(INPUT, 'utf-8')
    .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as LemmaEntry)
  console.log(`Loaded ${entries.length} corpus entries`)

  // Pull existing words + their frequency_sources (paginated) for matching + idempotency.
  const existing = new Map<string, Record<string, unknown> | null>()
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await sb.from('shared_dictionary')
      .select('word, frequency_sources').range(offset, offset + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const r of data) {
      existing.set(String(r.word).toLowerCase(), (r.frequency_sources ?? null) as Record<string, unknown> | null)
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Existing shared_dictionary words: ${existing.size}`)

  const updates: { word: string; payload: Record<string, unknown> }[] = []
  const inserts: Record<string, unknown>[] = []
  let skippedAlready = 0

  for (const e of entries) {
    const sourcePayload = {
      lemma_band: e.lemma_band,
      total_freq: e.total_freq,
      inflection_count: e.inflection_count,
    }
    const inflectionsObj = { forms: e.inflections, source: SOURCE_KEY }

    if (existing.has(e.lemma)) {
      const currentFreq = (existing.get(e.lemma) ?? {}) as Record<string, unknown>
      if (currentFreq && SOURCE_KEY in currentFreq) { skippedAlready++; continue }
      const newFreqSources = { ...currentFreq, [SOURCE_KEY]: sourcePayload }
      updates.push({
        word: e.lemma,
        payload: {
          frequency_sources: newFreqSources,
          frequency_band: e.frequency_band,
          lemma_band: e.lemma_band,
          inflections: inflectionsObj,
        },
      })
    } else {
      inserts.push({
        word: e.lemma,
        pos: 'unknown',
        source: 'imported',
        list_tags: [],
        frequency_sources: { [SOURCE_KEY]: sourcePayload },
        frequency_band: e.frequency_band,
        lemma_band: e.lemma_band,
        inflections: inflectionsObj,
      })
    }
  }

  console.log(`\nPlan:`)
  console.log(`  UPDATE   : ${updates.length}`)
  console.log(`  INSERT   : ${inserts.length}`)
  console.log(`  SKIP (already has ${SOURCE_KEY}): ${skippedAlready}`)

  if (!opts.apply) {
    console.log('\n(dry-run only — pass --apply to write)')
    return
  }

  // INSERTs: chunked, no on_conflict needed (we filtered existing).
  const INS_CHUNK = 500
  let inserted = 0
  for (let i = 0; i < inserts.length; i += INS_CHUNK) {
    const chunk = inserts.slice(i, i + INS_CHUNK)
    const { error } = await sb.from('shared_dictionary').insert(chunk)
    if (error) { console.error(`INSERT error @${i}:`, error.message); process.exit(1) }
    inserted += chunk.length
    if (inserted % 2000 === 0 || inserted === inserts.length) {
      console.log(`  inserted ${inserted}/${inserts.length}`)
    }
  }

  // UPDATEs: per-row (no bulk update by primary key value in supabase-js without RPC).
  let updated = 0
  let updErr = 0
  for (const u of updates) {
    const { error } = await sb.from('shared_dictionary')
      .update(u.payload).eq('word', u.word)
    if (error) { updErr++; if (updErr <= 5) console.error(`UPDATE error ${u.word}:`, error.message) }
    else updated++
    if (updated % 1000 === 0) console.log(`  updated ${updated}/${updates.length}`)
  }

  console.log(`\nResult: inserted=${inserted} updated=${updated} updateErrors=${updErr}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
