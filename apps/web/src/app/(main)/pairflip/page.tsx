// apps/web/src/app/(main)/pairflip/page.tsx
// PairFlip Hub — Stats + StartScreen 통합 (Flashcard Hub 패턴 정합)
// stats 는 scores(module='pairflip') 서버 집계 → PairFlipHub 주입(기록 없으면 zero).
//
// v06.201 — "이번 판 단어" 를 함께 주입한다.
//   PRACTICE 형제 5개가 두 계보로 갈려 있었다: Flashcard·SpellForge 는 실 큐를 보여주는데
//   WordBlitz·PairFlip 은 **무엇으로 노는지 말하지 않았다**(설명서만 있었다). 어휘 학습
//   플랫폼의 연습 화면에서 단어가 안 보이는 것은 /hub 이 갖고 있던 결함과 같은 것이다.
//
//   ⚠️ 반드시 게임이 **실제로 쓰는** `fetchDuePairs` 를 쓴다. 허브가 별도 쿼리로 세면
//   시작 후 나오는 것과 어긋나고, 그러면 목업을 지우고 새 거짓말을 만든 셈이 된다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { PairFlipHub } from '@/components/pairflip/PairFlipHub'
import { Screen } from '@/components/ui/ios'
import { fetchDuePairs, PAIRFLIP_MAX_PAIRS } from '@/lib/pairflip/due-pairs'
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

  const [stats, pairs, ownedTotal] = user
    ? await Promise.all([
        fetchPairFlipStats(client, user.id),
        fetchDuePairs(client, user.id, PAIRFLIP_MAX_PAIRS),
        // 보유 총수는 따로 센다 — 위 조회는 PAIRFLIP_MAX_PAIRS(10)로 잘린 풀이다.
        client
          .from('vocabularies')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then((r) => (r.error ? 0 : (r.count ?? 0))),
      ])
    : [PAIRFLIP_STATS_ZERO, [], 0]

  return (
    <Screen width="content" background="bg2" padX="md">
      <PairFlipHub
        stats={stats}
        poolWords={pairs.map((p) => ({ en: p.word, ko: p.meaning }))}
        ownedTotal={ownedTotal}
      />
    </Screen>
  )
}
