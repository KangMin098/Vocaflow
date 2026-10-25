// apps/web/src/lib/csat/map/v62/factory-bridge/dcp-supply.ts
//
// 단계 1C — DCP 후보 등록 · 자격 · 출시 승인 · 학습자 공급의 Supabase 경계.
//   · 관리자 세션 클라이언트: 후보 등록(factory_dcp_admit) → 자격(factory_dcp_qualify → 기존 content_qualification_record) → 출시 승인(content_release_approve).
//   · D3 링크(factory_order_link_product)만 service_role + 실제 관리자 actor — 기존 D3 actor 검증 경계.
//     세 단계는 별도 호출이다 — 등록이 자격 · 승인을 뜻하지 않는다. 필수 축이 pass 가 아니면 자격 행을 만들지 않고 보류로 돌려준다.
//   · 학습자 본인 세션 클라이언트: factory_order_open → workspace_delivery_record. 관리자 · service_role 이 학습자를 흉내내지 않는다.
//   · 원천은 관리자 세션으로 지금 DB 행을 읽어 planAdmission 이 다시 판정한다(스냅샷 파일을 믿지 않는다).
//   · 실패는 { ok:false, code } 로 돌려준다 — 0건 · 완료로 삼키지 않는다.

import {
  planAdmission,
  qualificationArgs,
  type AdmissionInput,
  type AdmissionItemPlan,
  type AdmissionPlan,
} from './dcp-admission'
import { parseReuseMapping, planExistingDcpReuse, type ExistingDcpRow, type ReuseInput, type ReusePlan } from './dcp-reuse'
import { LocalProductionError } from './local-production'

export interface RpcResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
}
/** supabase-js 클라이언트의 최소 모양 — 실제 클라이언트와 격리 시험 어댑터가 같이 만족한다 */
export interface SupplyClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult<T>>
}
/** 원천 현재 행 읽기(관리자 세션) — library_articles 한 행을 snapshot 모양으로 */
export type SourceReader = (id: string) => Promise<{ snapshot_kind: 'read_only_database_export'; current_time: string; row: Record<string, unknown> } | null>

export type Fail = { ok: false; code: string; detail?: string }
const fail = (code: string, detail?: string): Fail => ({ ok: false, code, ...(detail ? { detail } : {}) })

