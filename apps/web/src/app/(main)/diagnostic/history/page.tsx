// apps/web/src/app/(main)/diagnostic/history/page.tsx
//
// 진단 history — user_level_snapshots audit chain 시각화
// Server Component: 본인 snapshots 조회 → 클라이언트 timeline 렌더

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card, Screen } from '@/components/ui/ios'
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
      <Screen width="content" background="bg2" padX="md">
        <div className="py-8">
          <p className="font-body text-[var(--t3)]">로그인이 필요해요.</p>
        </div>
      </Screen>
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
    <Screen width="content" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="px-1">
          <Link
            href="/diagnostic"
            className="inline-flex items-center gap-1.5 font-display text-[13px] font-[600] text-[var(--p)] transition-colors duration-[var(--dur-ios-fast)] hover:text-[var(--p-hover)]"
          >
            <ArrowLeft size={14} aria-hidden />
            진단으로 돌아가기
          </Link>
          <h1 className="mt-3 font-display text-[28px] font-[800] tracking-[-0.025em] text-[var(--t1)] md:text-[32px]">
            V-Level 변천사
          </h1>
          <p className="mt-2 font-body text-[14px] text-[var(--t2)]">
            진단·학습·수동 갱신의 audit chain — 시간 순으로 V-Level 변화 추적
          </p>
        </header>

        {error && (
          <Card size="md" elevation={1}>
            <p className="font-body text-[var(--ios-red)]">{error.message}</p>
          </Card>
        )}

        <Card size="lg">
          <HistoryTimeline snapshots={(snapshots ?? []) as unknown as Parameters<typeof HistoryTimeline>[0]['snapshots']} />
        </Card>
      </div>
    </Screen>
  )
}
