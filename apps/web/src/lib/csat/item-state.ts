// apps/web/src/lib/csat/item-state.ts
//
// **문항 상태 곁 표를 읽는다** — `csat_item_state`.
//
// ── 읽는 쪽의 계약 (⚠️ 이 파일의 요점) ──────────────────────────────
//   행이 **없으면** `usable` 이다. **행 없음을 0 으로 세지 않는다.**
//   「막힌 문항 0」과 「저장소를 못 읽었다」를 뭉개면 그것이 곧 거짓 안심이고,
//   이 저장소의 지배적 결함 유형이다(`count ?? 0`).
//
// 이 표는 새로 판단하지 않는다 — `scripts/textbook/item-state-sync.mjs` 가 이미 있는
// 검수 판정에서 **파생**해 채운다. 그래서 여기 있는 수는 ⑦ 검수가 말하는 수와 같아야 한다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

// 순수 조각(타입 · 사유 이름 · UNREAD 상수)은 모델이 소유한다 — 화면이 그쪽에서 가져간다.
export * from './item-state-model'
import { UNREAD_ITEM_STATE, type ItemStateView } from './item-state-model'

/**
 * 막힌 문항을 센다.
 *
 * ⚠️ PostgREST 는 집계 함수가 꺼져 있어(`PGRST123`) `group by` 를 못 한다. 막힌 행만
 *   가져와 메모리에서 센다 — 기본값에서 벗어난 문항만 이 표에 있으므로 작다(실측 292행).
 *   그 가정이 깨지면(수만 행) 집계 RPC 를 열어야 하고, 그때는 이 주석이 근거가 된다.
 */
export async function loadItemState(): Promise<ItemStateView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await db
    .from('csat_item_state')
    .select('reason_code')
    .eq('status', 'blocked')
    // 상한을 둔다 — 넘치면 「못 잼」이 아니라 **적게 센 수**가 되므로 아래에서 경고한다.
    .limit(5000)

  if (error) {
    // 표가 없거나 조회가 깨졌다 — **0 으로 적지 않는다.**
    return { ...UNREAD_ITEM_STATE, error: `문항 상태를 못 읽었다: ${error.message}` }
  }

  const rows = (data ?? []) as { reason_code: string }[]
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.reason_code, (counts.get(r.reason_code) ?? 0) + 1)

  return {
    available: true,
    error:
      rows.length >= 5000
        ? '막힌 문항이 5,000행 상한에 닿았다 — 아래 수는 실제보다 적다. 집계 RPC 가 필요하다'
        : null,
    blocked: rows.length,
    byReason: [...counts.entries()]
      .map(([code, n]) => ({ code, n }))
      .sort((a, b) => b.n - a.n),
  }
}
