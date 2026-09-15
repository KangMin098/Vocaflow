// apps/web/src/app/(main)/csat/[typeId]/page.tsx
//
// 유형 하나의 분석 — **센 것이 먼저, 산문은 요청할 때.**
//
// ── 무엇을 바꿨나 (2026-09-15) ────────────────────────────────────────
// 전에는 이 화면이 산문 네 덩어리를 세로로 쌓았다. 실측하면 R-BLANK 에서 보이는 글자
// **10,730자 · 가장 긴 덩어리 1,084자 · 조작 0 · 그래픽 0**. 학습자가 도착해서 마주하는 것이
// 「읽어야 할 벽」이었고, 그 벽을 읽어도 **검증할 수가 없었다** — 산문은 믿거나 말거나다.
//
// 그래서 순서를 뒤집었다. 위쪽 둘은 **세어서 그린 것**이고 학습자가 확인할 수 있다:
//   ① 정답 근거가 지문의 어디에 있었나  (이 유형 기출의 앵커 위치를 실제로 센 분포)
//   ② 오답이 어떻게 만들어졌나          (이 유형 오답 선지의 함정 구성 + 전체 대비 배수)
// 그다음이 ③ 절차, 그리고 ④ 원래 있던 산문 전부 — **지우지 않고 접었다**(Progressive
// Disclosure). 접힌 것을 여는 손잡이에 분량을 적어 둔다: 몇 자짜리를 여는지 알고 열어야 한다.
//
// ⚠️ **`<main>` 이 아니라 `<div>` 다.** 셸(`(main)/layout.tsx`)이 이미 `<main id="main-content">`
//    를 그린다. 중첩하면 문서에 보이는 main 이 둘이 되어 스크린리더가 본문을 못 짚는다.
//    실측 2026-09-15: Playwright strict mode 가 `locator('main')` 에서 2개를 만나 드러났다 —
//    **axe 의 wcag2a/aa 태그로는 안 잡힌다**(중복 landmark 는 best-practice 규칙이다).
//
// ⚠️ 목록 그리드에 `grid-cols-1` 을 명시한다 — `grid` 만 두면 모바일에서 암시적 트랙이
//    `auto` 라 max-content 로 부풀어 화면이 옆으로 밀린다(`/csat` 에서 실측 51px).

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LocusBar } from '@/components/csat/LocusBar'
import { ReportText } from '@/components/csat/ReportText'
import { TrapAtlas } from '@/components/csat/TrapAtlas'
import { typeLocus } from '@/lib/csat/type-locus'
import { loadCsatTypeDetail, loadCsatTypeItems } from '@/lib/csat/learner'
import { rankFor } from '@/lib/csat/trap-atlas'

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

/** 접힌 덩어리의 분량을 손잡이에 적는다 — 몇 자짜리를 여는지 알고 열어야 한다. */
function charsLabel(n: number): string {
  if (n < 1000) return `약 ${Math.round(n / 100) * 100}자`
  return `약 ${(n / 1000).toFixed(1)}천 자`
}

