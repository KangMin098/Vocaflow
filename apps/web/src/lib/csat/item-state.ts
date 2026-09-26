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
import { pagedSelect } from '@/lib/supabase/paged-select'

// 순수 조각(타입 · 사유 이름 · UNREAD 상수)은 모델이 소유한다 — 화면이 그쪽에서 가져간다.
export * from './item-state-model'
import { UNREAD_ITEM_STATE, type ItemStateView } from './item-state-model'

/**
 * 막힌 문항을 센다.
 *
 * ⚠️ PostgREST 는 집계 함수가 꺼져 있어(`PGRST123`) `group by` 를 못 한다. 막힌 행만
 *   가져와 메모리에서 센다 — 기본값에서 벗어난 문항만 이 표에 있으므로 작다(실측 292행).
 *   그 가정이 깨지면(수만 행) 집계 RPC 를 열어야 하고, 그때는 이 주석이 근거가 된다.
 *
 * ── 고침 2026-09-23 (DD-78) ─────────────────────────────────────────
 * ⚠️ 여기는 `.limit(5000)` 이었고 `rows.length >= 5000` 이면 「적게 센 수」라고 경고했다.
 *   그런데 **PostgREST 응답은 1,000행에서 끊긴다** — 5,000은 애초에 못 받는 수라
 *   그 경고는 **영영 울리지 않고**, 1,001번째부터는 화면이 조용히 적은 수를 정확한 수처럼
 *   적는다. 이 저장소가 가장 싫어하는 모양(`count ?? 0`)과 같은 종류다.
 *   회귀 `row-cap-lies` 가 그 줄을 잡았다 — 스캐너는 처음부터 맞았고, 커밋할 때 그 검사를
 *   안 돌린 것이 문제였다(`src/lib/csat` 만 돌리고 `src/lib/__tests__` 를 빼먹었다).
 *   이제 정본 헬퍼로 **끝까지** 읽는다.
 */
export async function loadItemState(): Promise<ItemStateView> {
  const db = createAdminClient() as unknown as SupabaseClient
  let rows: { reason_code: string }[]
  try {
    rows = await pagedSelect<{ reason_code: string }>(
      (from, to) =>
        db
          .from('csat_item_state')
          .select('reason_code')
          .eq('status', 'blocked')
          // 페이지 경계가 안정적이어야 한 행을 두 번 세지 않는다.
          .order('item_id', { ascending: true })
          .range(from, to),
      '막힌 문항',
    )
  } catch (e) {
    // 표가 없거나 조회가 깨졌다 — **0 으로 적지 않는다.**
    return {
      ...UNREAD_ITEM_STATE,
      error: `문항 상태를 못 읽었다: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.reason_code, (counts.get(r.reason_code) ?? 0) + 1)

  return {
    available: true,
    error: null,
    blocked: rows.length,
    byReason: [...counts.entries()]
      .map(([code, n]) => ({ code, n }))
      .sort((a, b) => b.n - a.n),
  }
}
