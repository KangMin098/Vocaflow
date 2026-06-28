// apps/web/src/app/(main)/pairflip/page.tsx
// PairFlip Hub — Stats + StartScreen 통합 (Flashcard Hub 패턴 정합)
// stats 는 scores(module='pairflip') 서버 집계 → PairFlipHub 주입(기록 없으면 zero).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { PairFlipHub } from '@/components/pairflip/PairFlipHub'
import { Screen } from '@/components/ui/ios'
import { fetchPairFlipStats, PAIRFLIP_STATS_ZERO } from '@/lib/pairflip/stats'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'PairFlip — 짝맞추기 카드 게임 · Vocaflow',
  description: '영단어와 한글 뜻을 짝지어 매칭하는 카드 게임',
}

export default async function PairFlipHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()
  const stats = user ? await fetchPairFlipStats(client, user.id) : PAIRFLIP_STATS_ZERO

  return (
    <Screen width="content" background="bg2" padX="md">
      <PairFlipHub stats={stats} />
    </Screen>
  )
}
