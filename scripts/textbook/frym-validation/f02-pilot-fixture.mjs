// scripts/textbook/frym-validation/f02-pilot-fixture.mjs
// Synthetic observations only; never a real student study.
import { readFileSync } from 'node:fs'
import { pilotManifestHash, sha256 } from './f02-pilot-judge.mjs'

const root = 'scripts/textbook/frym-validation/'
export const freezeBytes = readFileSync(`${root}f02-calibration-freeze.json`)
export const freeze = JSON.parse(freezeBytes)
export const proposed = JSON.parse(readFileSync(`${root}f02-student-pilot.proposed.json`))
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
    sessions.push({ student_id, grade, arm, passage_sha256, instrument_sha256: arm === 'high_target' ? 'b'.repeat(64) : 'a'.repeat(64), reading_started_at, reading_finished_at, reading_seconds: 180,
      comprehension_accuracy: 0.8, lexical_accuracy: 0.8, syntax_accuracy: 0.8, reasoning_accuracy: 0.75,
      unknown_word_fraction: 0.1, lexical_burden: arm === 'high_target' ? 3 : 2,
      sentence_burden: 2, reasoning_burden: arm === 'high_target' ? 3 : 2, perceived_difficulty: 2 })
  }
  const study = { protocol, freeze_sha256: sha256(freezeBytes), instrument_sha256: { middle_1: 'a'.repeat(64), high_1: 'b'.repeat(64) }, assignments, sessions }
  study.registration = { human_lead_id: 'lead-synthetic', approved_at, registration_evidence: 'Synthetic preregistration, no real students', instrument_review_evidence: 'Synthetic item review evidence only', allocation_evidence: 'Synthetic randomized allocation evidence only', manifest_sha256: pilotManifestHash(study) }
  return study
}
