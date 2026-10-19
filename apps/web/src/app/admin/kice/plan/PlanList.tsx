// apps/web/src/app/admin/kice/plan/PlanList.tsx
import Link from 'next/link'
import { ReportText } from '@/components/csat/ReportText'
import type { CsatPlanRow } from '@/lib/csat/learner'
import { KICE_SCOPE, withScope, type CsatScope } from '@/lib/csat/scope'

/** Shared exam analysis. A logged-in administrator's learning history is not this scope. */
export function PlanList({ rows, scope = KICE_SCOPE }: { rows: CsatPlanRow[]; scope?: CsatScope }) {
  return (
    <div>
      <p className="mb-3 break-keep text-xs text-[var(--t2)]">공용 분석 · 시험 번호 순서입니다. 학습자 개인 계획과 수행 기록은 학습자 기록에서 확인합니다.</p>
      <ol className="space-y-2">
        {rows.map(row => (
          <li key={row.no} className="rounded-[var(--r-md)] border border-[var(--bd)] p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-bold tabular-nums">{row.no}번</span>
              <Link href={withScope(`/admin/kice/${row.type_id}`, scope)} className="inline-flex min-h-11 items-center text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]">
                {row.type_name}
              </Link>
              <span className="ml-auto text-xs tabular-nums text-[var(--t3)]">{row.points ? `${row.points}점` : ''}{row.time_budget_sec ? ` · ${row.time_budget_sec}초` : ''}</span>
            </div>
            {row.first_step ? <ReportText text={row.first_step} className="mt-2 text-sm" /> : <p className="mt-2 text-sm text-[var(--t3)]">절차 준비 중</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
