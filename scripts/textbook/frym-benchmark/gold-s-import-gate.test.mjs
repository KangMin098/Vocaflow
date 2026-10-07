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
  const input = { draft, targetKey, source, bundle, keys }
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
  assert.equal(validateGoldSImport({ ...input, keys: { ...keys, goldIssuer: seedKey.publicKey } }).ok, false)
  const { owner_id, ...withoutOwner } = bundle.certificate
  const incompleteCertificate = seal(Object.fromEntries(Object.entries(withoutOwner).filter(([key]) => key !== 'signature')), goldKey.privateKey)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, certificate: incompleteCertificate } }).reason, 'GOLD_S_CERTIFICATE_INCOMPLETE')
  const { approver_id, ...withoutApprover } = bundle.eligibility
  const incompleteEligibility = seal(Object.fromEntries(Object.entries(withoutApprover).filter(([key]) => key !== 'signature')), seedKey.privateKey)
  assert.equal(validateGoldSImport({ ...input, bundle: { ...bundle, eligibility: incompleteEligibility } }).reason, 'SEED_ELIGIBILITY_INCOMPLETE')
})
