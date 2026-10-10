// scripts/textbook/factory-lineage.mjs
import { createHash } from 'node:crypto'
import { sourceRightsHash } from './frym-benchmark/gold-s-import-gate.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'
import { prepareReadingPromotion } from './reading-promotion/preflight.mjs'
import { reviewDigest } from '@vocaflow/library-pipeline'

const sha = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex')
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

export function currentReadingLineage({ article, parent, audit, order, authority, now }) {
  if (!article?.source_id?.startsWith('reading:')) throw Error('READING_CHILD_REQUIRED')
  if (!['ready', 'published'].includes(article.status) || article.display_only || article.copyright_safe_in_kr !== true) throw Error('READING_NOT_READY')
  if (!parent || article.adapted_from_id !== parent.id || audit?.article_id !== article.id || audit.source_id !== parent.id) throw Error('PROMOTION_AUDIT_MISSING')
  if (!order || order.order_id !== audit.order_id || order.order_revision !== audit.order_revision || order.order_hash !== audit.order_hash) throw Error('PRODUCT_ORDER_STALE')
  if (!authority || !Number.isFinite(Date.parse(now)) || Date.parse(authority.valid_until) <= Date.parse(now) || authority.trust_policy_hash !== audit.trust_policy_hash || authority.benchmark_version !== audit.benchmark_version || authority.benchmark_snapshot_hash !== audit.benchmark_snapshot_hash || authority.revoked_certificate_hashes?.includes(audit.certificate_hash) || authority.revoked_eligibility_hashes?.includes(audit.eligibility_hash)) throw Error('PROMOTION_AUTHORITY_STALE_OR_REVOKED')
  const request = audit.request_payload
  if (!request || request.article_id !== article.id || request.child_source_id !== article.source_id || request.source_id !== parent.id || request.product_order_id !== audit.order_id || request.order_revision !== audit.order_revision || request.order_hash !== audit.order_hash || request.evidence_hash !== audit.evidence_hash) throw Error('PROMOTION_REQUEST_MIXED')
  if (request.child_content_sha256 !== sha(article.content) || request.source_content_sha256 !== sha(parent.content) || request.article_updated_at !== article.updated_at || request.source_updated_at !== parent.updated_at) throw Error('PROMOTED_BODY_STALE')
  const { request_hash: recordedHash, ...requestBody } = request
  if (recordedHash !== audit.request_hash || hash(requestBody) !== audit.request_hash || request.certificate_hash !== audit.certificate_hash || request.eligibility_hash !== audit.eligibility_hash || request.trust_policy_hash !== audit.trust_policy_hash || request.benchmark_snapshot_hash !== audit.benchmark_snapshot_hash || request.benchmark_version !== audit.benchmark_version) throw Error('PROMOTION_AUDIT_MIXED')
  if (request.rights_hash !== sourceRightsHash(parent) || article.source !== parent.source || article.license !== parent.license || article.license_class !== parent.license_class || parent.display_only || parent.copyright_safe_in_kr !== true) throw Error('SOURCE_RIGHTS_STALE')
  if (![audit.request_hash, audit.order_hash, audit.evidence_hash, audit.certificate_hash, audit.eligibility_hash, audit.trust_policy_hash, audit.benchmark_snapshot_hash].every(hex) || audit.result_status !== 'ready') throw Error('PROMOTION_AUDIT_INVALID')
  return Object.freeze({
    product_order_id: audit.order_id,
    order_revision: audit.order_revision,
    order_hash: audit.order_hash,
    evidence_hash: audit.evidence_hash,
    promotion_request_id: audit.request_id,
    promotion_request_hash: audit.request_hash,
    source_revision: parent.updated_at,
    source_hash: request.source_content_sha256,
    adaptation_revision: article.updated_at,
    adaptation_hash: request.child_content_sha256,
    rights_hash: request.rights_hash,
    certificate_hash: audit.certificate_hash,
    eligibility_hash: audit.eligibility_hash,
    trust_policy_hash: audit.trust_policy_hash,
    benchmark_version: audit.benchmark_version,
    benchmark_snapshot_hash: audit.benchmark_snapshot_hash,
  })
}

export function assertSameLineage(expected, actual) {
  if (!expected || !actual) throw Error('FACTORY_LINEAGE_MISSING')
  const keys = Object.keys(expected)
  if (Object.keys(actual).length !== keys.length || keys.some(key => actual[key] !== expected[key])) throw Error('FACTORY_LINEAGE_STALE_OR_MIXED')
  return true
}

