// apps/web/src/lib/recommend/get-next-action.ts
//
// 실 추천 — 사용자 상태 기반 (server action). getMockNextAction 의 DB 연동 대체.
// 컨텍스트: due 단어 수(P1) + mastery(user_stats 또는 vocab 수 근사, P3). v1 P2(진행중 스크립트)
// 는 미연동 — 후속에 recent reading_session 연동 시 inProgressText 채움.

'use server'

import type { MasteryLevel } from '@/lib/srs'
import { createClient } from '@/lib/supabase/server'

import { decideNextAction } from './decide'
import type { RecommendedAction } from './types'

const COLD_START: RecommendedAction = { module: 'library', label: '새 스크립트를 만나보세요' }

export async function getNextActionForUser(): Promise<RecommendedAction> {
  try {
    const client = await createClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return COLD_START

    const nowIso = new Date().toISOString()
    const [totalRes, dueRes, statsRes] = await Promise.all([
      client.from('vocabularies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      client
        .from('vocabularies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review_at', nowIso),
      client.from('user_stats').select('mastery_level, current_streak').eq('user_id', user.id).maybeSingle(),
    ])

    const total = totalRes.count ?? 0
    // mastery: user_stats 우선, 없으면 보유 단어 수로 근사(빈 테이블 안전)
    const stored = (statsRes.data?.mastery_level as MasteryLevel | null) ?? null
    const mastery: MasteryLevel = stored ?? (total < 50 ? 'cold' : total < 300 ? 'warm' : 'hot')

    return decideNextAction({
      masteryLevel: mastery,
      urgentWordCount: dueRes.count ?? 0,
    })
  } catch {
    return COLD_START
  }
}
