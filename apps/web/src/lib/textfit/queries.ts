// apps/web/src/lib/textfit/queries.ts
//
// TextFit 데이터 접근 — **기존 테이블만 읽는다. 새 테이블·쓰기 경로 0.**
//   user_profiles.current_v_level · word_familiarity · vocabularies · shared_dictionary
//
// 표면형 → 표제어 해석은 DB 의 `resolve_dict_headword` 가 정본이다(같은 규칙을 TS 로 복제하면
// 두 해석기가 서로 다르게 낡는다 — 학습자가 보는 추출과 커버리지가 갈라진다).
// 다만 그 함수를 "필터 없이 전량" 돌려주는 RPC 가 아직 없다.
//   → `textfit_resolve_levels` 가 있으면 그것을 쓰고, 없으면 **정확 일치 폴백**으로 내려간다.
//     폴백은 굴절형을 미해결로 남기므로 커버리지를 **낮게** 잡는다 —
//     방향이 안전한 쪽이다(있는 실력을 과소평가할지언정, 없는 실력을 있다고 하지 않는다).
//   승인 대기 SQL: supabase/migrations/_pending_20260817_textfit_resolve_levels.sql

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { analyzeTextFit } from './coverage'
import type { FsrsState, ResolutionMode, TextFitInput, TextFitReport } from './types'

/** RPC 가 돌려주는 표면형→표제어·레벨 매핑 한 행. */
interface ResolvedRow {
  surface: string
  headword: string
  v_level: number | null
}

/**
 * 표면형 배열을 표제어·V-Level 로 해석한다.
 *
 * 1순위 RPC → 실패하면 정확 일치 폴백. 폴백을 조용히 삼키지 않고 mode 로 되돌린다.
 */
async function resolveLevels(
  supabase: SupabaseClient,
  surfaces: string[],
): Promise<{ surfaceToLemma: Map<string, string>; lemmaVLevel: Map<string, number>; mode: ResolutionMode }> {
  const surfaceToLemma = new Map<string, string>()
  const lemmaVLevel = new Map<string, number>()

  if (surfaces.length === 0) {
    return { surfaceToLemma, lemmaVLevel, mode: 'headword_rpc' }
  }

  // ── 1순위: 정본 해석기 ──
  const rpc = await (supabase as unknown as SupabaseClient)
    .rpc('textfit_resolve_levels', { p_words: surfaces })

  if (!rpc.error && Array.isArray(rpc.data)) {
    for (const row of rpc.data as ResolvedRow[]) {
      if (!row.headword) continue
      surfaceToLemma.set(row.surface, row.headword)
      if (row.v_level !== null && row.v_level !== undefined) {
        lemmaVLevel.set(row.headword, row.v_level)
      }
    }
    return { surfaceToLemma, lemmaVLevel, mode: 'headword_rpc' }
  }

  // ── 폴백: 정확 일치만 ──
  // 굴절형("allocated")은 해석되지 않아 미지어로 남는다. 커버리지를 과소평가하는 방향.
  const CHUNK = 400
  for (let i = 0; i < surfaces.length; i += CHUNK) {
    const chunk = surfaces.slice(i, i + CHUNK)
    const { data } = await supabase
      .from('shared_dictionary')
      .select('word, v_level')
      .in('word', chunk)
      .not('classified_by', 'is', null)

    for (const row of (data ?? []) as { word: string; v_level: number | null }[]) {
      surfaceToLemma.set(row.word, row.word)
      if (row.v_level !== null) lemmaVLevel.set(row.word, row.v_level)
    }
  }

  return { surfaceToLemma, lemmaVLevel, mode: 'exact_match_fallback' }
}

