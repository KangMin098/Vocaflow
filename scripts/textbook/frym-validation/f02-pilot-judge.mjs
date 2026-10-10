// scripts/textbook/frym-validation/f02-pilot-judge.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const sha256 = value => createHash('sha256').update(value).digest('hex')
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const hash = value => /^[a-f0-9]{64}$/.test(value ?? '')
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 }
const metrics = ['reading_seconds', 'comprehension_accuracy', 'lexical_accuracy', 'syntax_accuracy', 'reasoning_accuracy', 'unknown_word_fraction', 'lexical_burden', 'sentence_burden', 'reasoning_burden', 'perceived_difficulty']
const frozenBytes = readFileSync(new URL('./f02-calibration-freeze.json', import.meta.url))
const frozenF02 = JSON.parse(frozenBytes)
const candidateManifest = JSON.parse(readFileSync(new URL('./f02-preregistration.proposed.json', import.meta.url)))
const grades = { middle_1: 'middle_1', high_1: 'high_1' }
const arms = ['middle_target', 'high_target', 'middle_anchor']
const variant = arm => arm.startsWith('middle') ? 'middle_1' : 'high_1'
const grade = arm => arm === 'middle_target' ? 'middle_1' : 'high_1'
const acceptable = (value, key) => Number.isFinite(value) && (key.endsWith('_accuracy') || key === 'unknown_word_fraction' ? value >= 0 && value <= 1 : key === 'reading_seconds' ? value > 0 : Number.isInteger(value) && value >= 1 && value <= 5)
const aggregate = sessions => Object.fromEntries(metrics.map(key => [key, key.endsWith('_accuracy') ? mean(sessions.map(s => s[key])) : median(sessions.map(s => s[key]))]))

// The seal binds the frozen passages, instrument files, assigned pseudonyms and proposed bands before any response.
export function pilotManifest(study) {
  return { freeze_sha256: study.freeze_sha256, passage_hash: study.passage_hash, item_set_hash: study.item_set_hash, scoring_key_hash: study.scoring_key_hash, pilot_protocol_hash: study.pilot_protocol_hash, protocol: study.protocol, instrument_sha256: study.instrument_sha256, assignments: study.assignments }
}
export const pilotManifestHash = study => sha256(canonical(pilotManifest(study)))

