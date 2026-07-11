// apps/web/src/lib/scores/record-score.ts
//
// 게임 세션 완료 시 scores 테이블 적재 공용 헬퍼.
// 메인 Hub "최근 활동"(useHubData 가 scores 읽음) + 모듈별 stats 의 source.
// learning_records(FSRS 단어별)와 별개 — scores 는 게임 세션 결과(점수/정확도/시간).
//
// fire-and-forget: 적재 실패는 학습 흐름을 막지 않는다(try/catch).
// useRecordGameScore: 완료 컴포넌트 마운트 시 1회만(re-render/StrictMode 중복 INSERT 방지).

'use client'

import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

export type ScoreModule =
  | 'flashcard'
  | 'spellforge'
  | 'wordblitz'
  | 'pairflip'
  | 'scriptquiz'
  | 'dictation'
  // 신규 아케이드 게임 6종 (v07.3) — DB module_id enum 확장 후 활성
  | 'cascade'
  | 'connections'
  | 'word-economy'
  | 'daily-blitz'
  | 'letter-forge'
  | 'ghost-race'
  | 'glyph-tongue'

export interface GameScoreInput {
  module: ScoreModule
  /** 대표 점수(모듈별 의미 상이 — 정답수/정확도/누적점수 등) */
  score: number
  totalQuestions?: number
  correctCount?: number
  /** 0~100 */
  accuracy?: number
  durationSeconds?: number
  /** 스크립트 스코프 게임이면 texts.id */
  textId?: string
  metadata?: Record<string, unknown>
}

/** scores 1행 INSERT. 미로그인/실패는 조용히 무시(게임 흐름 비차단). */
export async function recordGameScore(input: GameScoreInput): Promise<void> {
  try {
    const client = createClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return

    const row = {
      user_id: user.id,
      module: input.module,
      score: Math.round(input.score),
      total_questions: input.totalQuestions ?? null,
      correct_count: input.correctCount ?? null,
      accuracy: input.accuracy ?? null,
      duration_seconds: input.durationSeconds ?? null,
      text_id: input.textId ?? null,
      metadata: input.metadata ?? {},
    }
    // module enum 은 DB module_id 와 정합(생성 타입 stale 가능성 대비 unknown 경유).
    await client.from('scores').insert(row as never)
  } catch {
    /* 점수 저장 실패는 학습 흐름을 막지 않음 */
  }
}

/**
 * 완료 컴포넌트에서 1회만 scores 적재.
 * @param input null 이면 아직 준비 안 됨(데이터 미로드) — 준비되면 1회 실행.
 */
export function useRecordGameScore(input: GameScoreInput | null): void {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !input) return
    done.current = true
    void recordGameScore(input)
    // 완료 시점 1회만 — input 갱신에 재실행하지 않음(의도)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input !== null])
}
