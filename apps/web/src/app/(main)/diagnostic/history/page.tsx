// apps/web/src/app/(main)/diagnostic/history/page.tsx
//
// 진단 history — user_level_snapshots audit chain 시각화
// Server Component: 본인 snapshots 조회 → 클라이언트 timeline 렌더

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HistoryTimeline } from '@/components/diagnostic/HistoryTimeline'

export const metadata = {
  title: '진단 History — Vocaflow',
  description: 'V-Level 변천사 — 진단·학습·수동 갱신 audit chain',
}

export const dynamic = 'force-dynamic'

export default async function DiagnosticHistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="font-body text-[var(--t3)]">로그인이 필요해요.</p>
      </div>
    )
  }

  const { data: snapshots, error } = await supabase
    .from('user_level_snapshots')
    .select(
      'id, v_level, previous_v_level, v_level_delta, taken_reason, taken_at, snapshot_type, triggered_by, v_level_meta, snapshot_meta',
    )
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <Link
          href="/diagnostic"
          className="inline-flex items-center gap-1.5 font-body text-[12px] text-[var(--t3)] hover:text-[var(--t2)]"
        >
          <ArrowLeft size={12} />
          진단으로 돌아가기
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-[800] text-[var(--t1)]">
          V-Level 변천사
        </h1>
        <p className="mt-2 font-body text-[14px] text-[var(--t2)]">
          진단·학습·수동 갱신의 audit chain — 시간 순으로 V-Level 변화 추적
        </p>
      </header>

      {error && (
        <div className="rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-4">
          <p className="font-body text-[var(--error)]">{error.message}</p>
        </div>
      )}

      <HistoryTimeline snapshots={(snapshots ?? []) as unknown as Parameters<typeof HistoryTimeline>[0]['snapshots']} />
    </div>
  )
}
