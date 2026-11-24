// apps/web/src/lib/csat/map/v62/factory-bridge/dcp-request.ts
//
// 2F — 공장 DCP 안내 연습의 실제 공급 호출부(서버 전용).
//   · 학습자 요청: 서버가 지금 저장 계획 보기(composeV4 결과)로 buildDemand → 학습자 세션 workspace_demand_record →
//     r.central_meaning guided_practice 줄 → 기존 주문 재사용 · 없으면 factory_order_open(결정적 키) →
//     기존 D3 제품주문 링크를 **읽어서** 확인(service SELECT — 링크 표는 관리자 읽기 전용) → 승인된 현재 후보 3활동을
//     receiveForLearner → workspace_delivery_record(학습자 세션 · DB 가 잠금 아래 계보 · 현재성 · 수량을 다시 판정).
//     링크가 없으면 주문을 남기고 waiting_link — 학습자 요청을 관리자 actor 로 바꾸거나 관리자를 임의로 고르지 않는다.
//   · 관리자 승인: qualification_id 가 factory_dcp_qualification → factory_dcp_admission 의 등록 후보와 정확히 같을 때만
//     관리자 **세션**으로 approveForGuidedPractice(content_release_approve). 미리보기 · 입고는 승인하지 않는다.
//   · 조회 오류는 0건 · 대기로 삼키지 않고 던진다. 미설치(표 · 함수 없음)만 not_installed.
import 'server-only'
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { stableKey } from '@/lib/csat/authored/server'
import { buildDemand } from '@/lib/csat/map/v62/demand'
import { canonicalDemand } from '@/lib/csat/map/v62/persist-contract'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskId } from '@/lib/csat/map/v4/definition'
import { approveForGuidedPractice, receiveForLearner, type ProductLinker, type SupplyClient } from './dcp-supply'
import { openFactoryDelivery } from './dcp-learning'
import { LESSON_SOURCE_ID, LESSON_SOURCE_CONTENT_SHA256, LESSON_STEPS } from './source-lesson'

export const FACTORY_TASK = 'r.central_meaning' as const
const ROLE = 'guided_practice'
/** 한 원문 교수 = 요지 → 제목 → 주제 3활동(같은 원문 · 같은 주문) */
export const LESSON_ORDER = LESSON_STEPS
type Step = (typeof LESSON_ORDER)[number]

const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])
const isMissing = (e: { code?: string } | null) => !!e && MISSING.has(e.code ?? '')
class NotInstalled extends Error {}
function rows<T>(r: { data: unknown; error: { message: string; code?: string } | null }, what: string): T[] {
  if (r.error) { if (isMissing(r.error)) throw new NotInstalled(what); throw new Error(`${what} 조회 실패: ${r.error.code ?? ''} ${r.error.message}`) }
  if (!Array.isArray(r.data)) throw new Error(`${what} 조회 모양 불일치`)
  return r.data as T[]
}

export type FactoryRequestResult =
  | { status: 'not_installed' }
  /** 지금 계획의 이 TASK 단계에 안내 연습 줄이 없다(예: 확인 · 전이 단계) — 아무것도 쓰지 않는다 */
  | { status: 'not_in_stage' }
  /** 주문은 남았고 관리자 제품주문 연결을 기다린다 */
  | { status: 'waiting_link' }
  /** 연결은 있으나 같은 원문 3활동이 모두 승인된 현재 후보가 아니다 */
  | { status: 'waiting_approval' }
  | { status: 'delivered'; first: string; delivered: number; replayed: boolean }

export interface FactoryRequestInput { view: V4View; template: string; workspaceId: string; planVersion: number; goalVersion: number | null }

interface Candidate { step: Step; dcp: string; source: string; qualificationId: string; approvalId: string }

async function sourceEligible(service: SupabaseClient, sourceId: string): Promise<boolean> {
  const r = await service.rpc('csat_source_is_eligible', { p_article_id: sourceId })
  if (r.error) { if (isMissing(r.error)) throw new NotInstalled('원천 정책'); throw new Error(`원천 정책 조회 실패: ${r.error.code ?? ''}`) }
  if (typeof r.data !== 'boolean') throw new Error('원천 정책 응답 모양 불일치')
  return r.data
}

