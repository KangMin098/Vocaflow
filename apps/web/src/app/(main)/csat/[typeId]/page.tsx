// apps/web/src/app/(main)/csat/[typeId]/page.tsx
//
// ⚠️ 목록 그리드에 `grid-cols-1` 을 명시한다 — `grid` 만 두면 모바일에서 암시적 트랙이
//    `auto` 라 max-content 로 부풀어 화면이 옆으로 밀린다(`/csat` 에서 실측 51px).
//
// 유형 하나의 분석 — 이 화면이 학습자에게 주는 것은 **절차**다.
//
// 순서를 이렇게 둔 이유: 학습자는 「어디를 보는가」를 먼저 알아야 절차가 실행 가능해진다.
//   ① 정답 근거가 어디 있나 → ② 절차 → ③ 되풀이되는 함정 → ④ 내가 미끄러지는 자리
// 함정을 먼저 보여 주면 겁을 먼저 주는 셈이고(Empathetic Feedback 위반), 절차를 먼저 보여 주면
// 왜 그 단계인지 모른 채 외우게 된다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadCsatTypeDetail, loadCsatTypeItems } from '@/lib/csat/learner'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ typeId: string }>
}): Promise<Metadata> {
  const { typeId } = await params
  const { detail } = await loadCsatTypeDetail(typeId)
  return {
    title: detail ? `${detail.name} — 기출 유형 분석` : '기출 유형 분석',
  }
}

export default async function CsatTypePage({ params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = await params
  const [{ detail, error }, { items, error: itemsError }] = await Promise.all([
    loadCsatTypeDetail(typeId),
    loadCsatTypeItems(typeId),
  ])

  if (!error && !detail) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← 유형 목록
      </Link>

      {error || !detail ? (
        <p className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          지금은 분석을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : (
        <>
          <header className="mb-6 mt-2">
            <h1 className="font-display text-2xl font-bold text-[var(--t1)]">{detail.name}</h1>
            <p className="mt-2 text-xs text-[var(--t3)]">
              기출 {detail.items}문항
              {detail.n_analyzed > 0 ? ` · 분석 ${detail.n_analyzed}문항` : ''}
              {detail.time_budget_sec ? ` · 권장 풀이 시간 ${detail.time_budget_sec}초` : ''}
            </p>
          </header>

          {detail.n_analyzed === 0 ? (
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
              이 유형은 아직 분석 중이에요. 준비되면 여기에 절차가 올라옵니다.
            </p>
          ) : (
            <div className="space-y-6">
              {detail.answer_locus_pattern ? (
                <section>
                  <h2 className="font-display text-sm font-bold text-[var(--t1)]">정답 근거는 어디 있나</h2>
                  <p className="mt-2 whitespace-pre-line rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
                    {detail.answer_locus_pattern}
                  </p>
                </section>
              ) : null}

              {detail.procedure.length ? (
                <section>
                  <h2 className="font-display text-sm font-bold text-[var(--t1)]">푸는 절차</h2>
                  <ol className="mt-2 space-y-2">
                    {detail.procedure.map((s, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4"
                      >
                        <p className="text-sm leading-relaxed text-[var(--t1)]">{s.step}</p>
                        {s.on_fail ? (
                          <p className="mt-2 border-l-2 border-[var(--bd)] pl-3 text-xs leading-relaxed text-[var(--t3)]">
                            막히면 — {s.on_fail}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {detail.recurring_traps.length ? (
                <section>
                  <h2 className="font-display text-sm font-bold text-[var(--t1)]">
                    되풀이되는 함정
                    {detail.recurring_traps_total > detail.recurring_traps.length ? (
                      <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                        잦은 것 {detail.recurring_traps.length} / {detail.recurring_traps_total}
                      </span>
                    ) : null}
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {detail.recurring_traps.map((t, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-sm font-bold text-[var(--t1)]">{t.trap}</span>
                          {typeof t.count === 'number' ? (
                            <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                              {t.count}문항
                            </span>
                          ) : null}
                        </div>
                        {t.signature ? (
                          <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">{t.signature}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.failure_modes.length ? (
                <section>
                  <h2 className="font-display text-sm font-bold text-[var(--t1)]">
                    여기서 미끄러집니다
                    {detail.failure_modes_total > detail.failure_modes.length ? (
                      <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                        {detail.failure_modes.length} / {detail.failure_modes_total}
                      </span>
                    ) : null}
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {detail.failure_modes.map((m, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}

          {/* ⚠️ **세 상태를 갈라 그린다** — 못 불러왔다 / 아직 없다 / 목록.
              예전에는 `items.length ? … : null` 하나뿐이라 조회가 실패하면 이 섹션이
              흔적 없이 사라졌고, 학습자는 "이 유형엔 기출이 없구나" 로 읽었다. 문항 해설로
              가는 문이 여기 하나뿐인데도. 위 머리글의 「기출 {detail.items}문항」은 다른
              쿼리라 그대로 떠 있어서 화면이 스스로 모순됐다. */}
          <section className="mt-6">
            {/* **유형 절차만으로는 부족하다.** 학습자가 실제로 막히는 자리는 눈앞의 한 문항이고,
                거기서 알고 싶은 것은 "그래서 왜 ③인가" 다. 그 답으로 가는 문을 여기 둔다.
                최신 회차가 위에 온다 — 현행 설계부터 보는 것이 시험에 가깝다. */}
            <h2 className="font-display text-sm font-bold text-[var(--t1)]">
              이 유형의 기출
              {items.length > 0 && (
                <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                  해설 {items.filter((i) => i.explained).length} / {items.length}
                </span>
              )}
            </h2>

            {itemsError ? (
              <p className="mt-2 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
                지금은 기출 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
              </p>
            ) : items.length === 0 ? (
              <p className="mt-2 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
                이 유형의 기출을 아직 연결하지 못했어요. 위의 절차와 함정만으로도 한 번 풀어 볼 수 있어요.
              </p>
            ) : null}

            {items.length > 0 ? (
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((it) => (
                  <li key={it.id}>
                    <Link
                      href={`/csat/item/${it.slug}`}
                      className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] px-4 py-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
                    >
                      <span className="text-sm text-[var(--t1)]">
                        {it.exam_label} <span className="tabular-nums">{it.no}번</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--t3)]">
                        {it.points ? `${it.points}점` : ''}
                        {it.explained ? '' : ' · 준비 중'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <p className="mt-8 text-xs leading-relaxed text-[var(--t3)]">
            문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은
            그 문항을 분석해 우리가 쓴 글입니다.
          </p>
        </>
      )}
    </main>
  )
}
