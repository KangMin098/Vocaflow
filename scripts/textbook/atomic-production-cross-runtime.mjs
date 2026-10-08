// scripts/textbook/atomic-production-cross-runtime.mjs
// Prints read-only SQL using an ephemeral Ed25519 key. No private key leaves memory.
import { generateKeyPairSync, sign } from 'node:crypto'
import { hash } from './frym-benchmark/benchmark.mjs'
import { reviewDigest } from '@vocaflow/library-pipeline'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const publicPem = publicKey.export({ type: 'spki', format: 'pem' })
const body = { schema: 'frym-gold-s-certificate/1', issuer_id: 'cross-runtime-fixture',
  benchmark_version: 'fixture-v1', nested: { '2': 1, '10': 2, label: '한글' } }
const signed = { ...body, signature: sign(null, Buffer.from(hash(body)), privateKey).toString('base64') }
const payload = { passage: 'A short English passage.', details: { '2': 'second', '10': 'tenth' } }
const answerKey = { answer: 2, explanation_ko: '근거 문장.' }
const q = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const t = value => `'${value.replaceAll("'", "''")}'::text`
const expected = { signed_hash: hash(signed), review_digest: reviewDigest(payload, answerKey) }
process.stdout.write(`SELECT public._reading_json_hash(${q(signed)}) = ${t(expected.signed_hash)} AS signed_hash_matches,\n` +
  `  public._reading_json_hash(jsonb_build_object('payload',${q(payload)},'answer_key',${q(answerKey)})) = ${t(expected.review_digest)} AS review_digest_matches,\n` +
  `  public._reading_verify_ed25519(${q(signed)},${t(publicPem)}) AS signature_valid,\n` +
  `  public._reading_verify_ed25519(${q({ ...signed, issuer_id: 'changed' })},${t(publicPem)}) AS tampered_signature_valid;\n`)
