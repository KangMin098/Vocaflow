// apps/web/src/lib/pairflip/stats.ts
//
// PairFlip hub stats — scores 테이블(module='pairflip')에서 사용자 누적 기록 집계.
// /pairflip (server) 에서 fetch → PairFlipHub 에 prop 주입. 기록 없으면 zero(cold).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

export interface PairFlipStats {
  bestScore: number
  maxCombo: number
  gamesPlayed: number
}

export const PAIRFLIP_STATS_ZERO: PairFlipStats = {
  bestScore: 0,
  maxCombo: 0,
  gamesPlayed: 0,
}

interface ScoreRow {
  score: number | null
  metadata: { maxCombo?: number } | null
}

/** 사용자 PairFlip 누적 통계 (best score · 최고 콤보 · 게임 수). 기록 없으면 zero. */
export async function fetchPairFlipStats(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<PairFlipStats> {
  const { data, error } = await client
    .from('scores')
    .select('score, metadata')
    .eq('user_id', userId)
    .eq('module', 'pairflip')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const rows = (data ?? []) as unknown as ScoreRow[]
  if (rows.length === 0) return PAIRFLIP_STATS_ZERO

  let bestScore = 0
  let maxCombo = 0
  for (const r of rows) {
    if ((r.score ?? 0) > bestScore) bestScore = r.score ?? 0
    const combo = typeof r.metadata?.maxCombo === 'number' ? r.metadata.maxCombo : 0
    if (combo > maxCombo) maxCombo = combo
  }
  return { bestScore, maxCombo, gamesPlayed: rows.length }
}