export function judgeF02Pilot(study, freeze, proposed, now) {
  const insufficient = reason => ({ target_fit: { middle_1: 'INSUFFICIENT_EVIDENCE', high_1: 'INSUFFICIENT_EVIDENCE' }, level_separation: 'INSUFFICIENT_EVIDENCE', outcome_statuses: [reason.includes('invalid') || reason.includes('changed') ? 'measurement_invalid' : 'inconclusive_sample'], reasons: [reason], educationally_validated: false, gold: false, db_seed: false })
  if (proposed.status !== 'proposed_unsealed' || study.protocol?.status !== 'sealed') return insufficient('protocol_unsealed')
  if (study.protocol?.pair_id !== 'F02' || freeze.pair_id !== 'F02' || canonical(freeze) !== canonical(frozenF02) || study.freeze_sha256 !== sha256(frozenBytes) || !['middle_1', 'high_1'].every(g => freeze.variants.some(v => v.grade === g))) return insufficient('freeze_invalid')
  if (canonical(study.passage_hash) !== canonical(candidateManifest.passage_hash) || study.item_set_hash !== candidateManifest.item_set_hash || study.scoring_key_hash !== candidateManifest.scoring_key_hash || study.pilot_protocol_hash !== candidateManifest.pilot_protocol_hash || canonical(study.instrument_sha256) !== canonical(candidateManifest.instrument_file_sha256) || sha256(canonical(proposed)) !== candidateManifest.pilot_protocol_hash) return insufficient('preregistration_hash_changed')
  if (canonical({ ...study.protocol, status: 'proposed_unsealed', human_lead_id: null, approved_at: null, registration_evidence: null, operations: null }) !== canonical(proposed)) return insufficient('protocol_changed_from_proposal')
  const approval = study.registration
  if (!approval || typeof study.protocol.human_lead_id !== 'string' || study.protocol.human_lead_id.trim().length < 2 || typeof study.protocol.registration_evidence !== 'string' || study.protocol.registration_evidence.length < 12 || typeof study.protocol.operations !== 'string' || study.protocol.operations.length < 12 || !hash(study.freeze_sha256) || !hash(approval.manifest_sha256) || !hash(study.instrument_sha256?.middle_1) || !hash(study.instrument_sha256?.high_1) || !Array.isArray(study.assignments) || !Array.isArray(study.sessions) || approval.manifest_sha256 !== pilotManifestHash(study) || approval.human_lead_id !== study.protocol.human_lead_id || ['registration_evidence', 'instrument_review_evidence', 'allocation_evidence', 'separation_construct_review_evidence'].some(k => typeof approval[k] !== 'string' || approval[k].length < 12)) return insufficient('registration_not_sealed_or_changed')
  const approvedAt = Date.parse(approval.approved_at), proposedAt = Date.parse(study.protocol.approved_at)
  if (!Number.isFinite(approvedAt) || approvedAt !== proposedAt || approvedAt > now) return insufficient('approval_time_invalid')
  const assignmentMap = new Map()
  for (const a of study.assignments) {
    if (typeof a.student_id !== 'string' || a.student_id.length < 2 || !arms.includes(a.arm) || a.grade !== grade(a.arm) || a.grade_verified_by !== approval.human_lead_id || assignmentMap.has(a.student_id)) return insufficient('assignment_invalid')
    assignmentMap.set(a.student_id, a)
  }
  const assigned = Object.fromEntries(arms.map(arm => [arm, study.assignments.filter(a => a.arm === arm).length]))
  if (arms.some(arm => assigned[arm] < proposed.minimum_complete_students_per_variant || assigned[arm] > proposed.maximum_assigned_students_per_arm)) return insufficient('cohort_assignment_invalid')
  const used = new Set(), byArm = Object.fromEntries(arms.map(arm => [arm, []])), excluded = Object.fromEntries(arms.map(arm => [arm, 0]))
  const exclusionReasons = Object.fromEntries(arms.map(arm => [arm, {}]))
  const exclude = (arm, reason) => { excluded[arm]++; exclusionReasons[arm][reason] = (exclusionReasons[arm][reason] ?? 0) + 1 }
  for (const s of study.sessions) {
    const a = assignmentMap.get(s.student_id), start = Date.parse(s.reading_started_at), end = Date.parse(s.reading_finished_at)
    if (!a || used.has(s.student_id) || s.arm !== a.arm || s.grade !== a.grade || s.passage_sha256 !== freeze.variants.find(v => v.grade === variant(a.arm))?.passage_sha256 || s.instrument_sha256 !== study.instrument_sha256[variant(a.arm)]) return insufficient('session_invalid_or_unassigned')
    used.add(s.student_id)
    if ((s.reading_started_at != null && (!Number.isFinite(start) || start < approvedAt || start > now)) || (s.reading_finished_at != null && (!Number.isFinite(end) || end < approvedAt || end > now)) || (s.reading_started_at != null && s.reading_finished_at != null && end <= start) || metrics.some(k => s[k] != null && !acceptable(s[k], k)) || (s.reading_seconds != null && s.reading_started_at != null && s.reading_finished_at != null && s.reading_seconds !== (end - start) / 1000) || typeof s.prior_exposure !== 'boolean' || typeof s.second_version_exposure !== 'boolean' || (s.uninterrupted_gap_seconds != null && (!Number.isFinite(s.uninterrupted_gap_seconds) || s.uninterrupted_gap_seconds < 0))) return insufficient('session_invalid_or_unassigned')
    if (s.prior_exposure) { exclude(a.arm, 'prior_exposure'); continue }
    if (s.second_version_exposure) { exclude(a.arm, 'carryover'); continue }
    if (s.reading_started_at == null || s.reading_finished_at == null || metrics.some(k => s[k] == null)) { exclude(a.arm, 'incomplete'); continue }
    if (s.reading_seconds < proposed.session_quality_policy.minimum_reading_seconds) { exclude(a.arm, 'short_reading'); continue }
    if (s.uninterrupted_gap_seconds != null && s.uninterrupted_gap_seconds > proposed.session_quality_policy.maximum_uninterrupted_gap_seconds) { exclude(a.arm, 'long_gap'); continue }
    byArm[a.arm].push(s)
  }
  const min = proposed.minimum_complete_students_per_variant
  const targetMetrics = {}, targetDeviations = {}, target = Object.fromEntries(Object.entries(grades).map(([g]) => {
    const rows = byArm[g === 'middle_1' ? 'middle_target' : 'high_target']
    if (rows.length < min) return [g, 'INSUFFICIENT_EVIDENCE']
    const measured = aggregate(rows), bands = proposed.target_fit[g]
    targetMetrics[g] = measured
    targetDeviations[g] = metrics.filter(k => measured[k] + 1e-10 < bands[k].min || measured[k] - 1e-10 > bands[k].max).map(k => ({ metric: k, role: proposed.target_fit.metric_roles[k] }))
    return [g, targetDeviations[g].some(d => d.role === 'hard_gate') ? 'FAIL' : 'PASS']
  }))
  let separation = 'INSUFFICIENT_EVIDENCE'
  if (byArm.middle_anchor.length >= proposed.level_separation.minimum_complete_high_1_anchor_students_per_variant && byArm.high_target.length >= proposed.level_separation.minimum_complete_high_1_anchor_students_per_variant) {
    const low = aggregate(byArm.middle_anchor), high = aggregate(byArm.high_target)
    separation = high.reasoning_burden - low.reasoning_burden + 1e-10 >= proposed.level_separation.minimum_reasoning_burden_gap && high.sentence_burden - low.sentence_burden + 1e-10 >= proposed.level_separation.minimum_sentence_burden_gap && low.comprehension_accuracy + 1e-10 >= proposed.level_separation.comprehension_floor_each_anchor_arm && high.comprehension_accuracy + 1e-10 >= proposed.level_separation.comprehension_floor_each_anchor_arm ? 'PASS' : 'FAIL'
  }
  const outcomeStatuses = [...Object.values(target).map(v => v === 'PASS' ? 'target_fit_pass' : v === 'FAIL' ? 'target_fit_fail' : 'inconclusive_sample'), separation === 'PASS' ? 'separation_pass' : separation === 'FAIL' ? 'separation_fail' : 'inconclusive_sample']
  return { target_fit: target, target_metrics: targetMetrics, target_deviations: targetDeviations, level_separation: separation, outcome_statuses: [...new Set(outcomeStatuses)], counts: Object.fromEntries(arms.map(arm => [arm, byArm[arm].length])), excluded, exclusion_reasons: exclusionReasons, reasons: [], scope: 'F02_calibration_only', calibration_criteria_met: Object.values(target).every(v => v === 'PASS') && separation === 'PASS', educationally_validated: false, gold: false, db_seed: false }
}
