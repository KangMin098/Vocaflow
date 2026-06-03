// apps/web/src/hooks/useSubscribedSets.ts
//
// 사용자가 구독한 공용 단어장 fetch — /text 허브 my library carousel 의 '단어장' 탭.

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
