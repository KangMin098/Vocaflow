// apps/web/src/hooks/useHubData.ts
//
// Hub 페이지(/hub) 데이터 통합 훅 — Phase 2 Supabase 연동.
//
// 단일 SWR 키(`hub-data:<userId>`)로 8~10개 쿼리를 Promise.allSettled 로 병렬 실행.
// 한 쿼리가 실패해도 나머지 데이터는 표시 (Calm UI · Empathetic Feedback 정합).
//
// 캐싱:
//   - dedupingInterval 5초 (SWR 기본)
//   - revalidateOnFocus: 탭 복귀 시 갱신
//   - revalidateOnReconnect: 네트워크 복구 시 갱신
//
// RLS:
//   - 모든 쿼리는 `auth.uid() = user_id` 정책으로 자동 격리
//   - service_role 키 사용 금지

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

import { createClient } from '@/lib/supabase/client'

import type { Enums, UserRole } from '@vocaflow/types'

// ════════════════════════════════════════════════════════════════════
// 타입
// ════════════════════════════════════════════════════════════════════

export type ModuleId = Enums<'module_id'>

/** Hub 페이지에서 표시하는 7개 모듈 (pirate_quest 베타 제외, dashboard 는 메타 페이지) */
export const HUB_MODULE_IDS: readonly ModuleId[] = [
  'textviewer',
  'wordvault',
  'flashcard',
  'spellforge',
  'wordblitz',
  'pairflip',
  'scriptquiz',
] as const

export interface HubData {
  user: {
    id: string
    displayName: string
    avatarUrl: string | null
    role: UserRole
  }
  stats: {
    streak: number
    todayWordCount: number
    totalWords: number
    accuracy: number
    reviewDueCount: number
  }
  /** Vocaflow 특화 — VRL 진단 상태 + 위급 단어 카운트 */
  vrl: {
    currentVLevel: number | null
    isDiagnosed: boolean
    trackLevels: Record<string, number>
    riskWordCount: number // R(t) < 0.7 추정 — next_review_at 이미 지난 단어
  }
  continueCard: {
    textId: string
    title: string
    coverEmoji: string | null
    progressPercent: number
    lastModule: ModuleId
    relativeTime: string
  } | null
  modules: Array<{
    id: ModuleId
    lastStudiedAt: string | null
  }>
  recentActivities: Array<{
    id: string
    module: ModuleId
    textTitle: string
    score: number | null
    isCorrect: boolean | null
    relativeTime: string
    createdAt: string
  }>
}

// ════════════════════════════════════════════════════════════════════
// 시간 헬퍼
// ════════════════════════════════════════════════════════════════════

/** KST(Asia/Seoul, +09:00) 기준 오늘 00:00 의 ISO 문자열 (UTC 표기) */
function startOfTodayKstIso(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const nowUtcMs = Date.now()
  const kstMidnightUtcMs = Math.floor((nowUtcMs + KST_OFFSET_MS) / 86_400_000) * 86_400_000 - KST_OFFSET_MS
  return new Date(kstMidnightUtcMs).toISOString()
}

const KO_RTF = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('ko', { numeric: 'auto' }) : null

/** ISO 문자열 → "방금 전 / 5분 전 / 2시간 전 / 어제 / 3일 전" 한국어 상대 시간 */
function formatRelativeKo(iso: string | null): string {
  if (!iso || !KO_RTF) return ''
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 5) return '방금 전'
  if (diffSec < 60) return KO_RTF.format(-diffSec, 'second')
  const min = Math.round(diffSec / 60)
  if (min < 60) return KO_RTF.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (hr < 24) return KO_RTF.format(-hr, 'hour')
  const day = Math.round(hr / 24)
  if (day < 30) return KO_RTF.format(-day, 'day')
  const mon = Math.round(day / 30)
  if (mon < 12) return KO_RTF.format(-mon, 'month')
  return KO_RTF.format(-Math.round(mon / 12), 'year')
}

// ════════════════════════════════════════════════════════════════════
// 인증 상태 — userId 가 결정되어야 SWR 트리거
// ════════════════════════════════════════════════════════════════════

function useAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUserId(data.user?.id ?? null)
      setAuthReady(true)
    })

    // 명시적 SIGNED_OUT 외 이벤트가 session=null 로 잠시 발화될 수 있어
    // userId 를 null 로 내리면 SWR 키가 깜빡이며 Hub 데이터가 사라졌다 돌아오는 플리커가 발생.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        setUserId(null)
        return
      }
      const next = session?.user?.id
      if (next) setUserId(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { userId, authReady }
}

// ════════════════════════════════════════════════════════════════════
// 핵심 fetcher — 모든 Hub 쿼리 병렬 실행
// ════════════════════════════════════════════════════════════════════

