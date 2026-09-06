// apps/web/src/app/(main)/library/textbooks/[step]/page.tsx
//
// 교재 한 권의 **상세** — 서점에서 책을 집어 펼쳐 보는 자리.
//
// ── 왜 만들었나 ─────────────────────────────────────────────────────
// 서가의 "지금 펼치기" 가 **아무 데도 가지 않는 죽은 버튼**이었다(v06.337 실측).
// 보이는데 눌리지 않는 것은 이 저장소가 가장 나쁜 결함으로 못 박은 종류다(CONVENTIONS).
//
// ── 2026-09-06 재설계: 무엇이 틀렸었나 ──────────────────────────────
// 시중 교재의 구성요소를 코퍼스에서 같은 자로 세 보니(`scripts/textbook-corpus/apparatus-probe.mjs`)
// 시중 20종은 **중앙값 5축 · 최다 8축**인데 이 화면은 **1축**이었다(난이도 표시).
// 표지도 머리말도 구성과 특징도 학습 계획표도 판권도 없었다 — 학습자에게 이것은
// 교재가 아니라 **재고 요약표**다. "시중 대비 30% 수준" 이라는 지적이 정확했다.
//
// 그래서 구성요소를 **파이프라인이 만들게** 했다(`buildDossier`). 이 파일은 조립만 한다:
// 글·수치·계획표를 여기서 지으면 권이 일곱이라 일곱 번 손으로 적게 되고,
// 한 권만 고쳐도 나머지 여섯이 어긋난다.
//
// ── 무엇을 여전히 보여주지 않는가 ───────────────────────────────────
// **가짜 목차.** 실제 단원 조합은 길이 게이트(90~200어)와 "한 단원의 문항은 서로 다른
// 원글에서" 규칙을 더 걸기 때문에, 재고만으로 목차를 지어내면 실제보다 부풀려진다.
// 목차는 조판된 권(`textbook_volume_renders`)에서만 나온다 — 아직 그 자료가 없다.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'

import { buildDossier } from '@vocaflow/library-pipeline'

import { Screen } from '@/components/ui/ios'
import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import { ShareVolumeButton } from '@/components/library/textbooks/ShareVolumeButton'
import {
  NeighborCard,
  VolumeBackMatter,
  VolumeColophon,
  VolumeFeatures,
  VolumeHero,
  VolumePreface,
  VolumeStudyPlan,
} from '@/components/library/textbooks/VolumeDossier'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'
import { STAGE_LABEL, neighborsOf, stageOf } from '@/lib/textbook/shelf-stage'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

/**
 * 없는 권의 제목.
 *
 * ⚠️ 여기 있던 값이 `'교재 · Vocaflow'` 였다 — 404 화면인데 **교재 페이지인 척**했다.
 *    브라우저 탭·북마크·공유 카드에서 없는 권이 있는 권처럼 보인다.
 *
 * ⚠️ **`robots: noindex` 를 넣었다가 뺐다(실측 2026-08-22).** Next 가 `notFound()` 렌더에
 *    이미 `<meta name="robots" content="noindex">` 를 넣는다 — 커스텀 메타데이터가 없는
 *    이웃 라우트에서도 확인했다. 더하면 robots 태그가 **둘**이 된다.
 *    "고쳐야 할 것 같다" 로 손대기 전에 **이미 되고 있는지 확인할 것.**
 *
 * ── 상태 코드는 남은 문제다(앱 전역) ────────────────────────────────
 * 이 라우트는 없는 step 에 404 화면을 그리지만 **HTTP 상태는 200** 이다.
 * 루트 `loading.tsx` 때문에 모든 페이지가 스트리밍이라 200 셸이 먼저 나간 뒤에는
 * `notFound()` 가 상태를 못 바꾼다(없는 **라우트**는 정상 404 다).
 * `loading.tsx` 는 "수정·삭제 금지" 로 못 박힌 파일이라 여기서 구조를 바꾸지 않는다.
 * 색인은 Next 의 noindex 가 막고 있어 실질 피해는 크지 않다 — 기록만 남긴다.
 */
