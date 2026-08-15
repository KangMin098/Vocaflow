// apps/web/src/lib/dictation/persist.ts
//
// 받아쓰기 영속화 — 세션/시도를 DB 에 남기고, 단어는 FSRS 로 보낸다.
//
// 왜 localStorage 를 걷어냈나:
//   scores 0행 · learning_records 0행이 그 결과였다. 완주해도 홈·대시보드·주간리포트에
//   아무것도 안 뜨고, 기기를 바꾸면 기록이 통째로 사라졌다. "내가 성장하고 있다"를
//   보여줄 원본 데이터 자체가 없었다는 뜻이다.
//
// 적재 시점 3개:
//   ① 시작   — dictation_sessions INSERT (uuid 가 곧 세션 URL)
//   ② 문항마다 — dictation_attempts INSERT (중도 이탈해도 푼 만큼 남는다)
//   ③ 완주   — 세션 통계 UPDATE + scores INSERT + 타깃 단어 FSRS flush
//
// ②를 완주 시점에 몰아 넣지 않는 이유: 받아쓰기는 한 문항이 길어 중도 이탈이 잦다.
// 몰아 넣으면 이탈 = 전량 소실이고, 그러면 "어제 5문장 하다 말았다"가 기록에 안 남는다.
//
// 실패는 학습 흐름을 막지 않는다(fire-and-forget). 단, 세션 INSERT 실패만은 호출부에
// 알린다 — 세션 id 가 없으면 이후 적재가 전부 무의미해지므로.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

import { contentRefFromBook, type ContentRef } from '@/lib/content/content-ref'
import { recordGameScore } from '@/lib/scores/record-score'
import { flushPendingSrsResults } from '@/lib/srs/flush-actions'
import type { FlushItem } from '@/lib/srs/flush-types'

import type { DictationSource } from './source'
import type { DictationConfig, DictationItem, WordResult } from './types'

// ── ① 세션 시작 ───────────────────────────────────────────────────

export interface StartedSession {
  id: string
  persisted: boolean
}

/**
 * 세션 행 생성. 비로그인이면 로컬 전용 id 로 degrade —
 * 로그인 벽으로 학습을 막지 않는다(프로젝트 공통 정책).
 */
export async function startDictationSession(
  client: SupabaseClient,
  source: DictationSource,
  config: DictationConfig,
  totalItems: number,
  /**
   * 조립된 문항 목록. **이것을 남겨야 다른 기기에서 세션을 이어받을 수 있다** —
   * 없으면 진행 상태가 시작한 기기의 localStorage 에만 산다(사용자 신고 2026-08-15).
   */
  items?: DictationItem[],
): Promise<StartedSession> {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return { id: localId, persisted: false }

    const { data, error } = await client
      .from('dictation_sessions')
      .insert({
        user_id: user.id,
        source_kind: source.kind,
        text_id: source.textId ?? null,
        library_book_id: source.libraryBookId ?? null,
        chapter_idx: source.chapterIdx ?? null,
        shared_set_id: source.sharedSetId ?? null,
        title: source.title,
        config: config as unknown as Record<string, unknown>,
        total_items: totalItems,
        items: (items ?? null) as unknown as Record<string, unknown> | null,
      })
      .select('id')
      .single()

    if (error || !data) return { id: localId, persisted: false }
    return { id: (data as { id: string }).id, persisted: true }
  } catch {
    return { id: localId, persisted: false }
  }
}

/**
 * 진행 중 세션을 **DB 에서** 복원한다 — 이 기기 캐시에 없을 때의 정본 경로.
 *
 * 어디까지 풀었는지는 `dictation_attempts` 가 말한다(가장 큰 item_idx + 1).
 * 캐시가 아니라 실제 적재를 기준으로 삼으므로, 기기를 바꿔도 **푼 문항을 다시 풀지 않는다**.
 *
 * `items` 가 NULL 이면 이 컬럼(20260815060000) 이전에 만들어진 세션이다 — 복원할 수 없고,
 * 화면이 그 사실을 그대로 말해야 한다(없는 것을 있는 척 지어내지 않는다).
 */
