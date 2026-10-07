// scripts/textbook/reading-promotion/preflight.mjs
import { randomUUID, createHash } from 'node:crypto'
import { bindFactoryEvidence, assessFactoryEvidence, sealProductOrder } from '@vocaflow/library-pipeline/factory-order'
import { hash, canonical } from '../frym-benchmark/benchmark.mjs'
import { sourceRightsHash, validateGoldSImport } from '../frym-benchmark/gold-s-import-gate.mjs'
import { targetKey } from '../academic-reading-contract.mjs'
import { validateStoredAgentReview } from '../academic-reading-review.mjs'

const rawHash = value => createHash('sha256').update(value, 'utf8').digest('hex')
const fail = reason => ({ ok: false, reason })
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const required = value => typeof value === 'string' && value.trim().length > 0

// The caller must obtain child and source immediately before this check. The DB RPC
// locks and checks both rows again so a concurrent edit cannot pass on stale bytes.
export function prepareReadingPromotion({ request, child, source, now, requestedBy, allowReady = false } = {}) {
  if (!request || !child || !source || !required(now) || !Number.isFinite(Date.parse(now)) || !required(requestedBy)) return fail('PROMOTION_INPUT_MISSING')
  let sealed
  try { sealed = sealProductOrder(request.order) }
  catch { return fail('PRODUCT_ORDER_INVALID') }
  const { order, order_hash: orderHash } = sealed
  if (!required(request.request_id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(request.request_id)) return fail('PROMOTION_REQUEST_ID_INVALID')
  if (request.article_id !== child.id || (child.status !== 'queued' && !(allowReady && child.status === 'ready')) || !child.source_id?.startsWith('reading:') || child.adapted_from_id !== source.id) return fail('QUEUED_READING_CHILD_REQUIRED')
  if (!required(child.content) || !required(source.content) || !required(child.updated_at) || !required(source.updated_at)) return fail('LIVE_ROW_INCOMPLETE')
  if (child.source !== source.source || child.license !== source.license || child.license_class !== source.license_class || child.display_only !== false || child.copyright_safe_in_kr !== true) return fail('CHILD_RIGHTS_BLOCKED')
  if (request.order_hash !== orderHash) return fail('PRODUCT_ORDER_STALE')
  const key = targetKey(order.target)
  if (request.target_key !== key || request.bundle?.certificate?.target_key !== key) return fail('TARGET_MISMATCH')
  const draft = { adapted_from_id: source.id, text: child.content, reading: { target: order.target } }
  const gold = validateGoldSImport({ draft, targetKey: key, source, bundle: request.bundle, policy: request.policy, now })
  if (!gold.ok) return fail(gold.reason)
  if (!same(child.composed_spec?.academic_reading?.provenance?.gold_s, gold.certificate)) return fail('SEEDED_GOLD_S_EVIDENCE_CHANGED')
  if (!validateStoredAgentReview(child, source)) return fail('CONTENT_REVIEW_STALE')
  if (request.bundle.certificate.benchmark_version !== request.evidence?.benchmark_version || request.bundle.certificate.benchmark_snapshot_hash !== request.evidence?.benchmark_snapshot_hash) return fail('BENCHMARK_EVIDENCE_MIXED')
  if (request.bundle.certificate.source_id !== source.id || request.bundle.certificate.rights_hash !== sourceRightsHash(source)) return fail('SOURCE_RIGHTS_STALE')
  if (!['ADAPT_REQUIRED', 'ADAPT_OPTIONAL'].includes(request.evidence?.source_route)) return fail('ADAPTATION_ROUTE_REQUIRED')
  let bound
  try {
    bound = bindFactoryEvidence(order, {
      source_id: source.id,
      source_route: request.evidence?.source_route,
      source_hash: hash(source.content),
      rights_hash: sourceRightsHash(source),
      trust_policy_hash: hash(request.policy),
      evidence_policy_hash: order.evidence_policy_hash,
      adaptation_hash: hash(child.content.trim()),
      benchmark_version: request.bundle.certificate.benchmark_version,
      benchmark_snapshot_hash: request.bundle.certificate.benchmark_snapshot_hash,
      certificate_hash: hash(request.bundle.certificate),
    })
  } catch { return fail('FACTORY_EVIDENCE_INVALID') }
  let assessment
  try { assessment = assessFactoryEvidence(request.evidence, bound.evidence) }
  catch { return fail('FACTORY_EVIDENCE_INVALID') }
  if (assessment.state !== 'current') return fail(`FACTORY_EVIDENCE_${assessment.state.toUpperCase()}`)
  if (request.evidence_hash !== bound.evidence_hash) return fail('FACTORY_EVIDENCE_HASH_STALE')
  const body = {
    request_id: request.request_id,
    article_id: child.id,
    child_source_id: child.source_id,
    source_id: source.id,
    source_content_sha256: rawHash(source.content),
    child_content_sha256: rawHash(child.content),
    source_updated_at: source.updated_at,
    article_updated_at: child.updated_at,
    product_order_id: order.product_order_id,
    order_revision: order.order_revision,
    order_hash: orderHash,
    evidence_hash: bound.evidence_hash,
    certificate_hash: hash(request.bundle.certificate),
    eligibility_hash: hash(request.bundle.eligibility),
    trust_policy_hash: hash(request.policy),
    benchmark_version: request.bundle.certificate.benchmark_version,
    benchmark_snapshot_hash: request.bundle.certificate.benchmark_snapshot_hash,
    target_key: key,
    rights_hash: sourceRightsHash(source),
    requested_by: requestedBy,
    intent_hash: hash(request),
  }
  return { ok: true, rpc: { ...body, request_hash: hash(body) }, audit_scope: 'local-signatures-and-live-db-recheck' }
}

export const newPromotionRequestId = () => randomUUID()
