// scripts/textbook/frym-validation/f02-pilot-judge.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeF02Pilot, pilotManifestHash, sha256 } from './f02-pilot-judge.mjs'

const root = 'scripts/textbook/frym-validation/'
const freezeBytes = readFileSync(`${root}f02-calibration-freeze.json`)
const freeze = JSON.parse(freezeBytes)
const proposed = JSON.parse(readFileSync(`${root}f02-student-pilot.proposed.json`))
const now = Date.parse('2026-11-02T00:00:00Z')
const approved_at = '2026-11-01T00:00:00Z'
function fixture() {
  const protocol = { ...structuredClone(proposed), status: 'sealed', human_lead_id: 'lead-synthetic', approved_at, registration_evidence: 'Synthetic protocol registration for tests only', operations: 'Synthetic fixed reading, scoring, allocation, and missing-data procedure' }
  const assignments = [], sessions = []
  for (const arm of ['middle_target', 'high_target', 'middle_anchor']) for (let i = 0; i < 15; i++) {
    const student_id = `${arm}-${i}`, grade = arm === 'middle_target' ? 'middle_1' : 'high_1'
    assignments.push({ student_id, grade, arm, grade_verified_by: 'lead-synthetic' })
    const passage_sha256 = freeze.variants.find(v => v.grade === (arm === 'high_target' ? 'high_1' : 'middle_1')).passage_sha256
    const reading_started_at = new Date(Date.parse(approved_at) + 60_000 + sessions.length * 600_000).toISOString()
    const reading_finished_at = new Date(Date.parse(reading_started_at) + 180_000).toISOString()
    sessions.push({ student_id, grade, arm, passage_sha256, reading_started_at, reading_finished_at, reading_seconds: 180,
      comprehension_accuracy: 0.8, lexical_accuracy: 0.8, syntax_accuracy: 0.8, reasoning_accuracy: 0.75,
      unknown_word_fraction: 0.1, lexical_burden: arm === 'high_target' ? 3 : 2,
      sentence_burden: 2, reasoning_burden: arm === 'high_target' ? 3 : 2, perceived_difficulty: 2 })
  }
  const study = { protocol, freeze_sha256: sha256(freezeBytes), instrument_sha256: { middle_1: 'a'.repeat(64), high_1: 'b'.repeat(64) }, assignments, sessions }
  study.registration = { human_lead_id: 'lead-synthetic', approved_at, registration_evidence: 'Synthetic preregistration, no real students', instrument_review_evidence: 'Synthetic item review evidence only', allocation_evidence: 'Synthetic randomized allocation evidence only', manifest_sha256: pilotManifestHash(study) }
  return study
}

test('synthetic target fit and common-grade separation pass remain calibration only', () => {
  const result = judgeF02Pilot(fixture(), freeze, proposed, now)
  assert.deepEqual(result.target_fit, { middle_1: 'PASS', high_1: 'PASS' })
  assert.equal(result.level_separation, 'PASS')
  assert.equal(result.gold, false)
  assert.equal(result.db_seed, false)
})
test('target fit does not conceal failed separation', () => {
  const study = fixture()
  for (const s of study.sessions.filter(s => s.arm === 'high_target')) { s.lexical_burden = 2; s.reasoning_burden = 2 }
  assert.deepEqual(judgeF02Pilot(study, freeze, proposed, now).target_fit, { middle_1: 'PASS', high_1: 'PASS' })
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'FAIL')
})
test('unsealed, insufficient, changed-assignment and wrong-grade sessions cannot pass', () => {
  const study = fixture()
  study.sessions = study.sessions.filter(s => s.arm !== 'middle_anchor')
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  study.sessions = fixture().sessions
  study.assignments[0].arm = 'high_target'
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const unsealed = fixture(); unsealed.protocol.status = 'proposed_unsealed'
  assert.equal(judgeF02Pilot(unsealed, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const wrong = fixture(); wrong.sessions.find(s => s.arm === 'middle_anchor').grade = 'middle_1'
  assert.equal(judgeF02Pilot(wrong, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
})
test('missing response is excluded without erasing fifteen complete students', () => {
  const study = fixture()
  const extra = { ...study.assignments[0], student_id: 'middle_target-incomplete' }
  study.assignments.push(extra)
  study.sessions.push({ ...study.sessions[0], student_id: extra.student_id, reasoning_accuracy: null })
  study.registration.manifest_sha256 = pilotManifestHash(study)
  const result = judgeF02Pilot(study, freeze, proposed, now)
  assert.equal(result.target_fit.middle_1, 'PASS')
  assert.equal(result.level_separation, 'PASS')
  assert.equal(result.excluded.middle_target, 1)
})
test('empty lead and unapproved operations cannot seal the result', () => {
  const study = fixture()
  study.protocol.human_lead_id = null
  study.registration.human_lead_id = null
  study.assignments.forEach(a => { a.grade_verified_by = null })
  study.registration.manifest_sha256 = pilotManifestHash(study)
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const missingOperations = fixture(); missingOperations.protocol.operations = null
  missingOperations.registration.manifest_sha256 = pilotManifestHash(missingOperations)
  assert.equal(judgeF02Pilot(missingOperations, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
})
test('separation reads the predeclared numeric threshold', () => {
  const stricter = structuredClone(proposed)
  stricter.level_separation.minimum_reasoning_burden_gap = 1.5
  const study = fixture()
  study.protocol.level_separation.minimum_reasoning_burden_gap = 1.5
  study.registration.manifest_sha256 = pilotManifestHash(study)
  assert.equal(judgeF02Pilot(study, freeze, stricter, now).level_separation, 'FAIL')
})
