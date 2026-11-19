// apps/web/src/app/(main)/library/textbooks/[series]/[step]/practice/page.tsx
//
// 교재 한 권의 **문항을 실제로 푸는 자리.**
//
// ── 왜 만들었나 ─────────────────────────────────────────────────────
// 평가 요소 15개 중 열위 하나가 "실사용 난이도·변별도" 인데, 이것만은 **콘텐츠로 못 고친다** —
// 학습자가 풀어야 P(정답률)·D(변별도)가 나온다. 그런데 `csat_item_attempts` 는 0행이었다.
// 이유는 단순했다: 교재 서가가 재고를 보여 주고 `/hub` 로 돌려보낼 뿐 **풀 자리가 없었다.**
//
// ── 왜 오늘 처방(`/practice/dcp`)을 쓰지 않나 ───────────────────────
// 그쪽은 `prescribe_today` 를 읽어 **S3 이상에서만** 열린다. 교재는 학령 사다리를 따라
// 아무 계단이나 펼칠 수 있어야 하므로 경로가 다르다. 채점은 같은 `grade_dcp_item` 을 쓴다 —
// 정답 판정을 두 곳에 두지 않는다.
//
// ⚠️ **화면이 그릴 수 있는 유형만 나온다** — 순서 · 삽입 + 5지선다 계열(`PLAYABLE_DCP_TYPES`, parseItem 이 거른다).
//   교재(인쇄물) 전용 유형이 섞이면 빈 화면이 된다 — 이 저장소가 이미 한 번 겪은 사고다(처방에 42.5% 가 샜다).
//
// ⚠️ **문항을 고른 경로를 학습 전에 알린다**(TextbookPracticeScope). 권 단위 함수가 없으면 V레벨 공통 풀이고,
//   있더라도 수준 · 유형 기준일 뿐 인쇄본 수록 문항 목록과의 결속이 아니다 — 「교재 수록 문제」라고 말하지 않는다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, LogIn } from 'lucide-react'


import { TextbookPracticeBridge } from '@/components/practice/TextbookPracticeBridge'
import { RETURN_PARAM } from '@/lib/auth/redirect'
import { Screen } from '@/components/ui/ios'
import { fetchTextbookPracticeItems } from '@/lib/learner/dcp-actions'
import { canShow, loadPublishGate, stateOf } from '@/lib/textbook/publish-gate'
// 시리즈 정본 — 연습도 그 시리즈의 계단을 본다.
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

/** 한 번에 내주는 문항 수. 한 단원이 4문항이라 두 단원 분량으로 잡는다. */
const ITEM_LIMIT = 8

/**
 * 그 **시리즈의** 계단. 전에는 SERIES_SPINE(독해)만 봤다 — 어휘 6단·구문 6단은
 * 이 함수에서 늘 null 이 되어 연습 화면이 404 였다.
 */
function rungOf(seriesId: string, step: number) {
  const def = SERIES_CATALOG.find((x) => x.id === seriesId)
  if (!def) return null
  return def.rungs.find((r) => r.step === step) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string; step: string }>
}): Promise<Metadata> {
  const { series, step } = await params
  const rung = rungOf(series, Number(step))
  // 권마다 다른 제목을 준다 — 같은 제목이 여럿이면 탭·북마크·공유 카드에서 구별되지 않는다.
  return rung
    ? { title: `${rung.volumeTitle} 연습 · Vocaflow`, description: `${rung.schoolBand} 계단 수준의 연습 문항을 풀어요` }
    : { title: '교재 연습' }
}

