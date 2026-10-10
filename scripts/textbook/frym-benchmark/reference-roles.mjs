// scripts/textbook/frym-benchmark/reference-roles.mjs
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { assessReferenceCalibration } from './reference-calibration.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const filled = value => typeof value === 'string' && value.trim().length > 0
const fail = code => { throw Error(code) }
const file = (path, expected, code) => {
  if (!filled(path) || !hex(expected)) fail(code)
  assertExternalCandidate(path)
  let bytes
  try { bytes = readFileSync(path) } catch { fail(code) }
  if (createHash('sha256').update(bytes).digest('hex') !== expected) fail(code)
}

export function assessReferenceRoles({ structural, admission, calibration_evidence }) {
  if (!filled(structural?.source_id) || !filled(structural?.source_url) ||
      !['passage_structure', 'item_structure', 'level_progression'].includes(structural?.purpose) ||
      !filled(structural?.reviewer_id) ||
      !['authorized_internal_analysis', 'catalog_only', 'unknown', 'excluded'].includes(structural?.rights_scope))
    fail('STRUCTURAL_REFERENCE_INVALID')
  file(structural.source_path, structural.source_hash, 'STRUCTURAL_SOURCE_CHANGED')
  file(structural.rights_evidence_path, structural.rights_evidence_hash,
    'STRUCTURAL_RIGHTS_EVIDENCE_CHANGED')
  const structuralEligible = structural.rights_scope === 'authorized_internal_analysis'
  const calibration = admission ? assessReferenceCalibration({ admission,
    evidence: calibration_evidence }) : null
  const decision = {
    schema: 'reference-roles/1', source_id: structural.source_id,
    source_hash: structural.source_hash, rights_evidence_hash: structural.rights_evidence_hash,
    structural_evidence_hash: hash(structural),
    evidence_level: 'operator_reviewed_local',
    structural_reference: structuralEligible ? 'eligible' :
      (structural.rights_scope === 'excluded' ? 'rejected' : 'hold'),
    structural_reason: structuralEligible ? null :
      (structural.rights_scope === 'excluded' ? 'STRUCTURAL_RIGHTS_EXCLUDED' :
        'STRUCTURAL_ANALYSIS_RIGHTS_UNVERIFIED'),
    calibration_reference: calibration?.calibration_eligible ? 'eligible' : 'hold',
    calibration_decision_hash: calibration?.decision_hash ?? null,
    calibration_reason: admission ? (calibration.calibration_eligible ? null :
      'CALIBRATION_GATES_INCOMPLETE') : 'ADMISSION_AND_CALIBRATION_REQUIRED',
    grade_distribution_eligible: false,
    grade_distribution_reason: 'COHORT_REPRESENTATIVENESS_NOT_EVALUATED',
  }
  return { ...decision, decision_hash: hash(decision) }
}
