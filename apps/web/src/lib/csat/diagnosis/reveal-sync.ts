// apps/web/src/lib/csat/diagnosis/reveal-sync.ts
//
// **공개 전이 뒤 스냅샷 따라잡기 — 비동기 후속일 뿐, 공개 판정이 아니다.**
// 보류(capture held · collecting) 동안 저장된 기록은 진단 입력에서 빠진다(server.ts). capture 가 completed · closed_incomplete 로
// 넘어가 시험이 공개되면, 그 기록을 품은 스냅샷이 아직 없으므로 여기서 한 번 다시 쌓는다.
//
// DB 의 `csat_ec_reveal_outbox` 는 service_role 권한도 회수된 표(FORCE RLS)라 앱이 읽을 수 없다 — 새 DB 객체를 만들지 않고
// 같은 일을 **워터마크 비교**로 한다: 지금 보이는 기록의 마지막 저장 시각 > 최신 스냅샷의 inputs_as_of 면 재계산.
//   · 공개 여부는 언제나 embargo-gate(DB 상태)가 정한다. 이 함수가 실패해도 보류로 되돌리지 않는다(던지지 않고 'failed').
//   · 재실행 안전: 재계산한 스냅샷의 inputs_as_of 가 그 워터마크가 되므로 다음 호출은 'fresh' 다. 동시 호출은 스냅샷 한 행이 더 쌓일 뿐.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { userHasHeldSession } from '../embargo-gate'
import { loadSessionsWithWatermark, recomputeSnapshot } from './server'

export type RevealSyncResult = 'held' | 'fresh' | 'recomputed' | 'failed'

export async function syncRevealedSnapshot(db: SupabaseClient, userId: string, now: Date): Promise<RevealSyncResult> {
  try {
    // 보류가 하나라도 있으면 아무것도 하지 않는다(그동안의 스냅샷은 보류 기록을 빼고 계산됐다 — 공개 뒤에 따라잡는다)
    if (await userHasHeldSession(userId)) return 'held'
    const { sessions, watermark } = await loadSessionsWithWatermark(db, userId)
    if (sessions.length === 0 || watermark === null) return 'fresh'
    const { data, error } = await db.from('csat_dx_snapshot').select('inputs_as_of').eq('user_id', userId)
      .order('inputs_as_of', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    const asOf = (data as { inputs_as_of: string | null } | null)?.inputs_as_of ?? null
    if (asOf !== null && Date.parse(asOf) >= Date.parse(watermark)) return 'fresh'
    await recomputeSnapshot(db, userId, 'session', now)
    return 'recomputed'
  } catch (e) {
    console.error('[csat-reveal-sync] 공개 뒤 스냅샷 따라잡기 실패(공개 상태는 그대로 · 다음 방문에 다시)', e instanceof Error ? e.message : String(e))
    return 'failed'
  }
}