export default async function TextbookPracticePage({
  params,
}: {
  params: Promise<{ series: string; step: string }>
}) {
  const { series, step: raw } = await params
  const step = Number(raw)
  const rung = rungOf(series, step)
  if (!rung) notFound()
  // 발행 게이트(v6.2 P-F4a) — 발행 전 · 상태 미확인 권의 연습 화면은 없다(직접 주소로 들어와도)
  if (!canShow(stateOf(await loadPublishGate(series), step))) notFound()

  // 한 계단이 여러 V-Level 을 덮을 수 있다 — 첫 밴드를 쓴다(권의 대표 난이도).
  const vLevel = rung.vLevels[0] ?? 0
  const { items, unavailable, signedOut, scope, ownerId } = await fetchTextbookPracticeItems({ series, step, vLevel }, ITEM_LIMIT)

  // 로그인 뒤 **여기로 돌아온다.** 복귀 경로가 없으면 로그인하고 나서 다시 길을 찾아야 하고,
  // 그 지점에서 사람이 빠져나간다(`library/scripts` 가 이미 쓰는 규약을 그대로 따른다).
  const loginHref = `/login?${RETURN_PARAM}=${encodeURIComponent(`/library/textbooks/${series}/${step}/practice`)}`

  return (
      <Screen width="compact" background="bg2" padX="md" className="volume-practice-reference catalog-detail-reference">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <Link
            href={`/library/textbooks/${series}/${step}`}
            className="inline-flex w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            {rung.volumeTitle}
          </Link>
          <h1 className="font-editorial text-[20px] font-[800] text-[var(--t1)]">연습</h1>
          <p className="font-body text-[13px] text-[var(--t2)]">
            {rung.schoolBand} 계단의 연습 문항이에요. 푼 기록은 다음 문항을 고르는 데 쓰여요.
          </p>
        </header>

        {items.length > 0 && ownerId ? (
          // 마치면 이 교재(권)로 돌아온다 — 기본값 /hub 로 보내면 방금 고른 교재 맥락을 잃었다(복습 · 다음 선택은 교재 화면에서)
          // 계정 경계(TextbookPracticeBridge)가 같은 계정을 확인한 동안에만 문항 · 이미 본 해설 다시 보기를 그린다
          <TextbookPracticeBridge
            items={items}
            scope={scope}
            ownerId={ownerId}
            backHref={`/library/textbooks/${series}/${step}`}
            backCta="이 교재로 돌아가기"
            reopenHref={`/library/textbooks/${series}/${step}/practice`}
          />
        ) : (
          <section
            aria-label={
              signedOut ? '로그인이 필요함' : unavailable ? '문항을 불러오지 못함' : '연습 문항 없음'
            }
            className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
          >
            {signedOut && <LogIn size={40} strokeWidth={1.4} aria-hidden className="volume-practice-reference__icon" />}
            {/* ⚠️ 상태 **셋**을 구별한다 — 로그인 필요 · 조회 실패 · 재고 없음.
                셋을 뭉개면 각각 할 일이 다른데 같은 말을 듣는다.
                특히 로그인 필요를 '잠시 뒤 다시' 로 적으면 **영원히 안 되는 것을 기다리게** 한다
                (실측 2026-09-01: 익명 방문자가 정확히 그 화면을 보고 있었다. 서가는 공개
                표면이라 이 길로 오는 사람이 실제로 있다). */}
            <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
              {signedOut
                ? '로그인하면 바로 풀 수 있어요'
                : unavailable
                  ? '문항을 불러오지 못했어요'
                  : '이 계단에는 아직 연습 문항이 없어요'}
            </p>
            <p className="font-body text-[13px] leading-relaxed text-[var(--t2)] [word-break:keep-all]">
              {signedOut
                ? '채점과 기록이 계정에 쌓이기 때문에 로그인이 필요해요. 로그인하면 이 화면으로 돌아옵니다.'
                : unavailable
                  ? '잠시 문제가 있었어요. 잠시 뒤 다시 열어 볼까요?'
                  : '이 계단에는 아직 풀 수 있는 연습 문항이 준비되지 않았어요. 다른 계단을 펼쳐 볼까요?'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {signedOut && (
                <Link
                  href={loginHref}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]"
                >
                  로그인하고 풀기
                </Link>
              )}
              <Link
                href="/library/textbooks"
                className={`inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-5 font-display text-[14px] font-[700] no-underline transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  signedOut
                    ? 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] hover:text-[var(--p)]'
                    : 'bg-[var(--p)] text-[var(--on-p)] shadow-[var(--sh-xs)] hover:bg-[var(--p-hover)]'
                }`}
              >
                교재 서가로
              </Link>
            </div>
          </section>
        )}
      </div>
    </Screen>
  )
}
