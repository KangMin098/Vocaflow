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

import { Capsule, Frame } from '@/components/ui/ios'
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

type CapsuleTone = 'brand' | 'green' | 'orange' | 'purple' | 'yellow' | 'blue' | 'pink' | 'gray'

const TYPE_META: Record<
  RecommendationType,
  { label: string; tone: CapsuleTone }
> = {
  primary: { label: '현재', tone: 'brand' },
  stretch: { label: '다음', tone: 'green' },
  review: { label: '복습', tone: 'orange' },
  specialty: { label: '관심', tone: 'purple' },
  track_csat: { label: '수능', tone: 'yellow' },
  track_business: { label: '비즈', tone: 'blue' },
  track_academic: { label: '학술', tone: 'pink' },
  fallback: { label: '추천', tone: 'gray' },
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
            className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[12.5px] font-[600] text-white shadow-[0_2px_8px_rgba(88,86,214,0.25)] transition-all duration-[var(--dur-fast)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
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
        <p className="font-body text-[13px] text-[var(--t2)]">
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
            // 방어 — recommend RPC 가 TYPE_META 미등록 tier 를 반환하면 undefined.tone 크래시 (v06.183 /hub 복구)
            const typeMeta = TYPE_META[set.type] ?? TYPE_META.fallback
            return (
              <Link
                key={set.id}
                href={`/library/vocab#set-${set.slug}`}
                className="group flex items-center gap-3 px-4 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)]"
              >
                <Capsule tone={typeMeta.tone}>{typeMeta.label}</Capsule>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-1 font-display text-[14px] font-[600] tracking-[-0.012em] text-[var(--t1)] group-hover:text-[var(--p)]">
                    {set.title}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[var(--t2)]">
                    {set.word_count != null && set.word_count > 0 && (
                      <span className="tabular-nums">{set.word_count}개</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="shrink-0 text-[var(--t2)]/70" aria-hidden />
              </Link>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