export async function restoreDictationSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<{ session: RestoredSession | null; reason: 'ok' | 'not-found' | 'no-items' | 'done' }> {
  try {
    const { data } = await client
      .from('dictation_sessions')
      .select(
        'id, title, source_kind, text_id, library_book_id, chapter_idx, shared_set_id, config, items, started_at, completed_at, total_hints',
      )
      .eq('id', sessionId)
      .maybeSingle()
    if (!data) return { session: null, reason: 'not-found' }

    const row = data as Record<string, unknown>
    if (row.completed_at) return { session: null, reason: 'done' }

    const items = Array.isArray(row.items) ? (row.items as DictationItem[]) : null
    if (!items || items.length === 0) return { session: null, reason: 'no-items' }

    const { data: aData } = await client
      .from('dictation_attempts')
      .select('item_idx')
      .eq('session_id', sessionId)
      .order('item_idx', { ascending: false })
      .limit(1)
    const lastIdx = ((aData ?? []) as Array<{ item_idx: number }>)[0]?.item_idx
    const currentIndex = lastIdx == null ? 0 : Math.min(lastIdx + 1, items.length - 1)

    return {
      session: {
        id: String(row.id),
        config: row.config as unknown as DictationConfig,
        resourceTitle: String(row.title ?? ''),
        sourceKind: String(row.source_kind ?? 'custom'),
        textId: (row.text_id as string | null) ?? null,
        libraryBookId: (row.library_book_id as string | null) ?? null,
        chapterIdx: (row.chapter_idx as number | null) ?? null,
        sharedSetId: (row.shared_set_id as string | null) ?? null,
        items,
        currentIndex,
        startedAt: row.started_at ? new Date(String(row.started_at)).getTime() : Date.now(),
        totalHintsUsed: Number(row.total_hints ?? 0),
      },
      reason: 'ok',
    }
  } catch {
    return { session: null, reason: 'not-found' }
  }
}

/**
 * 아직 안 끝난 세션 하나 — 허브 "이어하기" 의 DB 근거.
 *
 * localStorage 만 보던 동안, 폰에서 시작하고 PC 에서 허브를 열면 이어하기가 **없었다**.
 * 세션 URL 복원과 같은 구멍이다. `items` 가 있는 것만 고른다 — 이어받을 수 없는 세션을
 * 이어하기로 내놓으면 허브가 자기 손으로 막다른 화면을 만든다.
 */
export async function fetchResumableSessionId(client: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return null
    const { data } = await client
      .from('dictation_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .not('items', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
    return ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null
  } catch {
    return null
  }
}

export interface RestoredSession {
  id: string
  config: DictationConfig
  resourceTitle: string
  sourceKind: string
  textId: string | null
  libraryBookId: string | null
  chapterIdx: number | null
  sharedSetId: string | null
  items: DictationItem[]
  currentIndex: number
  startedAt: number
  totalHintsUsed: number
}

// ── ② 문항 적재 ───────────────────────────────────────────────────

export interface AttemptInput {
  sessionId: string
  itemIdx: number
  expected: string
  userInput: string
  accuracy: number
  hintsUsed: number
  replayCount: number
  durationMs: number
  skipped: boolean
  wordResults: WordResult[]
  errorTags: string[]
  targetWords: string[]
  targetHits: string[]
}

