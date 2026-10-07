// scripts/textbook/frym-benchmark/pipeline-state.mjs
import { hash, judgeBenchmark, workflowState, verifyDecision } from './benchmark.mjs'
import { verifyAdmission } from './local-admission-ledger.mjs'
import { verifyAdmittedSnapshot } from './admitted-snapshot.mjs'

const result = (state, reasons = [], evidence = {}) => ({
  schema: 'frym-benchmark-pipeline-state/1',
  state,
  reasons,
  ...evidence,
  gold_s: false,
  seed_eligible: false,
  db_seed: false,
})

const shortageReasons = snapshot => Object.entries(snapshot.grades).flatMap(([grade, row]) => row.status === 'calibrated' ? [] : row.reasons.map(reason => `${grade}:${reason}`))
const verifiedCandidates = new WeakMap()
export const isVerifiedCandidateStatus = (status, decision) => {
  const proof = status && typeof status === 'object' ? verifiedCandidates.get(status) : null
  return Boolean(proof && proof.status_hash === hash(status) && proof.decision_hash === decision?.decision_hash)
}

export function inspectPipeline({ protocol, candidates, samples, audit, receipt, envelope, decision, currentDecision, f02, e3, decisionEvidenceError }) {
  let admission
  try { admission = verifyAdmission(protocol, candidates, samples, audit, receipt) }
  catch { return result('stale', ['ADMISSION_INPUT_INVALID']) }
  const evidence = { benchmark_version: protocol.version, admission_receipt_hash: admission.receipt_hash }
  if (admission.status !== 'current') return result('stale', admission.reasons, evidence)
  if (admission.state === 'admission-reject') return result('admission-reject', [...new Set(audit.results.flatMap(row => row.reasons))].sort(), evidence)
  if (admission.state === 'admission-hold') return result('admission-hold', [...new Set(audit.results.flatMap(row => row.reasons))].sort(), evidence)
  if (!envelope) return decision ? result('decision-unverified', ['SNAPSHOT_MISSING'], evidence) : result('admission-pass', [], evidence)
  let snapshot
  try { snapshot = verifyAdmittedSnapshot(envelope, protocol, samples, admission.receipt_hash) }
  catch (error) { return result('stale', [error.message], evidence) }
  evidence.benchmark_snapshot_hash = snapshot.snapshot_hash
  if (!decision) {
    const state = workflowState({ protocol, snapshot })
    return result(state, state === 'insufficient_benchmark' ? shortageReasons(snapshot) : [], evidence)
  }
  if (decisionEvidenceError) return result('stale', [decisionEvidenceError], evidence)
  if (!currentDecision || !f02 || !e3) return result('decision-unverified', ['CURRENT_DECISION_EVIDENCE_MISSING'], evidence)
  let expected
  try { expected = judgeBenchmark({ protocol, snapshot, samples, f02, e3 }) }
  catch { return result('stale', ['DECISION_RECOMPUTE_FAILED'], evidence) }
  const expectedBody = Object.fromEntries(Object.entries(expected).filter(([key]) => key !== 'decision_hash'))
  expectedBody.admission_receipt_hash = admission.receipt_hash
  if (decision.decision_hash !== hash(expectedBody) || decision.admission_receipt_hash !== admission.receipt_hash || verifyDecision(decision, currentDecision).status !== 'current') return result('stale', ['DECISION_STALE'], evidence)
  const state = workflowState({ protocol, snapshot, decision, current: currentDecision })
  const reasons = state === 'insufficient_benchmark' ? [...shortageReasons(snapshot), ...Object.entries(decision.target_fit).filter(([, value]) => value.status === 'insufficient_benchmark').map(([grade]) => `TARGET_FIT:${grade}:INSUFFICIENT_BENCHMARK`), ...(decision.level_separation.status === 'insufficient_benchmark' ? [`LEVEL_SEPARATION:${decision.level_separation.reason ?? 'INSUFFICIENT_BENCHMARK'}`] : [])] : []
  const outcome = result(state, reasons, evidence)
  if (state === 'gold_s_candidate') verifiedCandidates.set(outcome, { status_hash: hash(outcome), decision_hash: decision.decision_hash })
  return outcome
}
