// apps/web/src/app/(main)/csat/overlay/page.tsx
//
// **평가원 문제지를 열고 그 위/옆에 우리 해설을 얹는 화면.** 두 모드가 한 화면에 있다.
//
//   ① 링크 모드 (`?exam=2026&no=30`) — 기본. 원본을 **iframe 으로 우리 화면 안에** 열고
//      그 문항이 있는 쪽부터 보여 준다(`#page=N`). 오른쪽에 그 문항 해설.
//      **프록시가 없다** — 브라우저가 평가원에서 직접 받는다. 우리는 전송하지 않는다.
//   ② 파일 모드 — 내려받은 PDF 를 열면 **글자 위에 상자**를 얹는다(정밀).
//
// ── 왜 ①이 상자를 못 얹나 (실측 2026-09-13) ───────────────────────────
// 원본 응답에 `Access-Control-Allow-Origin` 이 **없다**(GET·OPTIONS 둘 다). 그래서 브라우저가
// 바이트를 읽을 수 없고, PDF.js 로 렌더할 수도 없다. iframe 은 되지만(X-Frame-Options·CSP 없음 +
// `Content-Disposition: inline`) cross-origin 이라 **스크롤·확대율·쪽 위치를 알려 주지 않는다** —
// 뷰어 안 픽셀에 상자를 맞출 방법이 없다. 그래서 ①은 **쪽 점프 + 나란히 해설**이고,
// 글자 위 정밀 오버레이는 ②의 몫이다.
//
// 프록시를 두면 ①도 정밀해지지만 그 순간 **우리가 원본을 전송**하는 것이 된다 — 두지 않았다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { kiceSourceOf, pdfFragment } from '@/lib/csat/kice-source'
import { loadCsatItemExplain } from '@/lib/csat/learner'
import { anchorCatalog, anchorMetaOf, pageOfItem } from '@/lib/csat/overlay'

import OverlayClient from './OverlayClient'

export const metadata: Metadata = {
  title: '문제지에 해설 얹기',
  description: '평가원 공개 문제지를 열면 문항마다 우리 해설을 그 자리에 붙여 드립니다.',
}

export const dynamic = 'force-dynamic'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