export async function saveDictationAttempt(
  client: SupabaseClient,
  input: AttemptInput,
): Promise<void> {
  if (input.sessionId.startsWith('local-')) return
  try {
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return
    // upsert + ignoreDuplicates — `uniq_dictation_attempt_item`(session_id, item_idx) 에
    // 걸리면 **조용히 넘긴다**. 그게 옳은 동작이다: 같은 문항의 두 번째 적재는 데이터
    // 오염이지 학습자의 새 시도가 아니다(두 탭에서 같은 세션을 열었을 때 생긴다).
    // insert 로 두면 여기서 오류가 나고, 그 오류를 삼키면 "왜 안 남았는지" 를 영영 모른다.
    const { error } = await client.from('dictation_attempts').upsert(
      {
        session_id: input.sessionId,
        user_id: user.id,
        item_idx: input.itemIdx,
        expected: input.expected,
        user_input: input.userInput,
        accuracy: Math.round(input.accuracy * 100) / 100,
        hints_used: input.hintsUsed,
        replay_count: input.replayCount,
        duration_ms: input.durationMs,
        skipped: input.skipped,
        word_results: input.wordResults as unknown as Record<string, unknown>[],
        error_tags: input.errorTags,
        target_words: input.targetWords,
        target_hits: input.targetHits,
      },
      { onConflict: 'session_id,item_idx', ignoreDuplicates: true },
    )
    // ⚠️ 이 upsert 는 `uniq_dictation_attempt_item` 에 **의존한다**. 그 인덱스가 없으면
    //    PostgREST 가 onConflict 를 해석하지 못해 **한 행도 안 남는다**(중복보다 나쁘다).
    //    실측 2026-08-16: 인덱스를 내리고 두 탭 시나리오를 돌리니 적재가 0행이었다.
    //    그래서 오류를 통째로 삼키지 않고 흔적을 남긴다 — 학습은 계속하되 진단은 가능하게.
    if (error) console.error('[dictation] attempt 적재 실패:', error.message)
  } catch (e) {
    // 학습 흐름은 막지 않는다. 다만 "왜 안 남았는지" 를 영영 모르게 두지도 않는다.
    console.error('[dictation] attempt 적재 예외:', e instanceof Error ? e.message : e)
  }
}

/**
 * 받아쓰기 자료 → 콘텐츠 참조.
 *   book  → 도서(챕터 포함) · text → 스크립트 · set → 단어장
 *   daily → 여러 자료를 가로지르는 처방이라 특정 자료로 귀속시키지 않는다(`mine`)
 *   custom→ 저장하지 않는 글이라 가리킬 자료가 없다(`mine`)
 */
function contentRefFromDictationSource(source: DictationSource): ContentRef {
  if (source.kind === 'book' && source.libraryBookId) {
    return contentRefFromBook(source.libraryBookId, source.chapterIdx ?? null)
  }
  if (source.kind === 'text' && source.textId) return { type: 'text', id: source.textId }
  if (source.kind === 'set' && source.sharedSetId) return { type: 'set', id: source.sharedSetId }
  return { type: 'mine' }
}

// ── ③ 완주 ────────────────────────────────────────────────────────

export interface CompleteInput {
  sessionId: string
  source: DictationSource
  completedItems: number
  totalItems: number
  avgAccuracy: number
  totalHints: number
  durationMs: number
  /** 힌트 없이 100% 로 받아쓴 최장 문장의 단어 수 */
  longestPerfectWords: number
  /** 단어 → FSRS 등급 */
  targetRatings: Map<string, 1 | 2 | 3 | 4>
}

export interface CompleteResult {
  /** FSRS 에 실제 반영된 단어 수 (내 vocabularies 에 있는 것만) */
  wordsPersisted: number
  wordsSkipped: number
}

/**
 * 세션 마감. 세 곳에 적는다:
 *   dictation_sessions(통계) · scores(홈/대시보드 최근 활동) · vocabularies+learning_records(FSRS)
 * learning_records INSERT 트리거가 daily_activity 를 갱신하므로 streak 은 자동으로 따라온다.
 */