/** 학습자의 자기보고 판정 — lemma → known/unknown. */
async function loadFamiliarity(
  supabase: SupabaseClient,
  userId: string,
  lemmas: string[],
): Promise<Map<string, 'known' | 'unknown'>> {
  const out = new Map<string, 'known' | 'unknown'>()
  if (lemmas.length === 0) return out

  const CHUNK = 400
  for (let i = 0; i < lemmas.length; i += CHUNK) {
    const { data } = await (supabase as unknown as SupabaseClient)
      .from('word_familiarity')
      .select('lemma, verdict')
      .eq('user_id', userId)
      .in('lemma', lemmas.slice(i, i + CHUNK))

    for (const row of (data ?? []) as { lemma: string; verdict: string }[]) {
      if (row.verdict === 'known' || row.verdict === 'unknown') out.set(row.lemma, row.verdict)
    }
  }
  return out
}

/**
 * 학습자의 FSRS 상태 — lemma → { stability, lastReviewAt }.
 *
 * `vocabularies.lemma` 가 비어 있는 오래된 행이 있으므로 `word` 로도 잡는다(둘 다 소문자로 접는다).
 * 같은 표제어가 여러 행이면 **가장 안정적인 것**을 남긴다 — 학습자가 그 단어를 아는 최선의 증거다.
 */
async function loadFsrs(
  supabase: SupabaseClient,
  userId: string,
  lemmas: string[],
): Promise<Map<string, FsrsState>> {
  const out = new Map<string, FsrsState>()
  if (lemmas.length === 0) return out

  const { data } = await supabase
    .from('vocabularies')
    .select('word, lemma, stability, last_review_at')
    .eq('user_id', userId)

  const wanted = new Set(lemmas)
  type Row = { word: string; lemma: string | null; stability: number | null; last_review_at: string | null }

  for (const row of (data ?? []) as Row[]) {
    const key = (row.lemma ?? row.word ?? '').toLowerCase()
    if (!key || !wanted.has(key)) continue

    const next: FsrsState = {
      stability: row.stability,
      lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
    }
    const prev = out.get(key)
    if (!prev || (next.stability ?? 0) > (prev.stability ?? 0)) out.set(key, next)
  }
  return out
}

/**
 * 지문 하나를 현재 로그인 학습자 기준으로 판정한다.
 *
 * `counts` / `totalTokens` 는 `lib/text-extract/tokenize` 결과를 그대로 넘긴다 —
 * 학습자가 보는 추출과 커버리지가 **같은 토크나이저**에서 나와야 두 숫자가 갈라지지 않는다.
 */
export async function analyzeText(
  counts: Record<string, number>,
  totalTokens: number,
  now: Date = new Date(),
): Promise<TextFitReport | null> {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null

  const surfaces = Object.keys(counts)

  const [{ data: profile }, resolved] = await Promise.all([
    supabase.from('user_profiles').select('current_v_level').eq('user_id', userId).maybeSingle(),
    resolveLevels(supabase, surfaces),
  ])

  const { surfaceToLemma, lemmaVLevel, mode } = resolved

  // 표면형 counts → 표제어 counts. 같은 표제어로 접히는 굴절형들의 빈도는 합산된다
  // ("allocate" 2회 + "allocated" 3회 = 5회) — 커버리지 기여도는 표제어 단위가 맞다.
  const lemmaCounts: Record<string, number> = {}
  for (const [surface, n] of Object.entries(counts)) {
    const lemma = surfaceToLemma.get(surface) ?? surface
    lemmaCounts[lemma] = (lemmaCounts[lemma] ?? 0) + n
  }

  const lemmas = Object.keys(lemmaCounts)
  const [familiarity, fsrs] = await Promise.all([
    loadFamiliarity(supabase, userId, lemmas),
    loadFsrs(supabase, userId, lemmas),
  ])

  const rawLevel = (profile as { current_v_level: number | null } | null)?.current_v_level ?? null
  // 0 은 "미진단" 을 뜻하는 센티널이다 — 레벨 1 로 오독하면 모든 단어가 추정 기지어가 된다.
  const userVLevel = rawLevel !== null && rawLevel > 0 ? rawLevel : null

  const input: TextFitInput = {
    counts: lemmaCounts,
    totalTokens,
    userVLevel,
    familiarity,
    fsrs,
    dictVLevel: lemmaVLevel,
    now,
  }

  return {
    ...analyzeTextFit(input),
    resolutionMode: mode,
    isDiagnosed: userVLevel !== null,
  }
}
