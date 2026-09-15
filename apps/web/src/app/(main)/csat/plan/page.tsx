// apps/web/src/app/(main)/csat/plan/page.tsx
//
// **한 회차 주파 계획** — 유형 분석을 번호 순서로 늘어놓은 것.
//
// 유형별 분석을 낱개로 읽는 것과, 그것을 시험 순서로 늘어놓는 것은 다른 물건이다.
// 시험장에서 만나는 것은 유형 목록이 아니라 18번부터 45번까지의 줄이고, 그 줄을 시간 안에
// 통과할 수 있는지가 **독해 실점 0** 의 실제 조건이다.
//
// ⚠️ **여기서 「99점」이라고 쓰지 않는다.** 배점 단위가 2·3점이라 99점이라는 점수 자체가
//    나오지 않고(100 다음이 98이다), 독해를 다 맞혀도 총점은 100 − 듣기 실점이다.
//    듣기는 이 파이프라인이 다루지 않으므로(사용자 지시), 화면은 **우리가 책임지는 것**만 말한다.
//
// 그래서 이 화면은 **시간 예산 합계를 시험 시간과 나란히 적는다.** 합이 넘으면 절차가
// 아무리 옳아도 쓸 수 없다 — 그건 분석의 결함이지 학습자의 결함이다는 뜻이 아니다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { PlanTimeline } from '@/components/csat/PlanTimeline'
import { ReportText } from '@/components/csat/ReportText'
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
  // ⚠️ **`<main>` 이 아니라 `<div>` 다.** 셸(`(main)/layout.tsx`)이 이미
  //    `<main id="main-content">` 를 그린다. 중첩하면 문서에 보이는 main 이 둘이 되어
  //    스크린리더가 본문을 못 짚고 건너뛰기 링크도 어디로 갈지 모호해진다.
  //    실측 2026-09-15: Playwright strict mode 가 `locator('main')` 에서 2개를 만나 드러났다 —
  //    **axe 의 wcag2a/aa 태그로는 안 잡힌다**(중복 landmark 는 best-practice 규칙이다).

  return (
    <div className="mx-auto max-w-3xl">
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
          {/* ── 증명 ────────────────────────────────────────────────────
              전에는 이 자리에 숫자 두 개(합계·쓸 수 있는 시간)뿐이었다. 맞는 말인데
              **학습자가 할 수 있는 일이 없다** — 6분이 모자란 건 알겠는데 어느 번호에서
              손이 멈추는지는 두 숫자로 안 보인다. 띠는 그 자리를 찍고, 속도 칩은 그것을
              **자기 속도로** 다시 그린다(I1·I3). 초과 문구도 여기로 옮겼다. */}
          <PlanTimeline rows={plan.rows} availableSec={plan.available_sec} />

          {/* ⚠️ **「절차 시간 합」 카드를 없앴다.** 위 시간 띠가 이미 「합 45분 43초 /
              쓸 수 있는 시간 45분」을 적는데 이 카드가 같은 두 수를 되풀이했다 — 한 화면이
              같은 질문에 두 번 답한 셈이고, 실제로 스펙 41 이 「쓸 수 있는 시간」 두 개를
              만나 strict mode 로 걸렸다(실측 2026-09-16). 남긴 것은 띠가 말하지 않는 것뿐이다. */}
          <section className="mb-5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
            <div className="text-xs text-[var(--t3)]">독해 배점</div>
            <div
              className="mt-1 font-display text-xl font-bold tabular-nums"
              style={{ color: over ? 'var(--warning-ink)' : 'var(--t1)' }}
            >
              {plan.scope_points}점
            </div>
            <div className="mt-1 break-keep text-xs text-[var(--t3)]">
              {plan.rows.length}문항 · 여기서 실점 0이 목표 (듣기는 다루지 않아요)
              {pending > 0 ? ` · ${pending}문항 절차 준비 중` : ''}
            </div>
          </section>

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
                  // ⚠️ **`{r.first_step}` 을 맨손으로 그리지 않는다.** 이 값은 유형 리포트의
                  //    첫 단계라 `**강조**` 와 문항 인용을 들고 있는데, 그대로 찍으면 학습자에게
                  //    별표가 보인다(실측 2026-09-15 캡처 · 19번 「**타인의 말을 근거에서 뺀다**」).
                  //    같은 글을 유형 화면은 `ReportText` 로 그리고 있었다 — 한쪽만 맨손이었다.
                  //    `known` 은 주지 않는다: 이 화면은 문항 목록을 안 불러오므로 인용을
                  //    링크로 만들면 **없는 문항으로 가는 링크**가 된다.
                  <div className="mt-2 flex gap-1.5">
                    <span className="shrink-0 text-sm text-[var(--t3)]">먼저 —</span>
                    <ReportText text={r.first_step} className="min-w-0 flex-1" />
                  </div>
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
    </div>
  )
}
