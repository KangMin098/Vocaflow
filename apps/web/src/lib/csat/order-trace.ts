// apps/web/src/lib/csat/order-trace.ts
import { createHash } from 'node:crypto'
import { canonicalJson, reviewDigest } from '@vocaflow/library-pipeline'

export const ORDER_TRACE_STAGES = [
  'candidate', 'adaptation', 'benchmark', 'gold_s', 'seed', 'queued', 'ready',
  'item', 'explanation', 'editorial', 'unit', 'volume', 'rendered', 'published',
] as const
export type OrderTraceStage = (typeof ORDER_TRACE_STAGES)[number]
export type OrderTraceState = 'observed' | 'hold' | 'stale' | 'blocked' | 'unmeasured'
export type OrderTraceEntry = { stage: OrderTraceStage; state: OrderTraceState; reason: string }

type OrderRow = { order_id: string; order_revision: number; order_hash: string }
type AuditRow = {
  request_id: string; request_hash: string; evidence_hash: string; article_id: string; source_id: string; order_revision: number; order_hash: string
  trust_policy_hash: string; benchmark_version: string; benchmark_snapshot_hash: string; certificate_hash: string
  eligibility_hash: string; result_status: string; request_payload: Record<string, unknown>
}
type AuthorityRow = {
  trust_policy_hash: string; benchmark_version: string; benchmark_snapshot_hash: string; valid_until: string
  revoked_certificate_hashes: string[]; revoked_eligibility_hashes: string[]
}
type ArticleRow = {
  id: string; status: string; adapted_from_id: string | null; display_only: boolean
  copyright_safe_in_kr: boolean; content: string; source: string; source_id: string; license: string; license_class: string; updated_at: string
}
type SourceRow = {
  id: string; source_id: string; source_url: string; content: string; csat_fit: unknown; source: string
  license: string; license_class: string; display_only: boolean; copyright_safe_in_kr: boolean
  status: string; updated_at: string
}
type ItemRow = {
  id: string; ref_id: string; payload: Record<string, unknown>
  answer_key: Record<string, unknown>
}
type ReviewRow = { item_id: string; persona: string; verdict: string; reviewed_digest: string | null }
type ItemStateRow = { item_id: string; status: string; reason_code: string | null }
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