function notFoundMeta(): Metadata {
  return { title: '찾을 수 없는 교재' }
}

export async function generateMetadata({
  params,
}: {
  params: { step: string }
}): Promise<Metadata> {
  const step = Number(params.step)
  if (!Number.isInteger(step)) return notFoundMeta()

  const shelf = await fetchTextbookShelf()
  const v = shelf.volumes.find((x) => x.step === step)
  if (!v) return notFoundMeta()

  // 조사를 붙이지 않는 형태로 잇는다 — 영문 권명에 한국어 조사를 붙일 수 없다.
  const types = v.types.map((t) => TYPE_GUIDE[t]?.label ?? t).join(' · ')
  // 못 잰 재고를 개수로 적지 않는다 — 검색 결과·공유 카드에 "문항 0개" 가 박히면
  // 그 문장은 화면보다 오래 남는다(캐시·인덱스). 레이아웃이 접미사를 붙이므로 여기서 안 붙인다.
  const count = v.status === 'unmeasured' ? '' : ` 문항 ${v.itemCount.toLocaleString()}개.`
  return {
    title: `${v.title} — ${v.schoolBand} 독해 교재`,
    description: `${v.schoolBand} 대상. 수록 유형 ${types}.${count}`,
  }
}

export default async function TextbookVolumePage({ params }: { params: { step: string } }) {
  const step = Number(params.step)
  if (!Number.isInteger(step)) notFound()

  const [shelf, mine] = await Promise.all([fetchTextbookShelf(), fetchMyTextbooks()])
  const v = shelf.volumes.find((x) => x.step === step)
  if (!v) notFound()

  // ── 구성요소는 파이프라인이 만든다 ────────────────────────────────
  // 이 화면은 재고 요약을 넘길 뿐이다. 같은 입력이면 같은 책이 나온다(순수 함수).
  const dossier = buildDossier({
    step: v.step,
    title: v.title,
    schoolBand: v.schoolBand,
    vLevels: v.vLevels,
    types: v.types,
    byType: v.byType,
    itemCount: v.itemCount,
    explainedCount: v.explainedCount,
    bySource: v.bySource,
  })

  const { prev, next } = neighborsOf(shelf.volumes, v.step)
  const stage = stageOf(v.schoolBand)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <Link
          href="/library/textbooks"
          className="inline-flex min-h-[44px] w-fit items-center gap-2 font-display text-[13px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          교재 서가
        </Link>

        <VolumeHero volume={v} dossier={dossier} brand={shelf.brand}>
          <Link
            href={`/library/textbooks/${v.step}/practice`}
            className="group inline-flex min-h-[48px] w-fit items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <ArrowRight size={15} aria-hidden />
            문항 풀어 보기
          </Link>
          {/* 담기는 서가와 **같은 버튼**을 쓴다 — 두 곳에서 다르게 생기면 같은 동작으로 안 읽힌다. */}
          {mine.available && (
            <TextbookPickButton
              step={v.step}
              title={v.title}
              picked={mine.steps.includes(v.step)}
              signedIn={mine.signedIn}
            />
          )}
          {/* 공유는 **로그인과 무관하게** 낸다 — 교사가 학생에게 보내는 경로이고,
              서가는 비로그인에도 열려 있어 받은 쪽이 바로 열 수 있다. */}
          <ShareVolumeButton step={v.step} title={v.title} />
        </VolumeHero>

        <VolumePreface dossier={dossier} />
        <VolumeFeatures dossier={dossier} />

        <section
          aria-label="수록 구성"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
            수록 구성
          </p>
          <h2 className="mt-1.5 font-editorial text-[22px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)]">
            유형마다 시키는 것이 다릅니다
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)]">
            {v.types.map((t) => {
              const g = TYPE_GUIDE[t]
              const n = v.byType[t] ?? 0
              // 막대는 **가장 많은 유형을 100%로** 잡는다 — 총계로 나누면 전부 한 뼘이 된다.
              const top = Math.max(...v.types.map((x) => v.byType[x] ?? 0), 1)
              const pct = Math.round((n / top) * 100)
              return (
                <li key={t} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                  <span className="min-w-[92px] shrink-0 font-display text-[13.5px] font-[700] text-[var(--t1)]">
                    {g?.label ?? t}
                  </span>
                  <span className="min-w-0 flex-1 basis-full font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all] sm:basis-0">
                    {g?.says ?? '—'}
                  </span>
                  {n > 0 && (
                    <span
                      aria-hidden
                      className="hidden h-1.5 w-[112px] shrink-0 overflow-hidden rounded-ios-pill bg-[var(--bg3)] sm:block"
                    >
                      <span
                        className="block h-1.5 rounded-ios-pill bg-[var(--p)]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                    {n > 0 ? n.toLocaleString() : '준비 중'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <VolumeStudyPlan dossier={dossier} />

        {/* 사다리에서의 자리 — 실제 교재의 뒤표지에 해당한다.
            서점에서 책을 집은 사람이 가장 먼저 하는 판단이 "나한테 맞나" 이고,
            안 맞을 때 서가로 되돌아가게 만들면 대개 안 돌아온다.
            ⚠️ `data-apparatus` 를 붙이지 않는다 — 시중의 「복습·단원 평가」가 아니다. */}
        {(prev || next) && (
          <section
            aria-label="계단 안내"
            className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
          >
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
              이 권이 안 맞는다면
            </p>
            <h2 className="mt-1.5 font-editorial text-[22px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)]">
              한 계단은 학년 하나
            </h2>
            <p className="mt-2 max-w-[62ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
              지금 보는 권은{stage ? ` ${STAGE_LABEL[stage]} 매대에 있어요.` : ' 이 사다리에 있어요.'}{' '}
              담은 권은 언제든 바꿀 수 있습니다.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NeighborCard volume={prev} direction="down" />
              <NeighborCard volume={next} direction="up" />
            </div>
          </section>
        )}

        <VolumeBackMatter dossier={dossier} />

        <section
          aria-label="학습 시작"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">어떻게 학습하나요</h2>
          {/* 이 문단은 두 번 고쳤다.
              ① 처음엔 "지금 수준에 맞는 단원부터 자동으로 배정돼요" 라고 적었는데 **거짓이었다** —
                 `prescribe_today` 가 담은 교재를 보지 않았다(실측 2026-08-22).
              ② 그래서 "담기가 오늘의 학습을 바꾸지는 않습니다" 로 되돌렸다.
              ③ 그 다음 배선을 실제로 붙였고(`20260822110000`), 이제 이 문장이 참이다.
              `promise-guard` 가 **양방향**으로 잡는다 — 배선이 없으면 약속을 막고,
              배선이 있으면 "바꾸지 않는다" 가 남아 있는 것을 막는다.

              ⚠️ 여전히 적지 않는 것: '단원' 단위 배정(그런 단위가 처방에 없다)과
                 "이 권의 모든 유형"(오늘의 학습은 글 순서·문장 삽입만 낸다). */}
          <p className="mt-3 max-w-[58ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            담아 두면 <strong className="font-display text-[var(--t1)]">내 교재</strong>에 쌓이고,
            <strong className="font-display text-[var(--t1)]"> 오늘의 학습</strong>이 이 권의 수준에서
            먼저 문항을 고릅니다.
          </p>
          <p className="mt-2 max-w-[58ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            오늘 나오는 것은 <strong className="font-display text-[var(--t1)]">글 순서·문장 삽입</strong>
            입니다 — 이 권의 다른 유형은 각 모듈에서 따로 만나요. 이 수준의 문항이 모자라면
            다른 수준으로 채웁니다. <strong className="font-display text-[var(--t1)]">담았다고 오늘 할
            것이 줄지는 않아요.</strong>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/hub"
              className="group inline-flex min-h-[48px] w-fit items-center gap-2 rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] no-underline motion-safe:transition-all motion-safe:hover:border-[var(--p)] motion-safe:hover:text-[var(--p)] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
            >
              <BookOpen size={15} aria-hidden />
              오늘의 학습으로
            </Link>
          </div>
        </section>

        <VolumeColophon dossier={dossier} passageSpec={null} />
      </div>
    </Screen>
  )
}
