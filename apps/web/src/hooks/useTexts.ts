// apps/web/src/hooks/useTexts.ts
//
// TextViewer 허브 (/text) 데이터 훅 — Phase 3 Supabase 연동.
//
// useHubData 패턴 정합:
//   - useAuthUserId 로 인증 결정 후 SWR 키 발행
//   - dedupingInterval 5초 / revalidateOnFocus / revalidateOnReconnect
//   - RLS 자동 격리 (auth.uid() = user_id)

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

import { createClient } from '@/lib/supabase/client'
import type { CEFRLevel, LibraryText } from '@/types/library'

import type { Tables } from '@vocaflow/types'

type TextsRow = Tables<'texts'>

const CATEGORY_MAP: Record<string, string> = {
  library: '라이브러리',
  'direct-script': '직접 입력',
  'direct-file': '파일',
  'shared-set': '공용 단어장',
}

function mapDbToLibraryText(row: TextsRow): LibraryText {
  const wordCount = row.content.split(/\s+/).filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(wordCount / 250))
  const progress = Number(row.progress_percent ?? 0)
  const currentPage = Math.floor((totalPages * progress) / 100)

  return {
    id: row.id,
    title: row.title,
    author: row.author || '저자 미상',
    cefrLevel: (row.cefr_level || 'B1') as CEFRLevel,
    category: CATEGORY_MAP[row.source ?? 'direct-script'] ?? '직접 입력',
    preview:
      row.content.slice(0, 100).trim() + (row.content.length > 100 ? '…' : ''),
    wordCount,
    progressPercent: progress,
    totalPages,
    currentPage,
    coverGradient: {
      from: row.cover_from || '#A78BFA',
      to: row.cover_to || '#6D28D9',
    },
    addedAt: new Date(row.created_at || Date.now()),
    lastStudiedAt: row.last_opened ? new Date(row.last_opened) : null,
    isBookmarked: row.is_bookmarked ?? false,
  }
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

    // 명시적 SIGNED_OUT 이외의 이벤트가 session=null 로 잠시 발화될 수 있어
    // (INITIAL_SESSION 직후 TOKEN_REFRESHED 등) userId 를 null 로 내리면
    // SWR 키가 깜빡이며 데이터가 사라졌다 돌아오는 플리커가 발생.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        setUserId(null)
        return
      }
      const next = session?.user?.id
      if (next) setUserId(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { userId, authReady }
}

async function fetchTexts(userId: string): Promise<LibraryText[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('texts')
    .select('*')
    .eq('user_id', userId)
    .order('last_opened', { ascending: false, nullsFirst: false })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[useTexts] fetch error:', error)
    return []
  }

  return (data ?? []).map(mapDbToLibraryText)
}

export interface UseTextsResult {
  texts: LibraryText[]
  isLoading: boolean
  error: Error | null
  stats: {
    total: number
    conquered: number
    inProgress: number
    notStarted: number
  }
  continueText: LibraryText | null
  refresh: () => void
}

export function useTexts(): UseTextsResult {
  const { userId, authReady } = useAuthUserId()

  const swr = useSWR(
    userId ? ['texts', userId] : null,
    () => fetchTexts(userId!),
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  const texts = swr.data ?? []

  const stats = {
    total: texts.length,
    conquered: texts.filter((t) => t.progressPercent >= 100).length,
    inProgress: texts.filter(
      (t) => t.progressPercent > 0 && t.progressPercent < 100,
    ).length,
    notStarted: texts.filter((t) => t.progressPercent === 0).length,
  }

  const continueText =
    texts
      .filter((t) => t.progressPercent > 0 && t.progressPercent < 100)
      .sort((a, b) => {
        const aTime = a.lastStudiedAt?.getTime() ?? 0
        const bTime = b.lastStudiedAt?.getTime() ?? 0
        return bTime - aTime
      })[0] ?? null

  return {
    texts,
    isLoading: !authReady || (!!userId && swr.isLoading),
    error: (swr.error as Error | undefined) ?? null,
    stats,
    continueText,
    refresh: () => {
      void swr.mutate()
    },
  }
}
