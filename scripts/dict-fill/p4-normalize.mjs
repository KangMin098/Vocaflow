// Post-process: normalize abbreviated pos values (n. → noun, etc.) + fix multi-IPA.
// Mutates each chunk-NNN-output.jsonl in-place.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.resolve(__dirname, '../../data/dict-fill/p4/outputs')

const POS_MAP = {
  'n.': 'noun', 'n': 'noun',
  'v.': 'verb', 'v': 'verb',
  'adj.': 'adjective', 'adj': 'adjective',
  'adv.': 'adverb', 'adv': 'adverb',
  'prep.': 'preposition', 'prep': 'preposition',
  'conj.': 'conjunction', 'conj': 'conjunction',
  'pron.': 'pronoun', 'pron': 'pronoun',
  'det.': 'determiner', 'det': 'determiner',
  'interj.': 'interjection', 'interj': 'interjection',
  'phrasal verb': 'phrasal_verb', 'phrasal-verb': 'phrasal_verb',
}

function normalizePos(p) {
  if (!p) return p
  const s = String(p).trim()
  // Strip parenthetical qualifiers like "verb (past)" → "verb"
  const stripped = s.replace(/\s*\([^)]*\)\s*/g, '').trim()
  // Multi-pos with slash or comma → first part
  const first = stripped.split(/[/,]/)[0].trim().toLowerCase()
  if (POS_MAP[first]) return POS_MAP[first]
  if (POS_MAP[first.replace(/\.$/, '')]) return POS_MAP[first.replace(/\.$/, '')]
  return first
}

function normalizeIpa(s) {
  if (!s) return s
  const m = String(s).match(/\/[^/]+\//)
  return m ? m[0] : s
}

let totalLines = 0, posFixed = 0, ipaFixed = 0
const files = fs.readdirSync(DIR).filter(f => f.endsWith('-output.jsonl')).sort()
for (const f of files) {
  const p = path.resolve(DIR, f)
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim())
  const out = []
  for (const line of lines) {
    totalLines++
    let w
    try { w = JSON.parse(line) } catch { out.push(line); continue }
    const newPos = normalizePos(w.pos)
    if (newPos !== w.pos) { w.pos = newPos; posFixed++ }
    const newIpa = normalizeIpa(w.ipa)
    if (newIpa !== w.ipa) { w.ipa = newIpa; ipaFixed++ }
    // Normalize meanings_ko[].pos too
    if (Array.isArray(w.meanings_ko)) {
      for (const m of w.meanings_ko) if (m && m.pos) m.pos = normalizePos(m.pos)
    }
    out.push(JSON.stringify(w))
  }
  fs.writeFileSync(p, out.join('\n') + '\n', 'utf8')
}
console.log(`Total: ${totalLines}, pos fixed: ${posFixed}, ipa fixed: ${ipaFixed}`)
