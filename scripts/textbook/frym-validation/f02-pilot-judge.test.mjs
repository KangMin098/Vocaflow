// scripts/textbook/frym-validation/f02-pilot-judge.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeF02Pilot, pilotManifestHash } from './f02-pilot-judge.mjs'
import { fixture, freeze, proposed, now } from './f02-pilot-fixture.mjs'

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
test('incomplete rows still reject preapproval reading and invalid observed values', () => {
  const base = fixture()
  const extra = { ...base.assignments[0], student_id: 'middle_target-incomplete' }
  base.assignments.push(extra)
  base.sessions.push({ ...base.sessions[0], student_id: extra.student_id, reasoning_accuracy: null, reading_started_at: '2026-10-31T23:59:00Z', reading_finished_at: '2026-11-01T00:02:00Z' })
  base.registration.manifest_sha256 = pilotManifestHash(base)
  assert.equal(judgeF02Pilot(base, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const badScore = fixture()
  badScore.assignments.push(extra)
  badScore.sessions.push({ ...badScore.sessions[0], student_id: extra.student_id, reasoning_accuracy: null, lexical_accuracy: -1 })
  badScore.registration.manifest_sha256 = pilotManifestHash(badScore)
  assert.equal(judgeF02Pilot(badScore, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
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
test('inclusive accuracy band accepts a repeated decimal mean at its lower bound', () => {
  const study = fixture()
  for (const s of study.sessions) s.lexical_accuracy = 0.6
  assert.deepEqual(judgeF02Pilot(study, freeze, proposed, now).target_fit, { middle_1: 'PASS', high_1: 'PASS' })
})
test('seventeen versus fifteen assigned anchor students remain evaluable', () => {
  const study = fixture()
  for (let i = 0; i < 2; i++) {
    const student_id = `high_target-extra-${i}`
    study.assignments.push({ ...study.assignments.find(a => a.arm === 'high_target'), student_id })
    study.sessions.push({ ...study.sessions.find(s => s.arm === 'high_target'), student_id })
  }
  study.registration.manifest_sha256 = pilotManifestHash(study)
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'PASS')
})
test('a changed instrument or different pair freeze cannot reuse F02 observations', () => {
  const study = fixture()
  study.sessions[0].instrument_sha256 = 'c'.repeat(64)
  assert.equal(judgeF02Pilot(study, freeze, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const wrongPair = { ...freeze, pair_id: 'F06' }
  assert.equal(judgeF02Pilot(fixture(), wrongPair, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
  const changedDraft = structuredClone(freeze)
  changedDraft.variants[0].draft_hash = 'c'.repeat(64)
  assert.equal(judgeF02Pilot(fixture(), changedDraft, proposed, now).level_separation, 'INSUFFICIENT_EVIDENCE')
})
test('burden ratings must be integer values on the sealed five-point scale', () => {
  const study = fixture()
  study.sessions.find(s => s.arm === 'middle_anchor').reasoning_burden = 2.5
  assert.deepEqual(judgeF02Pilot(study, freeze, proposed, now).reasons, ['session_invalid_or_unassigned'])
})
