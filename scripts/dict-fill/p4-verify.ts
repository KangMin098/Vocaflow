// scripts/dict-fill/p4-verify.ts
// Validate Phase 2 enrichment outputs (JSON shape + per-field rules).

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUTPUT_DIR = resolve(__dirname, '../../data/dict-fill/p4/outputs')

const ALLOWED_POS = ['noun','verb','adjective','adverb','preposition','conjunction','pronoun','determiner','interjection','idiom','phrasal_verb']
const ALLOWED_CEFR = ['A1','A2','B1','B2','C1','C2']

interface OutputWord {
  word: string
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

const hasKorean = (s: string): boolean => /[가-힯]/.test(s)
const hasLatin = (s: string): boolean => /[a-zA-Z]/.test(s)

function validate(w: OutputWord): string[] {
  const errs: string[] = []
  if (!w.word) errs.push('missing word')
  if (!ALLOWED_POS.includes(w.pos)) errs.push(`bad pos: ${w.pos}`)
  if (!w.meaning_ko || !hasKorean(w.meaning_ko)) errs.push('meaning_ko missing/non-Korean')
  if (!w.example_en || !hasLatin(w.example_en)) errs.push('example_en missing/non-English')
  if (!w.ipa || !/^\/.*\/$/.test(w.ipa.trim())) errs.push(`ipa malformed: ${w.ipa}`)
  if (!Array.isArray(w.synonyms)) errs.push('synonyms not array')
  if (!Array.isArray(w.antonyms)) errs.push('antonyms not array')
  if (!ALLOWED_CEFR.includes(w.cefr_level)) errs.push(`bad cefr: ${w.cefr_level}`)
  // lemma in example_en (allow any morphological variant — loose check)
  if (w.word && w.example_en) {
    const root = w.word.toLowerCase().slice(0, Math.max(3, w.word.length - 3))
    if (!w.example_en.toLowerCase().includes(root)) errs.push('example_en does not contain lemma stem')
  }
  return errs
}

function main(): void {
  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('-output.jsonl')).sort()
  let checked = 0, valid = 0, invalid = 0
  const samples: { word: string; errors: string[] }[] = []
  for (const f of files) {
    const lines = fs.readFileSync(resolve(OUTPUT_DIR, f), 'utf-8').split('\n').filter((l) => l.trim())
    for (const line of lines) {
      try {
        const w = JSON.parse(line) as OutputWord
        checked++
        const errs = validate(w)
        if (errs.length === 0) valid++
        else {
          invalid++
          if (samples.length < 50) samples.push({ word: w.word, errors: errs })
        }
      } catch {
        invalid++
      }
    }
  }
  console.log(`Total checked: ${checked}`)
  console.log(`Valid: ${valid} (${checked ? ((valid / checked) * 100).toFixed(1) : 0}%)`)
  console.log(`Invalid: ${invalid}`)
  if (samples.length > 0) {
    console.log('\nSamples:')
    for (const s of samples) console.log(`  ${s.word}: ${s.errors.join(', ')}`)
  }
}

main()
