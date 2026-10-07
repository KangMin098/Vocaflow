// scripts/textbook/frym-benchmark/operational-policy.mjs
import { createPublicKey } from 'node:crypto'
import { hash } from './benchmark.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const present = value => typeof value === 'string' && value.trim().length > 0
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
const unique = values => new Set(values).size === values.length
const exactKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key))
const publicKey = value => {
  try {
    if (!/^-----BEGIN PUBLIC KEY-----\r?\n/.test(value)) return null
    const key = createPublicKey(value)
    if (key.asymmetricKeyType !== 'ed25519') return null
    return key.export({ type: 'spki', format: 'der' }).toString('base64')
  }
  catch { return null }
}

export function inspectOperationalPolicy({ policy, certificate, eligibility, now } = {}) {
  const fail = reason => ({ ok: false, reason })
  if (!certificate || typeof certificate !== 'object' || Array.isArray(certificate) || !eligibility || typeof eligibility !== 'object' || Array.isArray(eligibility)) return fail('CERTIFICATION_EVIDENCE_MISSING')
  if (policy?.schema !== 'frym-gold-s-operational-policy/1' || !exactKeys(policy, ['schema', 'revision', 'gold_issuers', 'seed_issuers', 'gold_max_age_days', 'seed_max_age_days', 'revoked']) || !present(policy.revision) || !instant(now) || !Array.isArray(policy.gold_issuers) || !Array.isArray(policy.seed_issuers) || !exactKeys(policy.revoked, ['certificate_hashes', 'eligibility_hashes', 'issuer_ids']) || !Array.isArray(policy.revoked.certificate_hashes) || !Array.isArray(policy.revoked.eligibility_hashes) || !Array.isArray(policy.revoked.issuer_ids) || !Number.isSafeInteger(policy.gold_max_age_days) || policy.gold_max_age_days < 1 || policy.gold_max_age_days > 365 || !Number.isSafeInteger(policy.seed_max_age_days) || policy.seed_max_age_days < 1 || policy.seed_max_age_days > 30) return fail('TRUST_POLICY_INVALID')
  const entries = [...policy.gold_issuers, ...policy.seed_issuers]
  if (!entries.length || entries.some(entry => !exactKeys(entry, ['id', 'public_key', 'valid_from', 'valid_until']) || !present(entry.id) || !present(entry.public_key) || !publicKey(entry.public_key) || !instant(entry.valid_from) || !instant(entry.valid_until) || Date.parse(entry.valid_from) >= Date.parse(entry.valid_until)) || !unique(entries.map(entry => entry.id)) || !unique(entries.map(entry => publicKey(entry.public_key))) || !unique(policy.revoked.certificate_hashes) || !unique(policy.revoked.eligibility_hashes) || !unique(policy.revoked.issuer_ids) || [...policy.revoked.certificate_hashes, ...policy.revoked.eligibility_hashes].some(value => !hex(value)) || policy.revoked.issuer_ids.some(value => !present(value))) return fail('TRUST_POLICY_INVALID')
  const gold = policy.gold_issuers.find(entry => entry.id === certificate?.issuer_id)
  const seed = policy.seed_issuers.find(entry => entry.id === eligibility?.issuer_id)
  if (!gold || !seed || gold.id === seed.id) return fail('ISSUER_NOT_TRUSTED')
  if (policy.revoked.certificate_hashes.includes(hash(certificate)) || policy.revoked.eligibility_hashes.includes(hash(eligibility)) || policy.revoked.issuer_ids.includes(gold.id) || policy.revoked.issuer_ids.includes(seed.id)) return fail('CERTIFICATION_REVOKED')
  const at = Date.parse(now)
  for (const [entry, record, maxAge] of [[gold, certificate, policy.gold_max_age_days], [seed, eligibility, policy.seed_max_age_days]]) {
    if (!instant(record?.issued_at)) return fail('CERTIFICATION_TIME_INVALID')
    const issued = Date.parse(record.issued_at)
    if (issued > at || issued < Date.parse(entry.valid_from) || issued >= Date.parse(entry.valid_until) || at >= Date.parse(entry.valid_until) || at - issued >= maxAge * 86_400_000) return fail('CERTIFICATION_EXPIRED_OR_KEY_INACTIVE')
  }
  return { ok: true, policy_hash: hash(policy), keys: { goldIssuer: gold.public_key, seedIssuer: seed.public_key, goldIssuerId: gold.id, seedIssuerId: seed.id } }
}
