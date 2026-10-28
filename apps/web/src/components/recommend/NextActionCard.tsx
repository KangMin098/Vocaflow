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
import { ArrowRight } from 'lucide-react'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom'

import { actionToHref } from '@/lib/recommend/next-action.mock'
import type { RecommendationReason, RecommendedAction } from '@/lib/recommend/types'

/** 추천 근거 → 짧은 이유. 기록 부족 · 조회 실패를 낮은 능력으로 바꿔 말하지 않는다. */
export const REASON_COPY: Record<RecommendationReason, string> = {
  due_review: '복습할 때가 된 단어가 있어 권해요.',
  resume_text: '열어 둔 글이 있어 그 글로 돌아가 보길 권해요.',
  practice_flow: '보유 어휘·활동 단서를 바탕으로 다음 연습을 제안해요.',
  explore: '새 자료를 골라 시작해 보도록 권해요.',
  unconfirmed: '일부 추천 근거를 확인하지 못해 잠정적으로 제안해요.',
}
/** 근거 코드가 없는 기존 객체 — 구체 근거를 지어내지 않는다 */
export const GENERIC_REASON = '다음에 해 볼 만한 활동을 제안해요.'
/** 관측 범위 — 추천은 실력 판정이 아니다 */
export const LIMIT_NOTE = '이번 추천은 독해 실력을 측정한 결과가 아니에요.'
const LIBRARY_HREF = '/library'

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
        <Gwonjeom size={14} strokeWidth={2} className="text-[var(--p)]" aria-hidden="true" />
        <span className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--p)]">
          다음 추천
        </span>
      </div>

      {prelude && (
        <p className="mb-3 font-body text-[13px] leading-snug text-[var(--t2)]">{prelude}</p>
      )}

      <p className="mb-4 font-display text-[16px] font-[700] leading-snug text-[var(--t1)]">
        {recommendation.label}
      </p>

      <div className="mb-4 flex flex-col gap-1" data-testid="next-action-reason">
        <p className="break-keep font-body text-[13px] leading-snug text-[var(--t1)]">
          {recommendation.reason ? REASON_COPY[recommendation.reason] : GENERIC_REASON}
        </p>
        <p className="break-keep font-body text-[12px] leading-snug text-[var(--t2)]">{LIMIT_NOTE}</p>
      </div>

      <Link
        href={href}
        aria-label={recommendation.label}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] px-5 py-3 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.01] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <span>시작하기</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>

      {/* 직접 고르는 출구 — 주 목적지가 이미 라이브러리면 같은 버튼을 겹치지 않는다 */}
      {href !== LIBRARY_HREF && (
        <Link
          href={LIBRARY_HREF}
          data-testid="next-action-choose"
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t1)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          다른 자료 고르기
        </Link>
      )}
    </section>
  )
}
