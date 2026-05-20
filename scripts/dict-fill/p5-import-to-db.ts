// scripts/dict-fill/p4-import-to-db.ts
// Phase 4: import enriched P4 outputs into shared_dictionary.
//
// Approach: pair each input chunk with its output chunk line-by-line. Use
// the INPUT.word as the DB key (since some agents rewrote a headword to its
// lemma form — e.g. "lasted" → "last" — and that breaks DB targeting).
// Take enrichment fields from the output line.
//
// Idempotency guard: only UPDATE rows where meaning_ko IS NULL.
//
// CLI: tsx scripts/dict-fill/p4-import-to-db.ts [--apply]

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const INPUT_DIR = resolve(__dirname, '../../data/dict-fill/p5/chunks')
const OUTPUT_DIR = resolve(__dirname, '../../data/dict-fill/p5/outputs')

interface InputRow { word: string }
interface OutputRow {
  pos: string
  meaning_ko: string
  meanings_ko: unknown
  example_en: string
  ipa: string
  synonyms: string[]
  antonyms: string[]
  cefr_level: string
  korean_learner_note: string | null
}

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes('--apply') }
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE env required'); process.exit(1) }
  const sb = createClient(url, key)

  const chunkFiles = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.jsonl')).sort()
  console.log(`Chunks: ${chunkFiles.length}`)

  let attempted = 0, updated = 0, skipped = 0, errors = 0, mismatch = 0
  const errSamples: string[] = []
  const mismatchSamples: string[] = []

  for (const cf of chunkFiles) {
    const inPath = resolve(INPUT_DIR, cf)
    const outPath = resolve(OUTPUT_DIR, cf.replace('.jsonl', '-output.jsonl'))
    if (!fs.existsSync(outPath)) { console.warn(`missing output: ${cf}`); continue }
    const inLines = fs.readFileSync(inPath, 'utf-8').split('\n').filter((l) => l.trim())
    const outLines = fs.readFileSync(outPath, 'utf-8').split('\n').filter((l) => l.trim())
    if (inLines.length !== outLines.length) {
      mismatch++
      mismatchSamples.push(`${cf}: in=${inLines.length} out=${outLines.length}`)
      continue
    }

    for (let i = 0; i < inLines.length; i++) {
      let input: InputRow, output: OutputRow
      try { input = JSON.parse(inLines[i]) as InputRow } catch { errors++; continue }
      try { output = JSON.parse(outLines[i]) as OutputRow } catch { errors++; continue }
      const word = String(input.word)
      attempted++

      if (!opts.apply) continue

      // Idempotent: only update rows whose meaning_ko is still NULL.
      const { data: existing, error: selErr } = await sb.from('shared_dictionary')
        .select('word, meaning_ko').eq('word', word).maybeSingle()
      if (selErr) { errors++; if (errSamples.length < 5) errSamples.push(`${word}: select ${selErr.message}`); continue }
      if (!existing || existing.meaning_ko != null) { skipped++; continue }

      const { error: updErr } = await sb.from('shared_dictionary')
        .update({
          pos: output.pos,
          meaning_ko: output.meaning_ko,
          meanings_ko: output.meanings_ko,
          example_en: output.example_en,
          ipa: output.ipa,
          synonyms: output.synonyms,
          antonyms: output.antonyms,
          cefr_level: output.cefr_level,
          korean_learner_note: output.korean_learner_note,
          source: 'ai-generated',
          verified: false,
        })
        .eq('word', word)
      if (updErr) {
        errors++
        if (errSamples.length < 10) errSamples.push(`${word}: ${updErr.message}`)
      } else {
        updated++
      }
      if (updated % 200 === 0 && updated > 0) console.log(`  updated ${updated}/${attempted}`)
    }
  }

  console.log(`\n=== Final ===`)
  console.log(`Attempted    : ${attempted}`)
  console.log(`${opts.apply ? 'Updated' : 'Would update'}: ${opts.apply ? updated : '(dry-run, ' + attempted + ')'}`)
  console.log(`Skipped      : ${skipped}`)
  console.log(`Errors       : ${errors}`)
  console.log(`Chunk mismatches: ${mismatch}`)
  if (errSamples.length) console.log('Error samples:', errSamples)
  if (mismatchSamples.length) console.log('Mismatch samples:', mismatchSamples)
  if (!opts.apply) console.log('\n(dry-run only — pass --apply to write)')
}

main().catch((err) => { console.error(err); process.exit(1) })