export function deriveOrderTrace(input: {
  order: OrderRow | null; audits: AuditRow[]; authority: AuthorityRow | null
  article: ArticleRow | null; source: SourceRow | null; items: ItemRow[] | null
  itemStates: ItemStateRow[] | null; reviews: ReviewRow[] | null; now: string
}): { order_id: string | null; order_revision: number | null; entries: OrderTraceEntry[]; blocker: string | null } {
  const entries = ORDER_TRACE_STAGES.map(stage => ({
    stage, state: 'unmeasured' as OrderTraceState, reason: '이 주문의 현재 증거를 조회할 수 없습니다.',
  }))
  const set = (stage: OrderTraceStage, state: OrderTraceState, reason: string) => {
    const entry = entries.find(row => row.stage === stage)!
    entry.state = state
    entry.reason = reason
  }
  const { order, audits, authority, article, source, items, itemStates, reviews, now } = input
  if (!order) return { order_id: null, order_revision: null, entries, blocker: '등록된 주문을 찾지 못했습니다.' }
  const audit = audits[0]
  if (!audit) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: '주문은 등록됐지만 승격 감사가 없습니다. 선행 증거는 별도 검토가 필요합니다.' }
  if (audit.order_revision !== order.order_revision || audit.order_hash !== order.order_hash) {
    for (const stage of ORDER_TRACE_STAGES) set(stage, 'stale', '승격 감사의 주문 revision/hash가 현재 등록 주문과 다릅니다.')
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'ORDER_REVISION_STALE' }
  }
  if (!article || article.id !== audit.article_id) {
    for (const stage of ORDER_TRACE_STAGES) set(stage, 'unmeasured', '승격된 지문을 조회하지 못했습니다.')
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'ARTICLE_UNMEASURED' }
  }
  if (!source || source.id !== audit.source_id || article.adapted_from_id !== source.id)
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'SOURCE_UNMEASURED_OR_MIXED' }
  set('candidate', 'observed', '승격 감사에 source/지문 연결이 기록돼 있습니다.')
  set('adaptation', article.adapted_from_id ? 'observed' : 'hold',
    article.adapted_from_id ? '각색 자식과 원문 연결이 있습니다.' : '각색 원문 연결이 없습니다.')
  if (!authority) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: 'AUTHORITY_UNMEASURED' }
  const rightsBlocked = article.display_only || !article.copyright_safe_in_kr ||
    source.display_only || !source.copyright_safe_in_kr ||
    article.source !== source.source || article.license !== source.license ||
    article.license_class !== source.license_class ||
    !['cc_by', 'cc0', 'public_domain', 'cc_by_sa'].includes(source.license_class) ||
    ['archived', 'failed'].includes(source.status)
  const currentRightsHash = sha(canonicalJson({ id: source.id, source_id: source.source_id,
    source_url: source.source_url, content: source.content, csat_fit: source.csat_fit,
    license: source.license, license_class: source.license_class,
    display_only: source.display_only, copyright_safe_in_kr: source.copyright_safe_in_kr,
    status: source.status, updated_at: source.updated_at }))
  const sourceChanged = sha(source.content) !== audit.request_payload.source_content_sha256 ||
    sha(article.content) !== audit.request_payload.child_content_sha256 ||
    source.updated_at !== audit.request_payload.source_updated_at ||
    article.updated_at !== audit.request_payload.article_updated_at ||
    article.source_id !== audit.request_payload.child_source_id ||
    currentRightsHash !== audit.request_payload.rights_hash
  const authorityExpired = !Number.isFinite(Date.parse(authority.valid_until)) ||
    Date.parse(authority.valid_until) <= Date.parse(now)
  const authorityChanged = authority.trust_policy_hash !== audit.trust_policy_hash ||
    authority.benchmark_version !== audit.benchmark_version ||
    authority.benchmark_snapshot_hash !== audit.benchmark_snapshot_hash
  const certificateRevoked = authority.revoked_certificate_hashes.includes(audit.certificate_hash)
  const seedRevoked = authority.revoked_eligibility_hashes.includes(audit.eligibility_hash)
  if (rightsBlocked || sourceChanged || authorityExpired || authorityChanged || certificateRevoked || seedRevoked) {
    const reason = rightsBlocked ? 'RIGHTS_CHANGED' : sourceChanged ? 'SOURCE_OR_PASSAGE_STALE'
      : authorityExpired ? 'AUTHORITY_EXPIRED'
      : authorityChanged ? 'EVIDENCE_MISMATCH' : certificateRevoked ? 'CERTIFICATE_REVOKED' : 'SEED_REVOKED'
    for (const stage of ORDER_TRACE_STAGES.slice(2)) set(stage, reason === 'EVIDENCE_MISMATCH' ? 'stale' : 'blocked', reason)
    return { order_id: order.order_id, order_revision: order.order_revision, entries, blocker: reason }
  }
  set('benchmark', 'observed', '승격 당시 benchmark snapshot hash가 기록됐습니다. 최신 판정은 별도 재검증 대상입니다.')
  set('gold_s', 'observed', '승격 당시 Gold-S certificate hash가 기록됐습니다. 현재 인증 판정은 아닙니다.')
  set('seed', 'observed', '승격 당시 seed eligibility hash가 기록됐습니다. 현재 적재 승인 판정은 아닙니다.')
  set('queued', 'observed', '승격 감사가 queued → ready 전이를 기록했습니다.')
  const ready = ['ready', 'published'].includes(article.status) && audit.result_status === 'ready'
  set('ready', ready ? 'observed' : 'stale', ready ? '현재 지문이 ready 계열 상태입니다.' : '현재 지문 상태와 승격 감사가 다릅니다.')
  if (!ready) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: 'READY_STATE_STALE' }
  if (items === null) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: 'ITEM_UNMEASURED' }
  if (itemStates === null) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: 'ITEM_STATE_UNMEASURED' }
  const bound = items.filter(item => item.ref_id === article.id &&
    (item.payload.factory_lineage as Record<string, unknown> | undefined)?.product_order_id === order.order_id)
  if (!bound.length) {
    set('item', 'hold', '현재 주문에 결속된 문항이 없습니다.')
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'ITEM_PENDING' }
  }
  const blockedItem = bound.find(item => itemStates.some(state => state.item_id === item.id && state.status !== 'usable'))
  if (blockedItem) {
    set('item', 'blocked', `문항 ${blockedItem.id}의 현재 사용 상태가 차단됐습니다.`)
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'ITEM_STATE_BLOCKED' }
  }
  const expectedLineage = {
    product_order_id: order.order_id, order_revision: order.order_revision, order_hash: order.order_hash,
    evidence_hash: audit.evidence_hash, promotion_request_id: audit.request_id,
    promotion_request_hash: audit.request_hash, source_revision: source.updated_at,
    source_hash: audit.request_payload.source_content_sha256,
    adaptation_revision: article.updated_at, adaptation_hash: audit.request_payload.child_content_sha256,
    rights_hash: audit.request_payload.rights_hash, certificate_hash: audit.certificate_hash,
    eligibility_hash: audit.eligibility_hash, trust_policy_hash: audit.trust_policy_hash,
    benchmark_version: audit.benchmark_version, benchmark_snapshot_hash: audit.benchmark_snapshot_hash,
  }
  if (bound.some(item => {
    const lineage = item.payload.factory_lineage as Record<string, unknown>
    return Object.keys(lineage).length !== Object.keys(expectedLineage).length ||
      Object.entries(expectedLineage).some(([key, value]) => lineage[key] !== value)
  })) {
    set('item', 'stale', '문항의 주문·승격·인증 증거가 현재 감사와 다릅니다.')
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'ITEM_EVIDENCE_MISMATCH' }
  }
  set('item', 'observed', `${bound.length}개 문항의 주문·승격 계보를 확인했습니다.`)
  if (bound.some(item => !String(item.answer_key.explanation_ko ?? item.answer_key.rationale_ko ?? '').trim())) {
    set('explanation', 'hold', '문항 중 해설 근거가 없는 항목이 있습니다.')
    return { order_id: order.order_id, order_revision: order.order_revision, entries,
      blocker: 'EXPLANATION_PENDING' }
  }
  set('explanation', 'observed', '모든 문항에 해설이 연결돼 있습니다.')
  if (reviews === null) return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: 'EDITORIAL_UNMEASURED' }
  const allReviewed = bound.every(item => {
    const digest = reviewDigest(item.payload, item.answer_key)
    const matching = reviews.filter(row => row.item_id === item.id && row.verdict === 'pass' && row.reviewed_digest === digest)
    return new Set(matching.map(row => row.persona)).size >= 3
  })
  set('editorial', allReviewed ? 'observed' : 'hold',
    allReviewed ? '각 문항의 현재 digest에 독립 검수 3종이 결속돼 있습니다.' : '현재 문항 digest에 대한 검수 3종이 미완료입니다.')
  return { order_id: order.order_id, order_revision: order.order_revision, entries,
    blocker: allReviewed ? 'DOWNSTREAM_UNMEASURED' : 'EDITORIAL_PENDING' }
}
