// apps/web/src/components/home/TodayFocus.tsx
//
// 관문의 **첫 방문 지면** — 아직 진단하지 않은 사람이 보는 화면.
//
// ─────────────────────────────────────────────────────────────
// v06.203 재설계 — 관문은 시험이 아니라 지면이어야 한다
//
// 이전 버전(v06.202)은 문구·토큰·다크모드를 고쳤지만 **구조는 그대로 시험 하나**였다:
// 신규 학습자가 관문에서 받는 것이 "5분 진단하세요" 뿐이고, 진단을 안 하면 화면에
// 남는 것이 없었다 — 어휘 학습 제품인데 **단어 한 개, 문장 한 줄이 없었다.**
//
// 근거:
//   · 자체 실측(2026-08-16, `/admin` 리텐션 패널 1회차) — **가입 → 첫 학습 중앙값 55일**.
//     리텐션 이전에 활성화가 막혀 있고, 그 지점의 화면이 여기다.
//   · 온보딩 연구 — 가치를 게이트 뒤에 두는 것이 가장 비싼 실수 · 가치 도달 30분 초과 시
//     이탈 약 3배 · 신규의 70~80%가 3일 내 이탈하며 대부분 **가치를 만나기 전 첫 세션**에서 빠진다.
//   · 재료는 이미 있었다 — `shared_dictionary` 에 뜻·예문·CEFR·빈도를 다 갖춘 단어 28,946개.
//     파이프라인이 몇 달간 채운 것을 관문이 한 번도 쓰지 않았다.
//
// 그래서 순서를 뒤집었다:
//   **① 제품이 하는 일을 먼저 보여준다(단어 하나) → ② 진단은 게이트가 아니라 제안으로 아래에.**
//
// 이 지면은 진단을 마친 학습자의 무대(`TodayStage`)와 **같은 조판**을 쓴다. 처음 온 사람이
// 보는 것이 나중에 매일 볼 것과 같아야, 진단이 "새로운 곳으로 가는 문" 이 아니라
// "이 지면을 내 것으로 만드는 일" 로 읽힌다.
//
// 단일 CTA 규칙 유지 — 1차 행동은 진단 하나. 서재 둘러보기는 링크(2차)다.
// ⚠️ 색은 토큰만 쓴다. 이전 버전이 `#F5F3FF` 배경 + `var(--t1)` 글자로 **다크모드에서
//    흰 바탕에 흰 글자**(대비 약 1.05:1)였다 — 이 화면은 검증 계정에서 렌더되지 않아
//    눈으로는 영영 안 잡히는 자리다. 회귀는 `__tests__/TodayFocus.test.tsx` 가 잠근다.
// ─────────────────────────────────────────────────────────────

import { ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'

import type { TasteWord } from '@/lib/learner/taste-word'

export function TodayFocus({ word }: { word: TasteWord | null }) {
  return (
    <section
      aria-label="시작하기"
      className="relative overflow-hidden rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--p)]" />

      {/* ── 지면: 제품이 하는 일 ── */}
      {word && (
        <>
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            오늘 만나 볼 단어
          </p>

          <h2 className="mt-4 font-editorial text-[40px] font-[500] leading-[1.02] tracking-[-0.02em] text-[var(--t1)] md:text-[52px]">
            {word.word}
          </h2>

          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] tabular-nums text-[var(--t3)]">
            {word.cefr && <span>{word.cefr}</span>}
            {word.rank !== null && <span>· 자주 쓰는 순 {word.rank.toLocaleString()}위</span>}
          </p>

          <hr className="my-5 border-0 border-t border-[var(--bd)]" />

          <p className="max-w-[54ch] font-body text-[17px] leading-[1.65] text-[var(--t1)] [word-break:keep-all] md:text-[18px]">
            {word.meaningKo}
          </p>

          <blockquote className="mt-4 max-w-[58ch] border-l-2 border-[var(--bd)] pl-4 font-editorial text-[15px] italic leading-[1.7] text-[var(--t2)] md:text-[17px]">
            {word.exampleEn}
          </blockquote>
        </>
      )}

      {/* ── 제안: 게이트가 아니다 ──
          단어를 본 다음에 온다. 순서가 뒤집히면 다시 시험이 된다. */}
      <div
        className={`flex flex-col gap-4 md:flex-row md:items-center md:gap-8 ${
          word ? 'mt-8 border-t border-[var(--bd)] pt-6' : ''
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          >
            <Compass size={20} strokeWidth={1.9} />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="max-w-[26ch] font-display text-[16px] font-[700] leading-[1.4] text-[var(--t1)] [word-break:keep-all] md:text-[17px]">
              {word
                ? '이런 단어를 내 수준에 맞춰 골라 드릴까요?'
                : '5분이면 오늘 읽을 것이 정해져요'}
            </h3>
            <p className="mt-1.5 max-w-[46ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
              몇 개의 단어를 아는지만 확인하면, 지금 읽을 수 있는 글과 오늘 만날 단어를 골라
              드려요. 맞히지 못해도 괜찮아요 — 맞은 개수가 아니라 어디쯤인지를 봅니다.
            </p>
          </div>
        </div>

        <Link
          href="/diagnostic"
          className="group inline-flex min-h-[48px] shrink-0 items-center gap-2 self-start rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 md:self-auto"
        >
          5분 시작하기
          <ArrowRight
            size={15}
            aria-hidden
            className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {/* 2차 — 진단을 안 하고도 갈 곳이 있다. 게이트가 아님을 화면으로 증명하는 줄이다. */}
      <p className="mt-4 font-body text-[13px] leading-snug text-[var(--t3)]">
        <Link
          href="/library"
          className="inline-flex min-h-[44px] items-center font-display font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          먼저 둘러보기
        </Link>
        <span className="ml-2">— 진단 없이도 서재를 볼 수 있어요</span>
      </p>
    </section>
  )
}
