// apps/web/src/app/admin/csat/sourcing/actions.ts
//
// **「지금 다시 잰다」 — 크론과 같은 함수를 부른다.**
//
// 스냅샷은 6시간마다 크론(`csat-source-snapshot`, `20 */6 * * *`)이 뜬다. 드레인을 막 돌린
// 관리자에게 여섯 시간은 너무 길고, 그때 화면이 「안 늘었다」로 보이면 안 해도 될 일을 또 한다.
// 그래서 버튼이 **같은 RPC** 를 부른다 — 두 경로가 다른 셈법을 쓰면 값이 갈린다
// (마이그레이션 `20260906200000` 의 함수 주석이 이 버튼을 전제로 쓰였다).
//
// **재실행 안전**: 같은 시점을 여러 번 떠도 행만 늘고, 함수가 60행 넘는 과거를 스스로 지운다.
// 전수 훑기라 실측 1.4~2.6초 걸린다 — 그동안 버튼은 눌려 있으면 안 된다(화면이 막는다).

'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RetakeResult {
  ok: boolean
  takenAt?: string
  durationMs?: number
  error?: string
}

export async function retakeSourceSnapshotAction(): Promise<RetakeResult> {
  await requireAdmin('/admin/csat/sourcing')

  const db = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await db.rpc('csat_source_snapshot_take', { p_by: 'admin' })

  // 실패를 던지지 않고 결과값으로 돌려준다 — `/admin/db` 에서 배운 것이다. 예외로 올리면
  // 화면은 빈 오류 화면이 되고 **무엇이 실패했는지**가 사라진다.
  if (error) return { ok: false, error: error.message }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { taken_at?: string; duration_ms?: number }
    | null

  revalidatePath('/admin/csat/sourcing')
  revalidatePath('/admin/csat')
  return { ok: true, takenAt: row?.taken_at, durationMs: row?.duration_ms }
}
