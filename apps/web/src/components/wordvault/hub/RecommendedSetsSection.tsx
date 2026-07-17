// apps/web/src/components/wordvault/hub/RecommendedSetsSection.tsx
//
// WordVault hub Tier 2 — VRL Placement 기반 추천 단어장
//
// 호출:
//   - 진단 미완료 (current_v_level NULL/0): "진단 받기" CTA
//   - 진단 완료: recommend_word_sets_for_user RPC → 3-tier + specialty 카드
//
// 정합:
//   - Phase 2D.2 recommend_word_sets_for_user(uuid, text[] DEFAULT NULL)
//   - 진단 흐름: /diagnostic 라우트
//   - WordVault hub Tier 1 Hero (Identity) 다음 위치 — 자율성 진입점

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Compass, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { VLevelPromotionCheck } from './VLevelPromotionCheck'

interface Recommendation {
  set_id: string
  slug: string
  title: string
  category: string
  word_count: number
  cover_emoji: string | null
  recommendation_type: string
  reason: string
  priority: number
}

const TYPE_BADGE: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  primary:   { label: '메인', bg: 'var(--p)',          text: 'var(--ti)' },
  stretch:   { label: '도전', bg: 'var(--active)',     text: 'var(--ti)' },
  review:    { label: '보강', bg: 'var(--bg3)',        text: 'var(--t2)' },
  specialty: { label: '관심', bg: 'var(--info-light)', text: 'var(--info)' },
  etymology: { label: '어원', bg: 'var(--warn-light, var(--info-light))', text: 'var(--warn, var(--info))' },
  topic:     { label: '주제', bg: 'var(--bg3)',        text: 'var(--t2)' },
  fallback:  { label: '추천', bg: 'var(--bg3)',        text: 'var(--t2)' },
}

interface Props {
  /** 미진단 상태에서 자체 CTA 카드 숨김 (Hub 에서 사용 — TodayFocus 가 이미 진단 안내) */
  hideUndiagnosedCard?: boolean
}

export function RecommendedSetsSection({ hideUndiagnosedCard = false }: Props = {}) {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null)
  const [hasDiagnostic, setHasDiagnostic] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        setHasDiagnostic(false)
        return
      }

      // 진단 완료 여부 확인
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_v_level, diagnostic_completed_at')
        .eq('user_id', userId)
        .maybeSingle()

      const completed =
        !!profile?.diagnostic_completed_at && (profile.current_v_level ?? 0) > 0
      setHasDiagnostic(completed)

      const { data: recs } = await supabase.rpc(
        'recommend_word_sets_for_user',
        { p_user_id: userId, p_interests: undefined },
      )
      setRecommendations((recs ?? []) as Recommendation[])
    })()
  }, [])

  // 미진단 또는 fallback only → CTA 카드
  if (hasDiagnostic === false || (recommendations && recommendations.every((r) => r.recommendation_type === 'fallback'))) {
    if (hideUndiagnosedCard) return null
    return (
      <section
        aria-labelledby="recommended-sets-heading"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg)] p-5"
      >
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] text-[var(--ti)]"
            aria-hidden
          >
            <Compass size={20} strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <h2
              id="recommended-sets-heading"
              className="font-display text-[15px] font-[700] text-[var(--t1)]"
            >
              5분 진단으로 V-Level 추천 받기
            </h2>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
              40문항으로 당신의 V-Level을 측정하고 맞춤 단어장을 추천받아요.
            </p>
          </div>
          <Link
            href="/diagnostic"
            className="shrink-0 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
          >
            진단 시작
          </Link>
        </div>
      </section>
    )
  }

  if (!recommendations || recommendations.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="recommended-sets-heading">
      <header className="mb-3 flex items-center justify-between">
        <h2
          id="recommended-sets-heading"
          className="inline-flex items-center gap-2 font-display text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]"
        >
          <Sparkles size={13} className="text-[var(--p)]" />
          맞춤 추천
        </h2>
        <Link
          href="/diagnostic"
          className="font-body text-[11px] text-[var(--t3)] underline-offset-2 hover:text-[var(--t2)] hover:underline"
        >
          다시 진단
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec) => {
          const badge = TYPE_BADGE[rec.recommendation_type] ?? TYPE_BADGE.fallback
          // library_book 세트는 /library/vocab 에서 제외(clutter)라 앵커가 죽어 있음 → 도서 브라우즈로(v06.218).
          //   그 외 공용단어장 앵커는 카드가 id="set-{UUID}" 로 렌더하므로 slug(≠uuid·NULL 다수) 대신
          //   set_id(UUID)로 링크해야 :target 하이라이트가 매칭됨(v06.219 — 전 추천 딥링크 죽어있던 버그).
          const isBook = rec.category === 'library_book'
          const href = isBook ? '/library/books' : `/library/vocab#set-${rec.set_id}`
          return (
            <Link
              key={rec.set_id}
              href={href}
              aria-label={isBook ? `${rec.title} — 도서 라이브러리에서 열기` : `${rec.title} — 라이브러리에서 구독`}
              className="group flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
            >
              <span className="text-[28px] leading-none" aria-hidden>
                {rec.cover_emoji ?? '📒'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center rounded-[var(--r-full)] px-1.5 py-0.5 font-display text-[9px] font-[700] uppercase tracking-wider"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                  <span className="font-body text-[10px] text-[var(--t3)]">
                    {rec.word_count}개
                  </span>
                </div>
                <h3 className="truncate font-display text-[13px] font-[600] text-[var(--t1)] group-hover:text-[var(--p)]">
                  {rec.title}
                </h3>
                <p className="mt-0.5 truncate font-body text-[11px] text-[var(--t3)]">
                  {rec.reason}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Phase 2E wire-up — 학습 활동 누적 기반 V-Level 갱신 체크 */}
      <VLevelPromotionCheck />
    </section>
  )
}