export function assertOrderLineage(items) {
  if (!Array.isArray(items) || !items.length) throw Error('FACTORY_ORDER_EMPTY')
  const expected = items[0]?.payload?.factory_lineage
  if (!expected) throw Error('FACTORY_LINEAGE_MISSING')
  for (const item of items) assertSameLineage(expected, item?.payload?.factory_lineage)
  return expected
}

export function assertCompatibleOrderLineages(items, orderId) {
  if (!Array.isArray(items) || !items.length) throw Error('FACTORY_ORDER_EMPTY')
  const first = items[0]?.payload?.factory_lineage
  if (!first || first.product_order_id !== orderId) throw Error('FACTORY_ORDER_MIXED')
  for (const item of items) {
    const lineage = item?.payload?.factory_lineage
    if (!lineage || lineage.product_order_id !== orderId || lineage.order_revision !== first.order_revision || lineage.order_hash !== first.order_hash) throw Error('FACTORY_ORDER_MIXED')
  }
  return { product_order_id: orderId, order_revision: first.order_revision, order_hash: first.order_hash }
}

export async function loadCurrentReadingLineages(db, articles, parents, now) {
  const reading = articles.filter(article => article?.source_id?.startsWith('reading:'))
  const result = new Map()
  if (!reading.length) return result
  if (!Number.isFinite(Date.parse(now))) throw Error('FACTORY_VALIDATION_TIME_REQUIRED')
  const { data: authority, error: authorityError } = await db.from('reading_promotion_authority')
    .select('singleton, trust_policy_hash, benchmark_version, benchmark_snapshot_hash, revoked_certificate_hashes, revoked_eligibility_hashes, valid_until').eq('singleton', true).maybeSingle()
  if (authorityError) throw Error(`PROMOTION_AUTHORITY_READ_FAILED: ${authorityError.message}`)
  for (let i = 0; i < reading.length; i += 100) {
    const group = reading.slice(i, i + 100)
    const { data: audits, error } = await db.from('reading_promotion_audit')
      .select('request_id, article_id, source_id, request_hash, order_id, order_revision, order_hash, evidence_hash, certificate_hash, eligibility_hash, trust_policy_hash, benchmark_version, benchmark_snapshot_hash, request_payload, result_status, promoted_at')
      .in('article_id', group.map(article => article.id))
    if (error) throw Error(`PROMOTION_AUDIT_READ_FAILED: ${error.message}`)
    const orderIds = [...new Set((audits ?? []).map(audit => audit.order_id))]
    const { data: orders, error: orderError } = orderIds.length
      ? await db.from('reading_product_order_revision').select('order_id, order_revision, order_hash').in('order_id', orderIds)
      : { data: [], error: null }
    if (orderError) throw Error(`PRODUCT_ORDER_READ_FAILED: ${orderError.message}`)
    const byOrder = new Map((orders ?? []).map(order => [order.order_id, order]))
    const byArticle = new Map()
    for (const audit of audits ?? []) {
      if (!byArticle.has(audit.article_id)) byArticle.set(audit.article_id, [])
      byArticle.get(audit.article_id).push(audit)
    }
    for (const article of group) {
      const current = []
      for (const audit of byArticle.get(article.id) ?? []) {
        try { current.push(currentReadingLineage({ article, parent: parents.get(article.adapted_from_id), audit, order: byOrder.get(audit.order_id), authority, now })) }
        catch { /* A historical or revoked promotion is not current. */ }
      }
      if (current.length === 1) result.set(article.id, current[0])
    }
  }
  return result
}

export async function verifyCurrentItemLineages(db, items, now) {
  if (!Array.isArray(items) || items.some(item => !item)) throw Error('FACTORY_ITEM_SOURCE_MISSING')
  const ids = [...new Set(items.map(item => item.ref_id).filter(id => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id ?? ''))))]
  const articles = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('library_articles')
      .select('id, source_id, adapted_from_id, content, updated_at, status, source, license, license_class, display_only, copyright_safe_in_kr')
      .in('id', ids.slice(i, i + 100))
    if (error) throw Error(`READING_ARTICLE_READ_FAILED: ${error.message}`)
    articles.push(...(data ?? []))
  }
  const byArticle = new Map(articles.map(article => [article.id, article]))
  const parentIds = [...new Set(articles.filter(article => article.source_id?.startsWith('reading:')).map(article => article.adapted_from_id).filter(Boolean))]
  const parents = []
  for (let i = 0; i < parentIds.length; i += 100) {
    const { data, error } = await db.from('library_articles')
      .select('id, source_id, source_url, content, csat_fit, status, updated_at, source, license, license_class, display_only, copyright_safe_in_kr')
      .in('id', parentIds.slice(i, i + 100))
    if (error) throw Error(`READING_PARENT_READ_FAILED: ${error.message}`)
    parents.push(...(data ?? []))
  }
  const lineages = await loadCurrentReadingLineages(db, articles, new Map(parents.map(parent => [parent.id, parent])), now)
  for (const item of items) {
    const article = byArticle.get(item.ref_id)
    const lineage = lineages.get(item.ref_id)
    if (article?.source_id?.startsWith('reading:')) assertSameLineage(lineage, item.payload?.factory_lineage)
    else if (item.payload?.factory_lineage) throw Error('FACTORY_LINEAGE_WITHOUT_READING_SOURCE')
  }
  return lineages
}

