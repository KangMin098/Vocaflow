// apps/web/src/lib/wordvault/browse-queries.ts
//
// /wordvault/browse 풀스크린 세션용 Server-only 쿼리.
// - fetchUserVocabularies: 현재 사용자 단어 목록 (UI 필요 필드만 select)
// - fetchUserTextChips: 스크립트별(text_id) chip 데이터
// - fetchUserSetChips:  구독 단어장별(shared_set_id) chip 데이터
//
// 정렬: 최근 추가 우선 (created_at DESC). 풀 페이지네이션은 v2 — 현재는 1,500개
//   상한 (대부분 사용자 ≤ 2,000 단어 — UNIQUE(user_id, word) + Phase 1).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import type { ModuleId } from '@/lib/srs/types'

type DB = Database

export interface VocabRow {
  id: string
  word: string
  meaning: string
  example_sentence: string | null
  pronunciation: string | null
  pos: string | null
  cefr_level: string | null
  difficulty: number | null
  stability: number | null
  last_review_at: string | null
  next_review_at: string | null
  module_history: string[] | null
  review_count: number | null
  text_id: string | null
  shared_set_id: string | null
  created_at: string | null
}

export interface BrowseChip {
  id: string
  label: string
  count: number
}

/** 사용자 보유 단어 — 최근 추가 우선 1,500개 상한. */
export async function fetchUserVocabularies(
  supabase: SupabaseClient<DB>,
  userId: string,
): Promise<VocabRow[]> {
  const { data, error } = await supabase
    .from('vocabularies')
    .select(
      'id, word, meaning, example_sentence, pronunciation, pos, cefr_level, difficulty, stability, last_review_at, next_review_at, module_history, review_count, text_id, shared_set_id, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1500)
  if (error) throw error
  return (data ?? []) as VocabRow[]
}

/** 스크립트별 chip — 사용자가 보유한 단어가 1+인 텍스트만. */
export async function fetchUserTextChips(
  supabase: SupabaseClient<DB>,
  userId: string,
  rows: VocabRow[],
): Promise<BrowseChip[]> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.text_id) counts.set(r.text_id, (counts.get(r.text_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  const { data, error } = await supabase
    .from('texts')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', Array.from(counts.keys()))
  if (error) throw error

  return (data ?? [])
    .map((t) => ({ id: `text:${t.id}`, label: t.title, count: counts.get(t.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** 구독 공용 단어장별 chip — 사용자가 보유한 단어가 1+인 세트만. */
export async function fetchUserSetChips(
  supabase: SupabaseClient<DB>,
  rows: VocabRow[],
): Promise<BrowseChip[]> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.shared_set_id) counts.set(r.shared_set_id, (counts.get(r.shared_set_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  const { data, error } = await supabase
    .from('shared_word_sets')
    .select('id, title, cover_emoji')
    .in('id', Array.from(counts.keys()))
  if (error) throw error

  return (data ?? [])
    .map((s) => ({
      id: `set:${s.id}`,
      label: s.cover_emoji ? `${s.cover_emoji} ${s.title}` : s.title,
      count: counts.get(s.id) ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
}

// ─── WordItem 어댑터 ───────────────────────────────────────────

import type { SrsCard } from '@/lib/srs/types'
import type { CefrLevel, LevelClass, WordItem } from '@/components/wordvault/types'

function cefrFallback(v: string | null): { level: CefrLevel; levelClass: LevelClass } {
  const raw = (v ?? '').toUpperCase()
  const level: CefrLevel = (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).includes(
    raw as CefrLevel,
  )
    ? (raw as CefrLevel)
    : 'B1'
  const levelClass: LevelClass = level.startsWith('A') ? 'a' : level.startsWith('B') ? 'b' : 'c'
  return { level, levelClass }
}

function masteryFromReviewCount(n: number | null): 1 | 2 | 3 | 4 | 5 {
  // 단순 매핑 — v2: SRS Stability 기반 정밀화 예정
  const c = n ?? 0
  if (c <= 0) return 1
  if (c <= 2) return 2
  if (c <= 5) return 3
  if (c <= 10) return 4
  return 5
}

function rowToSrs(row: VocabRow): SrsCard {
  return {
    id: row.id,
    difficulty: row.difficulty ?? 6.0,
    stability: row.stability ?? 0,
    lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at) : null,
    moduleHistory: (row.module_history ?? []) as ModuleId[],
    reviewCount: row.review_count ?? 0,
  }
}

/**
 * DB row → 기존 WordItem 어댑터.
 * - id: 안정적 순번 (현재 fetch 결과 내 순서) — 셀렉션/재생 상태 추적용
 * - dbId/textId/setId: 필터·향후 액션 라우팅용
 */
export interface BrowseWord extends WordItem {
  dbId: string
  textId: string | null
  setId: string | null
}

export function vocabRowToWord(row: VocabRow, index: number): BrowseWord {
  const { level, levelClass } = cefrFallback(row.cefr_level)
  const srs = rowToSrs(row)
  const lastDays = srs.lastReviewAt
    ? Math.max(0, Math.floor((Date.now() - srs.lastReviewAt.getTime()) / 86_400_000))
    : 0
  const nextDays = srs.nextReviewAt
    ? Math.max(0, Math.floor((srs.nextReviewAt.getTime() - Date.now()) / 86_400_000))
    : 0
  return {
    id: index + 1,
    dbId: row.id,
    textId: row.text_id,
    setId: row.shared_set_id,
    word: row.word,
    pos: row.pos ?? '',
    meaning: row.meaning,
    exampleEn: row.example_sentence ?? '',
    level,
    levelClass,
    mastery: masteryFromReviewCount(row.review_count),
    lastDays,
    nextDays,
    srs,
  }
}