export async function completeDictationSession(
  client: SupabaseClient,
  input: CompleteInput,
): Promise<CompleteResult> {
  const result: CompleteResult = { wordsPersisted: 0, wordsSkipped: 0 }

  // 세션 통계
  if (!input.sessionId.startsWith('local-')) {
    try {
      await client
        .from('dictation_sessions')
        .update({
          completed_items: input.completedItems,
          avg_accuracy: Math.round(input.avgAccuracy * 100) / 100,
          total_hints: input.totalHints,
          duration_ms: input.durationMs,
          longest_perfect_words: input.longestPerfectWords,
          completed_at: new Date().toISOString(),
        })
        .eq('id', input.sessionId)
    } catch {
      /* 통계 갱신 실패 — attempts 는 이미 남아 있다 */
    }
  }

  // 홈/대시보드 최근 활동 (scores INSERT 트리거 → daily_activity)
  await recordGameScore({
    module: 'dictation',
    score: Math.round(input.avgAccuracy),
    totalQuestions: input.totalItems,
    correctCount: input.completedItems,
    accuracy: Math.round(input.avgAccuracy * 10) / 10,
    durationSeconds: Math.round(input.durationMs / 1000),
    textId: input.source.textId,
    content: contentRefFromDictationSource(input.source),
    metadata: {
      source_kind: input.source.kind,
      title: input.source.title,
      shared_set_id: input.source.sharedSetId ?? null,
      library_book_id: input.source.libraryBookId ?? null,
      chapter_idx: input.source.chapterIdx ?? null,
      longest_perfect_words: input.longestPerfectWords,
      dictation_session_id: input.sessionId,
    },
  })

  // 타깃 단어 → FSRS
  const items: FlushItem[] = [...input.targetRatings.entries()].map(([word, rating]) => ({
    word,
    rating,
    reviewedAt: new Date().toISOString(),
    module: 'dictation',
  }))
  if (items.length > 0) {
    try {
      const res = await flushPendingSrsResults(items)
      if (res.ok) {
        result.wordsPersisted = res.persisted
        result.wordsSkipped = res.skipped
      }
    } catch {
      /* FSRS 반영 실패 — 세션 기록 자체는 남는다 */
    }
  }

  return result
}

// ── 읽기 ──────────────────────────────────────────────────────────

export interface DictationOverview {
  streak: number
  span: number
  weeklyAccuracy: number | null
  totalSentences: number
  totalSessions: number
  bestAccuracy: number | null
}

const EMPTY_OVERVIEW: DictationOverview = {
  streak: 0,
  span: 0,
  weeklyAccuracy: null,
  totalSentences: 0,
  totalSessions: 0,
  bestAccuracy: null,
}

export async function fetchDictationOverview(
  client: SupabaseClient,
): Promise<DictationOverview> {
  try {
    const { data, error } = await client.rpc('dictation_overview')
    if (error || !data) return EMPTY_OVERVIEW
    const d = data as Record<string, unknown>
    return {
      streak: Number(d.streak ?? 0),
      span: Number(d.span ?? 0),
      weeklyAccuracy: d.weekly_accuracy == null ? null : Number(d.weekly_accuracy),
      totalSentences: Number(d.total_sentences ?? 0),
      totalSessions: Number(d.total_sessions ?? 0),
      bestAccuracy: d.best_accuracy == null ? null : Number(d.best_accuracy),
    }
  } catch {
    return EMPTY_OVERVIEW
  }
}

export interface WeaknessRow {
  tag: string
  hits: number
  sampleExpected: string | null
  sampleActual: string | null
}

export async function fetchDictationWeakness(
  client: SupabaseClient,
  days = 14,
): Promise<WeaknessRow[]> {
  try {
    const { data, error } = await client.rpc('dictation_weakness', { p_days: days })
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => ({
      tag: String(r.tag),
      hits: Number(r.hits ?? 0),
      sampleExpected: (r.sample_expected as string | null) ?? null,
      sampleActual: (r.sample_actual as string | null) ?? null,
    }))
  } catch {
    return []
  }
}

export interface RecentSessionRow {
  id: string
  title: string
  sourceKind: string
  avgAccuracy: number | null
  completedItems: number
  totalItems: number
  completedAt: string | null
  startedAt: string
}

