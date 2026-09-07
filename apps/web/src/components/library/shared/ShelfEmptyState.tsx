// apps/web/src/components/library/shared/ShelfEmptyState.tsx
//
// 서가의 **막다른 화면을 없애는** 한 조각 — 빈 서가 · 필터 0건 · 조회 실패 공용.
//
// ── 왜 한 곳에 모으나 (실측 2026-09-05) ─────────────────────────────────
// 라이브러리·만화 슬라이스의 빈 상태 네 곳이 서로 다른 모양으로 **전부 막다른 길**이었다:
//   · `/library/books`   — 이모지 + 제목 한 줄. 링크도 버튼도 없다.
//   · `/library/scripts` — 문장 두 줄. 다음 걸음 없음.
//   · `/library/vocab`   — 필터가 0건을 만들었을 때도 같은 죽은 상자. 되돌릴 버튼이 없어
//                          카테고리 칩을 잘못 누른 사람이 빠져나오지 못한다.
//   · `/comics/restored` — 바로 위 `NotReady()` 는 `/library/books` 링크를 가졌는데
//                          `Empty()` 만 링크가 빠졌다.
// CLAUDE.md D4: "빈 상태에 **다음 한 걸음**이 반드시 있다 — 막다른 화면 = 이탈".
//
// 결은 이 저장소에서 가장 잘 된 빈 상태를 따른다 —
// `components/game/scriptquiz/ScriptQuizQueue.tsx` 의 `AllCaughtUp`:
//   상황을 세 갈래로 갈라 각각 다른 문구와 CTA 를 주고, 비난하지 않고 맥락을 말한다
//   (Empathetic Feedback). 폭죽·트로피는 두지 않는다(철학 ④).
//
// ── 「없다」와 「못 읽었다」를 가른다 ────────────────────────────────────
// 조회가 실패했을 때 "아직 게시된 도서가 없어요" 를 보여 주면 재고 312권이 그대로인데
// 화면이 0을 말한다. 오류 로그도 화면 신호도 없어 아무도 못 잡는다. `tone="error"` 는
// 그 상태를 **다른 문구·다른 색·다시 시도 버튼**으로 갈라 놓는다.

'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'

export interface ShelfEmptyStateProps {
  /** 'empty' = 재고가 없다 · 'filtered' = 조건이 걸렀다 · 'error' = 못 읽었다 */
  tone?: 'empty' | 'filtered' | 'error'
  title: string
  /** 한 문단. 왜 비었는지 + 지금 할 수 있는 일. */
  body: string
  /** 다음 한 걸음 — 링크(있으면 항상 그린다). */
  ctaHref?: string
  ctaLabel?: string
  /** 되돌리기 — 필터 초기화·다시 시도처럼 화면 안에서 끝나는 동작. */
  onAction?: () => void
  actionLabel?: string
}

const TONE_ICON = {
  empty: Sparkles,
  filtered: Sparkles,
  error: AlertTriangle,
} as const

export function ShelfEmptyState({
  tone = 'empty',
  title,
  body,
  ctaHref,
  ctaLabel,
  onAction,
  actionLabel,
}: ShelfEmptyStateProps) {
  const Icon = TONE_ICON[tone]
  const isError = tone === 'error'

  return (
    <div
      // 오류는 그냥 상태가 아니다 — 스크린리더가 끼어들어 읽어야 한다.
      role={isError ? 'alert' : 'status'}
      className="flex flex-col items-start gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] p-6"
    >
      <span
        aria-hidden
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-full)]"
        style={
          isError
            ? { backgroundColor: 'var(--error-light)', color: 'var(--error-ink)' }
            : { backgroundColor: 'var(--warning-light)', color: 'var(--warning-ink)' }
        }
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <h3 className="font-display text-[15px] font-[700] text-[var(--t1)] break-keep">{title}</h3>
      <p className="max-w-[46ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] break-keep">
        {body}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {ctaLabel}
            <ArrowRight size={13} aria-hidden />
          </Link>
        )}
        {onAction && actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] active:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={13} aria-hidden />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
