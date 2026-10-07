// scripts/textbook/frym-benchmark/gold-s-import-gate.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { sourceRightsHash, validateGoldSImport } from './gold-s-import-gate.mjs'

const goldKey = generateKeyPairSync('ed25519'), seedKey = generateKeyPairSync('ed25519')
const seal = (body, key) => ({ ...body, signature: sign(null, Buffer.from(hash(body)), key).toString('base64') })
const source = { id: 'source-1', source_id: 'frym-full:fixture', content: 'Current source text', license: 'CC BY 4.0', license_class: 'cc_by', display_only: false, copyright_safe_in_kr: true, status: 'ready', updated_at: '2026-10-07T00:00:00Z' }
const draft = { adapted_from_id: source.id, text: 'A reviewed student adaptation.', reading: { target: { share_alike: false } } }
const targetKey = 'fixture-target'
const keys = { goldIssuer: goldKey.publicKey, seedIssuer: seedKey.publicKey, goldIssuerId: 'gold-issuer', seedIssuerId: 'seed-issuer' }
const now = '2026-10-07T12:00:00Z'
const trustEntry = (id, key) => ({ id, public_key: key.export({ type: 'spki', format: 'pem' }), valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z' })
const policy = { schema: 'frym-gold-s-operational-policy/1', revision: 'fixture-r1', gold_issuers: [trustEntry(keys.goldIssuerId, goldKey.publicKey)], seed_issuers: [trustEntry(keys.seedIssuerId, seedKey.publicKey)], gold_max_age_days: 30, seed_max_age_days: 7, revoked: { certificate_hashes: [], eligibility_hashes: [], issuer_ids: [] } }
const makeBundle = () => {
  const passage_hash = hash(draft.text)
  const content_hash = hash({ source_id: source.id, target_key: targetKey, passage_hash })
  const rights_hash = sourceRightsHash(source)
  const certificate = seal({ schema: 'frym-gold-s-certificate/1', certificate_id: 'fixture-cert', issued_at: '2026-10-07T00:00:00Z', issuer_id: keys.goldIssuerId, curator_id: 'fixture-curator', owner_id: 'fixture-owner', source_id: source.id, target_key: targetKey, passage_hash, content_hash, rights_hash, benchmark_version: 'fixture-v1', review_evidence_hash: hash('review-evidence'), decision_hash: hash('decision'), distribution_hash: hash('distribution'), admission_receipt_hash: hash('receipt'), benchmark_snapshot_hash: hash('snapshot'), review_hash: hash('review') }, goldKey.privateKey)
  const eligibility = seal({ schema: 'frym-seed-eligibility/1', eligibility_id: 'fixture-eligibility', issued_at: '2026-10-07T00:00:00Z', issuer_id: keys.seedIssuerId, operations_id: 'fixture-operations', approver_id: 'fixture-approver', certificate_hash: hash(certificate), content_hash, rights_hash, seed_evidence_hash: hash('seed'), operations_hash: hash('operations'), approval_hash: hash('approval') }, seedKey.privateKey)
  return { certificate, eligibility }
}

test('signed Gold-S and seed eligibility bind the exact current source, target and passage', () => {
  const bundle = makeBundle()
  const input = { draft, targetKey, source, bundle, policy, now }
  const result = validateGoldSImport(input)
  assert.equal(result.ok, true)
  assert.equal(result.certificate.state, 'gold_s')
  assert.equal(result.certificate.seed_eligible, true)
  assert.equal(result.certificate.production, false)
  assert.equal(validateGoldSImport({ ...input, draft: { ...draft, text: 'Changed passage.' } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, targetKey: 'other' }).ok, false)
  assert.equal(validateGoldSImport({ ...input, source: { ...source, content: 'Changed source' } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, source: { ...source, license_class: 'restricted' } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, certificate: { ...bundle.certificate, decision_hash: hash('tampered') } } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, eligibility: { ...bundle.eligibility, certificate_hash: hash('other') } } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, gold_issuers: [trustEntry(keys.goldIssuerId, seedKey.publicKey)] } }).ok, false)
  assert.equal(validateGoldSImport({ ...input, policy: null }).reason, 'TRUST_POLICY_INVALID')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, revoked: { ...policy.revoked, certificate_hashes: [hash(bundle.certificate)] } } }).reason, 'CERTIFICATION_REVOKED')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, revoked: { ...policy.revoked, eligibility_hashes: [hash(bundle.eligibility)] } } }).reason, 'CERTIFICATION_REVOKED')
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, eligibility: { ...bundle.eligibility, signature: `${bundle.eligibility.signature}\n` } }, policy: { ...policy, revoked: { ...policy.revoked, eligibility_hashes: [hash(bundle.eligibility)] } } }).reason, 'CERTIFICATION_SIGNATURE_NONCANONICAL')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, revoked: { ...policy.revoked, issuer_ids: [keys.seedIssuerId] } } }).reason, 'CERTIFICATION_REVOKED')
  assert.equal(validateGoldSImport({ ...input, now: '2026-11-01T00:00:00Z' }).reason, 'CERTIFICATION_EXPIRED_OR_KEY_INACTIVE')
  assert.equal(validateGoldSImport({ ...input, now: '2026-10-06T23:59:00Z' }).reason, 'CERTIFICATION_EXPIRED_OR_KEY_INACTIVE')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, seed_max_age_days: 0 } }).reason, 'TRUST_POLICY_INVALID')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, gold_max_age_days: 366 } }).reason, 'TRUST_POLICY_INVALID')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, ['private_' + 'key']: 'must never enter policy' } }).reason, 'TRUST_POLICY_INVALID')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, seed_issuers: [trustEntry(keys.seedIssuerId, goldKey.publicKey)] } }).reason, 'TRUST_POLICY_INVALID')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, seed_issuers: [{ ...policy.seed_issuers[0], public_key: seedKey.privateKey.export({ type: 'pkcs8', format: 'pem' }) }] } }).reason, 'TRUST_POLICY_INVALID')
  const rotated = generateKeyPairSync('ed25519')
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, gold_issuers: [...policy.gold_issuers, trustEntry('gold-issuer-next', rotated.publicKey)] } }).ok, true)
  assert.equal(validateGoldSImport({ ...input, policy: { ...policy, gold_issuers: [trustEntry('gold-issuer-next', rotated.publicKey)] } }).reason, 'ISSUER_NOT_TRUSTED')
  const { owner_id, ...withoutOwner } = bundle.certificate
  const incompleteCertificate = seal(Object.fromEntries(Object.entries(withoutOwner).filter(([key]) => key !== 'signature')), goldKey.privateKey)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, certificate: incompleteCertificate } }).reason, 'GOLD_S_CERTIFICATE_INCOMPLETE')
  const { approver_id, ...withoutApprover } = bundle.eligibility
  const incompleteEligibility = seal(Object.fromEntries(Object.entries(withoutApprover).filter(([key]) => key !== 'signature')), seedKey.privateKey)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, eligibility: incompleteEligibility } }).reason, 'SEED_ELIGIBILITY_INCOMPLETE')
})
