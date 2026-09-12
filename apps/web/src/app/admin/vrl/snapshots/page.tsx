// apps/web/src/app/admin/vrl/snapshots/page.tsx
// VRL Pipeline · Level Snapshots Audit (실 구현)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { History, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { fetchVrlSnapshots, type VrlSnapshotsData } from '@/lib/admin/vrl/queries'
import { VrlEmptyNotice, VrlUnreadableNotice } from '../_components/VrlStateNotice'

export const metadata = {
  title: 'VRL Snapshots — Vocaflow Admin',
  description: 'user_level_snapshots 감사 로그',
}

export const revalidate = 60

export default async function VrlSnapshotsPage() {
  await requireAdmin('/admin/vrl/snapshots')
  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={History}
        title="VRL Level Snapshots"
        description="user_level_snapshots audit log. snapshot_type/triggered_by/trigger_details + delta chain 추적 (최근 200건)."
      />
      <AdminScreenHelp screen="vrl-snapshots" className="-mt-4" />
      <Suspense fallback={<Fallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data = await fetchVrlSnapshots(client)
  return <SnapshotsView data={data} />
}

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  initial: { color: 'var(--t3)', bg: 'var(--bg3)' },
  level_change: { color: '#8B5CF6', bg: '#8B5CF61A' },
  scheduled: { color: 'var(--info)', bg: 'var(--info-light)' },
  manual: { color: 'var(--active)', bg: 'var(--warning-light)' },
  reset: { color: 'var(--error)', bg: 'var(--error-light)' },
}

const TRIGGER_BADGE: Record<string, string> = {
  api: 'var(--info)',
  cron: '#8B5CF6',
  admin: 'var(--error)',
  system: 'var(--t3)',
  internal: 'var(--active)',
}

function SnapshotsView({ data }: { data: VrlSnapshotsData }) {
  // "없음" 과 "못 읽음" 은 다른 화면이다. 예전엔 둘 다 헤더만 남은 표였고, 관리자는
  // RLS 거부를 "아직 변경 이력이 없다" 로 읽었다.
  if (data.error) {
    return (
      <VrlUnreadableNotice
        subject="V-Level 변경 이력"
        detail={data.error}
        hint="user_level_snapshots 조회 권한(RLS)과 테이블 존재 여부를 먼저 본다."
        nextStep={{ href: '/admin/vrl/automation', label: '자동화 상태 보기' }}
      />
    )
  }
  if (data.rows.length === 0) {
    return (
      <VrlEmptyNotice
        icon={History}
        title="아직 기록된 레벨 변경이 없습니다"
        body="진단이나 학습 데이터로 V-Level 이 바뀌면 여기에 한 줄씩 쌓입니다. 아직 아무 사용자도 레벨이 움직이지 않았습니다."
        nextStep={{ href: '/admin/vrl/automation', label: '자동화(cron) 상태 확인' }}
      />
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {/* 요약 분포 */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
          <h3 className="mb-2 font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            snapshot_type
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.byType.map((t) => {
              const b = TYPE_BADGE[t.type] ?? { color: 'var(--t3)', bg: 'var(--bg3)' }
              return (
                <span
                  key={t.type}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-display text-[11px] font-[700]"
                  style={{ backgroundColor: b.bg, color: b.color }}
                >
                  {t.type}
                  <span className="font-mono opacity-80">{t.n}</span>
                </span>
              )
            })}
          </div>
        </div>
        <div className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
          <h3 className="mb-2 font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            taken_reason
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.byReason.map((r) => (
              <span
                key={r.reason}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1 font-mono text-[11px] font-[600] text-[var(--t2)]"
              >
                {r.reason}
                <span className="font-display font-[700] text-[var(--t1)]">{r.n}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* row list */}
      <section className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full min-w-[1000px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--bd)] font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              <th className="px-3 py-2">taken_at</th>
              <th className="px-3 py-2">user</th>
              <th className="px-3 py-2">type</th>
              <th className="px-3 py-2">trigger</th>
              <th className="px-3 py-2">reason</th>
              <th className="px-3 py-2 text-center">v_level</th>
              <th className="px-3 py-2 text-center">delta</th>
              <th className="px-3 py-2">source</th>
              <th className="px-3 py-2 text-right">conf</th>
              <th className="px-3 py-2">details</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const tb = r.snapshotType
                ? (TYPE_BADGE[r.snapshotType] ?? { color: 'var(--t3)', bg: 'var(--bg3)' })
                : { color: 'var(--t3)', bg: 'var(--bg3)' }
              const trigColor = r.triggeredBy
                ? (TRIGGER_BADGE[r.triggeredBy] ?? 'var(--t3)')
                : 'var(--t3)'
              return (
                <tr
                  key={r.id}
                  className="border-b border-[var(--bd)] font-body text-[12px] hover:bg-[var(--bg2)]"
                >
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                    {r.takenAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                    {r.userId.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                      style={{ backgroundColor: tb.bg, color: tb.color }}
                    >
                      {r.snapshotType ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]" style={{ color: trigColor }}>
                    {r.triggeredBy ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
                    {r.takenReason}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--t2)]">
                      {r.previousVLevel ?? '·'}
                      <span className="text-[var(--t2)]">→</span>
                      <span className="font-[700] text-[var(--t1)]">{r.vLevel}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <DeltaPill delta={r.vLevelDelta} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
                    {r.source ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--t2)]">
                    {r.confidence != null ? r.confidence.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                    {r.triggerDetailsKeys.length > 0
                      ? r.triggerDetailsKeys.join(', ')
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta == null) {
    return <Minus size={12} className="inline text-[var(--t2)]" aria-label="no delta" />
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-[700] text-[var(--success)]">
        <ArrowUpRight size={11} aria-hidden />+{delta}
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-[700] text-[var(--error-ink)]">
        <ArrowDownRight size={11} aria-hidden />
        {delta}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-[700] text-[var(--t2)]">
      <Minus size={11} aria-hidden />0
    </span>
  )
}

function Fallback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
