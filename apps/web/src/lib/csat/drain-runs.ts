// apps/web/src/lib/csat/drain-runs.ts
//
// **「그 명령이 이미 돌았는가」를 화면이 말할 수 있게 하는 읽기 경로.**
//
// 쓰는 쪽은 `scripts/csat/drain-run.mjs`, 그리는 쪽은 `components/admin/csat/StageFrame.tsx`
// 의 `LastRun`. 그 둘 사이가 비어 있어서 표에 행이 0개였고 화면은 늘 「아직 안 돌렸다」였다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DrainRunView } from '@/components/admin/csat/StageFrame'

/** 표 자체가 없을 때 PostgREST 가 내는 코드. 「행이 없다」와 **전혀 다른 뜻**이다. */
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

/**
 * 한 단계의 마지막 드레인 실행.
 *
 * ⚠️ 세 가지 「없음」을 뭉개지 않는다 — 화면이 거짓말하는 건 늘 여기서 시작한다.
 *   - `{ available: false, run: null }` → **표가 없다**(마이그레이션 미적용).
 *   - `{ available: true,  run: null }` → 표는 있고 **한 번도 안 돌렸다**.
 *   - 조회 자체가 실패 → 던진다. 「모른다」를 「안 돌았다」로 바꾸지 않는다.
 */
export async function lastDrainRun(db: SupabaseClient, stage: string): Promise<DrainRunView> {
  const result = await db
    .from('csat_drain_runs')
    .select('mode,status,started_at,items_done,items_total,items_skipped,error')
    .eq('stage', stage)
    .order('started_at', { ascending: false })
    .limit(1)

  if (result.error) {
    if (MISSING_TABLE.has(result.error.code ?? '')) return { available: false, run: null }
    throw new Error(`Drain run history unavailable: ${result.error.message}`)
  }

  const row = result.data?.[0]
  if (!row) return { available: true, run: null }
  return {
    available: true,
    run: {
      mode: row.mode,
      status: row.status,
      startedAt: row.started_at,
      itemsDone: row.items_done,
      itemsTotal: row.items_total,
      // null = 「안 셌다」. 0 으로 채우면 재실행 안전이 깨진 신호(건너뜀 0)와 구별이 사라진다.
      itemsSkipped: row.items_skipped,
      error: row.error,
    },
  }
}
