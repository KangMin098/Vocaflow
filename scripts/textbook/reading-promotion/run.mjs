// scripts/textbook/reading-promotion/run.mjs
// pnpm exec tsx scripts/textbook/reading-promotion/run.mjs --request <outside-repo.json> --policy <current-policy.json> --requested-by <id>
// Add --commit --audit <outside-repo.jsonl> only after the DB migration is approved/applied.
import { readFileSync, writeFileSync, openSync, appendFileSync, fsyncSync, closeSync } from 'node:fs'
import { hash } from '../frym-benchmark/benchmark.mjs'
import { assertExternalCandidate } from '../frym-benchmark/local-candidate-path.mjs'
import { executeReadingPromotion } from './run-core.mjs'
import { client } from '../lib/db.mjs'

const arg = name => {
  const at = process.argv.indexOf(`--${name}`)
  return at < 0 ? null : process.argv[at + 1]
}
const requestFile = arg('request'), policyFile = arg('policy'), requestedBy = arg('requested-by'), auditFile = arg('audit'), packetFile = arg('packet')
const commit = process.argv.includes('--commit')
if (!requestFile || !policyFile || !requestedBy || (commit && !auditFile) || (auditFile && !commit) || (packetFile && commit)) throw Error('PROMOTION_USAGE_INVALID')
assertExternalCandidate(requestFile)
assertExternalCandidate(policyFile)
if (auditFile) assertExternalCandidate(auditFile)
if (packetFile) assertExternalCandidate(packetFile)

const request = JSON.parse(readFileSync(requestFile, 'utf8'))
const currentPolicy = () => JSON.parse(readFileSync(policyFile, 'utf8'))
const db = await client()
let auditFd = null
const onEvent = (event, reason = null) => {
  if (auditFd === null) auditFd = openSync(auditFile, 'a', 0o600)
  const body = { schema: 'reading-promotion-run/1', request_id: request.request_id,
    intent_hash: hash(request), event, reason, at: new Date().toISOString() }
  appendFileSync(auditFd, `${JSON.stringify(body)}\n`)
  fsyncSync(auditFd)
}
try {
  const result = await executeReadingPromotion({ db, request, currentPolicy,
    now: new Date().toISOString(), requestedBy, commit, onEvent })
  if (packetFile && result.packet) writeFileSync(packetFile,
    `${JSON.stringify(result.packet, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  const { packet: _packet, ...publicResult } = result
  process.stdout.write(`${JSON.stringify(publicResult)}\n`)
} finally {
  if (auditFd !== null) closeSync(auditFd)
}
