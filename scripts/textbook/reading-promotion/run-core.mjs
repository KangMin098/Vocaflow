// scripts/textbook/reading-promotion/run-core.mjs
// Shared execution path for the CLI and the synthetic master run. The DB RPC remains authoritative.
import { hash } from '../frym-benchmark/benchmark.mjs'
import { prepareReadingPromotion } from './preflight.mjs'
import { assessPromotionAuthorization } from './authorization.mjs'

const childFields = 'id,source_id,source,source_url,title,adapted_from_id,status,content,updated_at,composed_spec,license,license_class,display_only,copyright_safe_in_kr,article_v_level'
const sourceFields = 'id,source_id,source,source_url,content,csat_fit,license,license_class,display_only,copyright_safe_in_kr,status,updated_at'

async function readOne(db, table, fields, column, value) {
  const { data, error } = await db.from(table).select(fields).eq(column, value).single()
  if (error || !data) throw Error(table === 'library_articles'
    ? 'PROMOTION_LIVE_ROW_UNAVAILABLE' : `PROMOTION_${table.toUpperCase()}_UNAVAILABLE`)
  return data
}

async function readMaybe(db, table, fields, column, value, errorCode, allowMissingTable = false) {
  const { data, error } = await db.from(table).select(fields).eq(column, value).maybeSingle()
  if (allowMissingTable && ['42P01', 'PGRST205'].includes(error?.code)) return null
  if (table === 'reading_promotion_audit' && ['42P01', 'PGRST205'].includes(error?.code))
    throw Error('PROMOTION_DB_GATE_NOT_INSTALLED')
  if (error) throw Error(errorCode)
  return data
}

/** Every commit caller uses this exact preflight → authorization → RPC response contract. */
export async function executeReadingPromotion({ db, request, currentPolicy, now, requestedBy,
  commit = false, onEvent = () => {} }) {
  if (hash(request.policy) !== hash(currentPolicy())) throw Error('PROMOTION_TRUST_POLICY_CHANGED')
  const child = await readOne(db, 'library_articles', childFields, 'id', request.article_id)
  const source = await readOne(db, 'library_articles', sourceFields, 'id', child.adapted_from_id)
  const result = prepareReadingPromotion({ request, child, source, now, requestedBy,
    allowReady: child.status === 'ready' })
  if (!result.ok) throw Error(result.reason)
  const prior = await readMaybe(db, 'reading_promotion_audit',
    'request_id,article_id,request_hash,request_payload', 'request_id', request.request_id,
    'PROMOTION_AUDIT_READ_FAILED', !commit)
  if (prior) {
    if (child.status !== 'ready' || prior.article_id !== child.id ||
      prior.request_payload?.intent_hash !== hash(request) ||
      prior.request_payload?.evidence_hash !== result.rpc.evidence_hash)
      throw Error('PROMOTION_REPLAY_CONFLICT')
    if (!commit) return { status: 'replay_preflight', request_id: request.request_id, db_write: false }
    const { data, error } = await db.rpc('promote_reading_adaptation', { p_request: prior.request_payload })
    if (error || data?.status !== 'ready' || data?.replayed !== true || data?.evidence_current !== true)
      throw Error('PROMOTION_REPLAY_CURRENT_EVIDENCE_FAILED')
    return { status: 'ready', replayed: true, evidence_current: true, request_id: request.request_id }
  }
  if (child.status !== 'queued') throw Error('PROMOTION_QUEUED_CHILD_REQUIRED')
  if (!commit) return { status: 'preflight_pass', request_id: request.request_id,
    order_hash: result.rpc.order_hash, evidence_hash: result.rpc.evidence_hash,
    db_write: false, packet: result.rpc }

  const approval = await readMaybe(db, 'reading_promotion_approval',
    'request_payload,expires_at,consumed_at,approved_by', 'request_id', request.request_id,
    'PROMOTION_ORDER_APPROVAL_UNAVAILABLE')
  const authority = await readMaybe(db, 'reading_promotion_authority',
    'trust_policy_hash,benchmark_version,benchmark_snapshot_hash,revoked_certificate_hashes,revoked_eligibility_hashes,valid_until',
    'singleton', true, 'PROMOTION_AUTHORITY_UNAVAILABLE')
  const currentOrder = await readMaybe(db, 'reading_product_order_revision',
    'order_id,order_revision,order_hash', 'order_id', result.rpc.product_order_id,
    'PROMOTION_ORDER_REGISTRY_UNAVAILABLE')
  const authorized = assessPromotionAuthorization({ rpc: result.rpc, approval, authority, currentOrder, now })
  if (!authorized.ok) throw Error(authorized.reason)
  onEvent('rpc_start')
  if (hash(request.policy) !== hash(currentPolicy())) throw Error('PROMOTION_TRUST_POLICY_CHANGED')
  const { data, error } = await db.rpc('promote_reading_adaptation', { p_request: result.rpc })
  if (error || data?.status !== 'ready' || data?.evidence_current !== true ||
    data?.article_id !== child.id || data?.request_id !== request.request_id) {
    onEvent('rpc_uncertain', error?.code ?? 'RESPONSE_MISMATCH')
    throw Error('PROMOTION_RPC_UNCERTAIN_CHECK_DB_AUDIT_BEFORE_RETRY')
  }
  onEvent('rpc_ready')
  return { status: 'ready', replayed: data.replayed, request_id: request.request_id,
    article_id: child.id, order_hash: result.rpc.order_hash, evidence_hash: result.rpc.evidence_hash }
}
