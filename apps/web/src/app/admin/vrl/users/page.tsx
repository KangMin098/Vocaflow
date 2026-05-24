// apps/web/src/app/admin/vrl/users/page.tsx
// VRL Pipeline · User V-Levels (실 구현)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Users, GraduationCap, Clock3 } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { fetchVrlUsers, type VrlUsersData } from '@/lib/admin/vrl/queries'

export const metadata = {
  title: 'VRL Users — Vocaflow Admin',
  description: '사용자 V-Level 분포 + 상세',
}

export const revalidate = 60

export default async function VrlUsersPage() {
  await requireAdmin('/admin/vrl/users')
  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={Users}
        title="VRL User Levels"
        description="user_profiles.current_v_level + meta JSONB 기반. 진단 완료/source/last_active 추적."
      />
      <Suspense fallback={<Fallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data = await fetchVrlUsers(client)
  return <UsersView data={data} />
}

const SOURCE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  system_default: { label: 'system', color: 'var(--t3)', bg: 'var(--bg3)' },
  self_declared: { label: '자가선언', color: 'var(--info)', bg: 'var(--info-light)' },
  diagnostic: { label: '진단', color: 'var(--success)', bg: 'var(--success-light)' },
  learning_data: { label: '학습', color: '#8B5CF6', bg: '#8B5CF61A' },
  manual_override: { label: '관리자', color: 'var(--error)', bg: 'var(--error-light)' },
}

function UsersView({ data }: { data: VrlUsersData }) {
  const diagPct = data.total > 0 ? Math.round((data.diagnosticDone / data.total) * 100) : 0
  const maxLevelCount = Math.max(1, ...data.byLevel)

  return (
    <div className="flex flex-col gap-4">
      {/* KPI */}
      <section className="grid grid-cols-3 gap-3">
        <Stat icon={Users} label="총 사용자" value={data.total} accent="#8B5CF6" bg="#8B5CF61A" />
        <Stat
          icon={GraduationCap}
          label="진단 완료"
          value={`${data.diagnosticDone} (${diagPct}%)`}
          accent="var(--success)"
          bg="var(--success-light)"
        />
        <Stat
          icon={Clock3}
          label="평균 V-Level"
          value={
            data.total > 0
              ? (
                  data.byLevel.reduce((s, n, i) => s + n * i, 0) /
                  Math.max(1, data.total)
                ).toFixed(1)
              : '—'
          }
          accent="var(--info)"
          bg="var(--info-light)"
        />
      </section>

      {/* V-Level 분포 */}
      <section className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
        <h3 className="mb-3 font-display text-[13px] font-[700] text-[var(--t1)]">
          V-Level 분포 (전체 {data.total} users)
        </h3>
        <div className="grid grid-cols-12 gap-1.5">
          {data.byLevel.map((n, i) => {
            const h = Math.round((n / maxLevelCount) * 60) + 4
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="relative flex h-[68px] w-full items-end justify-center">
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-[#8B5CF6] to-[#A78BFA]"
                    style={{ height: `${h}px` }}
                    aria-label={`L${i}: ${n}명`}
                  />
                </div>
                <span className="font-mono text-[10px] font-[700] text-[var(--t2)]">
                  L{i}
                </span>
                <span className="font-mono text-[9px] text-[var(--t3)]">{n}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* user 목록 */}
      <section className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--bd)] font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
              <th className="px-3 py-2">user_id</th>
              <th className="px-3 py-2">segment</th>
              <th className="px-3 py-2 text-center">V-Level</th>
              <th className="px-3 py-2">CEFR</th>
              <th className="px-3 py-2">source</th>
              <th className="px-3 py-2 text-right">conf</th>
              <th className="px-3 py-2">goal</th>
              <th className="px-3 py-2 text-right">seen / mastered</th>
              <th className="px-3 py-2 text-center">진단</th>
              <th className="px-3 py-2">last active</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((u) => {
              const sb =
                u.source && SOURCE_BADGE[u.source]
                  ? SOURCE_BADGE[u.source]
                  : { label: u.source ?? '—', color: 'var(--t3)', bg: 'var(--bg3)' }
              return (
                <tr
                  key={u.userId}
                  className="border-b border-[var(--bd)] font-body text-[12px] hover:bg-[var(--bg2)]"
                >
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t3)]">
                    {u.userId.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2 text-[var(--t2)]">{u.segment ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#8B5CF6]/10 font-display text-[11px] font-[700] text-[#8B5CF6]">
                      {u.currentVLevel ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] font-[700] text-[var(--p)]">
                    {u.cefrLevel ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 font-display text-[10px] font-[700]"
                      style={{ backgroundColor: sb.bg, color: sb.color }}
                    >
                      {sb.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--t2)]">
                    {u.confidence != null ? u.confidence.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[var(--t3)]">
                    {u.learningGoal ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--t2)]">
                    {(u.totalWordsSeen ?? 0).toLocaleString()} /{' '}
                    <span className="font-[700] text-[var(--success)]">
                      {(u.totalWordsMastered ?? 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {u.diagnosticCompletedAt ? (
                      <span className="font-mono text-[10px] text-[var(--success)]">
                        ✓ {u.diagnosticCompletedAt.slice(0, 10)}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--t4)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t3)]">
                    {u.lastActiveAt ? u.lastActiveAt.slice(0, 10) : '—'}
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

function Stat({
  icon: Icon,
  label,
  value,
  accent,
  bg,
}: {
  icon: typeof Users
  label: string
  value: number | string
  accent: string
  bg: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)]"
        style={{ backgroundColor: bg, color: accent }}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
          {label}
        </p>
        <p
          className="font-display text-[22px] font-[800] leading-tight"
          style={{ color: accent }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function Fallback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
      <div className="h-64 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
