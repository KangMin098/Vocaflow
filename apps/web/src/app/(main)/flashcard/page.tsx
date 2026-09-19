// apps/web/src/app/(main)/flashcard/page.tsx
// Flashcard Hub — 실측 복습 큐 + 세션 길이 선택.
//
// v08.6 목업 제거. 이 화면은 전부 상수였다:
//   · 큐 5/12/3/23 + 미리보기 단어(vulnerable · criticize …) — 남의 단어였다
//   · 7일 정확도 87% + sparkline + "+5%" · Streak 12일 · "누적 847 카드 · retention 89%"
//   · ContinueRow "Day 12 · Gatsby Ch.1 — 어제 멈춘 자리에서 이어집니다 (어제 22:14)"
//   · 단어장 gatsby-1/gatsby-2/all + 모드 + 길이 → `?vocab=&mode=&length=` 로 넘겼지만
//     play 라우트는 `set/text/chapter` 만 받는다 — 세 컨트롤 전부 무시됐다
//
// 지운 것과 이유:
//   · ContinueRow — 재개 지점을 저장하는 곳이 없다(grep: resume/last_position/session_state 0건).
//     "어제 멈춘 자리에서 이어집니다" 를 눌러도 새 세션이 시작됐다. 실데이터로 만들 수 없다.
//   · 7일 정확도 sparkline — scores 에 flashcard 5행(전체 사용자 기준, 2026-08-12 실측).
//     학습자 1인의 7일치는 거의 항상 0~1점이라 추세선이 될 수 없다.
//   · 모드(단어→뜻 / 뜻→단어) — FlashcardSession 에 방향 개념이 없다. 컨트롤만 있었다.
//   · 단어장 선택기 — 실 목록으로 되살리면 콘텐츠 선택 표면이 셋(워크스페이스·받아쓰기·허브)이
//     된다. 프레임워크가 그걸 하나로 접기로 했으므로 짓지 않고, 자료 화면 링크만 남겼다.
//
// 남긴 것은 전부 실측 — 큐/미리보기는 play 라우트와 **같은 쿼리**(fetchSessionQueue),
// 연속일은 user_stats.current_streak(fetchGrowthStats · 셸이 이미 부르므로 추가 쿼리 없음).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { emptySessionQueue } from '@/lib/learner/session-queue'
import { fetchSessionQueue } from '@/lib/learner/session-queue-query'
import { fetchGrowthStats } from '@/lib/learner/growth-stats'
import { createClient } from '@/lib/supabase/server'

import { FlashcardHubClient } from './FlashcardHubClient'

export const metadata = {
  title: 'Flashcard',
}

export default async function FlashcardHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  const [queue, growth] = await Promise.all([
    user ? fetchSessionQueue(client, user.id) : Promise.resolve(emptySessionQueue()),
    fetchGrowthStats(),
  ])

  return <FlashcardHubClient queue={queue} streak={growth?.streak ?? 0} />
}
