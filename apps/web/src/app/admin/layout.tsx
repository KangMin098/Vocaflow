// apps/web/src/app/admin/layout.tsx

import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * 미처리 신고 건수.
 *
 * ⚠️ `count ?? 0` 금지 — head:true 요청은 **없는 테이블에도** 204 · error=null · count=null 을
 * 돌려준다. 0 으로 뭉개면 배지가 영원히 숨고, 관리자는 "신고 0건" 이라는 거짓 안심을 읽는다.
 * (`lib/admin/dashboard-stats.ts` 의 safeCount 가 같은 함정을 명문화해 뒀다.)
 * 지금 `reports` 테이블은 존재하지 않으므로 여기서 돌아오는 값은 항상 null 이고,
 * 배지는 "0 이라서" 가 아니라 **"셀 곳이 없어서"** 숨는다. 그 구분을 코드에 남긴다.
 *
 * @returns 건수, 또는 셀 수 없으면 null
 */
async function fetchPendingReportsCount(): Promise<number | null> {
  try {
    // 생성 타입에 `reports` 가 없다 — 테이블이 존재하지 않기 때문이다(그게 이 함수의 요점).
    // 타입을 넓혀 질의는 하되, 없으면 null 로 돌아온다.
    const client = (await createClient()) as unknown as SupabaseClient
    const { count, error } = await client
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
    if (error) return null
    return count
  } catch {
    return null
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 미들웨어(`src/middleware.ts`)가 이미 /admin/* 을 막지만 여기서 한 번 더 세운다.
  // 미들웨어 matcher 는 한 줄 정규식이라 예외를 하나 더할 때마다 admin 이 통째로 새어 나갈 수
  // 있고, 그때 유일한 방어가 각 화면의 개별 가드가 된다 — 실제로 8개 화면은 'use client' 라
  // 가드를 부를 수 없었다. 세그먼트 레이아웃은 그 8개까지 한 번에 덮는 유일한 지점이다.
  await requireAdmin()

  const reportsBadge = await fetchPendingReportsCount()

  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <AdminSidebar reportsBadge={reportsBadge} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
