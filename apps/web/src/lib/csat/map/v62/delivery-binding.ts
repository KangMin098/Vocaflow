// apps/web/src/lib/csat/map/v62/delivery-binding.ts
//
// R5 §6 — G2 시도 한 건을 그 학습자 본인의 납품에 결속한다(workspace_delivery_attempt_record · 20261018120100).
// 시도 기록(service_role)이 끝난 뒤 **학습자 세션**으로 부른다 — RPC 는 auth.uid() 로 납품 · 시도 소유를 다시 확인한다.
//
// FI-001(#293) — 결속 대상은 **수행이 시작된 납품(명시 delivery id)** 이다. 최신 납품을 추측하지 않는다:
//   같은 문항이 Workspace A(혼자 확인) · B(전이)에 각각 납품됐을 때 「가장 최근 행」을 고르면 B 에 영구 결속돼(attempt_id UNIQUE)
//   A 의 PLAN 근거가 사라진다. 그래서:
//   · deliveryId 가 없으면 결속하지 않는다 — 납품이 있으면 'no_provenance'(기록 보존 · 나중에 명시 id 로 복구), 없으면 'no_delivery'.
//   · deliveryId 가 있으면 서버가 다시 확인한다: 본인 납품 · 같은 산출물 종류 · 같은 문항 · Workspace active. 어긋나면 'invalid_delivery'.
//   · 시도 모양(activity · phase · 도움)과 납품 역할이 맞지 않으면 결속하지 않는다('role_mismatch') — 잘못된 역할로 영구 결속되지 않게.
//     (DB 는 맞지 않는 결속도 비근거로 「기록」한다 — 앱은 그 전에 멈춰 올바른 납품으로 복구할 길을 남긴다)
//   · 같은 제출 재전송(요청 키)은 처음 결속을 그대로 돌려준다(멱등).
// 판정(첫 노출 · 도움 상태 · 근거 여부 · 철회/대체)은 전부 DB 가 한다. 결과의 evidence/reason 을 함께 돌려줘 화면이 「결속됨」과 「근거로 셈」을 구분한다.
// 결속 실패는 시도 기록을 되돌리지 않는다 — 상태만 돌려준다.
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

export type BindingStatus =
  | 'not_installed' | 'no_delivery' | 'no_provenance' | 'invalid_delivery' | 'role_mismatch' | 'bound' | 'error'
  /** FI-011 바로잡기 연습 — 결속하지 않음(첫 독립 시도 · G2 불변) */
  | 'repair_practice'

export interface BindingResult {
  status: BindingStatus
  id?: string
  deliveryId?: string
  /** bound 일 때만 — DB 가 근거로 셌나 · 비근거 사유 */
  evidence?: boolean
  reason?: string | null
}

const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883'])
const codeOf = (e: unknown) => (e as { code?: string } | null)?.code
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ASSESS_INDEPENDENT = new Set(['independent_check', 'delayed_check'])

