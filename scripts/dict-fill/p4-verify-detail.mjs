import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.resolve(__dirname, '../../data/dict-fill/p4/outputs')
const ALLOWED_POS = new Set(['noun','verb','adjective','adverb','preposition','conjunction','pronoun','determiner','interjection','idiom','phrasal_verb'])
const ALLOWED_CEFR = new Set(['A1','A2','B1','B2','C1','C2'])
const hasKorean = (s) => /[가-힯]/.test(s)
const hasLatin = (s) => /[a-zA-Z]/.test(s)

const counts = { ok: 0, badPos: 0, badIpa: 0, badCefr: 0, noKor: 0, noLat: 0, missingWord: 0, noSyn: 0, noAnt: 0, stem: 0 }
const examples = { badPos: [], badIpa: [], badCefr: [], stem: [] }

const files = fs.readdirSync(DIR).filter(f => f.endsWith('-output.jsonl')).sort()
for (const f of files) {
  const lines = fs.readFileSync(path.resolve(DIR, f), 'utf8').split('\n').filter(l => l.trim())
  for (const line of lines) {
    let w
    try { w = JSON.parse(line) } catch { continue }
    let bad = false
    if (!w.word) { counts.missingWord++; bad = true }
    if (!ALLOWED_POS.has(w.pos)) { counts.badPos++; bad = true; if (examples.badPos.length < 5) examples.badPos.push(`${w.word}: pos="${w.pos}"`) }
    if (!w.meaning_ko || !hasKorean(w.meaning_ko)) { counts.noKor++; bad = true }
    if (!w.example_en || !hasLatin(w.example_en)) { counts.noLat++; bad = true }
    if (!w.ipa || !/^\/.*\/$/.test(String(w.ipa).trim())) { counts.badIpa++; bad = true; if (examples.badIpa.length < 5) examples.badIpa.push(`${w.word}: ipa="${w.ipa}"`) }
    if (!Array.isArray(w.synonyms)) { counts.noSyn++; bad = true }
    if (!Array.isArray(w.antonyms)) { counts.noAnt++; bad = true }
    if (!ALLOWED_CEFR.has(w.cefr_level)) { counts.badCefr++; bad = true; if (examples.badCefr.length < 5) examples.badCefr.push(`${w.word}: cefr="${w.cefr_level}"`) }
    if (w.word && w.example_en) {
      const root = String(w.word).toLowerCase().slice(0, Math.max(3, w.word.length - 3))
      if (!String(w.example_en).toLowerCase().includes(root)) { counts.stem++; bad = true; if (examples.stem.length < 5) examples.stem.push(`${w.word}: example="${w.example_en}"`) }
    }
    if (!bad) counts.ok++
  }
}
console.log(JSON.stringify(counts, null, 2))
for (const k of Object.keys(examples)) {
  if (examples[k].length) console.log(`\n${k} samples:`, examples[k])
}
