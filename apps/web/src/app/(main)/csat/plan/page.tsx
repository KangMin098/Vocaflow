// apps/web/src/app/(main)/csat/plan/page.tsx
//
// **한 회차 주파 계획** — 유형 분석을 번호 순서로 늘어놓은 것.
//
// 유형별 분석을 낱개로 읽는 것과, 그것을 시험 순서로 늘어놓는 것은 다른 물건이다.
// 시험장에서 만나는 것은 유형 목록이 아니라 18번부터 45번까지의 줄이고, 그 줄을 시간 안에
// 통과할 수 있는지가 99점의 실제 조건이다.
//
// 그래서 이 화면은 **시간 예산 합계를 시험 시간과 나란히 적는다.** 합이 넘으면 절차가
// 아무리 옳아도 쓸 수 없다 — 그건 분석의 결함이지 학습자의 결함이다는 뜻이 아니다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { loadCsatPlan } from '@/lib/csat/learner'

export const metadata: Metadata = {
  title: '한 회차 주파 계획 — 기출 유형 분석',
  description: '18번부터 45번까지, 번호를 만났을 때 가장 먼저 할 동작과 시간 예산.',
}

export const dynamic = 'force-dynamic'

function mmss(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}분 ${s}초` : `${m}분`
}

export default async function CsatPlanPage() {
  const plan = await loadCsatPlan()
  const pending = plan.rows.length - plan.ready_items
  const over = plan.budget_sec > plan.available_sec

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← 유형 목록
      </Link>

      <header className="mb-6 mt-2">
        <h1 className="font-display text-2xl font-bold text-[var(--t1)]">한 회차 주파 계획</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--t2)]">
          번호별 유형은 2019학년도부터 고정입니다. 그래서 <strong>번호를 보면 무엇을 할지 미리 정해
          둘 수 있어요.</strong> 아래는 {plan.exam_label || '최근 수능'} 기준입니다.
        </p>
      </header>

      {plan.error ? (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          지금은 계획을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : null}

      {!plan.error && plan.rows.length ? (
        <>
          <section className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
              <div className="text-xs text-[var(--t3)]">독해 배점</div>
              <div className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--t1)]">
                {plan.scope_points}점
              </div>
              <div className="mt-1 text-xs text-[var(--t3)]">{plan.rows.length}문항 · 실점 0이 99점</div>
            </div>
            <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
              <div className="text-xs text-[var(--t3)]">절차 시간 합</div>
              <div
                className="mt-1 font-display text-xl font-bold tabular-nums"
                style={{ color: over ? '#B5803A' : 'var(--t1)' }}
              >
                {mmss(plan.budget_sec)}
              </div>
              <div className="mt-1 text-xs text-[var(--t3)]">
                쓸 수 있는 시간 {mmss(plan.available_sec)}
                {pending > 0 ? ` · ${pending}문항 절차 준비 중` : ''}
              </div>
            </div>
          </section>

          {over ? (
            <p className="mb-5 rounded-[var(--r-md)] border border-[#B5803A] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
              지금 적힌 절차를 그대로 다 하면 시험 시간을 넘습니다. 시간이 모자란 것은 학습자의 문제가
              아니라 <strong>절차가 아직 무겁다는 뜻</strong>이에요 — 유형별로 더 줄이는 중입니다.
            </p>
          ) : null}

          <ol className="space-y-2">
            {plan.rows.map((r) => (
              <li
                key={r.no}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-sm font-bold tabular-nums text-[var(--t1)]">
                    {r.no}번
                  </span>
                  <Link
                    href={`/csat/${r.type_id}`}
                    className="text-sm text-[var(--p)] underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                  >
                    {r.type_name}
                  </Link>
                  <span className="ml-auto shrink-0 tabular-nums text-xs text-[var(--t3)]">
                    {r.points ? `${r.points}점` : ''}
                    {r.time_budget_sec ? ` · ${r.time_budget_sec}초` : ''}
                  </span>
                </div>
                {r.first_step ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">
                    <span className="text-[var(--t3)]">먼저 — </span>
                    {r.first_step}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--t3)]">절차 준비 중</p>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {!plan.error && !plan.rows.length ? (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          아직 계획을 세울 회차가 없어요.
        </p>
      ) : null}
    </main>
  )
}
