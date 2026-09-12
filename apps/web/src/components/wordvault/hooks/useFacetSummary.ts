// apps/web/src/components/wordvault/hooks/useFacetSummary.ts
//
// 면 요약 fetcher — `/api/wordvault/facets`.
//
// `useHubStats` 처럼 Supabase 를 직접 치지 않고 API 를 거치는 이유:
// 계산이 `learning_records` 전량을 훑으므로, 클라이언트가 직접 하면 학습자의 인출 이력이
// 통째로 브라우저에 실린다. 서버가 접어서 면 6개의 카운트만 내려보낸다.
//
// 실패는 조용히 넘긴다 — 이 섹션이 없어도 허브의 나머지는 그대로 쓸 수 있어야 한다.

'use client'

import { useEffect, useState } from 'react'

import type { FacetSummary } from '@/lib/framework/word-progress-query'

export type FacetSummaryState =
  | { status: 'loading'; data: null }
  | { status: 'unavailable'; data: null }
  | { status: 'ready'; data: FacetSummary }

export function useFacetSummary(): FacetSummaryState {
  const [state, setState] = useState<FacetSummaryState>({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    void fetch('/api/wordvault/facets')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as FacetSummary
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(() => {
        // 비로그인(401) · 서버 오류 — 섹션만 빠지고 허브는 그대로 뜬다
        if (!cancelled) setState({ status: 'unavailable', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
