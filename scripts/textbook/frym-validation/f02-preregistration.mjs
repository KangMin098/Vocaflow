// scripts/textbook/frym-validation/f02-preregistration.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const base = new URL('./', import.meta.url)
const read = name => JSON.parse(readFileSync(new URL(name, base), 'utf8'))
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const sha256 = value => createHash('sha256').update(value).digest('hex')
const freeze = read('f02-calibration-freeze.json')
const items = read('f02-items.proposed.json')
const key = read('f02-scoring-key.proposed.json')
const protocol = read('f02-student-pilot.proposed.json')
const packetBytes = readFileSync(new URL('../../../.agent-logs/academic-reading-f02-r2/F02-review-packet.json', base))
const packet = JSON.parse(packetBytes)
if (sha256(packetBytes) !== freeze.packet_sha256 || packet.source_id !== freeze.source_id || packet.source_revision !== freeze.source_revision || packet.source_hash !== freeze.source_hash) throw Error('F02 source or review packet freeze mismatch')
const instruments = {}

for (const grade of ['middle_1', 'high_1']) {
  const adaptation = packet.adaptations.find(a => a.target.age_band === grade)
  const variant = freeze.variants.find(v => v.grade === grade)
  if (!adaptation || !variant || sha256(adaptation.text) !== variant.passage_sha256) throw Error(`F02 ${grade} passage freeze mismatch`)
  const questions = items[grade], answers = key[grade]
  if (questions.length !== 12 || answers.length !== 12 || new Set(questions.map(i => i.id)).size !== 12 || canonical(questions.map(i => i.id).sort()) !== canonical(answers.map(i => i.id).sort())) throw Error(`F02 ${grade} item/key mismatch`)
  for (const axis of ['comprehension', 'lexical', 'syntax', 'reasoning']) if (questions.filter(i => i.axis === axis).length !== 3) throw Error(`F02 ${grade} ${axis} needs three items`)
  for (const item of questions) if (!item.source_quote || !adaptation.text.includes(item.source_quote)) throw Error(`F02 ${item.id} quote absent from frozen passage`)
  for (const answer of answers) if (['full', 'partial', 'zero'].some(field => typeof answer[field] !== 'string' || !answer[field].trim())) throw Error(`F02 ${answer.id} scoring rubric incomplete`)
  instruments[grade] = questions.map(item => {
    const answer = answers.find(a => a.id === item.id)
    return { id: item.id, axis: item.axis, prompt: item.prompt, source_quote: item.source_quote, scoring_rubric: `1: ${answer.full} 0.5: ${answer.partial} 0: ${answer.zero}` }
  })
}
if (items.status !== 'proposed_unreviewed' || key.status !== 'proposed_unreviewed' || protocol.status !== 'proposed_unsealed') throw Error('F02 proposal status changed without new registration procedure')
const metricKeys = ['reading_seconds', 'comprehension_accuracy', 'lexical_accuracy', 'syntax_accuracy', 'reasoning_accuracy', 'unknown_word_fraction', 'lexical_burden', 'sentence_burden', 'reasoning_burden', 'perceived_difficulty']
if (canonical(Object.keys(protocol.target_fit.metric_roles).sort()) !== canonical([...metricKeys].sort()) || protocol.target_fit.metric_roles.comprehension_accuracy !== 'hard_gate' || Object.values(protocol.target_fit.metric_roles).some(role => !['hard_gate', 'supporting', 'diagnostic'].includes(role))) throw Error('F02 target metric roles incomplete')
for (const grade of ['middle_1', 'high_1']) if (canonical(Object.keys(protocol.target_fit[grade]).sort()) !== canonical([...metricKeys].sort()) || metricKeys.some(metric => !Number.isFinite(protocol.target_fit[grade][metric].min) || !Number.isFinite(protocol.target_fit[grade][metric].max) || protocol.target_fit[grade][metric].min > protocol.target_fit[grade][metric].max)) throw Error(`F02 ${grade} bands invalid`)
const manifest = {
  version: 1,
  pair_id: 'F02',
  status: 'candidate_unsealed',
  passage_hash: Object.fromEntries(freeze.variants.map(v => [v.grade, v.passage_sha256])),
  item_set_hash: sha256(canonical({ middle_1: items.middle_1, high_1: items.high_1 })),
  scoring_key_hash: sha256(canonical({ scale: key.scoring_scale, general_rule: key.general_rule, middle_1: key.middle_1, high_1: key.high_1 })),
  pilot_protocol_hash: sha256(canonical(protocol)),
  instrument_file_sha256: Object.fromEntries(['middle_1', 'high_1'].map(grade => [grade, sha256(`${JSON.stringify(instruments[grade], null, 2)}\n`)])),
  source_freeze_sha256: sha256(readFileSync(new URL('f02-calibration-freeze.json', base))),
  item_file: 'f02-items.proposed.json',
  scoring_key_file: 'f02-scoring-key.proposed.json',
  protocol_file: 'f02-student-pilot.proposed.json',
  human_lead_id: null,
  registered_at: null,
  registration_evidence: null
}
const output = `${JSON.stringify(manifest, null, 2)}\n`
const target = new URL('f02-preregistration.proposed.json', base)
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw Error('F02 preregistration manifest is stale')
  for (const grade of ['middle_1', 'high_1']) if (readFileSync(new URL(`f02-${grade}-instrument.proposed.json`, base), 'utf8') !== `${JSON.stringify(instruments[grade], null, 2)}\n`) throw Error(`F02 ${grade} instrument is stale`)
  console.log('F02 candidate manifest and passage/item/key/protocol hashes verified')
} else {
  for (const grade of ['middle_1', 'high_1']) writeFileSync(new URL(`f02-${grade}-instrument.proposed.json`, base), `${JSON.stringify(instruments[grade], null, 2)}\n`)
  writeFileSync(target, output)
  console.log('F02 candidate manifest written; human preregistration remains pending')
}
