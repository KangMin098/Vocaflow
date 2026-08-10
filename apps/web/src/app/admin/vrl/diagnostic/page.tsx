// apps/web/src/app/admin/vrl/diagnostic/page.tsx
// VRL Pipeline · Diagnostic Tests (실 구현)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GraduationCap, FileText, ClipboardList, Clock3 } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { fetchVrlDiagnostic, type VrlDiagnosticData } from '@/lib/admin/vrl/queries'

export const metadata = {
  title: 'VRL Diagnostic — Vocaflow Admin',
  description: 'VRL 진단 테스트/문항 관리',
}

export const revalidate = 60

export default async function VrlDiagnosticPage() {
  await requireAdmin('/admin/vrl/diagnostic')
  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={GraduationCap}
        title="VRL Diagnostic System"
        description="vrl_diagnostic_tests / vrl_diagnostic_questions / user_diagnostic_results — V-Level/Track/Domain 진단 시스템."
      />
      <AdminScreenHelp screen="vrl-diagnostic" className="-mt-4" />
      <Suspense fallback={<Fallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data = await fetchVrlDiagnostic(client)
  return <DiagnosticView data={data} />
}

const TYPE_LABEL: Record<string, string> = {
  base_v_level: 'V-Level 진단',
  track: 'Track 진단',
  domain: 'Domain 진단',
  comprehensive: '종합 진단',
}

function DiagnosticView({ data }: { data: VrlDiagnosticData }) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPI 4 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={FileText}
          label="Tests"
          value={data.totalTests}
          sub={`${data.activeTests} active`}
          accent="#8B5CF6"
          bg="#8B5CF61A"
        />
        <Stat
          icon={ClipboardList}
          label="Questions"
          value={data.totalQuestions}
          sub="전체 문항"
          accent="var(--info)"
          bg="var(--info-light)"
        />
        <Stat
          icon={GraduationCap}
          label="Results"
          value={data.totalResults}
          sub="user 응시"
          accent="var(--success)"
          bg="var(--success-light)"
        />
        <Stat
          icon={Clock3}
          label="평균 분"
          value={
            data.tests.length > 0
              ? Math.round(
                  data.tests.reduce((s, t) => s + t.estimatedMinutes, 0) / data.tests.length,
                )
              : '—'
          }
          sub="estimated_minutes"
          accent="var(--active)"
          bg="var(--warning-light)"
        />
      </section>

      {/* tests list */}
      {data.tests.length === 0 ? (
        <EmptyTests />
      ) : (
        <section className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--bd)] font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                <th className="px-3 py-2">name</th>
                <th className="px-3 py-2">type</th>
                <th className="px-3 py-2">axis</th>
                <th className="px-3 py-2 text-right">questions</th>
                <th className="px-3 py-2 text-right">예상 분</th>
                <th className="px-3 py-2 text-center">active</th>
                <th className="px-3 py-2">created</th>
              </tr>
            </thead>
            <tbody>
              {data.tests.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--bd)] font-body text-[12px] hover:bg-[var(--bg2)]"
                >
                  <td className="px-3 py-2 font-display font-[600] text-[var(--t1)]">
                    {t.nameKo}
                    {t.descriptionKo && (
                      <p className="mt-0.5 font-body text-[10px] text-[var(--t2)]">
                        {t.descriptionKo}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
                    {TYPE_LABEL[t.testType] ?? t.testType}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
                    {t.targetAxis}
                    {t.targetTrackId && <span className="ml-1">· {t.targetTrackId}</span>}
                    {t.targetDomainId && <span className="ml-1">· {t.targetDomainId}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    <span
                      className={
                        t.questionsLoaded < t.questionCount
                          ? 'text-[var(--active)]'
                          : 'text-[var(--success)]'
                      }
                    >
                      {t.questionsLoaded}
                    </span>
                    <span className="text-[var(--t2)]"> / {t.questionCount}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--t2)]">
                    {t.estimatedMinutes}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {t.isActive ? (
                      <span className="inline-flex rounded-full bg-[var(--success-light)] px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--success)]">
                        active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--t2)]">
                        off
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                    {t.createdAt ? t.createdAt.slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 시드 가이드 (운영자 안내) */}
      <section className="rounded-[var(--r-xl)] border border-dashed border-[#8B5CF6]/40 bg-[#8B5CF6]/4 p-5">
        <h3 className="mb-2 font-display text-[13px] font-[700] text-[#8B5CF6]">
          시드 가이드
        </h3>
        <ul className="space-y-1.5 font-body text-[12px] text-[var(--t2)]">
          <li>
            <strong>V-Level 진단</strong>: 12 Level × 3-5 시그니처 단어 (target_v_level
            지정). 분류는 V1~V11 100% 완료(V0=빈 밴드) — 진단 문항은 V1부터 시드.
          </li>
          <li>
            <strong>Track 진단</strong>: 6 tracks × 10 단어 (target_track_id +
            target_track_level).
          </li>
          <li>
            <strong>Domain 진단</strong>: 8 domains × 5 단어 (target_domain_id).
          </li>
          <li>
            결과 적용: <code className="font-mono text-[11px]">analyze_and_apply_diagnostic_result(p_result_id)</code>{' '}
            호출 시 user current_v_level 자동 갱신 + snapshot 자동 INSERT.
          </li>
        </ul>
      </section>
    </div>
  )
}

function EmptyTests() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] py-16 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
        <FileText size={18} aria-hidden />
      </span>
      <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
        등록된 진단 테스트 없음
      </p>
      <p className="font-body text-[12px] text-[var(--t2)]">
        vrl_diagnostic_tests 테이블이 비어 있습니다. 시드 가이드 참고.
      </p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  bg,
}: {
  icon: typeof FileText
  label: string
  value: number | string
  sub: string
  accent: string
  bg: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: bg, color: accent }}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          {label}
        </span>
      </div>
      <p
        className="mt-1 font-display text-[24px] font-[800] leading-tight"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="font-body text-[11px] text-[var(--t2)]">{sub}</p>
    </div>
  )
}

function Fallback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