/** 관리자 경계 표(service SELECT)로 이 제품주문의 승인된 현재 후보를 원문별로 모은다. 최종 판정은 납품 RPC */
async function candidatesOf(service: SupabaseClient, link: { product_order_id: string; order_revision: number; order_hash: string }): Promise<Candidate[]> {
  if (!await sourceEligible(service, LESSON_SOURCE_ID)) return []
  const adm = rows<{ dcp_item_id: string; source_id: string; artifact_revision: string; source_content_sha256: string }>(await service.from('factory_dcp_admission')
    .select('dcp_item_id, source_id, artifact_revision, source_content_sha256').eq('product_order_id', link.product_order_id).eq('order_revision', link.order_revision)
    .eq('order_hash', link.order_hash).eq('role', ROLE).eq('task_id', FACTORY_TASK)
    .eq('source_id', LESSON_SOURCE_ID).eq('source_content_sha256', LESSON_SOURCE_CONTENT_SHA256), '등록 후보')
  if (adm.length === 0) return []
  const ids = adm.map((a) => a.dcp_item_id)
  const fq = rows<{ dcp_item_id: string; qualification_id: string; artifact_revision: string }>(await service.from('factory_dcp_qualification')
    .select('dcp_item_id, qualification_id, artifact_revision').in('dcp_item_id', ids), '후보 자격')
  const qids = fq.map((q) => q.qualification_id)
  if (qids.length === 0) return []
  const [cq, sup, ap, items] = await Promise.all([
    service.from('content_qualification').select('id, artifact_kind, artifact_ref, artifact_revision, task_id, role').in('id', qids),
    service.from('content_qualification').select('supersedes').in('supersedes', qids),
    service.from('content_release_approval').select('id, qualification_id, scope').in('qualification_id', qids).eq('scope', 'public'),
    service.from('csat_dcp_items').select('id, type, ref_id').in('id', ids),
  ])
  const quals = rows<{ id: string; artifact_kind: string; artifact_ref: string; artifact_revision: string; task_id: string; role: string }>(cq, '자격')
  const superseded = new Set(rows<{ supersedes: string }>(sup, '자격 대체').map((x) => x.supersedes))
  const approvals = rows<{ id: string; qualification_id: string }>(ap, '출시 승인')
  const typed = rows<{ id: string; type: string; ref_id: string }>(items, '문항')
  const rv = approvals.length ? rows<{ approval_id: string }>(await service.from('content_release_revocation').select('approval_id').in('approval_id', approvals.map((a) => a.id)), '승인 철회') : []
  const revoked = new Set(rv.map((x) => x.approval_id))
  const out: Candidate[] = []
  for (const a of adm) {
    const q = fq.find((x) => x.dcp_item_id === a.dcp_item_id)
    const c = q && quals.find((x) => x.id === q.qualification_id)
    const t = typed.find((x) => x.id === a.dcp_item_id)
    if (!q || !c || !t || q.artifact_revision !== a.artifact_revision || superseded.has(c.id)) continue
    if (c.artifact_kind !== 'dcp_item' || c.artifact_ref !== a.dcp_item_id || c.artifact_revision !== a.artifact_revision || c.role !== ROLE || c.task_id !== FACTORY_TASK) continue
    if (t.ref_id !== a.source_id || !(LESSON_ORDER as readonly string[]).includes(t.type)) continue
    const approval = approvals.filter((x) => x.qualification_id === c.id && !revoked.has(x.id)).sort((x, y) => x.id.localeCompare(y.id))[0]
    if (approval) out.push({ step: t.type as Step, dcp: a.dcp_item_id, source: a.source_id, qualificationId: c.id, approvalId: approval.id })
  }
  return out
}

/** 같은 원문에서 요지 · 제목 · 주제가 모두 있는 첫 원문(결정적: 원문 id 순). 이미 받은 원문이 있으면 그 원문만 */
function lessonSet(c: Candidate[], onlySource: string | null): Candidate[] | null {
  const sources = [...new Set(c.map((x) => x.source))].sort().filter((s) => !onlySource || s === onlySource)
  for (const s of sources) {
    const set = LESSON_ORDER.map((step) => c.filter((x) => x.source === s && x.step === step).sort((a, b) => a.dcp.localeCompare(b.dcp))[0])
    if (set.every(Boolean)) return set as Candidate[]
  }
  return null
}

/**
 * 학습자 요청 — learner 는 학습자 세션(쓰기 · 본인 행 읽기), service 는 관리자 전용 표 읽기만(쓰기 없음).
 * 같은 요청 반복 · 부분 성공 · 응답 유실은 같은 수요 서명 · 주문 키 · 납품 키로 같은 행을 돌려받는다.
 */
