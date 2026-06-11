// apps/web/src/components/wordvault/hub/NextStepList.tsx
//
// WordVault Zone 2 (v06.35) — 다음 한 단계.
// 진단 결과 기반 추천 단어장 3-5개를 텍스트 list (Editorial). 카드/배지 X.
// 진단 미완료 시 단일 CTA (지단 받기).

'use client'

import { ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface RecommendedSet {
  id: string
  slug: string
  title: string
  type: 'primary' | 'stretch' | 'review' | 'specialty' | 'track_csat' | 'track_business' | 'track_academic'
  vlevel: number | null
  category?: string | null
  word_count?: number | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'no-diagnostic' }
  | { kind: 'empty'; vLevel: number | null }
  | { kind: 'ready'; sets: RecommendedSet[]; vLevel: number | null }
  | { kind: 'error'; message: string }

const TYPE_LABEL: Record<RecommendedSet['type'], string> = {
  primary: '현재 수준',
  stretch: '한 단계 위',
  review: '복습',
  specialty: '관심 분야',
  track_csat: '수능',
  track_business: '비즈니스',
  track_academic: '학술',
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

      const sets = ((data ?? []) as RecommendedSet[]).slice(0, 5)
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
        <p className="font-body text-[14px] leading-relaxed text-[var(--t2)]">
          진단을 마치면 V-Level 에 맞는 단어장 3-5개를 추천해드려요.{' '}
          <Link
            href="/diagnostic"
            className="inline-flex items-baseline gap-1 font-display font-[600] text-[var(--p)] underline-offset-2 hover:underline"
          >
            <Compass size={13} aria-hidden />
            진단 받기
            <ArrowRight size={12} aria-hidden />
          </Link>
        </p>
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
      meta={state.vLevel != null ? `V${state.vLevel} 기준 추천` : undefined}
    >
      <ol className="flex flex-col">
        {state.sets.map((set, i) => (
          <li
            key={set.id}
            className="border-b border-[var(--bd)] last:border-b-0"
          >
            <Link
              href={`/library/vocab#set-${set.slug}`}
              className="group flex items-center gap-4 py-3.5 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)]"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] font-[700] tabular-nums text-[var(--t4)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[14px] font-[600] text-[var(--t1)]">
                  {set.title}
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-[var(--t3)]">
                  <span>{TYPE_LABEL[set.type] ?? set.type}</span>
                  {set.vlevel != null && (
                    <>
                      <span aria-hidden className="text-[var(--t4)]">·</span>
                      <span className="tabular-nums">V{set.vlevel}</span>
                    </>
                  )}
                  {set.word_count != null && set.word_count > 0 && (
                    <>
                      <span aria-hidden className="text-[var(--t4)]">·</span>
                      <span className="tabular-nums">{set.word_count}개</span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight
                size={13}
                aria-hidden
                className="text-[var(--t4)] transition-colors group-hover:text-[var(--p)]"
              />
            </Link>
          </li>
        ))}
      </ol>
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
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {title}
        </span>
        {meta && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
            {meta}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}
