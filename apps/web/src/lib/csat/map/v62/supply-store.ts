// apps/web/src/lib/csat/map/v62/supply-store.ts
//
// v6.2 P-F8e — 영속 주문 · 공급 기록 읽기(서버 전용 · 읽기만). 표(승인안 B)가 없으면 'not_installed', 실패는 'error' —
// 둘 다 화면에서 「주문됨 · 공급 완료」를 만들지 않는다(`supply-ledger.ts`).
// 소유: 사용자 id 는 인증 세션에서 온 값만 받고, 모든 행을 user_id 로 거른다. Workspace 는 그 사용자의 열린 것만.
// 클라이언트가 보낸 자격 · 승인 · 주문 상태는 받지 않는다 — 여기서 읽은 값이 유일한 근거다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { OrderState } from './persist-contract'
import { ledgerKey, type LedgerLine, type SupplyLedger } from './supply-ledger'
import type { MaterialRole } from './demand'

const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])

export async function loadSupplyLedger(db: SupabaseClient, userId: string, workspaceId: string | null): Promise<SupplyLedger> {
  if (!workspaceId) return { status: 'installed', lines: {} }
  const probe = await db.from('factory_order').select('id', { head: true, count: 'exact' }).limit(1)
  if (probe.error) return probe.error.code && MISSING.has(probe.error.code) ? { status: 'not_installed' } : { status: 'error' }

  const ws = await db.from('learner_workspace').select('id').eq('id', workspaceId).eq('user_id', userId).neq('status', 'closed').maybeSingle()
  if (ws.error) return { status: 'error' }
  if (!ws.data) return { status: 'installed', lines: {} } // 남의 · 닫힌 Workspace — 기록을 보이지 않는다

  const [lines, orders, deliveries] = await Promise.all([
    db.from('workspace_content_demand_line').select('id, role, task_id, quantity, workspace_content_demand!inner(canonical)').eq('user_id', userId).eq('workspace_id', workspaceId),
    db.from('factory_order').select('line_id, state, order_seq').eq('user_id', userId).eq('workspace_id', workspaceId),
    db.from('workspace_content_delivery').select('line_id').eq('user_id', userId).eq('workspace_id', workspaceId),
  ])
  if (lines.error || orders.error || deliveries.error) return { status: 'error' }

  const byLine = new Map<string, { role: MaterialRole; task: string; canonical: string }>()
  for (const l of lines.data ?? []) {
    const parent = l.workspace_content_demand as unknown as { canonical?: string } | null
    if (typeof parent?.canonical !== 'string' || !parent.canonical) return { status: 'error' }
    byLine.set(l.id as string, { role: l.role as MaterialRole, task: l.task_id as string, canonical: parent.canonical })
  }
  const out: Record<string, LedgerLine> = {}
  const at = (lineId: string): LedgerLine | null => {
    const l = byLine.get(lineId)
    if (!l) return null
    return (out[ledgerKey(l.task, l.role, l.canonical)] ??= { order: null, delivered: 0 })
  }
  for (const o of orders.data ?? []) {
    const rec = at(o.line_id as string)
    if (rec && (!rec.order || (o.order_seq as number) > rec.order.seq)) rec.order = { state: o.state as OrderState, seq: o.order_seq as number }
  }
  const delivered = new Set<string>()
  for (const d of deliveries.data ?? []) {
    const rec = at(d.line_id as string)
    if (rec) { rec.delivered++; delivered.add(d.line_id as string) }
  }
  // I1-P — 공급 행이 있는 줄만 서버 충족도(유효 공급 · 남은 부족)를 읽는다. 함수가 없으면(P 미적용) null = 수량 확인 전, 그 밖의 오류는 'error'
  for (const lineId of delivered) {
    const l = byLine.get(lineId)!
    const rec = out[ledgerKey(l.task, l.role, l.canonical)]!
    const f = await db.rpc('workspace_line_fulfillment', { p_line: lineId })
    if (f.error) {
      if (f.error.code && MISSING.has(f.error.code)) { rec.requested = null; rec.validDelivered = null; continue }
      return { status: 'error' }
    }
    const row = (Array.isArray(f.data) ? f.data[0] : f.data) as { requested: number; delivered_valid: number } | undefined
    // 한 수요의 (TASK, 역할)은 DB unique. 이전 PLAN/수요의 공급·주문 seq를 합치지 않는다.
    rec.requested = row?.requested ?? null
    rec.validDelivered = row?.delivered_valid ?? null
  }
  return { status: 'installed', lines: out }
}
