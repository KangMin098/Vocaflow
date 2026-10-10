// scripts/textbook/frym-benchmark/promotion-preview.mjs
import { hash } from './benchmark.mjs'
import { isVerifiedCandidateStatus } from './pipeline-state.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

export function previewPromotion(status, decision) {
  const blockers = []
  if (!isVerifiedCandidateStatus(status, decision) || status.schema !== 'frym-benchmark-pipeline-state/1' || status.state !== 'gold_s_candidate' || typeof status.benchmark_version !== 'string' || !status.benchmark_version.trim() || !hex(status.admission_receipt_hash) || !hex(status.benchmark_snapshot_hash)) blockers.push('BENCHMARK_CANDIDATE_NOT_CURRENT')
  const decisionBody = decision && typeof decision === 'object' && !Array.isArray(decision) ? Object.fromEntries(Object.entries(decision).filter(([key]) => key !== 'decision_hash')) : null
  if (!decisionBody || decision.gold_s_candidate !== true || decision.gold_s !== false || decision.db_seed !== false || decision.benchmark_version !== status?.benchmark_version || decision.benchmark_snapshot_hash !== status?.benchmark_snapshot_hash || decision.admission_receipt_hash !== status?.admission_receipt_hash || decision.decision_hash !== hash(decisionBody)) blockers.push('DECISION_BINDING_INVALID')
  const ready = blockers.length === 0
  return {
    schema: 'frym-benchmark-promotion-preview/1',
    gold_s_review: ready ? 'ready_for_owner_review' : 'blocked',
    review_evidence_hash: ready ? hash({ benchmark_version: status.benchmark_version, admission_receipt_hash: status.admission_receipt_hash, benchmark_snapshot_hash: status.benchmark_snapshot_hash, decision_hash: decision.decision_hash }) : null,
    gold_s: false,
    seed_eligibility: 'blocked',
    seed_eligible: false,
    db_seed: false,
    blockers: [...blockers, 'GOLD_S_CERTIFICATION_NOT_ISSUED', 'SEED_RIGHTS_PROVENANCE_RECHECK_PENDING', 'CURRENT_CONTENT_HASH_RECHECK_PENDING', 'OPERATIONAL_REVIEW_STATUS_PENDING', 'DB_WRITE_AUTHORIZATION_PENDING'],
  }
}