export async function requestFactoryDcp(service: SupabaseClient, learner: SupabaseClient, userId: string, input: FactoryRequestInput): Promise<FactoryRequestResult> {
  const demand = buildDemand(input.view, FACTORY_TASK as TaskId, input.template, { workspaceId: input.workspaceId, planVersion: input.planVersion, goalVersion: input.goalVersion })
  if (!demand.lines.some((l) => l.role === ROLE && l.task === FACTORY_TASK)) return { status: 'not_in_stage' }
  try {
    // 정본 수요는 지원하지 않는 역할(source_analysis · model_explanation)까지 그대로 기록한다 — 공급은 안내 연습 줄만
    const rec = await learner.rpc('workspace_demand_record', { p_canonical: canonicalDemand(userId, demand) })
    if (rec.error) { if (isMissing(rec.error)) return { status: 'not_installed' }; throw new Error(`수요 기록 실패: ${rec.error.message}`) }
    if (typeof rec.data !== 'string') throw new Error('수요 기록 응답 모양 불일치')
    const line = rows<{ id: string; role: string; task_id: string; quantity: number }>(await learner.from('workspace_content_demand_line')
      .select('id, role, task_id, quantity').eq('demand_id', rec.data).eq('user_id', userId), '수요 줄').find((l) => l.role === ROLE && l.task_id === FACTORY_TASK)
    if (!line) throw new Error('안내 연습 수요 줄이 기록되지 않았어요')
    const have = rows<{ id: string; order_id: string | null; artifact_ref: string }>(await learner.from('workspace_content_delivery')
      .select('id, order_id, artifact_ref').eq('line_id', line.id).eq('user_id', userId), '납품')
    const orders = rows<{ id: string; order_seq: number }>(await learner.from('factory_order').select('id, order_seq').eq('line_id', line.id).eq('user_id', userId), '주문')
    let orderId = orders.sort((a, b) => b.order_seq - a.order_seq)[0]?.id ?? null
    if (!orderId) {
      const o = await learner.rpc('factory_order_open', { p_line: line.id, p_reason: 'initial', p_quantity: line.quantity, p_request_key: stableKey('factory-dcp-order', userId, line.id) })
      if (o.error) { if (isMissing(o.error)) return { status: 'not_installed' }; throw new Error(`주문 실패: ${o.error.message}`) }
      if (typeof o.data !== 'string') throw new Error('주문 응답 모양 불일치')
      orderId = o.data
    }
    const links = rows<{ id: string; product_order_id: string; order_revision: number; order_hash: string }>(await service.from('factory_order_product_link')
      .select('id, product_order_id, order_revision, order_hash').eq('order_id', orderId), '제품주문 연결')
    if (links.length === 0) return { status: 'waiting_link' }
    let link: typeof links[number] | undefined
    for (const candidate of links.sort((a, b) => a.product_order_id.localeCompare(b.product_order_id) || b.order_revision - a.order_revision)) {
      const live = await service.rpc('factory_product_order_is_current', { p_id: candidate.product_order_id, p_revision: candidate.order_revision })
      if (live.error) { if (isMissing(live.error)) throw new NotInstalled('제품주문 현재성'); throw new Error('제품주문 현재성 조회 실패') }
      if (typeof live.data !== 'boolean') throw new Error('제품주문 현재성 응답 모양 불일치')
      if (live.data) { link = candidate; break }
    }
    if (!link) return { status: 'waiting_link' }
    const cands = await candidatesOf(service, link)
    const mine = have.filter((h) => h.order_id === orderId)
    const pickedSource = mine.length ? cands.find((c) => mine.some((m) => m.artifact_ref === c.dcp))?.source ?? null : null
    const set = lessonSet(cands, pickedSource)
    if (!set) return { status: 'waiting_approval' }
    // 읽기 전용 링커 — 이 주문의 기존 링크를 확인만 한다(새 링크 · 관리자 actor 없음)
    const verify: ProductLinker = async (oid) => (oid === orderId ? { ok: true, link_id: link.id } : { ok: false, code: 'product_link_missing' })
    const ids: Record<string, string> = Object.fromEntries(have.map((h) => [h.artifact_ref, h.id]))
    let fresh = 0
    for (const c of set) {
      if (ids[c.dcp]) {
        const current = await openFactoryDelivery(learner as unknown as SupplyClient, ids[c.dcp]!)
        if (!current.ok) {
          if (current.code === 'not_installed') return { status: 'not_installed' }
          if (current.code === 'query_failed' || current.code === 'bad_shape') throw new Error('기존 납품 현재성을 확인하지 못했어요')
          return { status: 'waiting_approval' }
        }
        continue
      }
      const r = await receiveForLearner(learner as unknown as SupplyClient, verify, {
        lineId: line.id, orderId, quantity: line.quantity, qualificationId: c.qualificationId, approvalId: c.approvalId,
        orderKey: stableKey('factory-dcp-order', userId, line.id), deliveryKey: stableKey('factory-dcp-delivery', userId, line.id, c.qualificationId),
      })
      if (!r.ok) throw new Error(`납품 실패(${fresh}/${set.length} 새로 받음 · 같은 요청으로 다시 이어 받을 수 있음): ${r.code}`)
      ids[c.dcp] = r.delivery_id
      fresh++
    }
    return { status: 'delivered', first: ids[set[0]!.dcp]!, delivered: set.length, replayed: fresh === 0 }
  } catch (e) {
    if (e instanceof NotInstalled) return { status: 'not_installed' }
    throw e
  }
}

