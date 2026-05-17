// scripts/dict-fill/03-import-enriched.ts
// Dict-fill output JSONL → shared_dictionary UPDATE.
// Idempotent: WHERE word=$1 AND pos=$2 AND <col> IS NULL.
//
// 사용:
//   tsx scripts/dict-fill/03-import-enriched.ts --tier p1 --dry-run
//   tsx scripts/dict-fill/03-import-enriched.ts --tier p1 --apply

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

interface CliOpts { tier: 'p1' | 'p2' | 'p3'; apply: boolean }

function parseArgs(): CliOpts {
  const args = process.argv.slice(2)
  const tierIdx = args.indexOf('--tier')
  const tier = (tierIdx >= 0 ? args[tierIdx + 1] : 'p1') as CliOpts['tier']
  const apply = args.includes('--apply')
  if (tier !== 'p1' && tier !== 'p2' && tier !== 'p3') { console.error(`invalid --tier: ${tier}`); process.exit(1) }
  return { tier, apply }
}

interface EnrichedLine {
  word: string
  pos: string
  ok: boolean
  data?: {
    example_en?: string
    synonyms?: string[]
    antonyms?: string[]
    ipa?: string
    collocations?: string[]
  }
  error?: string
}

function findOutputFiles(tier: 'p1' | 'p2' | 'p3'): string[] {
  const dir = resolve(__dirname, '../../exports/dict-fill')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(`${tier}-output-`) && f.endsWith('.jsonl'))
    .map((f) => resolve(dir, f))
    .sort()
}

interface DictRow {
  example_en: string | null
  synonyms: string[] | null
  antonyms: string[] | null
  ipa: string | null
  collocations: string[] | null
}

async function main(): Promise<void> {
  const opts = parseArgs()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE env required'); process.exit(1) }
  const sb = createClient(url, key)

  const files = findOutputFiles(opts.tier)
  if (files.length === 0) { console.error(`no ${opts.tier}-output-*.jsonl files in exports/dict-fill/`); process.exit(1) }
  console.log(`tier=${opts.tier}  files=${files.length}`)

  const stats = { total: 0, ok_true: 0, ok_false: 0, no_dict_match: 0, skip_filled: 0, updated: 0, errors: 0 }
  const colCounts = { example_en: 0, synonyms: 0, antonyms: 0, ipa: 0, collocations: 0 }
  const noMatchSamples: string[] = []

  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim().length > 0)
    for (const raw of lines) {
      stats.total++
      let obj: EnrichedLine
      try { obj = JSON.parse(raw) as EnrichedLine } catch { stats.errors++; continue }
      if (!obj.ok) { stats.ok_false++; continue }
      stats.ok_true++

      const word = obj.word.toLowerCase()
      const pos = obj.pos
      const d = obj.data ?? {}

      const { data: existing, error: selErr } = await sb.from('shared_dictionary')
        .select('example_en, synonyms, antonyms, ipa, collocations')
        .eq('word', word).eq('pos', pos).maybeSingle<DictRow>()
      if (selErr) { stats.errors++; continue }
      if (!existing) {
        stats.no_dict_match++
        if (noMatchSamples.length < 20) noMatchSamples.push(`${word}|${pos}`)
        continue
      }

      const patch: Record<string, unknown> = {}
      if (existing.example_en == null && typeof d.example_en === 'string' && d.example_en) {
        patch.example_en = d.example_en; colCounts.example_en++
      }
      if ((existing.synonyms == null || existing.synonyms.length === 0) && Array.isArray(d.synonyms) && d.synonyms.length > 0) {
        patch.synonyms = d.synonyms; colCounts.synonyms++
      }
      if ((existing.antonyms == null || existing.antonyms.length === 0) && Array.isArray(d.antonyms) && d.antonyms.length > 0) {
        patch.antonyms = d.antonyms; colCounts.antonyms++
      }
      if (existing.ipa == null && typeof d.ipa === 'string' && d.ipa) {
        patch.ipa = d.ipa; colCounts.ipa++
      }
      if ((existing.collocations == null || existing.collocations.length === 0) && Array.isArray(d.collocations) && d.collocations.length > 0) {
        patch.collocations = d.collocations; colCounts.collocations++
      }

      if (Object.keys(patch).length === 0) { stats.skip_filled++; continue }

      if (opts.apply) {
        const { error: updErr } = await sb.from('shared_dictionary')
          .update(patch).eq('word', word).eq('pos', pos)
        if (updErr) { stats.errors++ } else { stats.updated++ }
      } else {
        stats.updated++ // dry-run: count what would change
      }
    }
  }

  console.log('\nResult:')
  console.log('  total lines       :', stats.total)
  console.log('  ok=true           :', stats.ok_true)
  console.log('  ok=false          :', stats.ok_false)
  console.log('  no dict match     :', stats.no_dict_match)
  console.log('  skip (filled)     :', stats.skip_filled)
  console.log('  ' + (opts.apply ? 'updated' : 'would update'), '       :', stats.updated)
  console.log('  errors            :', stats.errors)
  console.log('\nPer-column updates:', colCounts)
  if (noMatchSamples.length > 0) console.log('\nno-match samples:', noMatchSamples)
  if (!opts.apply) console.log('\n(dry-run only — pass --apply to write)')
}

main().catch((err) => {
  console.error('03-import-enriched failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
