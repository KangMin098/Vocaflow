// apps/web/src/app/(main)/text/[id]/word-states.ts
//
// **내 기억으로 칠한 원문** — `/text/[id]` 의 낱말 밑줄 두께를 실제 R(t) 로(2026-09-19 · docs/design/compare/text-id.md · DD-27).
//
// 감사(2026-09-18)가 잡은 것: 원문 낱말이 **전부 `status: 'new'` 로 하드코딩**이었다(`word-enrichment.ts` `toWord`).
// 그래서 형태 문법 F1(밑줄 두께 3/2/1px = 망각도)이 한 종류(점선)로 무너졌다. 데이터가 없어서가 아니라
// 코드가 비어 있었다 — 학습자의 `vocabularies`(stability · last_review_at)와 **낱말로 조인**하면 된다.
//
// 조회는 이 챕터의 학습 낱말만(`in`) — 단어장 전량을 읽지 않는다. 상태는 요청마다 계산(`memory_state` 저장 금지).

import type { SupabaseClient } from '@supabase/supabase-js'

import { getMemoryState } from '@/lib/srs/state'
import type { MemoryState } from '@/lib/srs/types'

export interface VocabStateRow {
  word: string
  stability: number | null
  difficulty: number | null
  last_review_at: string | null
}

/** 낱말(소문자) → 지금 상태. 같은 낱말이 여러 행이면 **가장 잘 기억하는** 행을 쓴다(중복 저장이 상태를 깎지 않게). */
export function statesFromRows(rows: readonly VocabStateRow[], now: Date = new Date()): Record<string, MemoryState> {
  const rank: Record<MemoryState, number> = { new: 0, risk: 1, shaky: 2, stable: 3 }
  const out: Record<string, MemoryState> = {}
  for (const r of rows) {
    const key = r.word.trim().toLowerCase()
    if (!key) continue
    const state = getMemoryState(
      {
        id: key,
        difficulty: r.difficulty ?? 0,
        stability: r.stability ?? 0,
        lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
        nextReviewAt: null,
        moduleHistory: [],
        reviewCount: 0,
      },
      now,
    )
    if (!(key in out) || rank[state] > rank[out[key]!]) out[key] = state
  }
  return out
}

/**
 * 이 챕터 낱말들에 대한 학습자의 기억 상태. 실패하면 `null` — 화면은 지금처럼 전부 `new` 로 그린다
 * (그러나 인사이트 패널은 "불러오지 못했어요" 를 말한다 — 오류를 빈 값으로 삼키지 않는다).
 */
export async function fetchWordStates(
  client: SupabaseClient,
  userId: string,
  words: readonly string[],
): Promise<Record<string, MemoryState> | null> {
  if (words.length === 0) return {}
  const variants = [...new Set(words.flatMap((w) => [w, w.toLowerCase()]))]
  const { data, error } = await client
    .from('vocabularies')
    .select('word, stability, difficulty, last_review_at')
    // RLS 에만 기대지 않는다 — 이 글의 주인(= 로그인 학습자, texts RLS)의 단어장만
    .eq('user_id', userId)
    .in('word', variants)
  if (error) return null
  return statesFromRows((data ?? []) as VocabStateRow[])
}
