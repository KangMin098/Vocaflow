// scripts/textbook/reading-promotion/authorization.mjs
import { hash } from '../frym-benchmark/benchmark.mjs'

// Read-only mirror of the DB's order-specific approval and active-revision gate.
// It is a preflight convenience; the SQL function locks and repeats the checks.
export function assessPromotionAuthorization({ rpc, approval, authority, currentOrder, now } = {}) {
  if (!rpc || !Number.isFinite(Date.parse(now))) return { ok: false, reason: 'PROMOTION_AUTHORIZATION_INPUT_INVALID' }
  if (!approval || approval.consumed_at || !approval.approved_by || !Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) <= Date.parse(now) || hash(approval.request_payload) !== hash(rpc))
    return { ok: false, reason: 'PROMOTION_ORDER_APPROVAL_MISSING_OR_STALE' }
  if (!authority || !Number.isFinite(Date.parse(authority.valid_until)) || Date.parse(authority.valid_until) <= Date.parse(now) ||
      authority.trust_policy_hash !== rpc.trust_policy_hash || authority.benchmark_version !== rpc.benchmark_version ||
      authority.benchmark_snapshot_hash !== rpc.benchmark_snapshot_hash ||
      !Array.isArray(authority.revoked_certificate_hashes) || !Array.isArray(authority.revoked_eligibility_hashes) ||
      authority.revoked_certificate_hashes.includes(rpc.certificate_hash) || authority.revoked_eligibility_hashes.includes(rpc.eligibility_hash))
    return { ok: false, reason: 'PROMOTION_AUTHORITY_STALE_OR_REVOKED' }
  if (!currentOrder || currentOrder.order_id !== rpc.product_order_id || currentOrder.order_revision !== rpc.order_revision || currentOrder.order_hash !== rpc.order_hash)
    return { ok: false, reason: 'PROMOTION_PRODUCT_ORDER_STALE' }
  return { ok: true, reason: null }
}
