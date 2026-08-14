// apps/web/src/lib/framework/word-progress-query.ts
//
// 면×단계 매트릭스의 **데이터 경로** — 계산은 word-progress.ts(순수)가 한다.
//
// 왜 파일을 나누는가: 규칙은 테스트로 고정하고 조회는 갈아끼울 수 있어야 한다.
// (같은 이유로 lib/learner/session-queue 도 순수부/조회부가 갈려 있다.)
//
// 이 파일은 서버 전용이다 — `learning_records` 전량을 훑으므로 클라이언트로 내보내면
// 학습자의 인출 이력이 통째로 브라우저에 실린다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getMemoryState } from '@/lib/srs/state'

import type { MemoryState, WordFrameworkState } from './flow'
import { deriveWordStates, type FacetAttempt } from './word-progress'

/**
 * 학습자의 단어별 프레임워크 상태.
 *
 * 두 곳을 읽는다:
 *   · `learning_records` — 어떤 활동으로 몇 번 맞혔나 (면 이력의 원천)
 *   · `vocabularies`     — 기억 상태(R(t) 동적 계산)와 노출 횟수
 *
 * ⚠️ `learning_records.vocabulary_id` 로 단어를 잇는다. 결합 키는 소문자 `word` 지만
 *    이 테이블은 단어 텍스트를 갖지 않으므로 vocabularies 를 거쳐야 한다.
 */
export async function fetchWordStates(
  client: SupabaseClient,
  userId: string,
  limit = 500,
): Promise<WordFrameworkState[]> {
  const { data: vocabRows, error: vErr } = await client
    .from('vocabularies')
    .select('id, word, difficulty, stability, last_review_at, review_count')
    .eq('user_id', userId)
    .limit(limit)
  if (vErr || !vocabRows) return []

  const vocabs = vocabRows as Array<{
    id: string
    word: string
    difficulty: number | null
    stability: number | null
    last_review_at: string | null
    review_count: number | null
  }>
  if (vocabs.length === 0) return []

  const byId = new Map(vocabs.map((v) => [v.id, v]))

  const { data: recRows } = await client
    .from('learning_records')
    .select('vocabulary_id, module, is_correct')
    .eq('user_id', userId)
    .in(
      'vocabulary_id',
      vocabs.map((v) => v.id),
    )

  const attempts: FacetAttempt[] = []
  for (const r of ((recRows ?? []) as Array<{
    vocabulary_id: string | null
    module: string
    is_correct: boolean
  }>)) {
    const v = r.vocabulary_id ? byId.get(r.vocabulary_id) : undefined
    if (!v) continue
    attempts.push({ word: v.word.toLowerCase(), module: r.module, isCorrect: r.is_correct })
  }

  // 기억 상태는 **저장하지 않는다** — R(t) 로 매번 계산한다(프로젝트 절대 규칙).
  const meta = new Map<string, { memory: MemoryState; encounters: number }>()
  for (const v of vocabs) {
    meta.set(v.word.toLowerCase(), {
      memory: getMemoryState({
        id: v.id,
        difficulty: v.difficulty ?? 0,
        stability: v.stability ?? 0,
        lastReviewAt: v.last_review_at ? new Date(v.last_review_at) : null,
        nextReviewAt: null,
        reviewCount: v.review_count ?? 0,
        moduleHistory: [],
      }) as MemoryState,
      // 노출 횟수의 정본은 아직 없다 — 복습 횟수를 하한 근사로 쓴다.
      // (읽기 노출까지 세려면 reading 계층이 단어 단위로 남겨야 한다 — 미구현.)
      encounters: v.review_count ?? 0,
    })
  }

  return deriveWordStates(attempts, meta)
}
