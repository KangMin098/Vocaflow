// apps/web/src/components/home/TodayFocus.tsx
//
// 관문의 **첫 방문 카드** — 아직 진단하지 않은 사람에게 보이는 단 하나의 제안.
//
// ─────────────────────────────────────────────────────────────
// v06.202 재작성 — 이 파일은 네 가지가 동시에 잘못돼 있었다 (2026-08-16 실측)
//
// ① **다크모드에서 글자가 안 보였다.** 배경을 `accentTint: '#F5F3FF'`(거의 흰색)로 하드코딩하고
//    글자를 `var(--t1)` 로 뒀는데, `--t1` 은 다크에서 `#F0EAE0`(거의 흰색)이다.
//    → 흰 바탕에 흰 글자, 대비 약 1.05:1. 프로젝트 절대 규칙 두 개를 동시에 위반했다
//    ("CSS Variables 로 테마 제어 — 하드코딩 금지" · "`data-theme='dark'` 모든 컴포넌트 대응 필수").
//    이 화면은 **검증 계정에서 절대 렌더되지 않아**(그 계정은 진단 완료 상태) 눈으로는
//    영영 발견되지 않는 종류의 결함이었다.
//
// ② **페르소나 5종 중 4종이 죽은 코드였다.** `/hub` 이 `{!hasTodayPlan && !isDiagnosed && <TodayFocus/>}`
//    로만 부르므로 `undiagnosed` 외의 분기(cold·warm-risk·warm-progress·hot)에는 도달할 수 없었다.
//    도달 불가 코드는 "구현돼 있다" 는 착각을 만들고 리뷰 비용만 든다 → 삭제.
//
// ③ **보라 계열(#AF52DE·#5856D6)을 썼다.** 보라는 이 제품에서 **Admin 콘솔 전용 액센트**다.
//    학습자 화면이 같은 색을 쓰면 두 체계가 섞인다.
//
// ④ **조사 오류** — `'단어장 또는 스크립트을 골라'`. 받침 없는 명사 뒤라 '를' 이어야 하고,
//    이름도 레지스트리상 `Texts` 로 확정됐는데 옛 이름이 남아 있었다.
//    (같은 세션에 `GatewayLead` 에서 고친 것과 같은 계열 — 조사는 손으로 붙이면 반드시 틀린다.)
//
// 문구 원칙: 처음 온 사람에게 **시스템을 설명하지 않는다.** 이전 문구는
// "한국 학습자 12단계 V-Level 체계로 본인의 어휘 수준을 정확히 측정합니다" 였는데,
// 'V-Level' 은 아직 아무 의미가 없는 내부 용어다. 무엇을 얻는지만 말한다.
// ─────────────────────────────────────────────────────────────

import { ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'

export function TodayFocus() {
  return (
    <section
      aria-label="시작하기"
      className="relative overflow-hidden rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-7"
    >
      {/* 액센트 스트립 — 토큰만 쓴다(테마가 뒤집혀도 짝이 유지된다). */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--p)]" />

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          >
            <Compass size={20} strokeWidth={1.9} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
              시작하기
            </p>
            <h2 className="mt-1.5 max-w-[24ch] font-editorial text-[24px] font-[500] leading-[1.25] tracking-[-0.014em] text-[var(--t1)] [word-break:keep-all] md:text-[28px]">
              5분이면 오늘 읽을 것이 정해져요
            </h2>
            <p className="mt-2.5 max-w-[46ch] font-body text-[13.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
              몇 개의 단어를 아는지만 확인하면, 지금 읽을 수 있는 글과 오늘 만날 단어를
              골라 드려요. 맞히지 못해도 괜찮아요 — 맞은 개수가 아니라 어디쯤인지를 봅니다.
            </p>
          </div>
        </div>

        <Link
          href="/diagnostic"
          className="group inline-flex min-h-[48px] shrink-0 items-center gap-2 self-start rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 md:self-auto"
        >
          시작하기
          <ArrowRight
            size={15}
            aria-hidden
            className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  )
}
