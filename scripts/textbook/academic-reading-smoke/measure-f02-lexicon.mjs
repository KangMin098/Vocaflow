// scripts/textbook/academic-reading-smoke/measure-f02-lexicon.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../../lib/supabase-client.mjs'
import { fetchAllIn, loadEnv } from '../volume-pool.mjs'
import { extractBookLemmas } from '@vocaflow/library-pipeline'

loadEnv()
const base = path.resolve(process.argv[2] ?? '.agent-logs/academic-reading-f02-r2')
const apply = process.argv.includes('--apply')
const db = createScriptClient({ quiet: true })
const outputs = []
for (const dir of ['middle1', 'high1']) {
  const file = path.join(base, dir, 'chunk-00.out.json')
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  const draft = rows.find(x => x.reading?.preservation_rules?.entry?.pair_id === 'F02')
  if (!draft) throw new Error(`F02 draft missing: ${dir}`)
  const text = draft.text
  const index = extractBookLemmas([{ chapter_idx: 1, title: '', content: text,
    word_count: text.split(/\s+/).filter(Boolean).length,
    paragraph_offsets: [0], sentence_offsets: [0] }])
  const lemmas = [...index.bookFrequency.keys()]
  const map = new Map()
  for (const row of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', lemmas, ['word'])) {
    if (row.v_level != null && Number(row.v_level) !== 11) map.set(row.word, Number(row.v_level))
  }
  const matched = lemmas.flatMap(word => map.has(word) ? [{ word, level: map.get(word) }] : [])
  const levels = matched.map(x => x.level).sort((a, b) => a - b)
  const p75 = levels.length ? levels[Math.ceil(0.75 * levels.length) - 1] : null
  const upper = matched.filter(x => x.level > 3).sort((a, b) => b.level - a.level || a.word.localeCompare(b.word))
  const unmatched = lemmas.filter(word => !map.has(word)).sort()
  const measurement = { id: `F02-${dir}`, method: 'extractBookLemmas + shared_dictionary.v_level, distinct matched lemma p75',
    total_lemmas: lemmas.length, matched_lemmas: matched.length, p75_v_level: p75,
    above_v3: upper, unmatched }
  outputs.push(measurement)
  if (apply) {
    const profile = draft.reading.reading_analysis.passage_profile
    const metric = `Dictionary proxy: ${matched.length}/${lemmas.length} distinct lemmas matched; p75 V${p75 ?? 'unknown'} among matched (V11 excluded). ${upper.length} matched lemmas exceed V3; ${unmatched.length} are unmatched. This is not student-calibrated difficulty.`
    profile.lexical_level.evidence += ` ${metric}`
    profile.overall_level.evidence += ` ${metric}`
    fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
  }
}
fs.writeFileSync(path.join(base, 'lexical-evidence.json'), `${JSON.stringify(outputs, null, 2)}\n`)
console.log(JSON.stringify(outputs, null, 2))
