// apps/web/src/app/(main)/csat/item/[slug]/page.tsx
//
// **문항 하나의 해설 — 「이 문제의 답이 왜 이것인가」.**
//
// 유형 화면이 "이 유형은 이렇게 푼다" 를 말한다면, 여기는 **눈앞의 한 문항**을 답한다.
// 학습자가 채점을 하고 나서 알고 싶은 것은 딱 하나다 — 그래서 왜 ③인가.
//
// 순서를 이렇게 둔 이유:
//   ① 답이 왜 이것인가 → ② 나머지가 왜 아닌가 → ③ 다시 풀 때의 순서
// 오답부터 보여 주면 "내가 왜 틀렸나" 로 시작해 자책이 앞선다(Empathetic Feedback).
// 정답 근거를 먼저 세워 두면 오답 넷은 그 근거에 비추어 읽히고, 그때 배제가 절차가 된다.
//
// ⚠️ **문항 원문은 싣지 않는다.** 지문·선지는 평가원 저작물이고 `csat_items_public` 뷰에
//    컬럼 자체가 없다. 이 화면은 **해설**이라 학습자가 평가원 공개 문제지를 곁에 두고 읽는다.
//    그래서 오답은 번호로 가리키고, 지문은 근거 인용(짧은 발췌)까지만 나온다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fromItemSlug, loadCsatItemExplain } from '@/lib/csat/learner'

export const dynamic = 'force-dynamic'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { item } = await loadCsatItemExplain(fromItemSlug(slug))
  return {
    title: item ? `${item.exam_label} ${item.no}번 해설 — 기출 분석` : '기출 문항 해설',
  }
}

export default async function CsatItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { item, error } = await loadCsatItemExplain(fromItemSlug(slug))

  if (!error && !item) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={item?.type_id ? `/csat/${item.type_id}` : '/csat'}
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← {item?.type_name ?? '유형 목록'}
      </Link>

      {error || !item ? (
        <p className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          지금은 해설을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : (
        <>
          <header className="mb-6 mt-2">
            <h1 className="font-display text-2xl font-bold text-[var(--t1)]">
              {item.exam_label} {item.no}번
            </h1>
            <p className="mt-2 text-xs text-[var(--t3)]">
              {item.type_name ?? '유형 미정'}
              {item.points ? ` · ${item.points}점` : ''}
              {item.time_budget_sec ? ` · 권장 풀이 시간 ${item.time_budget_sec}초` : ''}
            </p>
          </header>

          {item.answer_unknown || item.answer == null ? (
            // 정답표가 없는 회차. **추정한 정답을 정답인 척 적지 않는다** —
            // 그 한 줄이 학습자를 반대로 훈련시킨다.
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
              이 회차는 평가원 정답표를 구하지 못했어요. 정답을 모르는 채로 근거를 적으면 그건 창작이라,
              이 문항은 <strong>답을 지목하지 않습니다.</strong> 대신 아래 절차는 그대로 쓸 수 있어요.
            </p>
          ) : (
            <section className="mb-6">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-sm font-bold text-[var(--t1)]">답이 왜 이것인가</h2>
                <span className="font-display text-lg font-bold tabular-nums text-[#2E7D5A]">
                  {CIRCLED[item.answer] ?? item.answer}
                </span>
              </div>

              {item.why_correct ? (
                <p className="mt-2 rounded-[var(--r-md)] border border-[#2E7D5A] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t1)]">
                  {item.why_correct}
                </p>
              ) : (
                <p className="mt-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
                  이 문항은 정답 근거 서술을 아직 쓰는 중이에요.
                </p>
              )}

              {item.evidence_quote ? (
                <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
                  <p className="text-xs text-[var(--t3)]">근거가 되는 문장</p>
                  {/* 지문 발췌는 여기까지다 — 문단 전체는 평가원 공개자료에서 본다 */}
                  <blockquote className="mt-1 border-l-2 border-[var(--bd)] pl-3 font-display text-sm italic leading-relaxed text-[var(--t1)]">
                    {item.evidence_quote}
                  </blockquote>
                  {item.evidence_reasoning ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{item.evidence_reasoning}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          {item.distractors.length ? (
            <section className="mb-6">
              <h2 className="font-display text-sm font-bold text-[var(--t1)]">나머지가 왜 아닌가</h2>
              <ul className="mt-2 space-y-2">
                {item.distractors.map((d) => (
                  <li key={d.n} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-base font-bold tabular-nums text-[var(--t2)]">
                        {CIRCLED[d.n] ?? d.n}
                      </span>
                      {d.trap ? (
                        <span className="shrink-0 rounded bg-[var(--sf-2)] px-1.5 py-0.5 text-[10px] text-[var(--t3)]">
                          {d.trap}
                        </span>
                      ) : null}
                    </div>
                    {d.why_tempting ? (
                      <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">{d.why_tempting}</p>
                    ) : null}
                    {d.how_to_reject ? (
                      <p className="mt-2 border-l-2 border-[#9C3A30] pl-3 text-sm leading-relaxed text-[var(--t1)]">
                        지우는 근거 — {d.how_to_reject}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.procedure.length ? (
            <section className="mb-6">
              <h2 className="font-display text-sm font-bold text-[var(--t1)]">다시 풀 때의 순서</h2>
              <ol className="mt-2 space-y-2">
                {item.procedure.map((s, i) => (
                  <li key={i} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
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

          {item.required_vocab.length ? (
            <section className="mb-6">
              <h2 className="font-display text-sm font-bold text-[var(--t1)]">이 문항이 요구한 낱말</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {item.required_vocab.map((w) => (
                  <li
                    key={w}
                    className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] px-2.5 py-1 text-sm text-[var(--t2)]"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="mt-8 text-xs leading-relaxed text-[var(--t3)]">
            문항 원문(지문·선지)은 싣지 않습니다. 저작권은 한국교육과정평가원에 있고, 여기 있는 것은
            그 문항을 분석해 우리가 쓴 해설입니다. 원문은 평가원 공개자료에서 함께 보세요.
          </p>
        </>
      )}
    </main>
  )
}
