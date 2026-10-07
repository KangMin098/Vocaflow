// scripts/textbook/frym-benchmark/gold-s-contract.mjs
import { hash } from './benchmark.mjs'
import { previewPromotion } from './promotion-preview.mjs'
import { createPublicKey, randomUUID, sign, verify } from 'node:crypto'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const nonempty = value => typeof value === 'string' && Boolean(value.trim())
const signed = (value, signature, publicKey) => {
  try { return Boolean(publicKey && nonempty(signature) && verify(null, Buffer.from(hash(value)), publicKey, Buffer.from(signature, 'base64'))) }
  catch { return false }
}
const distinctKeys = (...keys) => {
  try {
    const encoded = keys.map(key => (key?.type === 'public' ? key : createPublicKey(key)).export({ type: 'spki', format: 'der' }).toString('base64'))
    return new Set(encoded).size === encoded.length
  } catch { return false }
}
const failure = (status, reasons, evidenceHash = null) => ({
  schema: 'frym-gold-s-certification-contract/1',
  status,
  reasons,
  review_evidence_hash: evidenceHash,
  gold_s: false,
  seed_eligibility: 'blocked',
  seed_eligible: false,
  db_seed: false,
})

// A structural preflight only. Authenticating an owner's identity and issuing a
// certificate belong to a separate authority; this function never grants Gold-S.
export function assessGoldSContract({ status, decision, corpus, review } = {}) {
  const preview = previewPromotion(status, decision)
  if (status?.state === 'stale' || status?.state === 'decision-unverified') return failure('stale', ['CURRENT_PIPELINE_EVIDENCE_STALE'])
  if (status?.state === 'admission-reject' || status?.state === 'fail' || review?.decision === 'reject') return failure('reject', ['BENCHMARK_OR_OWNER_REJECTED'])
  if (preview.gold_s_review !== 'ready_for_owner_review') return failure('hold', ['CURRENT_CANDIDATE_REQUIRED'])
  const evidenceHash = preview.review_evidence_hash
  const reasons = []
  if (corpus?.kind !== 'real_commercial_textbooks' || corpus?.fixture === true || !Number.isSafeInteger(corpus?.admitted_n) || corpus.admitted_n <= 0 || !hex(corpus?.distribution_hash) || corpus?.benchmark_version !== status.benchmark_version || corpus?.snapshot_hash !== status.benchmark_snapshot_hash || corpus?.admission_receipt_hash !== status.admission_receipt_hash) reasons.push('REAL_BENCHMARK_DISTRIBUTION_REQUIRED')
  if (!review) reasons.push('OWNER_REVIEW_MISSING')
  else {
    if (review.review_evidence_hash !== evidenceHash || review.benchmark_version !== status.benchmark_version || review.decision_hash !== decision.decision_hash || review.distribution_hash !== corpus?.distribution_hash) return failure('stale', ['OWNER_REVIEW_EVIDENCE_STALE'], evidenceHash)
    if (review.decision !== 'approve' || !nonempty(review.owner_id) || !nonempty(review.decided_at) || !nonempty(review.rationale) || !nonempty(review.revision) || review.review_hash !== hash(Object.fromEntries(Object.entries(review).filter(([key]) => key !== 'review_hash')))) reasons.push('OWNER_REVIEW_INCOMPLETE')
  }
  if (reasons.length) return failure('hold', reasons, evidenceHash)
  return failure('reviewable', ['OWNER_IDENTITY_AUTHENTICATION_REQUIRED', 'GOLD_S_CERTIFICATE_NOT_ISSUED'], evidenceHash)
}

// Key material is injected at runtime, never persisted in a repo artifact.
// A caller must pin the independent curator, owner and issuer public keys.
export function issueGoldSCertificate({ status, decision, corpus, review, corpusSignature, ownerSignature, current, keys, issuerPrivateKey, issuedAt } = {}) {
  const preflight = assessGoldSContract({ status, decision, corpus, review })
  if (preflight.status !== 'reviewable') throw Error(`GOLD_S_PREFLIGHT_${preflight.status.toUpperCase()}`)
  if (!nonempty(corpus?.curator_id) || corpus.curator_id !== keys?.curator_id || review.owner_id !== keys?.owner_id || new Set([keys?.curator_id, keys?.owner_id, keys?.issuer_id]).size !== 3 || !distinctKeys(keys?.curator, keys?.owner, issuerPrivateKey) || !signed(corpus, corpusSignature, keys?.curator) || !signed(review, ownerSignature, keys?.owner)) throw Error('GOLD_S_INDEPENDENT_ATTESTATION_REQUIRED')
  if (current?.rights_status !== 'permitted' || !hex(current?.rights_hash) || !hex(current?.content_hash) || !nonempty(current?.source_id) || !nonempty(current?.target_key) || !hex(current?.passage_hash) || !nonempty(issuedAt) || !issuerPrivateKey) throw Error('GOLD_S_CURRENT_RIGHTS_OR_ISSUER_MISSING')
  const body = { schema: 'frym-gold-s-certificate/1', certificate_id: randomUUID(), issuer_id: keys.issuer_id, curator_id: keys.curator_id, owner_id: keys.owner_id, issued_at: issuedAt, review_evidence_hash: preflight.review_evidence_hash, decision_hash: decision.decision_hash, distribution_hash: corpus.distribution_hash, review_hash: review.review_hash, benchmark_version: status.benchmark_version, admission_receipt_hash: status.admission_receipt_hash, benchmark_snapshot_hash: status.benchmark_snapshot_hash, source_id: current.source_id, target_key: current.target_key, passage_hash: current.passage_hash, content_hash: current.content_hash, rights_hash: current.rights_hash }
  return { ...body, signature: sign(null, Buffer.from(hash(body)), issuerPrivateKey).toString('base64') }
}

// A certificate is never trusted by its own local hash or a caller-supplied
// "verified" flag. The issuer signature must verify with a pinned public key.
export function inspectGoldSCertificate({ certificate, current, authority } = {}) {
  const output = (status, reasons) => ({ schema: 'frym-gold-s-certificate-check/1', status, reasons, gold_s: status === 'current', seed_eligible: false, db_seed: false })
  if (!certificate || certificate.schema !== 'frym-gold-s-certificate/1' || !nonempty(certificate.certificate_id)) return output('unverified', ['CERTIFICATE_MISSING'])
  if (certificate.revoked === true || current?.rights_status !== 'permitted') return output('invalidated', ['CERTIFICATE_REVOKED_OR_RIGHTS_LOST'])
  const bound = ['review_evidence_hash', 'decision_hash', 'distribution_hash', 'review_hash', 'benchmark_version', 'admission_receipt_hash', 'benchmark_snapshot_hash', 'source_id', 'target_key', 'passage_hash', 'content_hash', 'rights_hash']
  if (bound.some(key => !nonempty(certificate[key]) || certificate[key] !== current?.[key])) return output('stale', ['CERTIFICATE_EVIDENCE_CHANGED'])
  const { signature, ...body } = certificate
  if (certificate.issuer_id !== authority?.issuer_id || !signed(body, signature, authority?.issuerPublicKey)) return output('unverified', ['AUTHORITY_SIGNATURE_REQUIRED'])
  return output('current', [])
}
