// scripts/freq-corpus/01-xlsx-to-jsonl.ts
// External frequency corpus XLSX → JSONL
//
// Input:  data/freq-corpus/source.xlsx  (multi-sheet, sheet name = band like "1k", "2k", …)
// Output: data/freq-corpus/corpus.jsonl  (one lemma family per line)
//
// Sheet layout (per row):
//   [List label] [Headword] [Related forms "form (freq), …"] [Total frequency]

import * as XLSX from 'xlsx'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const INPUT_PATH = resolve(__dirname, '../../data/freq-corpus/source.xlsx')
const OUTPUT_PATH = resolve(__dirname, '../../data/freq-corpus/corpus.jsonl')

interface InflectionEntry { form: string; freq: number }
interface LemmaEntry {
  lemma: string
  lemma_band: string       // "1k", "2k", …, "25k"
  frequency_band: string   // "top1k" | "top2k" | "top3k" | "top5k" | "top10k" | "top15k" | "top20k" | "top25k"
  total_freq: number
  inflections: InflectionEntry[]
  inflection_count: number
}

function parseInflections(s: string): InflectionEntry[] {
  const pattern = /([a-zA-Z\-']+)\s*\((\d+)\)/g
  const out: InflectionEntry[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(s)) !== null) {
    out.push({ form: m[1].trim().toLowerCase(), freq: parseInt(m[2], 10) })
  }
  return out
}

function bandToFrequencyBand(band: string): string {
  const m = band.match(/^(\d+)k$/i)
  if (!m) return 'unknown'
  const n = parseInt(m[1], 10)
  if (n === 1) return 'top1k'
  if (n === 2) return 'top2k'
  if (n === 3) return 'top3k'
  if (n <= 5) return 'top5k'
  if (n <= 10) return 'top10k'
  if (n <= 15) return 'top15k'
  if (n <= 20) return 'top20k'
  return 'top25k'
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`ABORT: source xlsx not found at ${INPUT_PATH}`)
    process.exit(1)
  }
  console.log(`Reading: ${INPUT_PATH}`)
  const wb = XLSX.readFile(INPUT_PATH)
  console.log(`Sheets (${wb.SheetNames.length}): ${wb.SheetNames.join(', ')}`)

  // Single-sheet layout: col 0 = band label ("1k"…"25k"), col 1 = headword,
  // col 2 = related forms, col 3 = total frequency.
  const entries: LemmaEntry[] = []
  const bandPattern = /^\d+k$/i
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  const perBand: Record<string, number> = {}
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 4) continue
    const bandLabel = String(row[0] ?? '').trim().toLowerCase()
    if (!bandPattern.test(bandLabel)) continue
    const lemma = String(row[1] ?? '').trim().toLowerCase()
    const relatedForms = String(row[2] ?? '').trim()
    const totalFreqRaw = row[3]
    const totalFreq = typeof totalFreqRaw === 'number' ? totalFreqRaw : parseInt(String(totalFreqRaw), 10)
    if (!lemma || isNaN(totalFreq)) continue
    const inflections = parseInflections(relatedForms)
    entries.push({
      lemma,
      lemma_band: bandLabel,
      frequency_band: bandToFrequencyBand(bandLabel),
      total_freq: totalFreq,
      inflections,
      inflection_count: inflections.length,
    })
    perBand[bandLabel] = (perBand[bandLabel] ?? 0) + 1
  }
  console.log('Per-band counts:')
  Object.entries(perBand)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([b, c]) => console.log(`  ${b}: ${c}`))

  console.log(`Total entries: ${entries.length}`)

  fs.mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8')
  console.log(`Wrote: ${OUTPUT_PATH}`)

}

main()
