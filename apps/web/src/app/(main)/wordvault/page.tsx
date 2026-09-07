// apps/web/src/app/(main)/wordvault/page.tsx
// WordVault 허브 + 옛 `?view=` 주소 호환.
//
// Routes:
//   /wordvault                 → 허브 (기본 진입)
//   /wordvault?view=browse     → `/wordvault/browse` 로 이동 (쿼리 보존)
//   /wordvault?view=study      → `/wordvault/study`
//   /wordvault?view=review     → `/wordvault/review`
//
// ── 2026-09-05 — 이 파일이 다시 서버 컴포넌트가 됐다 ────────────────────
// 이 파일이 `'use client'` 였던 유일한 이유는 옛 `?view=` 호환 리다이렉트였다. 그런데
// 그 대가가 컸다: **서버가 그리는 것이 하나도 없어서**(첫 HTML 은 스켈레톤) 하이드레이션
// 뒤에 8개 컴포넌트가 각자 Supabase 를 쳤고, `vocabularies` 를 전량 **두 번** 내려받았다.
// 리다이렉트는 서버 `redirect()` 한 줄이면 되는 일이었다 —
// 그 김에 조회도 전부 서버로 내렸다(`lib/wordvault/hub-query.ts`).
//
// 부수 효과 하나가 더 있다: 레거시 `?view=` 경로가 **허브 전량 조회를 낭비하지 않는다.**
// 예전에는 `useHubStats()` 가 `target` 판정보다 먼저 무조건 돌아, 단어를 전부 받아 버린 뒤
// 목적지로 replace 했다. 지금은 `redirect()` 가 조회 앞에 있다.
//
// ⚠️ 허브 통계는 목업으로 폴백하지 않는다 — "못 셌다" 와 "세어보니 0" 을 화면이 구별한다.

import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { WordVaultHub } from '@/components/wordvault/hub/WordVaultHub'
import { WordVaultHubChrome } from '@/components/wordvault/hub/WordVaultHubChrome'
import { WordVaultHubSkeleton } from '@/components/wordvault/hub/WordVaultHubSkeleton'
import { fetchFacetSummary } from '@/lib/framework/word-progress-query'
import type { FacetSummary } from '@/lib/framework/word-progress-query'
import { createClient } from '@/lib/supabase/server'
import { loadHubData, type HubData } from '@/lib/wordvault/hub-query'

export const dynamic = 'force-dynamic'

/** 옛 주소 → 새 라우트. 값 하나를 두 곳에 적지 않으려고 표로 둔다. */
const VIEW_ROUTES: Record<string, string> = {
  browse: '/wordvault/browse',
  study: '/wordvault/study',
  review: '/wordvault/review',
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function WordVaultPage({ searchParams }: PageProps) {
  const viewRaw = searchParams?.view
  const view = typeof viewRaw === 'string' ? viewRaw : null
  const target = view ? VIEW_ROUTES[view] : undefined

  // ── 옛 `?view=` 주소 호환 ──
  //
  // ⚠️ **나머지 쿼리를 보존한다.** 허브는 `?view=browse&q=<단어>` · `&level=B1` 로 보내는데,
  //    `view` 만 떼고 넘기지 않으면 그 조건이 목적지에 닿지 않는다.
  //    (그 두 파라미터를 읽는 자는 `lib/wordvault/list-params` 하나다.)
  if (target) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (k === 'view') continue
      if (typeof v === 'string') params.set(k, v)
      else if (Array.isArray(v)) for (const one of v) params.append(k, one)
    }
    const qs = params.toString()
    redirect(qs ? `${target}?${qs}` : target)
  }

  return (
    <WordVaultHubChrome activeView="hub">
      {/* 메인은 셸이 칠해진 **뒤에** 흘러 들어온다 — 아래 주석 참조 */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg2)] pb-12">
        <Suspense fallback={<WordVaultHubSkeleton />}>
          <HubSection />
        </Suspense>
      </main>
    </WordVaultHubChrome>
  )
}

/**
 * 데이터가 필요한 부분만 따로 떼어 **스트리밍**한다.
 *
 * ⚠️ 이것을 페이지 본문에 그대로 두면 두 조회가 끝날 때까지 **첫 픽셀이 안 나온다** —
 *    실측 2026-09-06 콜드 진입 본문 등장 **2,831ms**(학습자는 그동안 흰 화면을 본다).
 *    셸(`WordVaultHubChrome`)은 조회와 무관하므로 먼저 칠하고, 이 안만 기다린다.
 */
async function HubSection() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let data: HubData | null = null
  let facets: FacetSummary | null = null
  let failed = false
  if (user) {
    try {
      // 면 요약은 `learning_records` 전량을 훑는다 — 예전에는 클라이언트가 `/api/wordvault/facets`
      // 를 한 번 더 왕복했다. 같은 서버 렌더 안이므로 함수를 그대로 부른다.
      const [hub, facetSummary] = await Promise.all([
        loadHubData(supabase, user.id),
        fetchFacetSummary(supabase, user.id).catch(() => null),
      ])
      data = hub
      facets = facetSummary
    } catch {
      failed = true
    }
  }

  // 셸(`WordVaultHubChrome`)과 `<main>` 은 **페이지가 이미 그렸다** — 여기서 또 그리면
  // 캔버스가 두 겹이 되고 스크롤 컨테이너도 둘이 된다.
  return (
    <WordVaultHub
      data={data}
      facets={facets}
      state={!user ? 'unauthenticated' : failed || !data ? 'error' : 'ready'}
    />
  )
}
