// apps/web/src/hooks/useSubscribedSets.ts
//
// 사용자가 구독한 공용 단어장 fetch — /text 허브 my library carousel 의 '단어장' 탭.
//
// 노출 분리 정책 (lib/library/vocab/queries.ts 와 정합):
//   도서 챕터 단어장(category='library_book')은 단어장 카탈로그에 노출하지 않는다.
//   enroll 시 자동 구독되지만(도서 상세의 챕터별 구독상태 표시용), "단어장"은 사용자가
//   의도적으로 고른 독립 큐레이션(수능·TOEIC 등) 전용. 도서 vocab 은 도서 컨텍스트
//   (/library/books/[id]) + WordVault(import된 단어)로만 접근.

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

import { createClient } from '@/lib/supabase/client'

export interface SubscribedSet {
  id: string
  title: string
  description: string | null
  category: string
  cefrLevel: string | null
  coverEmoji: string | null
  wordCount: number
  subscribedAt: string
}

function useAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUserId(data.user?.id ?? null)
      setAuthReady(true)
    })

    return () => {
      mounted = false
    }
  }, [])

  return { userId, authReady }
}

async function fetchSubscribedSets(userId: string): Promise<SubscribedSet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_word_set_subscriptions')
    .select(
      `subscribed_at,
       shared_word_sets!inner (
         id, title, description, category, cefr_level, cover_emoji, word_count, is_published
       )`,
    )
    .eq('user_id', userId)
    .order('subscribed_at', { ascending: false })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[useSubscribedSets] fetch error:', error)
    return []
  }

  type Row = {
    subscribed_at: string
    shared_word_sets: {
      id: string
      title: string
      description: string | null
      category: string
      cefr_level: string | null
      cover_emoji: string | null
      word_count: number | null
      is_published: boolean
    } | null
  }

  return (data ?? [])
    .map((r) => r as unknown as Row)
    .filter((r) => r.shared_word_sets && r.shared_word_sets.is_published)
    // 노출 분리 — 도서 챕터 단어장은 단어장 카탈로그에서 제외 (도서 컨텍스트 전용)
    .filter((r) => r.shared_word_sets!.category !== 'library_book')
    .map((r) => ({
      id: r.shared_word_sets!.id,
      title: r.shared_word_sets!.title,
      description: r.shared_word_sets!.description,
      category: r.shared_word_sets!.category,
      cefrLevel: r.shared_word_sets!.cefr_level,
      coverEmoji: r.shared_word_sets!.cover_emoji,
      wordCount: r.shared_word_sets!.word_count ?? 0,
      subscribedAt: r.subscribed_at,
    }))
}

export interface UseSubscribedSetsResult {
  sets: SubscribedSet[]
  isLoading: boolean
}

export function useSubscribedSets(): UseSubscribedSetsResult {
  const { userId, authReady } = useAuthUserId()
  const swr = useSWR(
    userId ? ['subscribed-sets', userId] : null,
    () => fetchSubscribedSets(userId!),
    { dedupingInterval: 5_000, revalidateOnFocus: true },
  )
  return {
    sets: swr.data ?? [],
    isLoading: !authReady || (!!userId && swr.isLoading),
  }
}