async function call<T>(c: SupplyClient, fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | Fail> {
  const { data, error } = await c.rpc<T>(fn, args)
  if (error) return fail(`${fn}_failed`, error.message)
  if (data === null || data === undefined) return fail(`${fn}_empty`)
  return { ok: true, data }
}

export interface AdmittedItem {
  item_id: string
  dcp_item_id: string
  artifact_revision: string
  replayed: boolean
  qualification_id: string | null
  held: string[]
}

/**
 * 계획 → 후보 등록 → (필수 축이 모두 pass 일 때만) 자격 기록. 출시 승인은 하지 않는다.
 * isolated=true 는 격리 시험에서만 — 합성 수요 계획을 넘긴다(DB 쪽 factory_dcp_admit 가 그래도 합성 본문을 거절한다).
 */
export async function admitCandidates(
  admin: SupplyClient,
  readSource: SourceReader,
  input: Omit<AdmissionInput, 'currentSource'>,
  opts: { isolated?: boolean } = {},
): Promise<{ ok: true; plan: AdmissionPlan; items: AdmittedItem[] } | Fail> {
  const preview = await previewAdmission(readSource, input)
  if (!preview.ok) return preview
  const r = await admitPlan(admin, preview.plan, opts)
  return r.ok ? { ok: true, plan: preview.plan, items: r.items } : r
}

/** 계획의 문항마다 별도 RPC(문항 단위 원자) — 한 묶음 전체가 원자는 아니다. 같은 본문 재요청은 replayed 로 복구된다 */
async function admitPlan(admin: SupplyClient, plan: AdmissionPlan, opts: { isolated?: boolean }): Promise<{ ok: true; items: AdmittedItem[] } | Fail> {
  if (!plan.real_admissible && !opts.isolated) return fail('not_admissible', plan.blockers.join(','))
  // Reject the entire content batch before reserving any immutable admission/slot.
  // Rights/runtime holds may remain candidates; failed or missing content review may not.
  const unchecked = plan.items.filter((it) =>
    (['B', 'C', 'D'] as const).some((axis) => it.axes[axis].state !== 'pass') ||
    it.held.some((reason) => reason === 'item_not_reviewed' || reason.startsWith('review_conclusion_')),
  )
  if (unchecked.length) return fail('content_review_not_pass', unchecked.map((it) => it.item_id).join(','))
  const items: AdmittedItem[] = []
  for (const it of plan.items) {
    const r = await call<{ dcp_item_id: string; artifact_revision: string; replayed: boolean }>(admin, 'factory_dcp_admit', { p_request_key: it.request_key, p_body: it.body })
    if (!r.ok) return { ...r, detail: `${it.item_id}: ${r.detail ?? ''}` }
    // 재전송(replayed)도 자격을 다시 요청한다 — factory_dcp_qualify 가 후보당 1건으로 잠가 같은 인자면 같은 id 를 돌려준다.
    // 그래서 등록 성공 뒤 자격 실패 · 응답 유실이 있어도 재요청이 복구한다(자격 행은 늘지 않는다).
    const q = it.qualification_ready ? await qualify(admin, plan, it, r.data.dcp_item_id, r.data.artifact_revision) : null
    if (q && !q.ok) return { ...q, detail: `${it.item_id}: ${q.detail ?? ''}` }
    items.push({ item_id: it.item_id, ...r.data, qualification_id: q?.data ?? null, held: it.held })
  }
  return { ok: true, items }
}

/** 기존 DCP 행 읽기(서버 service SELECT) — 매핑의 id 들만. 오류는 던진다(0건으로 삼키지 않는다) */
export type ExistingRowReader = (ids: string[]) => Promise<ExistingDcpRow[]>

/** 재사용 미리보기 — 지금 원천 행 · 지금 기존 행으로 planExistingDcpReuse 만. RPC · 쓰기 없음 */
export async function previewReuse(
  readSource: SourceReader,
  readRows: ExistingRowReader,
  input: Omit<ReuseInput, 'currentSource' | 'existingRows'>,
): Promise<{ ok: true; plan: ReusePlan } | Fail> {
  const packetSourceId = (input.packet as { body?: { source?: { id?: unknown } } })?.body?.source?.id
  if (typeof packetSourceId !== 'string') return fail('packet_shape')
  let mapping
  try {
    mapping = parseReuseMapping(input.reuse)
  } catch (e) {
    if (e instanceof LocalProductionError) return fail(e.code, e.detail.join(','))
    throw e
  }
  const current = await readSource(packetSourceId)
  if (!current) return fail('source_not_found')
  const existingRows = await readRows(mapping.map((m) => m.dcp_item_id))
  try {
    return { ok: true, plan: planExistingDcpReuse({ ...input, reuse: mapping, currentSource: current, existingRows }) }
  } catch (e) {
    if (e instanceof LocalProductionError) return fail(e.code, e.detail.join(','))
    throw e
  }
}

/** 재사용 입고 — 기존 행은 영수증만(행 불변) · 매핑 밖 문항은 원래 INSERT 경로. 자격은 기존 경로 그대로 */
export async function admitReuse(
  admin: SupplyClient,
  readSource: SourceReader,
  readRows: ExistingRowReader,
  input: Omit<ReuseInput, 'currentSource' | 'existingRows'>,
  opts: { isolated?: boolean } = {},
): Promise<{ ok: true; plan: ReusePlan; items: AdmittedItem[] } | Fail> {
  const preview = await previewReuse(readSource, readRows, input)
  if (!preview.ok) return preview
  const r = await admitPlan(admin, preview.plan as unknown as AdmissionPlan, opts)
  return r.ok ? { ok: true, plan: preview.plan, items: r.items } : r
}

function qualify(admin: SupplyClient, plan: AdmissionPlan, it: AdmissionItemPlan, dcpId: string, rev: string) {
  return call<string>(admin, 'factory_dcp_qualify', { p_dcp_item: dcpId, p_args: qualificationArgs(plan, it, dcpId, rev) })
}

/** 읽기 전용 미리보기 — 지금 원천 행으로 planAdmission 만. RPC · 쓰기 없음 */
export async function previewAdmission(
  readSource: SourceReader,
  input: Omit<AdmissionInput, 'currentSource'>,
): Promise<{ ok: true; plan: AdmissionPlan } | Fail> {
  const packetSourceId = (input.packet as { body?: { source?: { id?: unknown } } })?.body?.source?.id
  if (typeof packetSourceId !== 'string') return fail('packet_shape')
  const current = await readSource(packetSourceId)
  if (!current) return fail('source_not_found')
  try {
    return { ok: true, plan: planAdmission({ ...input, currentSource: current }) }
  } catch (e) {
    if (e instanceof LocalProductionError) return fail(e.code, e.detail.join(','))
    throw e
  }
}

/** 출시(public) 승인 — 관리자 세션의 명시적 별도 호출. 지도 연습은 assessment 범위를 요청하지 않는다 */
export function approveForGuidedPractice(admin: SupplyClient, qualificationId: string, note: string) {
  return call<string>(admin, 'content_release_approve', { p_qualification: qualificationId, p_scope: 'public', p_note: note })
}

/** 등록된 제품주문(D3 factory_product_order) 판 */
export interface ProductOrderRef { product_order_id: string; order_revision: number; order_hash: string }
/** 개인 주문 → 제품주문 링크(관리자 경계). 학습자 세션이 아니라 서버의 service_role + 실제 관리자 actor 로 실행한다 */
export type ProductLinker = (orderId: string) => Promise<{ ok: true; link_id: string } | Fail>

/**
 * D3 factory_order_link_product 를 그대로 부르는 링커. service 는 service_role 클라이언트, actorId 는 로그인한 실제 관리자.
 * readSignature 는 그 주문의 현재 수요 서명(service SELECT). 링크 RPC 가 개인 계보 현재성 · 서명 · 제품주문 현재성 · spec 을 다시 판정한다.
 */
export function d3Linker(
  service: SupplyClient,
  actorId: string,
  product: ProductOrderRef,
  readSignature: (orderId: string) => Promise<string | null>,
  opts: { quantity: number; reason: string; requestKey: (orderId: string) => string },
): ProductLinker {
  return async (orderId) => {
    const signature = await readSignature(orderId)
    if (!signature) return fail('demand_signature_not_found')
    const r = await call<string>(service, 'factory_order_link_product', {
      p_actor: actorId, p_order: orderId, p_id: product.product_order_id, p_revision: product.order_revision, p_hash: product.order_hash,
      p_signature: signature, p_quantity: opts.quantity, p_reason: opts.reason, p_request: opts.requestKey(orderId),
    })
    return r.ok ? { ok: true, link_id: r.data } : r
  }
}

/**
 * 학습자 본인 세션 — 명시적 줄 · 주문으로 공급 기록. 주문이 없으면 그 줄에 연다.
 * 공급 전 link 로 그 주문을 등록 후보의 제품주문에 잇는다(현재 계보가 아니면 링크가 거절된다).
 * 납품 RPC 는 주문 행을 잠근 채 계보 · 링크 · 제품주문 현재성을 다시 확인한다(TOCTOU 방지).
 */
export async function receiveForLearner(
  learner: SupplyClient,
  link: ProductLinker,
  req: { lineId: string; orderId?: string | null; quantity: number; qualificationId: string; approvalId: string; orderKey: string; deliveryKey: string },
): Promise<{ ok: true; order_id: string; delivery_id: string } | Fail> {
  let orderId = req.orderId ?? null
  if (!orderId) {
    // 줄의 첫 주문 사유는 'initial' 이어야 한다(I1-P). 재주문은 orderId 를 명시해 기존 주문으로 받는다
    const o = await call<string>(learner, 'factory_order_open', { p_line: req.lineId, p_reason: 'initial', p_quantity: req.quantity, p_request_key: req.orderKey })
    if (!o.ok) return o
    orderId = o.data
  }
  const l = await link(orderId)
  if (!l.ok) return l
  const d = await call<string>(learner, 'workspace_delivery_record', {
    p_line: req.lineId, p_order: orderId, p_qualification: req.qualificationId, p_approval: req.approvalId, p_request_key: req.deliveryKey,
  })
  if (!d.ok) return d
  return { ok: true, order_id: orderId, delivery_id: d.data }
}
