// scripts/textbook/frym-validation/f02-v2-bridge.mjs
import { bundleV2Schema, evaluateV2, expertOutcomeV2, METRIC_KEYS, registrationBlockersV2 } from '@vocaflow/library-pipeline/educational-validation-v2'
import { judgeF02Pilot, sha256 } from './f02-pilot-judge.mjs'

const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const insufficient = reason => ({ target_fit: { middle_1: 'INSUFFICIENT_EVIDENCE', high_1: 'INSUFFICIENT_EVIDENCE' }, level_separation: 'INSUFFICIENT_EVIDENCE', reasons: [reason], gold: false, db_seed: false })

// A companion anchor arm can be judged only when both target arms reconcile with the existing sealed v2 workflow.
export function judgeF02PilotWithV2(study, freeze, proposed, rawBundle, instrumentFiles, now) {
  const pilot = judgeF02Pilot(study, freeze, proposed, now)
  if (pilot.reasons.length) return pilot
  let bundle
  try { bundle = bundleV2Schema.parse(rawBundle) } catch { return insufficient('v2_bundle_invalid') }
  if (bundle.protocol.study_purpose !== 'calibration' || registrationBlockersV2(bundle, now).length || bundle.protocol_approval?.human_lead_id !== study.registration.human_lead_id) return insufficient('v2_registration_or_expert_gate_invalid')
  const passages = Object.fromEntries(bundle.records.map(r => [r.id, r.adapted_passage]))
  for (const grade of ['middle_1', 'high_1']) {
    const frozen = freeze.variants.find(v => v.grade === grade)
    const records = bundle.records.filter(r => r.source_id === freeze.source_id && r.target_key === frozen.target_key && r.grade === grade)
    if (records.length !== 1) return insufficient(`v2_F02_${grade}_record_missing`)
    const r = records[0], arm = grade === 'middle_1' ? 'middle_target' : 'high_target', sessions = study.sessions.filter(s => s.arm === arm)
    const currentIds = sessions.map(s => s.student_id).sort(), v2Ids = r.student_sessions.map(s => s.student_id).sort()
    if (r.pair_id !== freeze.pair_id || r.source_revision !== freeze.source_revision || r.source_hash !== freeze.source_hash || sha256(r.adapted_passage) !== frozen.passage_sha256 || canonical(currentIds) !== canonical(v2Ids) || canonical(r.instrument) !== canonical(instrumentFiles[grade])) return insufficient(`v2_F02_${grade}_identity_or_sessions_changed`)
    const meaning = expertOutcomeV2(bundle, r, r.adapted_passage, now)
    if (!meaning.ok) return insufficient(`v2_F02_${grade}_meaning_review_failed`)
    const words = r.adapted_passage.trim().split(/\s+/).length
    for (const session of sessions) {
      const original = r.student_sessions.find(s => s.student_id === session.student_id)
      if (!original || session.reading_started_at !== original.reading_started_at || session.reading_finished_at !== original.reading_finished_at || session.grade !== original.grade || ['lexical_burden', 'sentence_burden', 'reasoning_burden', 'perceived_difficulty'].some(k => session[k] !== original[k]) || (session.unknown_word_fraction == null ? original.unknown_word_count != null : original.unknown_word_count == null || Math.abs(session.unknown_word_fraction - original.unknown_word_count / words) > 1e-10)) return insufficient(`v2_F02_${grade}_student_record_changed`)
      if (session.reading_started_at != null && Date.parse(session.reading_started_at) < meaning.completed_at) return insufficient(`v2_F02_${grade}_started_before_meaning_review`)
      for (const axis of ['comprehension', 'lexical', 'syntax', 'reasoning']) {
        const values = r.instrument.filter(i => i.axis === axis).map(i => original.answers.find(a => a.item_id === i.id)?.score ?? null)
        const observed = session[`${axis}_accuracy`]
        if (observed == null ? values.every(v => v != null) : values.some(v => v == null) || Math.abs(observed - values.reduce((sum, v) => sum + v, 0) / values.length) > 1e-10) return insufficient(`v2_F02_${grade}_student_record_changed`)
      }
    }
    const range = bundle.protocol.ranges.find(x => x.grade === grade)
    if (!range || METRIC_KEYS.some(k => canonical(range[k]) !== canonical(proposed.target_fit[grade][k]))) return insufficient(`v2_F02_${grade}_band_changed`)
    const outcome = evaluateV2(bundle, r, r.adapted_passage, now, passages)
    const metrics = pilot.target_metrics[grade]
    if (!metrics || outcome.student_count !== pilot.counts[arm] || METRIC_KEYS.some(k => outcome.metrics[k] === null || Math.abs(outcome.metrics[k] - metrics[k]) > 1e-10)) return insufficient(`v2_F02_${grade}_scores_changed`)
    const nonBandBlockers = outcome.blockers.filter(k => !k.startsWith('target_range_failed_'))
    if (nonBandBlockers.length || (pilot.target_fit[grade] === 'PASS') !== (outcome.state === 'student_validated')) return insufficient(`v2_F02_${grade}_validation_failed`)
  }
  const middle = bundle.records.find(r => r.source_id === freeze.source_id && r.target_key === freeze.variants.find(v => v.grade === 'middle_1').target_key)
  const meaning = expertOutcomeV2(bundle, middle, middle.adapted_passage, now)
  if (!meaning.ok || study.sessions.some(s => s.arm === 'middle_anchor' && s.reading_started_at != null && Date.parse(s.reading_started_at) < meaning.completed_at)) return insufficient('anchor_started_before_meaning_review')
  return { ...pilot, v2_reconciled: true }
}
