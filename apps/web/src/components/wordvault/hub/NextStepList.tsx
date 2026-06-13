// apps/web/src/components/wordvault/hub/NextStepList.tsx
//
// WordVault Section 5 (v06.35 iOS) — 다음 한 단계 (단어장 추천).
//
// iOS Settings 인셋 그룹 + 컬러 캡슐 type 배지.
// recommend_word_sets_for_user RPC → 5-tier 추천.

'use client'

import { ChevronRight, Compass } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type RecommendationType =
  | 'primary'
  | 'stretch'
  | 'review'
  | 'specialty'
  | 'track_csat'
  | 'track_business'
  | 'track_academic'
  | 'fallback'

interface RawRecommendation {
  set_id: string
  slug: string
  title: string
  category: string | null
  word_count: number | null
  cover_emoji: string | null
  recommendation_type: string
  reason: string | null
  priority: number | null
}

interface RecommendedSet {
  id: string
  slug: string
  title: string
  type: RecommendationType
  category: string | null
  word_count: number | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'no-diagnostic' }
  | { kind: 'empty'; vLevel: number | null }
  | { kind: 'ready'; sets: RecommendedSet[]; vLevel: number | null }
  | { kind: 'error'; message: string }

const TYPE_META: Record<
  RecommendationType,
  { label: string; bg: string; color: string }
> = {
  primary: { label: '현재', bg: 'var(--p-light)', color: 'var(--p-dark)' },
  stretch: { label: '다음', bg: '#E8F8EE', color: '#15803D' },
  review: { label: '복습', bg: '#FFF1E5', color: '#9A3412' },
  specialty: { label: '관심', bg: '#F3E8FF', color: '#7C3AED' },
  track_csat: { label: '수능', bg: '#FEF3C7', color: '#92400E' },
  track_business: { label: '비즈', bg: '#E0F2FE', color: '#075985' },
  track_academic: { label: '학술', bg: '#FCE7F3', color: '#9D174D' },
  fallback: { label: '추천', bg: 'var(--bg2)', color: 'var(--t2)' },
}

export function NextStepList() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'unauth' })
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_v_level')
        .eq('user_id', user.id)
        .maybeSingle()

      const vLevel = (profile as { current_v_level: number | null } | null)?.current_v_level ?? null
      if (vLevel == null) {
        setState({ kind: 'no-diagnostic' })
        return
      }

      const { data, error } = await supabase.rpc('recommend_word_sets_for_user', {
        p_user_id: user.id,
      })
      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }

      const raws = (data ?? []) as RawRecommendation[]
      const sets: RecommendedSet[] = raws
        .map((r) => ({
          id: r.set_id,
          slug: r.slug,
          title: r.title,
          type: ((r.recommendation_type as RecommendationType) ?? 'fallback'),
          category: r.category,
          word_count: r.word_count,
        }))
        .slice(0, 5)
      if (sets.length === 0) {
        setState({ kind: 'empty', vLevel })
        return
      }
      setState({ kind: 'ready', sets, vLevel })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return <Frame title="다음 한 단계">{null}</Frame>
  }

  if (state.kind === 'unauth' || state.kind === 'no-diagnostic') {
    return (
      <Frame title="다음 한 단계">
        <div className="flex items-center justify-between gap-4 rounded-[18px] bg-[var(--bg2)] px-5 py-4">
          <p className="font-body text-[13px] text-[var(--t2)]">
            진단을 받으면 수준에 맞는 단어장을 추천해드려요.
          </p>
          <Link
            href="/diagnostic"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[12.5px] font-[600] text-white shadow-[0_2px_8px_rgba(59,130,246,0.22)] transition-all duration-[var(--dur-fast)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
          >
            <Compass size={13} aria-hidden />
            진단 받기
          </Link>
        </div>
      </Frame>
    )
  }

  if (state.kind === 'error' || state.kind === 'empty') {
    return (
      <Frame title="다음 한 단계">
        <p className="font-body text-[13px] text-[var(--t3)]">
          현재 추천 가능한 단어장이 없어요.
        </p>
      </Frame>
    )
  }

  return (
    <Frame
      title="다음 한 단계"
      meta={state.vLevel != null ? `V${state.vLevel} 기준` : undefined}
    >
      <div className="overflow-hidden rounded-[14px] bg-[var(--bg2)]">
        <div className="divide-y divide-[var(--bd)]/60 bg-[var(--bg)]">
          {state.sets.map((set) => {
            const typeMeta = TYPE_META[set.type]
            return (
              <Link
                key={set.id}
                href={`/library/vocab#set-${set.slug}`}
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)]"
              >
                {/* Type 배지 — 컬러 캡슐 */}
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded-[var(--r-full)] px-2.5 py-1 font-display text-[10.5px] font-[700]"
                  style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
                >
                  {typeMeta.label}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-1 font-display text-[14px] font-[600] tracking-[-0.012em] text-[var(--t1)] group-hover:text-[var(--p)]">
                    {set.title}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[var(--t3)]">
                    {set.word_count != null && set.word_count > 0 && (
                      <span className="tabular-nums">{set.word_count}개</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="shrink-0 text-[var(--t3)]/70" aria-hidden />
              </Link>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

function Frame({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[24px] bg-[var(--bg)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] md:p-7"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] font-[700] tracking-[-0.022em] text-[var(--t1)]">
          {title}
        </h2>
        {meta && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
            {meta}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}
