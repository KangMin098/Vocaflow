// scripts/textbook/frym-validation/f02-pilot-fixture.mjs
// Synthetic observations only; never a real student study.
import { readFileSync } from 'node:fs'
import { pilotManifestHash, sha256 } from './f02-pilot-judge.mjs'

const root = 'scripts/textbook/frym-validation/'
export const freezeBytes = readFileSync(`${root}f02-calibration-freeze.json`)
export const freeze = JSON.parse(freezeBytes)
export const proposed = JSON.parse(readFileSync(`${root}f02-student-pilot.proposed.json`))
const preregistration = JSON.parse(readFileSync(`${root}f02-preregistration.proposed.json`))
export const now = Date.parse('2026-11-02T00:00:00Z')
const approved_at = '2026-11-01T00:00:00Z'
export function fixture() {
  const protocol = { ...structuredClone(proposed), status: 'sealed', human_lead_id: 'lead-synthetic', approved_at, registration_evidence: 'Synthetic protocol registration for tests only', operations: 'Synthetic fixed reading, scoring, allocation, and missing-data procedure' }
  const assignments = [], sessions = []
  for (const arm of ['middle_target', 'high_target', 'middle_anchor']) for (let i = 0; i < 15; i++) {
    const student_id = `${arm}-${i}`, grade = arm === 'middle_target' ? 'middle_1' : 'high_1'
    assignments.push({ student_id, grade, arm, grade_verified_by: 'lead-synthetic' })
    const passage_sha256 = freeze.variants.find(v => v.grade === (arm === 'high_target' ? 'high_1' : 'middle_1')).passage_sha256
    const reading_started_at = new Date(Date.parse(approved_at) + 60_000 + sessions.length * 600_000).toISOString()
    const reading_finished_at = new Date(Date.parse(reading_started_at) + 180_000).toISOString()
    sessions.push({ student_id, grade, arm, passage_sha256, instrument_sha256: arm === 'high_target' ? 'b'.repeat(64) : 'a'.repeat(64), reading_started_at, reading_finished_at, reading_seconds: 180, prior_exposure: false, second_version_exposure: false, uninterrupted_gap_seconds: 0,
      comprehension_accuracy: 0.8, lexical_accuracy: 0.8, syntax_accuracy: 0.8, reasoning_accuracy: 0.75,
      unknown_word_fraction: 0.1, lexical_burden: arm === 'high_target' ? 3 : 2,
      sentence_burden: arm === 'high_target' ? 3 : 2, reasoning_burden: arm === 'high_target' ? 3 : 2, perceived_difficulty: 2 })
  }
  const study = { protocol, freeze_sha256: sha256(freezeBytes), passage_hash: preregistration.passage_hash, item_set_hash: preregistration.item_set_hash, scoring_key_hash: preregistration.scoring_key_hash, pilot_protocol_hash: preregistration.pilot_protocol_hash, instrument_sha256: preregistration.instrument_file_sha256, assignments, sessions }
  for (const s of sessions) s.instrument_sha256 = study.instrument_sha256[s.arm === 'high_target' ? 'high_1' : 'middle_1']
  study.registration = { human_lead_id: 'lead-synthetic', approved_at, registration_evidence: 'Synthetic preregistration, no real students', instrument_review_evidence: 'Synthetic item review evidence only', separation_construct_review_evidence: 'Synthetic construct review evidence only', allocation_evidence: 'Synthetic randomized allocation evidence only', manifest_sha256: pilotManifestHash(study) }
  return study
}
