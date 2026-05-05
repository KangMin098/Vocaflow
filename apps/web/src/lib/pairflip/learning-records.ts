// apps/web/src/lib/pairflip/learning-records.ts
// PairFlip → learning_records 저장 (Phase 2: Supabase 연동)
// 현재는 로컬 콘솔 로그만 — interface 정합 보장.

import type { PairFlipResultData } from '@/components/pairflip/types'

export interface LearningRecordInput {
  module: 'pairflip'
  pairId: string
  word: string
  meaning: string
  rating: 1 | 2 | 3 | 4
  isCorrect: boolean
  responseTimeMs: number
  attemptedAt: string
}

/**
 * 세션 결과를 learning_records 형태로 변환.
 * Phase 2: Supabase insert 로 교체.
 */
export function toLearningRecords(
  result: PairFlipResultData,
): LearningRecordInput[] {
  const startBase = Date.now() - result.durationMs
  return result.pairResults.map((p) => ({
    module: 'pairflip',
    pairId: p.pairId,
    word: p.word,
    meaning: p.meaning,
    rating: p.fsrsRating,
    isCorrect: true,
    responseTimeMs: p.matchedAt - startBase,
    attemptedAt: new Date(p.matchedAt).toISOString(),
  }))
}

/**
 * Phase 2 — Supabase insert. 현재는 dev 콘솔 로그.
 */
export async function saveLearningRecords(
  result: PairFlipResultData,
): Promise<void> {
  const records = toLearningRecords(result)
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[pairflip] saveLearningRecords (mock)', records)
  }
  // Phase 2:
  //   const supabase = createClient()
  //   await supabase.from('learning_records').insert(records.map(r => ({ ... })))
}
