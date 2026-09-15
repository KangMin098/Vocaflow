// apps/web/src/app/(main)/csat/plan/PlanList.tsx
//
// **⑤ 주파 — 한 회차를 「시험 순서」로도, 「내 약한 것 먼저」로도 본다.**
//
// ── 왜 이 화면에 붙나 ─────────────────────────────────────────────────
// 계획 화면은 18번부터 45번까지를 번호 순서로 늘어놓는다. 그건 **시험에서 만나는 순서**이고
// 옳다. 그런데 학습자가 실제로 묻는 것은 하나 더 있다: **무엇부터 공부하나.**
// 지도는 유형마다 오답이 어떤 수법으로 만들어졌는지 알고, 기록은 내가 어떤 수법에 걸리는지
// 안다. 둘을 곱하면 「이 유형에서 내가 잃을 몫」이 나온다(`lib/csat/plan-order.ts`).
//
// ── ⚠️ 시험을 이 순서로 치르라는 말이 아니다 ──────────────────────────
// 그렇게 읽히면 이 화면이 줄 수 있는 **가장 나쁜 조언**이 된다. 그래서 「내 약한 것 먼저」를
// 켠 동안 화면이 그 문장을 띄우고, **시간 띠는 언제나 번호 순서**로 남는다(띠는 이 컴포넌트
// 밖에 있다 — 섞이지 않게 일부러 갈라 두었다).
//
// ── 기록이 얇으면 이 정렬을 아예 안 내민다 ────────────────────────────
// 다섯 문항 풀고 「네 약점 순서」를 내밀면 그건 순서가 아니라 잡음이다. 문턱은
// `my-traps.ts` 가 정하고(`enough`), 여기서는 따르기만 한다.

'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { ReportText } from '@/components/csat/ReportText'
import { track } from '@/lib/analytics/client'
import type { CsatPlanRow } from '@/lib/csat/learner'
import type { MyTrapSummary } from '@/lib/csat/my-traps'
import { myMissCounts } from '@/lib/csat/my-traps'
import { orderRows, riskByType, type PlanOrder } from '@/lib/csat/plan-order'

export function PlanList({ rows, mine }: { rows: CsatPlanRow[]; mine: MyTrapSummary | null }) {
  const [order, setOrder] = useState<PlanOrder>('exam')

  const risk = useMemo(() => (mine ? riskByType(myMissCounts(mine)) : new Map()), [mine])
  // 기록이 문턱을 넘었고 실제로 줄을 세울 값이 있을 때만 토글을 낸다.
  const canWeak = Boolean(mine?.enough) && risk.size > 0
  const mode: PlanOrder = canWeak ? order : 'exam'
  const shown = useMemo(() => orderRows(rows, mode, risk), [rows, mode, risk])

  function pick(next: PlanOrder) {
    if (next === order) return
    setOrder(next)
    track({ name: 'csat_plan_ordered', props: { weak: next === 'weak', rows: rows.length } })
  }

  return (
    <>
      {canWeak ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="줄 세우는 기준">
          <span className="text-xs text-[var(--t3)]">순서</span>
          {(
            [
              { v: 'exam' as const, label: '시험 순서' },
              { v: 'weak' as const, label: '내 약한 것 먼저' },
            ]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => pick(o.v)}
              aria-pressed={mode === o.v}
              className={[
                'inline-flex min-h-[44px] items-center break-keep rounded-[var(--r-full)] border px-3.5 text-sm',
                'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
                mode === o.v
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--bg3)] active:bg-[var(--bd)]',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ⚠️ 이 문장이 없으면 학습자가 **시험장에서 문제를 건너뛰며 푸는 법**으로 읽는다. */}
      {mode === 'weak' ? (
        <p className="mb-3 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-sm leading-relaxed text-[var(--t2)]">
          시험은 <strong>번호 순서로</strong> 치릅니다 — 이건 <strong>공부할 순서</strong>예요. 내 기록에서 자주
          놓친 수법이 많이 섞인 유형부터 올렸습니다. 위의 시간 띠는 그대로 번호 순서입니다.
        </p>
      ) : null}

      <ol className="space-y-2">
        {shown.map((r) => {
          const x = mode === 'weak' ? risk.get(r.type_id) : undefined
          return (
            <li key={r.no} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-sm font-bold tabular-nums text-[var(--t1)]">{r.no}번</span>
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

              {/* **왜 위로 왔는지 줄마다 말한다.** 순서만 바꾸고 이유를 안 적으면 학습자는
                  그 순서를 믿을 근거가 없다 — 그건 지도가 배수를 적는 것과 같은 이유다. */}
              {x?.driver ? (
                // ⚠️ 이름 뒤에 **조사를 붙이지 않는다** — 함정 이름은 데이터라 끝 글자에 따라
                //    「이/가」가 갈리고, 「이(가)」로 도망치면 읽는 맛이 떨어진다. 가운뎃점으로 끊는다.
                <p className="mt-1.5 break-keep text-xs leading-relaxed text-[var(--t3)]">
                  내가 자주 놓치는 수법 — <strong className="text-[var(--t2)]">{x.driver}</strong> · 이 유형 오답의{' '}
                  <span className="tabular-nums">{Math.round(x.driverShare * 100)}%</span>
                </p>
              ) : null}

              {r.first_step ? (
                // ⚠️ **맨손으로 그리지 않는다.** 이 값은 유형 리포트의 첫 단계라 `**강조**` 와
                //    문항 인용을 들고 있고, 그대로 찍으면 학습자에게 별표가 보인다(실측 캡처).
                //    `known` 은 주지 않는다 — 이 화면은 문항 목록을 안 불러오므로 인용을 링크로
                //    만들면 **없는 문항으로 가는 링크**가 된다.
                <div className="mt-2 flex gap-1.5">
                  <span className="shrink-0 text-sm text-[var(--t3)]">먼저 —</span>
                  <ReportText text={r.first_step} className="min-w-0 flex-1" />
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--t3)]">절차 준비 중</p>
              )}
            </li>
          )
        })}
      </ol>

      {/* 기록이 얇을 때 **왜 토글이 없는지** 말한다 — 없는 이유를 안 적으면 없는 기능이 된다. */}
      {!canWeak ? (
        <p className="mt-3 break-keep text-xs leading-relaxed text-[var(--t3)]">
          훈련 기록이 쌓이면 여기에 <strong>「내 약한 것 먼저」</strong> 순서가 생겨요 —{' '}
          <Link
            href="/csat/drill"
            className="underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] hover:decoration-[var(--p)] motion-reduce:transition-none"
          >
            오답 감별 훈련 →
          </Link>
        </p>
      ) : null}
    </>
  )
}
