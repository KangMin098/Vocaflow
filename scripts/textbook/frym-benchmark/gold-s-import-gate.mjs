// scripts/textbook/frym-benchmark/gold-s-import-gate.mjs
import { verify } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { inspectOperationalPolicy } from './operational-policy.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const present = value => typeof value === 'string' && value.trim().length > 0
const signed = (record, key) => {
  try {
    if (!key || typeof record?.signature !== 'string') return false
    const { signature, ...body } = record
    return verify(null, Buffer.from(hash(body)), key, Buffer.from(signature, 'base64'))
  } catch { return false }
}

export const sourceRightsHash = source => hash({
  id: source?.id, source_id: source?.source_id, source_url: source?.source_url,
  content: source?.content, csat_fit: source?.csat_fit,
  license: source?.license, license_class: source?.license_class,
  display_only: source?.display_only, copyright_safe_in_kr: source?.copyright_safe_in_kr,
  status: source?.status, updated_at: source?.updated_at,
})

// A signed seed authorization is the trust boundary here. Its issuer must have
// checked the benchmark in one process; this gate rechecks live DB source bytes
// and the exact adapted passage/target immediately before the insert.
export function validateGoldSImport({ draft, targetKey, source, bundle, policy, now } = {}) {
  const fail = reason => ({ ok: false, reason })
  if (!source || !draft || !bundle) return fail('GOLD_S_EVIDENCE_OR_TRUST_ANCHOR_MISSING')
  if (!['cc_by', 'cc0', 'public_domain', ...(draft.reading?.target?.share_alike ? ['cc_by_sa'] : [])].includes(source.license_class) || source.display_only !== false || source.copyright_safe_in_kr !== true || ['archived', 'failed'].includes(source.status)) return fail('CURRENT_SOURCE_RIGHTS_BLOCKED')
  const passage = typeof draft.text === 'string' ? draft.text.trim() : ''
  if (!passage) return fail('ADAPTATION_PASSAGE_MISSING')
  const passageHash = hash(passage)
  const contentHash = hash({ source_id: draft.adapted_from_id, target_key: targetKey, passage_hash: passageHash })
  const rightsHash = sourceRightsHash(source)
  const certificate = bundle.certificate, eligibility = bundle.eligibility
  const trust = inspectOperationalPolicy({ policy, certificate, eligibility, now })
  if (!trust.ok) return fail(trust.reason)
  const { keys } = trust
  if (certificate?.schema !== 'frym-gold-s-certificate/1' || certificate.issuer_id !== keys.goldIssuerId || !signed(certificate, keys.goldIssuer)) return fail('GOLD_S_CERTIFICATE_UNVERIFIED')
  if (eligibility?.schema !== 'frym-seed-eligibility/1' || eligibility.issuer_id !== keys.seedIssuerId || !signed(eligibility, keys.seedIssuer)) return fail('SEED_ELIGIBILITY_UNVERIFIED')
  if (certificate.revoked === true || eligibility.revoked === true) return fail('CERTIFICATION_REVOKED')
  if (!['certificate_id', 'issued_at', 'curator_id', 'owner_id', 'benchmark_version', 'source_id', 'target_key'].every(key => present(certificate[key])) || !['review_evidence_hash', 'decision_hash', 'distribution_hash', 'review_hash', 'admission_receipt_hash', 'benchmark_snapshot_hash'].every(key => hex(certificate[key])) || new Set([certificate.curator_id, certificate.owner_id, certificate.issuer_id]).size !== 3) return fail('GOLD_S_CERTIFICATE_INCOMPLETE')
  if (!['eligibility_id', 'issued_at', 'operations_id', 'approver_id'].every(key => present(eligibility[key])) || !['seed_evidence_hash', 'operations_hash', 'approval_hash'].every(key => hex(eligibility[key])) || new Set([eligibility.operations_id, eligibility.approver_id, eligibility.issuer_id]).size !== 3) return fail('SEED_ELIGIBILITY_INCOMPLETE')
  if (certificate.source_id !== draft.adapted_from_id || certificate.target_key !== targetKey || certificate.passage_hash !== passageHash || certificate.content_hash !== contentHash || certificate.rights_hash !== rightsHash || !hex(certificate.decision_hash) || !hex(certificate.distribution_hash) || !hex(certificate.admission_receipt_hash) || !hex(certificate.benchmark_snapshot_hash) || !hex(certificate.review_hash)) return fail('GOLD_S_CERTIFICATE_STALE')
  if (eligibility.certificate_hash !== hash(certificate) || eligibility.content_hash !== contentHash || eligibility.rights_hash !== rightsHash || !hex(eligibility.seed_evidence_hash) || !hex(eligibility.operations_hash) || !hex(eligibility.approval_hash)) return fail('SEED_ELIGIBILITY_STALE')
  return { ok: true, certificate: { version: 1, state: 'gold_s', certificate_hash: hash(certificate), eligibility_hash: hash(eligibility), trust_policy_hash: trust.policy_hash, benchmark_version: certificate.benchmark_version, decision_hash: certificate.decision_hash, distribution_hash: certificate.distribution_hash, admission_receipt_hash: certificate.admission_receipt_hash, benchmark_snapshot_hash: certificate.benchmark_snapshot_hash, source_id: certificate.source_id, target_key: certificate.target_key, passage_hash: certificate.passage_hash, rights_hash: certificate.rights_hash, seed_eligible: true, production: false } }
}
