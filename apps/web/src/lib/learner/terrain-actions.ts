// apps/web/src/lib/learner/terrain-actions.ts
//
// "내 어휘 지형" 서버 액션 — Stage × Memory 교차 분포.
//
// 왜 별도 액션인가: `word-progress-query` 는 `server-only` 라 클라이언트가 직접 못 부른다.
// 그리고 불러서도 안 된다 — 그 경로는 학습자의 인출 이력 전량을 훑는다. 여기서 칸별
// 개수로 접은 뒤에야 화면으로 나간다.

'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchStageMemoryGrid, type StageMemoryGrid } from '@/lib/framework/word-progress-query'

/**
 * 로그인 학습자의 Stage × Memory 지형.
 *
 * 로그인하지 않았거나 단어가 없으면 `null` 을 돌려준다 — **빈 격자를 돌려주지 않는다.**
 * 0 으로 가득 찬 격자는 화면에서 "아직 없음" 과 구별되지 않아, 계산 실패가 정상처럼
 * 보이는 종류의 침묵을 만든다(처방 `unavailable` 플래그가 생긴 이유와 같은 계열).
 */
export async function fetchLearningTerrain(): Promise<StageMemoryGrid | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const terrain = await fetchStageMemoryGrid(supabase, user.id)
  return terrain.total === 0 ? null : terrain
}
