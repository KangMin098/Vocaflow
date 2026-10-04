// scripts/textbook/frym-preservation-verify.mjs
// Read-only verification of local observer examples; no semantic classifier or DB import.
import fs from 'node:fs'
import path from 'node:path'
import { readPreservationRules, targetKey, digest, canonical } from './academic-reading-contract.mjs'
import { preservationPilotSchema, validatePreservationChecks } from '@vocaflow/library-pipeline/reading-preservation'
import { precisionRoundSchema, validatePrecisionEvidence } from '../../packages/library-pipeline/src/textbook/parallel-precision.ts'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? null : process.argv[i+1] }
if (process.argv.includes('--commit')) throw new Error('Local preservation verification has no --commit mode')
if (!arg('input') || !arg('preservation-rules') || !arg('precision-review') || !arg('evidence-dir'))
  throw new Error('--input --preservation-rules --precision-review --evidence-dir required')
const tasks = readPreservationRules(arg('preservation-rules'), arg('precision-review'))
const review = precisionRoundSchema.parse(JSON.parse(fs.readFileSync(arg('precision-review'), 'utf8')))
const pilot = preservationPilotSchema.parse(JSON.parse(fs.readFileSync(arg('input'), 'utf8')))
const first = tasks.values().next().value
if (pilot.review_hash !== first.review_hash || pilot.rules_hash !== first.rules_hash) throw new Error('Pilot review/rules changed')
const dir = path.resolve(arg('evidence-dir'))
function read(file) {
  if (!file || !/^[A-Za-z0-9_.-]+$/.test(file) || file === '.' || file === '..') throw new Error('Unsafe evidence filename')
  const target = path.join(dir,file)
  if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Evidence symlink rejected')
  return fs.readFileSync(target,'utf8')
}
const targetNames = ['knowledge-middle1','knowledge-high1-simple']
const expectedTargets = targetNames.map(n => JSON.parse(fs.readFileSync(new URL(`./targets/${n}.json`,import.meta.url),'utf8')))
const expected = new Set()
for (const task of tasks.values()) {
  const pair = review.pairs.find(p => p.id === task.entry.pair_id)
  const errors = validatePrecisionEvidence(pair, read(pair.files.fym), read(pair.files.research))
  if (errors.length) throw new Error(errors.join('; '))
  for (const target of expectedTargets) expected.add(`${pair.id}:${targetKey(target)}`)
}
const seen = new Set(), ids = new Set()
const counts = { records: 0, observer_preserved: 0, observer_changed: 0, observer_held: 0, negative_cases: 0 }
for (const r of pilot.records) {
  const key = `${r.pair_id}:${targetKey(r.target)}`
  if (!expected.has(key) || seen.has(key) || ids.has(r.id) || r.target_key !== targetKey(r.target) ||
      !expectedTargets.some(t => canonical(t) === canonical(r.target))) throw new Error('Pilot coverage/target identity mismatch')
  seen.add(key); ids.add(r.id)
  if (digest(r.text) !== r.text_hash) throw new Error(`${r.id}: passage changed after observer review`)
  const words = r.text.trim().split(/\s+/).length
  if (words < r.target.words.min || words > r.target.words.max) throw new Error(`${r.id}: word window failed`)
  const task = [...tasks.values()].find(t => t.entry.pair_id === r.pair_id)
  if (!r.source_attribution.includes(task.entry.source_url) || !r.source_attribution.includes(task.entry.original_work_id))
    throw new Error(`${r.id}: source attribution missing`)
  const error = validatePreservationChecks(task,r.checks,r.text)
  if (error) throw new Error(`${r.id}: ${error}`)
  if (!r.target.skills.includes(r.focus_question.skill) || !r.text.includes(r.focus_question.evidence))
    throw new Error(`${r.id}: question evidence or target skill mismatch`)
  counts.records++; counts[`observer_${r.observer_review.verdict}`]++
}
if (seen.size !== expected.size) throw new Error('Missing pilot source/target combination')
const requiredNegatives = new Set(review.pairs.flatMap(p=>p.alignments.filter(a=>['partial','contradicted'].includes(a.verdict)).map(a=>a.id)))
const negativeSeen = new Set()
for (const n of pilot.negative_cases) {
  if (!requiredNegatives.has(n.alignment_id) || negativeSeen.has(n.alignment_id) || n.observer_review.verdict !== 'changed')
    throw new Error('Negative example is not bound to a recorded partial/contradicted alignment')
  negativeSeen.add(n.alignment_id); counts.negative_cases++
}
// This pilot specifically covers the four comparison/denominator/frequency/age failures.
if (!['F05-A1','F09-A1','F10-A2','F13-A2'].every(id=>negativeSeen.has(id))) throw new Error('Missing negative failure example')
console.log(JSON.stringify({mode:pilot.mode,...counts,semantic_classification:'observer_judgment_only',student_calibration:false,db_writes:0},null,2))
