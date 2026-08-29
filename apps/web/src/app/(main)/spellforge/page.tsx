// apps/web/src/app/(main)/spellforge/page.tsx
// SpellForge Hub — 실측 철자 큐 + 실제 기록.
//
// v08.6 목업 제거. 이 화면도 전부 상수였다:
//   · 큐 4/12/2/18 + 미리보기 단어 · IME 정확도 92% + sparkline + "+4%"
//   · 최고 점수 1,240 + 최근 기록 3행 — 실측 결과 scores 에 spellforge **0행**이었다.
//     즉 한 번도 만들어진 적 없는 기록을 "오늘 920점" 으로 보여주고 있었다.
//   · ContinueRow "어제 라운드 · 정확도 90% (어제 21:08)" — 재개 저장소가 없다
//   · 단어장/모드/난이도 → `?vocab=&mode=&difficulty=` 로 넘겼지만 play 라우트는
//     `set/text/chapter` 만 받는다. 세 컨트롤 전부 무시됐다.
//
// 지운 컨트롤이 왜 되살릴 수 없었나 (코드 확인):
//   · 모드(뜻→철자 / 발음→철자) — SpellForge 의 실제 모드는 useTypingMode 의
//     realtime·delayed·blind(피드백 시점)다. 뜻/발음 방향이라는 개념 자체가 없다.
//   · 난이도(쉬움·보통·어려움) — 'difficulty' 는 spellforge 코드에 0건.
//     난이도는 adaptiveDifficulty.recommendMode 가 정확도로 **자동** 추천한다.
//   · "힌트 -20점" — 점수 감점은 없다. 힌트는 FSRS 등급을 내린다(rating-mapper).
//
// 남긴 것은 전부 실측 — 큐는 play 라우트와 같은 쿼리(fetchSessionQueue ·
// spellforge/hub-words 도 같은 fetchStudyVocabularies 를 쓴다), 기록은 scores 실조회.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { emptySessionQueue } from '@/lib/learner/session-queue'
import { fetchSessionQueue } from '@/lib/learner/session-queue-query'
import { fetchBestScore, fetchRecentScores } from '@/lib/scores/recent'
import { createClient } from '@/lib/supabase/server'

import { SpellForgeHubClient } from './SpellForgeHubClient'

export const metadata = {
  title: 'SpellForge',
}

export default async function SpellForgeHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return <SpellForgeHubClient queue={emptySessionQueue()} recent={[]} best={null} />
  }

  const [queue, recent, best] = await Promise.all([
    fetchSessionQueue(client, user.id),
    fetchRecentScores(client, user.id, 'spellforge'),
    fetchBestScore(client, user.id, 'spellforge'),
  ])

  return <SpellForgeHubClient queue={queue} recent={recent} best={best} />
}
