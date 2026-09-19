// apps/web/src/app/admin/vrl/concerns/page.tsx
// VRL Pipeline · Data Integrity Concerns (실 구현)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { fetchVrlConcerns, type VrlConcernsData } from '@/lib/admin/vrl/queries'

export const metadata = {
  title: 'VRL Concerns — Vocaflow Admin',
  description: 'VRL 데이터 정합 의심 단어 cleanup',
}

export const revalidate = 60

export default async function VrlConcernsPage() {
  await requireAdmin('/admin/vrl/concerns')

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={AlertTriangle}
        title="VRL Concerns"
        description="vrl_data_integrity_concerns — 분류 작업 중 식별된 의심 단어. cleanup 후 resolved 처리."
      />
      <AdminScreenHelp screen="vrl-concerns" className="-mt-4" />
      <Suspense fallback={<Fallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data = await fetchVrlConcerns(client)
  return <ConcernsView data={data} />
}

function ConcernsView({ data }: { data: VrlConcernsData }) {
  if (data.total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] py-16 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
          <CheckCircle2 size={18} aria-hidden />
        </span>
        <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
          의심 단어 없음
        </p>
        <p className="font-body text-[12px] text-[var(--t2)]">
          VRL 분류 작업 중 감지된 정합성 문제가 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI 3 */}
      <section className="grid grid-cols-3 gap-3">
        <Stat
          icon={Inbox}
          label="Open"
          value={data.openCount}
          accent="var(--error)"
          bg="var(--error-light)"
        />
        <Stat
          icon={CheckCircle2}
          label="Resolved"
          value={data.resolvedCount}
          accent="var(--success)"
          bg="var(--success-light)"
        />
        <Stat
          icon={AlertTriangle}
          label="Total"
          value={data.total}
          accent="var(--t2)"
          bg="var(--bg2)"
        />
      </section>

      {/* concern_type 분포 */}
      <section className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
        <h3 className="mb-3 font-display text-[13px] font-[700] text-[var(--t1)]">
          유형별 분포
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.byType.map((t) => (
            <span
              key={t.type}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1 font-mono text-[11px] font-[600] text-[var(--t2)]"
            >
              {t.type}
              <span className="font-display font-[700] text-[var(--t1)]">{t.total}</span>
              {t.open > 0 && (
                <span className="rounded-full bg-[var(--error)] px-2 py-1 font-display text-[9px] font-[700] text-white">
                  {t.open} open
                </span>
              )}
            </span>
          ))}
        </div>
      </section>

      {/* row list */}
      <section className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--bd)] font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              <th className="px-3 py-2">word</th>
              <th className="px-3 py-2">type</th>
              <th className="px-3 py-2">reasoning</th>
              <th className="px-3 py-2">suggested</th>
              <th className="px-3 py-2">detected</th>
              <th className="px-3 py-2 text-center">status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[var(--bd)] font-body text-[12px] hover:bg-[var(--bg2)]"
              >
                <td className="px-3 py-2 font-mono font-[600] text-[var(--t1)]">{r.word}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
                  {r.concernType}
                </td>
                <td className="max-w-[300px] truncate px-3 py-2 text-[var(--t2)]">
                  {r.reasoning ?? '—'}
                </td>
                <td className="px-3 py-2 text-[11px] text-[var(--t2)]">
                  {r.suggestedAction ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                  {r.detectedAt ? r.detectedAt.slice(0, 10) : '—'}
                  {r.detectedDuring && (
                    <span className="ml-1 opacity-70">· {r.detectedDuring}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.resolved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--success)]">
                      <CheckCircle2 size={10} aria-hidden />
                      resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--error-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--error-ink)]">
                      <AlertTriangle size={10} aria-hidden />
                      open
                    </span>
                  )}
                </td>
              </tr>
            ))}
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
  icon: typeof AlertTriangle
  label: string
  value: number
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
        <p className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          {label}
        </p>
        <p
          className="font-display text-[24px] font-[800] leading-tight"
          style={{ color: accent }}
        >
          {value.toLocaleString()}
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
      <div className="h-64 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
