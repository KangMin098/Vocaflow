// apps/web/src/app/(main)/library/vocab/page.tsx
//
// /library/vocab — 공용 단어장 (실 데이터 · Supabase shared_word_sets).
// Server Component: 게시된 세트 + 현재 사용자 구독 상태 fetch → 클라이언트 그리드로 전달.

import { rungForVLevel } from '@vocaflow/library-pipeline/vocab-brand'

import { Capsule, Screen } from '@/components/ui/ios'
import { VocabSetGrid } from '@/components/library/vocab/VocabSetGrid'
import { VocabSeriesHeader } from '@/components/library/vocab/VocabSeriesHeader'
import { createClient } from '@/lib/supabase/server'
import {
  fetchPublishedSets,
  fetchUserSubscriptions,
  type RecommendedSet,
} from '@/lib/library/vocab/queries'
import { measureLadderFill } from '@/lib/library/vocab/rung'

export const metadata = {
  title: '공용 단어장',
  description: '함께 만든 어휘 자산 — 큐레이션된 단어 컬렉션을 내 단어장에 추가하세요.',
}

export const dynamic = 'force-dynamic' // 로그인 상태/구독 상태가 사용자별로 다름

export default async function LibraryVocabPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [sets, subscribedSet] = await Promise.all([
    fetchPublishedSets(supabase),
    fetchUserSubscriptions(supabase, user?.id ?? null),
  ])

  // 학습자 V-level + 개인 맞춤 추천 — recommend_word_sets_for_user RPC(진단 V-level/track 기반, 3~5티어).
  //   즉흥 랭킹이 아니라 앱의 정본 추천 엔진 재사용. 미진단이면 추천 없음 → 진단 유도.
  let userVLevel = 0
  let recommended: RecommendedSet[] = []
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_v_level, diagnostic_completed_at')
      .eq('user_id', user.id)
      .maybeSingle()
    const p = profile as { current_v_level: number | null; diagnostic_completed_at: string | null } | null
    userVLevel = p?.current_v_level ?? 0
    const diagnosed = !!p?.diagnostic_completed_at && userVLevel > 0
    if (diagnosed) {
      const { data: recs } = await supabase.rpc('recommend_word_sets_for_user', {
        p_user_id: user.id,
        p_interests: undefined,
      })
      recommended = ((recs ?? []) as RecommendedSet[]).filter((r) => r.recommendation_type !== 'fallback')
    }
  }

  const setCount = sets.length
  const totalWords = sets.reduce((sum, s) => sum + s.wordCount, 0)
  const subscribedCount = subscribedSet.size

  // 사다리를 **실측 재고에 대 본다.** 계단마다 몇 권인지, 학령 밖이 몇 권인지.
  //   목업이 아니다 — 빈 계단이 있으면 빈 채로 나온다(`measureLadderFill`).
  const ladder = measureLadderFill(sets)
  // 학습자의 계단 — 진단을 마친 사람만. 미진단이면 null 이라 아무 칸도 '지금' 으로 서지 않는다.
  const learnerStep = userVLevel > 0 ? (rungForVLevel(userVLevel)?.step ?? null) : null

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <VocabSeriesHeader
          fill={ladder}
          learnerStep={learnerStep}
          totalVolumes={setCount}
          totalWords={totalWords}
        />
        {subscribedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Capsule tone="green" label="구독" value={`${subscribedCount}개`} />
          </div>
        )}

        <VocabSetGrid
          sets={sets}
          subscribedIds={Array.from(subscribedSet)}
          isLoggedIn={!!user}
          userVLevel={userVLevel}
          recommended={recommended}
        />
      </div>
    </Screen>
  )
}
