// scripts/textbook/frym-benchmark/seed-preview.mjs
import { hash } from './benchmark.mjs'
import { previewPromotion } from './promotion-preview.mjs'
import { inspectGoldSCertificate } from './gold-s-contract.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const result = (status, reasons, evidenceHash = null) => ({
  schema: 'frym-benchmark-seed-preview/1',
  status,
  reasons,
  seed_evidence_hash: evidenceHash,
  seed_eligible: false,
  db_seed: false,
})

// This is a read-only operational packet check. An independently authorized
// seed gate must replay the source/rights checks before changing eligibility.
export function previewSeedEligibility({ status, decision, certificate, current, authority, operations } = {}) {
  const promotion = previewPromotion(status, decision)
  if (promotion.gold_s_review !== 'ready_for_owner_review') return result('blocked', ['CURRENT_BENCHMARK_CANDIDATE_REQUIRED'])
  const gold = inspectGoldSCertificate({ certificate, current, authority })
  if (gold.status !== 'current') return result('blocked', [`GOLD_S_${gold.status.toUpperCase()}`, ...gold.reasons])
  const body = operations && typeof operations === 'object' && !Array.isArray(operations) ? Object.fromEntries(Object.entries(operations).filter(([key]) => key !== 'operations_hash')) : null
  if (!body || operations.operations_hash !== hash(body) || operations.certificate_hash !== hash(certificate) || operations.review_evidence_hash !== promotion.review_evidence_hash || operations.decision_hash !== decision.decision_hash || operations.content_hash !== current.content_hash || operations.rights_hash !== current.rights_hash || operations.rights_status !== 'permitted' || operations.review_status !== 'approved' || !hex(operations.provenance_hash) || !hex(operations.item_set_hash) || typeof operations.revision !== 'string' || !operations.revision.trim()) return result('blocked', ['OPERATIONAL_EVIDENCE_MISSING_OR_STALE'])
  return result('ready_for_seed_review', ['INDEPENDENT_SEED_AUTHORIZATION_REQUIRED', 'DB_WRITE_NOT_AUTHORIZED'], hash({ certificate_hash: hash(certificate), operations_hash: operations.operations_hash }))
}