export async function fetchRecentDictationSessions(
  client: SupabaseClient,
  limit = 6,
): Promise<RecentSessionRow[]> {
  try {
    const { data, error } = await client
      .from('dictation_sessions')
      .select(
        'id, title, source_kind, avg_accuracy, completed_items, total_items, completed_at, started_at',
      )
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      sourceKind: String(r.source_kind ?? 'custom'),
      avgAccuracy: r.avg_accuracy == null ? null : Number(r.avg_accuracy),
      completedItems: Number(r.completed_items ?? 0),
      totalItems: Number(r.total_items ?? 0),
      completedAt: (r.completed_at as string | null) ?? null,
      startedAt: String(r.started_at),
    }))
  } catch {
    return []
  }
}

export interface SessionDetail {
  session: RecentSessionRow & {
    totalHints: number
    durationMs: number | null
    longestPerfectWords: number | null
    /** 출처 좌표 — "한 번 더" 가 같은 자료로 되돌아가려면 필요하다 */
    textId: string | null
    sharedSetId: string | null
    chapterIdx: number | null
  }
  attempts: Array<{
    itemIdx: number
    expected: string
    userInput: string
    accuracy: number
    hintsUsed: number
    replayCount: number
    skipped: boolean
    wordResults: WordResult[]
    errorTags: string[]
    targetWords: string[]
    targetHits: string[]
  }>
}

/** 결과 화면 — DB 에서 읽는다(다른 기기·나중에 다시 열어도 보인다). */
export async function fetchDictationSessionDetail(
  client: SupabaseClient,
  sessionId: string,
): Promise<SessionDetail | null> {
  try {
    const { data: sData } = await client
      .from('dictation_sessions')
      .select(
        'id, title, source_kind, avg_accuracy, completed_items, total_items, completed_at, started_at, total_hints, duration_ms, longest_perfect_words, text_id, shared_set_id, chapter_idx',
      )
      .eq('id', sessionId)
      .maybeSingle()
    if (!sData) return null
    const s = sData as Record<string, unknown>

    const { data: aData } = await client
      .from('dictation_attempts')
      .select(
        'item_idx, expected, user_input, accuracy, hints_used, replay_count, skipped, word_results, error_tags, target_words, target_hits',
      )
      .eq('session_id', sessionId)
      .order('item_idx', { ascending: true })

    return {
      session: {
        id: String(s.id),
        title: String(s.title ?? ''),
        sourceKind: String(s.source_kind ?? 'custom'),
        avgAccuracy: s.avg_accuracy == null ? null : Number(s.avg_accuracy),
        completedItems: Number(s.completed_items ?? 0),
        totalItems: Number(s.total_items ?? 0),
        completedAt: (s.completed_at as string | null) ?? null,
        startedAt: String(s.started_at),
        totalHints: Number(s.total_hints ?? 0),
        durationMs: s.duration_ms == null ? null : Number(s.duration_ms),
        longestPerfectWords:
          s.longest_perfect_words == null ? null : Number(s.longest_perfect_words),
        textId: (s.text_id as string | null) ?? null,
        sharedSetId: (s.shared_set_id as string | null) ?? null,
        chapterIdx: s.chapter_idx == null ? null : Number(s.chapter_idx),
      },
      attempts: ((aData ?? []) as Array<Record<string, unknown>>).map((r) => ({
        itemIdx: Number(r.item_idx ?? 0),
        expected: String(r.expected ?? ''),
        userInput: String(r.user_input ?? ''),
        accuracy: Number(r.accuracy ?? 0),
        hintsUsed: Number(r.hints_used ?? 0),
        replayCount: Number(r.replay_count ?? 0),
        skipped: Boolean(r.skipped),
        wordResults: (r.word_results as WordResult[]) ?? [],
        errorTags: (r.error_tags as string[]) ?? [],
        targetWords: (r.target_words as string[]) ?? [],
        targetHits: (r.target_hits as string[]) ?? [],
      })),
    }
  } catch {
    return null
  }
}