export type ApproveResult =
  | { status: 'ok'; approval_id: string; replayed: boolean }
  | { status: 'not_installed' }
  | { status: 'rejected'; code: string }

/**
 * 관리자 승인 — service 는 영수증 · 자격 · 원문 읽기만, session 은 로그인한 관리자 · 큐레이터 세션(content_release_approve 가 권한을 다시 판정).
 * 같은 자격의 미철회 승인이 이미 있으면 그 id(재승인 없음). 철회된 승인은 같은 자격으로 되살리지 않는다(새 판본 · 새 자격).
 */
export async function approveFactoryDcp(service: SupabaseClient, session: SupplyClient, qualificationId: string, note: string): Promise<ApproveResult> {
  try {
    const fq = rows<{ dcp_item_id: string; artifact_revision: string }>(await service.from('factory_dcp_qualification').select('dcp_item_id, artifact_revision').eq('qualification_id', qualificationId), '후보 자격')[0]
    if (!fq) return { status: 'rejected', code: 'not_factory_candidate' }
    const a = rows<{ source_id: string; source_content_sha256: string; artifact_revision: string; role: string; task_id: string }>(await service.from('factory_dcp_admission')
      .select('source_id, source_content_sha256, artifact_revision, role, task_id').eq('dcp_item_id', fq.dcp_item_id), '등록 후보')[0]
    const c = rows<{ artifact_kind: string; artifact_ref: string; artifact_revision: string; task_id: string; role: string }>(await service.from('content_qualification')
      .select('artifact_kind, artifact_ref, artifact_revision, task_id, role').eq('id', qualificationId), '자격')[0]
    if (!a || !c || a.role !== ROLE || a.task_id !== FACTORY_TASK || a.artifact_revision !== fq.artifact_revision || c.artifact_kind !== 'dcp_item'
        || c.artifact_ref !== fq.dcp_item_id || c.artifact_revision !== fq.artifact_revision || c.role !== ROLE || c.task_id !== FACTORY_TASK) return { status: 'rejected', code: 'not_factory_candidate' }
    if (rows(await service.from('content_qualification').select('id').eq('supersedes', qualificationId), '자격 대체').length) return { status: 'rejected', code: 'superseded' }
    const src = rows<{ content: string }>(await service.from('library_articles').select('content').eq('id', a.source_id), '원문')[0]
    if (!src || createHash('sha256').update(src.content, 'utf8').digest('hex') !== a.source_content_sha256) return { status: 'rejected', code: 'source_changed' }
    if (!await sourceEligible(service, a.source_id)) return { status: 'rejected', code: 'source_not_eligible' }
    const prev = rows<{ id: string }>(await service.from('content_release_approval').select('id').eq('qualification_id', qualificationId).eq('scope', 'public'), '출시 승인')[0]
    if (prev) {
      const rv = rows(await service.from('content_release_revocation').select('approval_id').eq('approval_id', prev.id), '승인 철회')
      return rv.length ? { status: 'rejected', code: 'approval_revoked' } : { status: 'ok', approval_id: prev.id, replayed: true }
    }
    const r = await approveForGuidedPractice(session, qualificationId, note)
    if (!r.ok) return r.detail && /PGRST202|Could not find the function/.test(r.detail) ? { status: 'not_installed' } : { status: 'rejected', code: r.code }
    return { status: 'ok', approval_id: r.data, replayed: false }
  } catch (e) {
    if (e instanceof NotInstalled) return { status: 'not_installed' }
    throw e
  }
}