export default async function CsatTypePage({ params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = await params
  const [{ detail, error }, { items, error: itemsError }] = await Promise.all([
    loadCsatTypeDetail(typeId),
    loadCsatTypeItems(typeId),
  ])

  if (!error && !detail) notFound()

  // 리포트 산문에 박힌 문항 인용(리포트 전체 1,182개)을 링크로 만들 때 쓰는 자.
  // **이미 불러온 목록**이라 추가 조회가 없고, 여기 없는 인용은 평문으로 남는다 —
  // 없는 문항으로 가는 링크는 막다른 화면이다(실측: 인용의 98.5%가 이 목록 안에 있다).
  const knownItems = new Set(items.map((it) => it.id))

  // **이 유형의 기출을 실제로 세어** 근거 자리의 분포를 낸다. DB 를 치지 않는다 —
  // 커밋된 골격이 type_id 를 들고 있다. 표본이 8문항 미만이면 null 이고, 그때는 안 그린다:
  // 적은 표본으로 「대개 뒤쪽」이라고 적으면 학습자가 그것을 규칙으로 외운다.
  const locus = typeLocus(typeId)
  // 이 유형의 오답 구성. 구운 지도에서 읽으므로 조회 왕복이 0 이다.
  const traps = rankFor(typeId)

  // 접어 둘 산문의 분량 — 손잡이가 말해야 한다.
  const proseChars =
    (detail?.answer_locus_pattern?.length ?? 0) +
    (detail?.recurring_traps ?? []).reduce((a, t) => a + (t.trap?.length ?? 0) + (t.signature?.length ?? 0), 0) +
    (detail?.failure_modes ?? []).reduce((a, m) => a + m.length, 0)

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← 유형 목록
      </Link>

      {error || !detail ? (
        <p className="mt-4 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          지금은 분석을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : (
        <>
          <header className="mb-5 mt-2">
            <h1 className="break-keep font-display text-2xl font-bold text-[var(--t1)]">{detail.name}</h1>
            <p className="mt-1.5 text-xs text-[var(--t3)]">
              기출 {detail.items}문항
              {detail.n_analyzed > 0 ? ` · 분석 ${detail.n_analyzed}문항` : ''}
              {traps.total > 0 ? ` · 오답 선지 ${traps.total}개` : ''}
              {detail.time_budget_sec ? ` · 권장 풀이 시간 ${detail.time_budget_sec}초` : ''}
            </p>
          </header>

          {detail.n_analyzed === 0 ? (
            <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm leading-relaxed text-[var(--t2)]">
              이 유형은 아직 분석 중이에요. 준비되면 여기에 절차가 올라옵니다.
            </p>
          ) : (
            <div className="space-y-8">
              {/* ── ① 센 것: 근거 자리 ──────────────────────────────────
                  산문보다 **먼저** 온다 — 학습자가 검증할 수 있는 것이 앞서야 한다. */}
              {locus ? (
                <section aria-labelledby="locus-h">
                  <h2 id="locus-h" className="mb-2 font-display text-sm font-bold text-[var(--t1)]">
                    정답 근거는 어디 있나
                  </h2>
                  <LocusBar summary={locus} />
                </section>
              ) : null}

              {/* ── ② 센 것: 오답 구성 ─────────────────────────────────
                  허브의 지도를 **이 유형으로 좁혀** 다시 그린다. 여기서는 순위가 아니라
                  **전체 대비 배수**가 정보다 — 어느 유형을 열어도 1~2위는 같으니까. */}
              {traps.rows.length ? (
                <TrapAtlas
                  chips={[]}
                  initialTypeId={typeId}
                  showChips={false}
                  showLift
                  visibleRows={6}
                  title="오답은 이렇게 만들어졌습니다"
                  subtitle={
                    <>
                      이 유형의 오답 선지 {traps.total}개를 하나씩 뜯어 센 것입니다. 눌러서 실제 기출을 보세요.
                    </>
                  }
                />
              ) : null}

              {/* ── ③ 절차 ─────────────────────────────────────────────
                  단계마다 「막히면」을 **접어 둔다.** 펴 두면 단계 수가 두 배로 보여
                  "이걸 다 외워야 하나" 가 된다 — 막힌 사람만 열면 된다. */}
              {detail.procedure.length ? (
                <section aria-labelledby="proc-h">
                  <h2 id="proc-h" className="mb-2 font-display text-sm font-bold text-[var(--t1)]">
                    푸는 절차
                    <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                      {detail.procedure.length}단계
                    </span>
                  </h2>
                  <ol className="space-y-2">
                    {detail.procedure.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sf-2)] font-display text-xs font-bold tabular-nums text-[var(--t2)]"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ReportText text={s.step} known={knownItems} />
                          {s.on_fail ? (
                            <details className="mt-2">
                              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-xs text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none">
                                여기서 막히면 →
                              </summary>
                              <div className="mt-1 border-l-2 border-[var(--bd)] pl-3">
                                <ReportText text={s.on_fail} known={knownItems} />
                              </div>
                            </details>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {/* ── ④ 산문 — 지우지 않고 접는다 ────────────────────────
                  이 세 덩어리가 R-BLANK 에서 13,000자가 넘는다. 값어치가 없어서가 아니라
                  **도착하자마자 삼킬 것이 아니라서** 접는다. 손잡이가 분량을 말한다. */}
              {detail.answer_locus_pattern || detail.recurring_traps.length || detail.failure_modes.length ? (
                <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)]">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 break-keep px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--sf-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none">
                    <span className="font-display font-bold">분석 원문 읽기</span>
                    <span className="shrink-0 text-xs text-[var(--t3)]">{charsLabel(proseChars)} →</span>
                  </summary>

                  <div className="space-y-6 border-t border-[var(--bd)] p-4">
                    {detail.answer_locus_pattern ? (
                      <section>
                        <h3 className="mb-2 font-display text-sm font-bold text-[var(--t1)]">
                          근거 자리 — 자세히
                        </h3>
                        {/* 한 덩어리로 쏟지 않는다 — 문단·강조·문항 인용이 **데이터에 이미 있고**,
                            예전 화면이 그것을 버리고 있었다. */}
                        <ReportText text={detail.answer_locus_pattern} known={knownItems} />
                      </section>
                    ) : null}

                    {detail.recurring_traps.length ? (
                      <section>
                        <h3 className="mb-2 font-display text-sm font-bold text-[var(--t1)]">
                          되풀이되는 함정
                          {detail.recurring_traps_total > detail.recurring_traps.length ? (
                            <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                              잦은 것 {detail.recurring_traps.length} / {detail.recurring_traps_total}
                            </span>
                          ) : null}
                        </h3>
                        <ul className="space-y-2">
                          {detail.recurring_traps.map((t, i) => (
                            <li key={i} className="border-l-2 border-[var(--bd)] pl-3">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="break-keep font-display text-sm font-bold text-[var(--t1)]">
                                  {t.trap}
                                </span>
                                {typeof t.count === 'number' ? (
                                  <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                                    {t.count}문항
                                  </span>
                                ) : null}
                              </div>
                              {t.signature ? <ReportText text={t.signature} known={knownItems} /> : null}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    {detail.failure_modes.length ? (
                      <section>
                        <h3 className="mb-2 font-display text-sm font-bold text-[var(--t1)]">
                          여기서 미끄러집니다
                          {detail.failure_modes_total > detail.failure_modes.length ? (
                            <span className="ml-2 font-sans text-xs font-normal text-[var(--t3)]">
                              {detail.failure_modes.length} / {detail.failure_modes_total}
                            </span>
                          ) : null}
                        </h3>
                        <ul className="space-y-2">
                          {detail.failure_modes.map((m, i) => (
                            <li key={i} className="border-l-2 border-[var(--bd)] pl-3">
                              {/* 이 절의 인용이 리포트 전체에서 두 번째로 많다(472개). */}
                              <ReportText text={m} known={knownItems} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          )}

          {/* ⚠️ **세 상태를 갈라 그린다** — 못 불러왔다 / 아직 없다 / 목록.
              예전에는 `items.length ? … : null` 하나뿐이라 조회가 실패하면 이 섹션이
              흔적 없이 사라졌고, 학습자는 "이 유형엔 기출이 없구나" 로 읽었다. 문항 해설로
              가는 문이 여기 하나뿐인데도. 위 머리글의 「기출 N문항」은 다른 쿼리라 그대로
              떠 있어서 화면이 스스로 모순됐다. */}
          <section className="mt-8" aria-labelledby="items-h">
            {/* **유형 절차만으로는 부족하다.** 학습자가 실제로 막히는 자리는 눈앞의 한 문항이고,
                거기서 알고 싶은 것은 "그래서 왜 ③인가" 다. 그 답으로 가는 문을 여기 둔다.
                최신 회차가 위에 온다 — 현행 설계부터 보는 것이 시험에 가깝다. */}
            <h2 id="items-h" className="font-display text-sm font-bold text-[var(--t1)]">
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

          <p className="mt-8 break-keep text-xs leading-relaxed text-[var(--t3)]">
            문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은 그 문항을
            분석해 우리가 쓴 글입니다.
          </p>
        </>
      )}
    </div>
  )
}