export default async function CsatOverlayPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; no?: string }>
}) {
  const catalog = anchorCatalog()
  const sp = await searchParams

  // 회차 id 는 **좌표 색인에 있는 것만** 받는다 — 사용자 입력이 파일 경로·외부 URL 로 흐르지 않게.
  const examId = sp.exam && catalog.exams.includes(sp.exam) ? sp.exam : null
  const no = sp.no && /^\d{1,2}$/.test(sp.no) ? Number(sp.no) : null
  const linkMode = Boolean(examId && no && no >= 1 && no <= 45)

  const source = examId ? kiceSourceOf(examId) : null
  const meta = examId ? anchorMetaOf(examId) : null
  const page = examId && no ? pageOfItem(examId, no) : null
  const { item } = linkMode ? await loadCsatItemExplain(`${examId}#${no}`) : { item: null }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
      >
        ← 기출 유형 분석
      </Link>

      <header className="mb-6 mt-2">
        <h1 className="font-editorial text-2xl font-[600] text-[var(--t1)]">
          {linkMode ? `${item?.exam_label ?? examId} ${no}번 — 원본과 함께 보기` : '문제지에 해설 얹기'}
        </h1>
        <p className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-[var(--t2)]">
          {linkMode
            ? '왼쪽은 평가원 원본입니다 — 이 문항이 있는 쪽부터 열려요. 오른쪽은 우리 해설입니다.'
            : '평가원에서 받은 문제지를 열면, 문항 번호 자리에 우리 해설을 붙여 드려요.'}
        </p>
      </header>

      {linkMode ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section>
              {source?.paperUrl ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <a
                      href={source.paperUrl + pdfFragment(page ?? 1)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
                    >
                      새 탭에서 크게 보기 ↗
                    </a>
                    <p className="text-xs text-[var(--t3)]">
                      {page ? `${page}쪽부터 열려요` : '1쪽부터 열려요'}
                      {meta && meta.totalPages > meta.formPages
                        ? ` · 이 문제지는 두 형이 이어 붙어 있어요(앞 ${meta.formPages}쪽이 우리 기준)`
                        : ''}
                    </p>
                  </div>

                  {/* 원본은 브라우저가 평가원에서 **직접** 받는다 — 우리 서버를 거치지 않는다.
                      cross-origin 이라 안을 읽을 수 없고, 그래서 상자도 못 얹는다(머리 주석 참조). */}
                  {/* ⚠️ `loading="lazy"` 를 준다. 원본은 **2.2 MB**(2026 영어 문제지 실측)이고,
                      브라우저가 그걸 받는 동안 이 화면의 나머지 — 특히 아래 「파일 열기」 —
                      가 굼떠진다. e2e 가 그걸 드러냈다: 파일 입력을 10초 안에 못 잡아
                      **단독 실행은 통과하고 전체 실행만 실패**했다(2026-09-15).
                      lazy 는 뷰포트에 들어올 때 받으므로 첫 페인트를 원본에 인질로 잡히지 않는다. */}
                  <iframe
                    src={source.paperUrl + pdfFragment(page ?? 1)}
                    title={`${item?.exam_label ?? examId} 영어 영역 문제지 (한국교육과정평가원)`}
                    loading="lazy"
                    className="h-[70vh] min-h-[28rem] w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]"
                  />
                </>
              ) : (
                // 막다른 안내로 끝내지 않는다 — 왜 없는지와 다음 걸음을 함께 준다(D4)
                <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
                  <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">
                    이 회차는 <strong>원본 직접 링크가 없어요.</strong> {source?.reason}.
                  </p>
                  <p className="mt-2 break-keep text-xs leading-relaxed text-[var(--t3)]">
                    평가원에서 <strong>영어 영역 문제지</strong>를 받아 아래에서 열면, 글자 위에 상자까지
                    얹어 드려요 — 링크로 여는 것보다 정확합니다.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={source?.listUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg3)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
                    >
                      평가원에서 찾기 ↗
                    </a>
                  </div>
                </div>
              )}
            </section>

            {/* 오른쪽 — 우리가 쓴 것만. 순서는 해설 화면과 같다(①답 → ②나머지 → ③다시 풀 때) */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
                <h2 className="text-base font-bold text-[var(--t1)]">
                  {no}번
                  {item?.type_name ? (
                    <span className="ml-2 text-xs font-normal text-[var(--t3)]">{item.type_name}</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-[var(--t3)]">
                  {item?.points ? `${item.points}점` : ''}
                  {item?.time_budget_sec ? ` · 권장 ${item.time_budget_sec}초` : ''}
                </p>

                {!item ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--t2)]">
                    이 문항은 분석 준비 중이에요.
                  </p>
                ) : (
                  <>
                    {item.answer && !item.answer_unknown ? (
                      <p className="mt-3 text-sm text-[var(--t1)]">
                        답 <strong className="text-base">{CIRCLED[item.answer]}</strong>
                      </p>
                    ) : null}

                    {item.evidence_quote ? (
                      <blockquote className="mt-2 border-l-2 border-[var(--p)] pl-3 text-sm leading-relaxed text-[var(--t2)]">
                        {item.evidence_quote}
                      </blockquote>
                    ) : null}

                    {item.why_correct ? (
                      <p className="mt-3 break-keep text-sm leading-relaxed text-[var(--t2)]">{item.why_correct}</p>
                    ) : null}

                    {item.distractors.length ? (
                      <ul className="mt-3 space-y-2">
                        {item.distractors.map((d) => (
                          <li key={d.n} className="break-keep text-sm leading-relaxed text-[var(--t2)]">
                            <span className="font-bold text-[var(--t1)]">{CIRCLED[d.n] ?? d.n}</span>{' '}
                            {d.how_to_reject ?? d.trap ?? ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {item.procedure.length ? (
                      <ol className="mt-3 list-decimal space-y-1 pl-5 break-keep text-sm leading-relaxed text-[var(--t2)]">
                        {item.procedure.map((s, i) => (
                          <li key={i}>{s.step}</li>
                        ))}
                      </ol>
                    ) : null}

                    <Link
                      href={`/csat/item/${examId}-${no}`}
                      className="mt-4 inline-flex min-h-[44px] items-center text-sm text-[var(--t2)] underline decoration-dotted underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
                    >
                      해설 전문 보기 →
                    </Link>
                  </>
                )}
              </div>
            </aside>
          </div>

          <section className="mt-10 border-t border-[var(--bd)] pt-6">
            <h2 className="text-base font-bold text-[var(--t1)]">글자 위에 상자까지 얹기</h2>
            <p className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-[var(--t2)]">
              위 원본은 평가원에서 바로 열리는 것이라 <strong>우리가 안을 들여다볼 수 없어요</strong> — 그래서
              쪽만 맞춰 드립니다. 내려받은 문제지를 아래에서 열면 문항 번호와 선지 자리에 상자를 그려요.
            </p>
            <div className="mt-4">
              <OverlayClient catalog={catalog} initialExam={examId} initialNo={no} />
            </div>
          </section>
        </>
      ) : (
        <OverlayClient catalog={catalog} initialExam={null} initialNo={null} />
      )}

      <p className="mt-8 max-w-3xl break-keep text-xs leading-relaxed text-[var(--t3)]">
        문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은 그
        문항을 분석해 우리가 쓴 글입니다. 원본은 <strong>여러분 브라우저가 평가원에서 직접</strong>{' '}
        받으며 우리 서버를 거치지 않습니다. 해설이 얹힌 파일을 내려받는 기능은 두지 않았습니다.
      </p>
    </div>
  )
}
