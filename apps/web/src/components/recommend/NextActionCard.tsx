// apps/web/src/components/recommend/NextActionCard.tsx
//
// 게임 세션 종료 후 다음 추천 노출 — CLAUDE.md §17.3 추천 축 (3곳 중 1곳)
// Hub Today CTA · FloatingSparkle 와 동일한 RecommendedAction 사용.
//
// 안티패턴 회피:
// - 격려형 라벨링 (recommendation.label 그대로 표시)
// - 정확도 / 실패 카운트 노출 X
// - 자동 재출현 X (한 번만 표시, 사용자가 닫거나 클릭하면 끝)

'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

import { actionToHref } from '@/lib/recommend/next-action.mock'
import type { RecommendedAction } from '@/lib/recommend/types'

interface NextActionCardProps {
  /** §17.9 추천 엔진 결과 */
  recommendation: RecommendedAction
  /** 카드 위에 표시할 짧은 격려 메시지 (선택) */
  prelude?: string
}

export function NextActionCard({ recommendation, prelude }: NextActionCardProps) {
  const href = actionToHref(recommendation)

  return (
    <section
      className="rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-5"
      aria-label="다음 추천"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} strokeWidth={2} className="text-[var(--p)]" aria-hidden="true" />
        <span className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          다음 추천
        </span>
      </div>

      {prelude && (
        <p className="mb-3 font-body text-[13px] leading-snug text-[var(--t2)]">{prelude}</p>
      )}

      <p className="mb-4 font-display text-[16px] font-[700] leading-snug text-[var(--t1)]">
        {recommendation.label}
      </p>

      <Link
        href={href}
        aria-label={recommendation.label}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] px-5 py-3 font-display text-[14px] font-[700] text-white no-underline shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.01] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <span>시작하기</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}
