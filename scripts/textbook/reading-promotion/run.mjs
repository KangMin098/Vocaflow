// scripts/textbook/reading-promotion/run.mjs
// pnpm exec tsx scripts/textbook/reading-promotion/run.mjs --request <outside-repo.json> --policy <current-policy.json> --requested-by <id>
// Add --commit --audit <outside-repo.jsonl> only after the DB migration is approved/applied.
import { readFileSync, writeFileSync, openSync, appendFileSync, fsyncSync, closeSync } from 'node:fs'
import { hash } from '../frym-benchmark/benchmark.mjs'
import { assertExternalCandidate } from '../frym-benchmark/local-candidate-path.mjs'
import { prepareReadingPromotion } from './preflight.mjs'
import { assessPromotionAuthorization } from './authorization.mjs'
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
if (hash(request.policy) !== hash(currentPolicy())) throw Error('PROMOTION_TRUST_POLICY_CHANGED')
const executionNow = new Date()
const db = await client()
const readOne = async (id, fields) => {
  const { data, error } = await db.from('library_articles').select(fields).eq('id', id).single()
  if (error || !data) throw Error('PROMOTION_LIVE_ROW_UNAVAILABLE')
  return data
}
const child = await readOne(request.article_id, 'id,source_id,source,source_url,title,adapted_from_id,status,content,updated_at,composed_spec,license,license_class,display_only,copyright_safe_in_kr,article_v_level')
const source = await readOne(child.adapted_from_id, 'id,source_id,source,source_url,content,csat_fit,license,license_class,display_only,copyright_safe_in_kr,status,updated_at')
const result = prepareReadingPromotion({ request, child, source, now: executionNow.toISOString(), requestedBy, allowReady: child.status === 'ready' })
if (!result.ok) throw Error(result.reason)

const { data: prior, error: priorError } = await db.from('reading_promotion_audit').select('request_id,article_id,request_hash,request_payload').eq('request_id', request.request_id).maybeSingle()
if (commit && ['42P01', 'PGRST205'].includes(priorError?.code)) throw Error('PROMOTION_DB_GATE_NOT_INSTALLED')
if (priorError && priorError.code !== '42P01' && priorError.code !== 'PGRST205') throw Error('PROMOTION_AUDIT_READ_FAILED')
if (prior) {
  if (child.status !== 'ready' || prior.article_id !== child.id || prior.request_payload?.intent_hash !== hash(request) || prior.request_payload?.evidence_hash !== result.rpc.evidence_hash) throw Error('PROMOTION_REPLAY_CONFLICT')
  if (!commit) {
    process.stdout.write(`${JSON.stringify({ status: 'replay_preflight', request_id: request.request_id, db_write: false })}\n`)
    process.exit(0)
  }
  const { data, error } = await db.rpc('promote_reading_adaptation', { p_request: prior.request_payload })
  if (error || data?.status !== 'ready' || data?.replayed !== true || data?.evidence_current !== true) throw Error('PROMOTION_REPLAY_CURRENT_EVIDENCE_FAILED')
  process.stdout.write(`${JSON.stringify({ status: 'ready', replayed: true, evidence_current: true, request_id: request.request_id })}\n`)
  process.exit(0)
}
if (child.status !== 'queued') throw Error('PROMOTION_QUEUED_CHILD_REQUIRED')
if (!commit) {
  if (packetFile) writeFileSync(packetFile, `${JSON.stringify(result.rpc, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ status: 'preflight_pass', request_id: request.request_id, order_hash: result.rpc.order_hash, evidence_hash: result.rpc.evidence_hash, db_write: false })}\n`)
  process.exit(0)
}

const { data: approval, error: approvalError } = await db.from('reading_promotion_approval').select('request_payload,expires_at,consumed_at,approved_by').eq('request_id', request.request_id).maybeSingle()
if (approvalError) throw Error('PROMOTION_ORDER_APPROVAL_UNAVAILABLE')
const { data: authority, error: authorityError } = await db.from('reading_promotion_authority').select('trust_policy_hash,benchmark_version,benchmark_snapshot_hash,revoked_certificate_hashes,revoked_eligibility_hashes,valid_until').eq('singleton', true).maybeSingle()
if (authorityError) throw Error('PROMOTION_AUTHORITY_UNAVAILABLE')
const { data: currentOrder, error: currentOrderError } = await db.from('reading_product_order_revision').select('order_id,order_revision,order_hash').eq('order_id', result.rpc.product_order_id).maybeSingle()
if (currentOrderError) throw Error('PROMOTION_ORDER_REGISTRY_UNAVAILABLE')
const authorized = assessPromotionAuthorization({ rpc: result.rpc, approval, authority, currentOrder, now: executionNow.toISOString() })
if (!authorized.ok) throw Error(authorized.reason)

// The local append-only record supports reconciliation if the process exits after
// the RPC commits but before the response is received. The DB audit is authoritative.
const fd = openSync(auditFile, 'a', 0o600)
const append = (event, reason = null) => {
  const body = { schema: 'reading-promotion-run/1', request_id: request.request_id, intent_hash: hash(request), event, reason, at: new Date().toISOString() }
  appendFileSync(fd, `${JSON.stringify(body)}\n`)
  fsyncSync(fd)
}
try {
  append('rpc_start')
  if (hash(request.policy) !== hash(currentPolicy())) throw Error('PROMOTION_TRUST_POLICY_CHANGED')
  const { data, error } = await db.rpc('promote_reading_adaptation', { p_request: result.rpc })
  if (error || data?.status !== 'ready' || data?.evidence_current !== true || data?.article_id !== child.id || data?.request_id !== request.request_id) {
    append('rpc_uncertain', error?.code ?? 'RESPONSE_MISMATCH')
    throw Error('PROMOTION_RPC_UNCERTAIN_CHECK_DB_AUDIT_BEFORE_RETRY')
  }
  append('rpc_ready')
  process.stdout.write(`${JSON.stringify({ status: 'ready', replayed: data.replayed, request_id: request.request_id })}\n`)
} finally { closeSync(fd) }
