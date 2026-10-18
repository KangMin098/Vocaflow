// apps/web/src/lib/csat/map/v62/delivery-binding.ts
//
// R5 §6 — G2 시도 한 건을 그 학습자 본인의 납품에 결속한다(workspace_delivery_attempt_record · 20261018120100).
// 시도 기록(service_role)이 끝난 뒤 **학습자 세션**으로 부른다 — RPC 는 auth.uid() 로 납품 · 시도 소유를 다시 확인한다.
// 판정(첫 노출 · 도움 상태 · 근거 여부 · 철회/대체)은 전부 DB 가 한다. 여기서는 대상 찾기와 멱등 요청 키만 만든다.
// 결속 실패는 시도 기록을 되돌리지 않는다(기록은 이미 남았다) — 상태만 돌려준다. 납품이 없으면(대부분의 풀이) 아무것도 하지 않는다.
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

export type BindingStatus = 'not_installed' | 'no_delivery' | 'bound' | 'error'

const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883'])
const codeOf = (e: unknown) => (e as { code?: string } | null)?.code

/** 같은 제출(clientMutationId)의 재시도는 같은 요청 키 — DB 가 같은 결속 id 를 돌려준다 */
export function bindingRequestKey(userId: string, clientMutationId: string): string {
  const h = createHash('sha256').update(`r5-delivery-attempt|${userId}|${clientMutationId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export async function bindDeliveryAttempt(
  learner: SupabaseClient,
  input: { userId: string; itemRef: string; clientMutationId: string },
): Promise<{ status: BindingStatus; id?: string }> {
  const d = await learner.from('workspace_content_delivery').select('id, delivered_at')
    .eq('user_id', input.userId).eq('artifact_kind', 'csat_item').eq('artifact_ref', input.itemRef)
    .order('delivered_at', { ascending: false }).limit(1)
  if (d.error) return { status: MISSING.has(codeOf(d.error) ?? '') ? 'not_installed' : 'error' }
  const delivery = (d.data as { id: string }[] | null)?.[0]
  if (!delivery) return { status: 'no_delivery' }
  const a = await learner.from('learning_task_attempts').select('id')
    .eq('user_id', input.userId).eq('item_ref', input.itemRef).eq('client_mutation_id', input.clientMutationId).limit(2)
  const rows = (a.data as { id: number | string }[] | null) ?? []
  // 시도 행을 못 찾거나 같은 제출 id 가 둘 이상이면 어느 것을 결속할지 모른다 — 추측하지 않는다
  if (a.error || rows.length !== 1) return { status: 'error' }
  const r = await learner.rpc('workspace_delivery_attempt_record', {
    p_delivery: delivery.id, p_attempt: Number(rows[0].id), p_request_key: bindingRequestKey(input.userId, input.clientMutationId),
  })
  if (r.error) return { status: MISSING.has(codeOf(r.error) ?? '') ? 'not_installed' : 'error' }
  return typeof r.data === 'string' ? { status: 'bound', id: r.data } : { status: 'error' }
}