type SettledQuery<T> = { data: T | null; count: number | null; error: unknown }

function unwrap<T>(r: PromiseSettledResult<unknown>, label: string): SettledQuery<T> {
  if (r.status === 'fulfilled') {
    const v = r.value as { data: T | null; count?: number | null; error: unknown }
    if (v?.error) {
      // eslint-disable-next-line no-console
      console.error(`[useHubData] ${label} error:`, v.error)
    }
    return { data: v?.data ?? null, count: v?.count ?? null, error: v?.error ?? null }
  }
  // eslint-disable-next-line no-console
  console.error(`[useHubData] ${label} rejected:`, r.reason)
  return { data: null, count: null, error: r.reason }
}

async function fetchHubData(userId: string, userEmail: string | null): Promise<HubData> {
  const supabase = createClient()
  const todayStart = startOfTodayKstIso()
  const nowIso = new Date().toISOString()

  const queries = await Promise.allSettled([
    // 0) profile — current_v_level + current_track_levels 포함 (Vocaflow VRL)
    supabase
      .from('user_profiles')
      .select('display_name, avatar_url, role, current_v_level, current_track_levels')
      .eq('user_id', userId)
      .maybeSingle(),

    // 1) user_stats
    supabase
      .from('user_stats')
      .select('current_streak')
      .eq('user_id', userId)
      .maybeSingle(),

    // 2) today learning_records count (KST 00:00 기준)
    supabase
      .from('learning_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('attempted_at', todayStart),

    // 3) total vocabularies count
    supabase
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    // 4) all-time learning_records total count (정확도 분모)
    supabase
      .from('learning_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    // 5) all-time correct count (정확도 분자)
    supabase
      .from('learning_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_correct', true),

    // 6) review due count (next_review_at <= now)
    supabase
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('next_review_at', 'is', null)
      .lte('next_review_at', nowIso),

    // 7) continue 후보 — 최근 열람한 텍스트 1건
    supabase
      .from('texts')
      .select('id, title, progress_percent, last_opened')
      .eq('user_id', userId)
      .not('last_opened', 'is', null)
      .order('last_opened', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 8) 최근 학습 기록 (모듈별 lastStudiedAt + recentActivities + continueCard.lastModule 도출용)
    //    learning_records.vocabularies → texts(title) 중첩 조인
    supabase
      .from('learning_records')
      .select(
        'id, module, attempted_at, is_correct, vocabularies(text_id, texts(title))',
      )
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(50),

    // 9) 최근 게임 점수 (learning_records 와 머지)
    supabase
      .from('scores')
      .select('id, module, created_at, score, text_id, texts(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const profileQ = unwrap<{
    display_name: string | null
    avatar_url: string | null
    role: string
    current_v_level: number | null
    current_track_levels: Record<string, number> | null
  }>(queries[0], 'user_profiles')
  const statsQ = unwrap<{ current_streak: number | null }>(queries[1], 'user_stats')
  const todayCountQ = unwrap<unknown>(queries[2], 'today_count')
  const totalWordsQ = unwrap<unknown>(queries[3], 'total_words')
  const accuracyTotalQ = unwrap<unknown>(queries[4], 'accuracy_total')
  const accuracyCorrectQ = unwrap<unknown>(queries[5], 'accuracy_correct')
  const reviewDueQ = unwrap<unknown>(queries[6], 'review_due')
  const continueTextQ = unwrap<{
    id: string
    title: string
    progress_percent: number | null
    last_opened: string | null
  }>(queries[7], 'continue_text')

  type RecordRow = {
    id: string
    module: ModuleId
    attempted_at: string | null
    is_correct: boolean
    vocabularies: { text_id: string | null; texts: { title: string } | null } | null
  }
  type ScoreRow = {
    id: string
    module: ModuleId
    created_at: string | null
    score: number
    text_id: string | null
    texts: { title: string } | null
  }
  const recordsQ = unwrap<RecordRow[]>(queries[8], 'learning_records')
  const scoresQ = unwrap<ScoreRow[]>(queries[9], 'scores')

  // ── user (profile 없으면 안전한 fallback) ──
  const fallbackName = userEmail ? userEmail.split('@')[0] : '학습자'
  const user = {
    id: userId,
    displayName: profileQ.data?.display_name?.trim() || fallbackName,
    avatarUrl: profileQ.data?.avatar_url ?? null,
    role: ((profileQ.data?.role ?? 'user') as UserRole),
  }

  // ── stats ──
  const accuracyTotal = accuracyTotalQ.count ?? 0
  const accuracyCorrect = accuracyCorrectQ.count ?? 0
  const stats = {
    streak: statsQ.data?.current_streak ?? 0,
    todayWordCount: todayCountQ.count ?? 0,
    totalWords: totalWordsQ.count ?? 0,
    accuracy: accuracyTotal > 0 ? Math.round((accuracyCorrect / accuracyTotal) * 100) : 0,
    reviewDueCount: reviewDueQ.count ?? 0,
  }

  // ── VRL — V-Level + 진단 상태 + risk 단어 (reviewDueCount 재활용) ──
  const vLevelRaw = profileQ.data?.current_v_level ?? null
  const vrl = {
    currentVLevel: vLevelRaw,
    isDiagnosed: vLevelRaw !== null && vLevelRaw > 0,
    trackLevels: (profileQ.data?.current_track_levels ?? {}) as Record<string, number>,
    riskWordCount: reviewDueQ.count ?? 0,
  }

  // ── 모듈별 lastStudiedAt — records + scores 머지 후 최신 시각 ──
  const moduleLastStudied = new Map<ModuleId, string>()

  for (const r of recordsQ.data ?? []) {
    if (!r.attempted_at) continue
    const prev = moduleLastStudied.get(r.module)
    if (!prev || r.attempted_at > prev) moduleLastStudied.set(r.module, r.attempted_at)
  }
  for (const s of scoresQ.data ?? []) {
    if (!s.created_at) continue
    const prev = moduleLastStudied.get(s.module)
    if (!prev || s.created_at > prev) moduleLastStudied.set(s.module, s.created_at)
  }

  const modules = HUB_MODULE_IDS.map((id) => ({
    id,
    lastStudiedAt: moduleLastStudied.get(id) ?? null,
  }))

  // ── continueCard ──
  let continueCard: HubData['continueCard'] = null
  if (continueTextQ.data) {
    const t = continueTextQ.data
    // 해당 텍스트의 가장 최근 학습 모듈 찾기 (records → scores 순)
    let lastModule: ModuleId | null = null
    let lastTime = ''
    for (const r of recordsQ.data ?? []) {
      const tid = r.vocabularies?.text_id
      if (tid === t.id && r.attempted_at && r.attempted_at > lastTime) {
        lastModule = r.module
        lastTime = r.attempted_at
      }
    }
    for (const s of scoresQ.data ?? []) {
      if (s.text_id === t.id && s.created_at && s.created_at > lastTime) {
        lastModule = s.module
        lastTime = s.created_at
      }
    }

    continueCard = {
      textId: t.id,
      title: t.title,
      coverEmoji: null, // texts 테이블 cover_emoji 컬럼 부재 — Phase 3 추가 시 매핑
      progressPercent: t.progress_percent ?? 0,
      lastModule: lastModule ?? 'textviewer',
      relativeTime: formatRelativeKo(t.last_opened),
    }
  }

  // ── recentActivities — records + scores 머지 후 시간 desc 상위 5개 ──
  type Item = HubData['recentActivities'][number]
  const merged: Item[] = []

  for (const r of recordsQ.data ?? []) {
    if (!r.attempted_at) continue
    merged.push({
      id: `lr:${r.id}`,
      module: r.module,
      textTitle: r.vocabularies?.texts?.title ?? '단어장',
      score: null,
      isCorrect: r.is_correct,
      relativeTime: formatRelativeKo(r.attempted_at),
      createdAt: r.attempted_at,
    })
  }
  for (const s of scoresQ.data ?? []) {
    if (!s.created_at) continue
    merged.push({
      id: `sc:${s.id}`,
      module: s.module,
      textTitle: s.texts?.title ?? '게임 세션',
      score: s.score,
      isCorrect: null,
      relativeTime: formatRelativeKo(s.created_at),
      createdAt: s.created_at,
    })
  }

  merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  const recentActivities = merged.slice(0, 5)

  return { user, stats, vrl, continueCard, modules, recentActivities }
}

// ════════════════════════════════════════════════════════════════════
// 공개 훅
// ════════════════════════════════════════════════════════════════════

export function useHubData(): {
  data: HubData | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
} {
  const { userId, authReady } = useAuthUserId()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // email 은 displayName fallback 용도로만 사용 — getUser 결과에서 수집
  useEffect(() => {
    if (!userId) {
      setUserEmail(null)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [userId])

  const swr = useSWR(
    userId ? ['hub-data', userId] : null,
    () => fetchHubData(userId!, userEmail),
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  return {
    data: swr.data ?? null,
    // auth 가 결정되기 전 + SWR 가 fetch 중인 동안 모두 loading
    isLoading: !authReady || (!!userId && swr.isLoading),
    error: (swr.error as Error | undefined) ?? null,
    refetch: () => {
      void swr.mutate()
    },
  }
}