/** 같은 제출(clientMutationId)의 재시도는 같은 요청 키 — DB 가 같은 결속 id 를 돌려준다 */
export function bindingRequestKey(userId: string, clientMutationId: string): string {
  const h = createHash('sha256').update(`r5-delivery-attempt|${userId}|${clientMutationId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** 납품 역할에 맞는 시도 모양인가 — DB 도움 상태 규칙(practice · helped · independent · transfer)과 같은 기준. 도움 받은 시도는 역할과 무관하게 결속(비근거로 남는다) */
export function shapeFitsRole(role: string, a: { activity: string | null; phase: string | null; help_level: string | null }): boolean {
  if (a.activity === 'practice') return !ASSESS_INDEPENDENT.has(role) && role !== 'transfer'
  if (a.help_level !== 'independent') return true
  if (a.activity === 'theater' && a.phase === 'transfer') return role === 'transfer'
  if (a.activity === 'theater' && a.phase === 'practice') return ASSESS_INDEPENDENT.has(role)
  return false
}

async function readBound(learner: SupabaseClient, userId: string, id: string): Promise<BindingResult> {
  const r = await learner.from('workspace_delivery_attempt').select('id, delivery_id, evidence, non_evidence_reason').eq('user_id', userId).eq('id', id).limit(1)
  const row = (r.data as { id: string; delivery_id: string; evidence: boolean; non_evidence_reason: string | null }[] | null)?.[0]
  return row ? { status: 'bound', id: row.id, deliveryId: row.delivery_id, evidence: row.evidence, reason: row.non_evidence_reason } : { status: 'bound', id }
}

export async function bindDeliveryAttempt(
  learner: SupabaseClient,
  input: { userId: string; itemRef: string; clientMutationId: string; artifactKind?: 'csat_item' | 'authored_item'; deliveryId?: string | null },
): Promise<BindingResult> {
  const kind = input.artifactKind ?? 'csat_item'
  // 재전송 — 같은 요청 키의 결속이 이미 있으면 그대로 돌려준다(그 사이 다른 납품이 생겨도 최초 delivery 를 유지 · Codex P2)
  const key = bindingRequestKey(input.userId, input.clientMutationId)
  const prev = await learner.from('workspace_delivery_attempt').select('id').eq('user_id', input.userId).eq('request_key', key).limit(1)
  if (prev.error) return { status: MISSING.has(codeOf(prev.error) ?? '') ? 'not_installed' : 'error' }
  const done = (prev.data as { id: string }[] | null)?.[0]
  if (done) return readBound(learner, input.userId, done.id)

  if (!input.deliveryId) {
    // 출처 없음 — 추측하지 않는다. 납품이 있었는지만 구분해 복구 가능 상태를 남긴다(FI-001)
    const any = await learner.from('workspace_content_delivery').select('id').eq('user_id', input.userId).eq('artifact_kind', kind).eq('artifact_ref', input.itemRef).limit(1)
    if (any.error) return { status: MISSING.has(codeOf(any.error) ?? '') ? 'not_installed' : 'error' }
    return { status: ((any.data as unknown[] | null) ?? []).length > 0 ? 'no_provenance' : 'no_delivery' }
  }
  if (!UUID.test(input.deliveryId)) return { status: 'invalid_delivery' }
  const d = await learner.from('workspace_content_delivery').select('id, role, workspace_id, artifact_kind, artifact_ref')
    .eq('id', input.deliveryId).eq('user_id', input.userId).limit(1)
  if (d.error) return { status: MISSING.has(codeOf(d.error) ?? '') ? 'not_installed' : 'error' }
  const delivery = (d.data as { id: string; role: string; workspace_id: string; artifact_kind: string; artifact_ref: string }[] | null)?.[0]
  if (!delivery || delivery.artifact_kind !== kind || delivery.artifact_ref !== input.itemRef) return { status: 'invalid_delivery' }
  const w = await learner.from('learner_workspace').select('id').eq('id', delivery.workspace_id).eq('user_id', input.userId).eq('status', 'active').limit(1)
  if (w.error || ((w.data as unknown[] | null) ?? []).length !== 1) return { status: 'invalid_delivery' }

  const a = await learner.from('learning_task_attempts').select('id, activity, phase, help_level')
    .eq('user_id', input.userId).eq('item_ref', input.itemRef).eq('client_mutation_id', input.clientMutationId).limit(2)
  const rows = (a.data as { id: number | string; activity: string | null; phase: string | null; help_level: string | null }[] | null) ?? []
  // 시도 행을 못 찾거나 같은 제출 id 가 둘 이상이면 어느 것을 결속할지 모른다 — 추측하지 않는다
  if (a.error || rows.length !== 1) return { status: 'error' }
  if (!shapeFitsRole(delivery.role, rows[0])) return { status: 'role_mismatch', deliveryId: delivery.id }
  const r = await learner.rpc('workspace_delivery_attempt_record', {
    p_delivery: delivery.id, p_attempt: Number(rows[0].id), p_request_key: key,
  })
  if (r.error) return { status: MISSING.has(codeOf(r.error) ?? '') ? 'not_installed' : 'error', deliveryId: delivery.id }
  return typeof r.data === 'string' ? readBound(learner, input.userId, r.data) : { status: 'error', deliveryId: delivery.id }
}
