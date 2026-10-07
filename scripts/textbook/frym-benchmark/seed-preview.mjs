// scripts/textbook/frym-benchmark/seed-preview.mjs
import { hash } from './benchmark.mjs'
import { previewPromotion } from './promotion-preview.mjs'
import { inspectGoldSCertificate } from './gold-s-contract.mjs'
import { randomUUID, sign, verify } from 'node:crypto'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const signed = (value, signature, key) => {
  try { return Boolean(key && typeof signature === 'string' && verify(null, Buffer.from(hash(value)), key, Buffer.from(signature, 'base64'))) }
  catch { return false }
}
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
  if (!body || operations.operations_hash !== hash(body) || operations.certificate_hash !== hash(certificate) || operations.review_evidence_hash !== promotion.review_evidence_hash || operations.decision_hash !== decision.decision_hash || operations.source_id !== current.source_id || operations.target_key !== current.target_key || operations.passage_hash !== current.passage_hash || operations.content_hash !== current.content_hash || operations.rights_hash !== current.rights_hash || operations.rights_status !== 'permitted' || operations.review_status !== 'approved' || !hex(operations.provenance_hash) || !hex(operations.item_set_hash) || typeof operations.revision !== 'string' || !operations.revision.trim()) return result('blocked', ['OPERATIONAL_EVIDENCE_MISSING_OR_STALE'])
  return result('ready_for_seed_review', ['INDEPENDENT_SEED_AUTHORIZATION_REQUIRED', 'DB_WRITE_NOT_AUTHORIZED'], hash({ certificate_hash: hash(certificate), operations_hash: operations.operations_hash }))
}

// Eligibility is a separately signed decision. It grants no DB write.
export function issueSeedEligibility({ packet, operationsSignature, approval, approvalSignature, keys, issuerPrivateKey, issuedAt } = {}) {
  const preview = previewSeedEligibility(packet)
  if (preview.status !== 'ready_for_seed_review') throw Error('SEED_PREVIEW_BLOCKED')
  const operations = packet.operations
  if (operations.reviewer_id !== keys?.operations_id || !signed(operations, operationsSignature, keys?.operationsPublicKey)) throw Error('SEED_OPERATIONS_SIGNATURE_REQUIRED')
  if (approval?.decision !== 'approve' || approval?.seed_evidence_hash !== preview.seed_evidence_hash || approval?.approver_id !== keys?.approver_id || typeof approval?.rationale !== 'string' || !approval.rationale.trim() || !signed(approval, approvalSignature, keys?.approverPublicKey)) throw Error('SEED_APPROVAL_SIGNATURE_REQUIRED')
  if (!keys?.issuer_id || !issuerPrivateKey || !issuedAt) throw Error('SEED_ISSUER_MISSING')
  const body = { schema: 'frym-seed-eligibility/1', eligibility_id: randomUUID(), issued_at: issuedAt, issuer_id: keys.issuer_id, operations_id: keys.operations_id, approver_id: keys.approver_id, seed_evidence_hash: preview.seed_evidence_hash, certificate_hash: hash(packet.certificate), operations_hash: operations.operations_hash, approval_hash: hash(approval), content_hash: packet.current.content_hash, rights_hash: packet.current.rights_hash }
  return { ...body, signature: sign(null, Buffer.from(hash(body)), issuerPrivateKey).toString('base64') }
}

export function inspectSeedEligibility({ eligibility, packet, authority } = {}) {
  const output = (status, reasons) => ({ schema: 'frym-seed-eligibility-check/1', status, reasons, seed_eligible: status === 'current', db_seed: false })
  if (!eligibility || eligibility.schema !== 'frym-seed-eligibility/1') return output('unverified', ['SEED_ELIGIBILITY_MISSING'])
  const preview = previewSeedEligibility(packet)
  if (preview.status !== 'ready_for_seed_review' || eligibility.seed_evidence_hash !== preview.seed_evidence_hash || eligibility.certificate_hash !== hash(packet?.certificate) || eligibility.operations_hash !== packet?.operations?.operations_hash || eligibility.content_hash !== packet?.current?.content_hash || eligibility.rights_hash !== packet?.current?.rights_hash) return output('stale', ['SEED_EVIDENCE_CHANGED'])
  const { signature, ...body } = eligibility
  if (eligibility.issuer_id !== authority?.issuer_id || !signed(body, signature, authority?.issuerPublicKey)) return output('unverified', ['SEED_ISSUER_SIGNATURE_REQUIRED'])
  return output('current', [])
}
