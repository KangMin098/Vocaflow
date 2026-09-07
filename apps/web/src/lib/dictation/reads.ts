// apps/web/src/lib/dictation/reads.ts
//
// 받아쓰기 **읽기 전용** 조회 — 서버·클라이언트 어느 쪽에서도 부를 수 있다.
//
// ── 왜 `persist.ts` 에서 떼어 왔나 (실측 2026-09-06) ────────────────────
// `persist.ts` 는 완주 시 `recordGameScore`(`'use client'`)를 부르기 때문에 파일 전체가
// `'use client'` 다. 그래서 `/dictate` 허브를 서버 컴포넌트로 내렸을 때 서버가 받은 것은
// 함수가 아니라 **클라이언트 참조**였고, 첫 렌더가 통째로
// `TypeError: fetchDictationOverview is not a function` 으로 죽었다
// (화면은 「불러오지 못했어요」를 그렸다 — 조용히 비지 않은 건 다행이지만 값은 못 냈다).
//
// 읽기 4종은 쓰기 경로와 의존성이 하나도 겹치지 않는다(Supabase 클라이언트만 쓴다).
// 그래서 **복제가 아니라 이동**했다 — `persist.ts` 는 여기서 다시 내보내므로
// 기존 클라이언트 호출부는 그대로다.
//
// ⚠️ 여기에는 `'use client'` 를 붙이지 않는다. 붙이는 순간 서버 허브가 다시 죽는다.

import type { SupabaseClient } from '@supabase/supabase-js'

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

