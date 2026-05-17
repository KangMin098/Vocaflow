// scripts/freq-corpus/02-match-analysis.ts
// Match corpus lemmas/inflections against shared_dictionary (read-only).

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const INPUT = resolve(__dirname, '../../data/freq-corpus/corpus.jsonl')
const REPORT = resolve(__dirname, '../../data/freq-corpus/match_report.txt')
const SUMMARY = resolve(__dirname, '../../data/freq-corpus/match_summary.json')

interface InflectionEntry { form: string; freq: number }
interface LemmaEntry {
  lemma: string
  lemma_band: string
  frequency_band: string
  total_freq: number
  inflections: InflectionEntry[]
  inflection_count: number
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE env required'); process.exit(1) }
  const sb = createClient(url, key)

  const entries: LemmaEntry[] = fs.readFileSync(INPUT, 'utf-8')
    .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as LemmaEntry)
  console.log(`Loaded ${entries.length} corpus entries`)

  // Pull all dictionary words (paginated)
  const allWords = new Set<string>()
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await sb.from('shared_dictionary')
      .select('word').range(offset, offset + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    data.forEach((r) => allWords.add(String(r.word).toLowerCase()))
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`shared_dictionary words: ${allWords.size}`)

  let lemmaMatched = 0, lemmaUnmatched = 0
  let infMatched = 0, infTotal = 0
  const matchedByBand: Record<string, number> = {}
  const totalByBand: Record<string, number> = {}
  const unmatchedLemmas: LemmaEntry[] = []

  for (const e of entries) {
    totalByBand[e.lemma_band] = (totalByBand[e.lemma_band] ?? 0) + 1
    if (allWords.has(e.lemma)) {
      lemmaMatched++
      matchedByBand[e.lemma_band] = (matchedByBand[e.lemma_band] ?? 0) + 1
    } else {
      lemmaUnmatched++
      if (unmatchedLemmas.length < 50) unmatchedLemmas.push(e)
    }
    for (const inf of e.inflections) {
      infTotal++
      if (allWords.has(inf.form)) infMatched++
    }
  }

  const report: string[] = []
  report.push(`# Frequency Corpus Match Report`)
  report.push(`Date: ${new Date().toISOString()}`)
  report.push(``)
  report.push(`## Summary`)
  report.push(`- Total corpus entries: ${entries.length}`)
  report.push(`- Lemma matched: ${lemmaMatched} (${((lemmaMatched / entries.length) * 100).toFixed(1)}%)`)
  report.push(`- Lemma unmatched: ${lemmaUnmatched}`)
  report.push(`- Inflections matched: ${infMatched}/${infTotal} (${((infMatched / infTotal) * 100).toFixed(1)}%)`)
  report.push(``)
  report.push(`## Per-band match rate`)
  Object.keys(totalByBand).sort((a, b) => parseInt(a) - parseInt(b)).forEach((b) => {
    const m = matchedByBand[b] ?? 0
    const t = totalByBand[b]
    report.push(`  ${b}: ${m}/${t} (${((m / t) * 100).toFixed(1)}%)`)
  })
  report.push(``)
  report.push(`## Sample unmatched (first 50)`)
  unmatchedLemmas.forEach((e) => report.push(`- ${e.lemma} (${e.lemma_band}, freq=${e.total_freq})`))

  fs.writeFileSync(REPORT, report.join('\n'), 'utf-8')

  const summary = {
    total_entries: entries.length,
    lemma_matched: lemmaMatched,
    lemma_unmatched: lemmaUnmatched,
    match_rate: lemmaMatched / entries.length,
    inflections_matched: infMatched,
    inflections_total: infTotal,
    by_band: Object.fromEntries(
      Object.keys(totalByBand).sort((a, b) => parseInt(a) - parseInt(b)).map((b) => [
        b, { total: totalByBand[b], matched: matchedByBand[b] ?? 0 },
      ]),
    ),
  }
  fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2), 'utf-8')
  console.log(`Report: ${REPORT}`)
  console.log(`Summary: ${SUMMARY}`)
  console.log(`\nLemma match: ${lemmaMatched}/${entries.length} (${((lemmaMatched / entries.length) * 100).toFixed(1)}%)`)
  console.log(`Inflection match: ${infMatched}/${infTotal} (${((infMatched / infTotal) * 100).toFixed(1)}%)`)
}

main().catch((err) => { console.error(err); process.exit(1) })