export async function verifyRenderPromotionProofs(db, items, requests, policy, now) {
  const byArticle = new Map()
  for (const request of requests ?? []) {
    if (!request?.article_id || byArticle.has(request.article_id)) throw Error('RENDER_PROMOTION_REQUEST_MIXED')
    byArticle.set(request.article_id, request)
  }
  const articleIds = [...new Set(items.map(item => item.ref_id))]
  if (!articleIds.length || byArticle.size !== articleIds.length) throw Error('RENDER_PROMOTION_REQUEST_MISSING')
  for (const articleId of articleIds) {
    const request = byArticle.get(articleId)
    const lineage = items.find(item => item.ref_id === articleId)?.payload?.factory_lineage
    if (!request || !lineage || hash(request.policy) !== hash(policy)) throw Error('RENDER_TRUST_POLICY_STALE')
    for (const item of items.filter(item => item.ref_id === articleId)) assertSameLineage(lineage, item.payload?.factory_lineage)
    const { data: child, error: childError } = await db.from('library_articles')
      .select('id, source_id, source, source_url, title, adapted_from_id, status, content, updated_at, composed_spec, license, license_class, display_only, copyright_safe_in_kr, article_v_level')
      .eq('id', articleId).single()
    if (childError || !child) throw Error('RENDER_CHILD_UNAVAILABLE')
    const { data: source, error: sourceError } = await db.from('library_articles')
      .select('id, source_id, source, source_url, content, csat_fit, license, license_class, display_only, copyright_safe_in_kr, status, updated_at')
      .eq('id', child.adapted_from_id).single()
    if (sourceError || !source) throw Error('RENDER_SOURCE_UNAVAILABLE')
    const { data: audit, error: auditError } = await db.from('reading_promotion_audit')
      .select('request_id, requested_by, request_hash, evidence_hash')
      .eq('request_id', lineage.promotion_request_id).single()
    if (auditError || !audit) throw Error('RENDER_AUDIT_UNAVAILABLE')
    const checked = prepareReadingPromotion({ request, child, source, now, requestedBy: audit.requested_by, allowReady: true })
    if (!checked.ok || checked.rpc.request_hash !== audit.request_hash || checked.rpc.request_hash !== lineage.promotion_request_hash || checked.rpc.evidence_hash !== lineage.evidence_hash) throw Error(`RENDER_PROMOTION_PROOF_STALE: ${checked.reason ?? 'hash mismatch'}`)
  }
  return true
}

export async function verifyOrderRenderItems(db, printedItems, orderId, requests, policy, now) {
  if (!orderId || !printedItems?.length) throw Error('FACTORY_ORDER_EMPTY')
  const ids = [...new Set(printedItems.map(item => item.id))]
  const currentItems = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('csat_dcp_items')
      .select('id, ref_id, payload, answer_key').in('id', ids.slice(i, i + 100))
    if (error) throw Error(`RENDER_ITEM_READ_FAILED: ${error.message}`)
    currentItems.push(...(data ?? []))
  }
  if (currentItems.length !== ids.length) throw Error('RENDER_ITEM_MISSING')
  await verifyCurrentItemLineages(db, currentItems, now)
  const byId = new Map(currentItems.map(item => [item.id, item]))
  for (const printed of printedItems) {
    const current = byId.get(printed.id)
    assertSameLineage(current?.payload?.factory_lineage, printed.payload?.factory_lineage)
    if (reviewDigest(current.payload, current.answer_key) !== printed.source_item_digest ||
        reviewDigest(printed.payload, printed.answer_key) !== printed.source_item_digest) throw Error('RENDER_ITEM_OR_EXPLANATION_STALE')
  }
  const order = assertCompatibleOrderLineages(currentItems, orderId)
  await verifyRenderPromotionProofs(db, currentItems, requests, policy, now)
  return { order, itemEvidence: printedItems.map(item => ({ itemId: item.id, lineage: item.payload.factory_lineage })) }
}
