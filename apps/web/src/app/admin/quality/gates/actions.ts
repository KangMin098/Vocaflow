// apps/web/src/app/admin/quality/gates/actions.ts
//
// 전역 품질 게이트 — **요청할 때만** 돈다.
//
// ── 왜 서버 액션으로 뺐나 (2026-09-06) ────────────────────────────────
// `run_content_quality_gates('global')` 은 실측 **49,706 ms** 다(EXPLAIN ANALYZE).
// 예전에는 페이지가 이것을 SSR 에서 await 했고, 그래서 **화면이 45초 안에 안 떴다**
// (런타임 전수 훑기가 41화면 중 이 하나를 「네비게이션 실패(타임아웃)」로 잡았다).
//
// Suspense 로 감싸는 것으로는 안 된다 — 스트리밍 SSR 에서 문서는 **모든 경계가 풀려야**
// 끝나고, `DOMContentLoaded` 는 그때 발생한다. 눈에 보이는 것은 빨라져도 "화면이 떴다"
// 는 여전히 50초 뒤다.
//
// 그리고 매 방문마다 50초를 쓰는 것 자체가 낭비였다. 이건 대시보드 숫자가 아니라
// **진단**이다 — 관리자가 "지금 재 봐" 라고 할 때만 돌면 된다. 콘텐츠별 게시 전 체크만
// 하러 온 사람은 이 비용을 아예 치르지 않는다.
//
// service_role 을 쓰는 이유는 페이지와 같다: RPC 안의 `is_admin_or_curator()` 가
// dev 우회 세션(auth.uid()=NULL)에서 막히기 때문. 그래서 `requireAdmin()` 이 먼저 선다.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export interface GateRow {
  pipeline: string
  invariant: string
  severity: 'critical' | 'warning'
  fail_count: number
  verdict: 'PASS' | 'FAIL' | 'WARN'
  detail: Record<string, unknown> | null
}

export type GlobalGatesResult =
  | { ok: true; rows: GateRow[]; tookMs: number }
  | { ok: false; error: string }

export async function runGlobalGates(): Promise<GlobalGatesResult> {
  await requireAdmin('/admin/quality/gates')

  const supabase = createAdminClient() as unknown as SupabaseClient
  const started = Date.now()
  const { data, error } = await supabase.rpc('run_content_quality_gates', { p_scope: 'global' })
  const tookMs = Date.now() - started

  if (error) {
    // 실패를 빈 표로 바꾸지 않는다 — "불변식이 하나도 없다" 와 "못 쟀다" 는 다른 말이다.
    return { ok: false, error: error.message || '(오류 메시지 없음 — 시간초과일 수 있다)' }
  }
  return { ok: true, rows: (data ?? []) as GateRow[], tookMs }
}
