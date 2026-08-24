// apps/web/src/lib/game/ranking.ts
//
// Game Lab 랭킹 — RPC 래퍼 + 표시 규칙.
//
// ── 이 파일이 지키는 것 ───────────────────────────────────────────
// **표본이 작다는 사실을 화면에서 지우지 않는다.**
// 실측(2026-08-25): 게임 기록 43행 · 2명. 이 상태에서 "1위" 만 크게 띄우면 그건 성취가
// 아니라 거짓말이다. 그래서 모든 조회가 `playerCount` 를 함께 들고 다니고,
// `rankLine()` 이 참가자 수에 따라 **말을 바꾼다** — 혼자면 순위 대신 개인 최고를 말한다.
//
// ── 점수를 게임 사이로 넘기지 않는다 ─────────────────────────────
// 같은 "점수" 가 게임마다 다른 단위다(cascade 0~900 · pairflip 0~1460 · scriptquiz 0~40)
// 게다가 풀 크기·세션 길이에 비례한다. 원점수 합산 랭킹은 "누가 큰 단어장을 골랐나" 를 잰다.
// 그래서 종합은 **게임별 백분위의 평균**으로만 만든다(`overallRank`).
//
// RPC 계약은 supabase/migrations/20260825120000_game_ranking.sql.

import type { SupabaseClient } from '@supabase/supabase-js'

import { GAME_BY_SLUG, type GameSlug } from '@/lib/game/catalog'

/** 순위 기간. 주/월 경계는 KST 기준(RPC `game_rank_window`). */
export type RankPeriod = 'all' | 'week' | 'month'

export const RANK_PERIODS: { key: RankPeriod; label: string; note: string }[] = [
  { key: 'week', label: '이번 주', note: '월요일 0시(KST)에 새로 시작해요' },
  { key: 'month', label: '이번 달', note: '1일 0시(KST)에 새로 시작해요' },
  { key: 'all', label: '전체', note: '가입 이후 전 기록' },
]

export interface LeaderboardRow {
  rank: number
  /** 별칭 또는 (본인이 공개를 켠 경우) 표시 이름 */
  label: string
  bestScore: number
  plays: number
  bestAccuracy: number | null
  lastPlayed: string | null
  isMe: boolean
}

export interface Leaderboard {
  module: GameSlug
  period: RankPeriod
  rows: LeaderboardRow[]
  /** 이 기간·이 게임의 참가자 수. 화면은 이 값을 반드시 표기한다. */
  playerCount: number
  /** 내 행 (상위 밖이어도 RPC 가 함께 돌려준다) */
  me: LeaderboardRow | null
}

interface RawLeaderboardRow {
  rank: number
  label: string
  best_score: number
  plays: number
  best_accuracy: number | string | null
  last_played: string | null
  is_me: boolean
  player_count: number
}

/**
 * 게임 하나의 순위표.
 *
 * RPC 가 없거나(마이그레이션 미적용) 실패하면 **빈 순위표**를 준다 — 던지지 않는다.
 * 랭킹은 부가 기능이라, 이것 때문에 게임 허브가 통째로 죽으면 안 된다.
 */
export async function fetchLeaderboard(
  client: SupabaseClient,
  module: GameSlug,
  period: RankPeriod = 'week',
  limit = 10,
): Promise<Leaderboard> {
  const empty: Leaderboard = { module, period, rows: [], playerCount: 0, me: null }
  try {
    const { data, error } = await client.rpc('game_leaderboard', {
      p_module: module,
      p_period: period,
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return empty

    const rows: LeaderboardRow[] = (data as RawLeaderboardRow[]).map((r) => ({
      rank: r.rank,
      label: r.label,
      bestScore: r.best_score,
      plays: Number(r.plays ?? 0),
      bestAccuracy: r.best_accuracy == null ? null : Number(r.best_accuracy),
      lastPlayed: r.last_played,
      isMe: r.is_me === true,
    }))
    return {
      module,
      period,
      rows,
      playerCount: Number((data as RawLeaderboardRow[])[0]?.player_count ?? 0),
      me: rows.find((r) => r.isMe) ?? null,
    }
  } catch {
    return empty
  }
}

export interface RankSummaryRow {
  module: GameSlug
  bestScore: number
  plays: number
  myRank: number
  playerCount: number
  /** 참가자가 1명뿐이면 null — 100% 로 적으면 거짓 성취가 된다. */
  percentile: number | null
}

interface RawSummaryRow {
  module: string
  best_score: number
  plays: number
  my_rank: number
  player_count: number
  percentile: number | string | null
}

/** 내가 플레이한 게임 전부의 최고점·순위. 비로그인이면 빈 배열. */
export async function fetchRankSummary(
  client: SupabaseClient,
  period: RankPeriod = 'all',
): Promise<RankSummaryRow[]> {
  try {
    const { data, error } = await client.rpc('game_rank_summary', { p_period: period })
    if (error || !Array.isArray(data)) return []
    return (data as RawSummaryRow[])
      // scores.module 에는 아케이드 밖 모듈(flashcard·scriptquiz·dictation…)도 들어 있다.
      // Game Lab 랭킹은 카탈로그에 있는 게임만 센다 — 아니면 "게임 4종 플레이" 같은
      // 숫자가 카탈로그와 어긋난다.
      .filter((r) => !!GAME_BY_SLUG[r.module])
      .map((r) => ({
        module: r.module as GameSlug,
        bestScore: r.best_score,
        plays: Number(r.plays ?? 0),
        myRank: r.my_rank,
        playerCount: Number(r.player_count ?? 0),
        percentile: r.percentile == null ? null : Number(r.percentile),
      }))
  } catch {
    return []
  }
}

// ── 종합 랭크 ─────────────────────────────────────────────────────

export interface OverallRank {
  /** 랭킹이 성립한 게임 수 — 참가자 2명 이상인 게임만 센다 */
  rankedGames: number
  /** 내가 기록을 남긴 아케이드 게임 수 */
  playedGames: number
  /** 게임별 백분위의 평균. 성립한 게임이 없으면 null */
  meanPercentile: number | null
  /** 개인 최고를 세운 게임 수 — 혼자 있는 게임에서도 말할 수 있는 사실 */
  soloBests: number
}

/**
 * 종합 랭크 — **백분위의 평균**이지 점수의 합이 아니다.
 *
 * 점수를 더하면 단위가 다른 것을 더하게 되고(파일 헤더), 그 순간 랭킹은
 * "큰 단어장을 고른 사람" 을 1등으로 만든다. 백분위는 게임 안에서 정규화된 값이라
 * 게임 사이를 넘길 수 있다.
 *
 * 참가자 1명인 게임은 백분위가 정의되지 않으므로 평균에서 **빼고**, 대신
 * `soloBests` 로 따로 센다 — 그 게임에서 세운 개인 최고는 사실이기 때문이다.
 */
export function overallRank(rows: RankSummaryRow[]): OverallRank {
  const ranked = rows.filter((r) => r.percentile != null)
  const mean =
    ranked.length > 0
      ? Math.round((ranked.reduce((s, r) => s + (r.percentile ?? 0), 0) / ranked.length) * 10) / 10
      : null
  return {
    rankedGames: ranked.length,
    playedGames: rows.length,
    meanPercentile: mean,
    soloBests: rows.length - ranked.length,
  }
}

// ── 표시 규칙 ─────────────────────────────────────────────────────

/**
 * 순위 한 줄 — **참가자 수에 따라 말이 달라진다.**
 *
 * 혼자 있는 순위표에서 "1위 🏆" 는 격려가 아니라 거짓이다(디자인 철학 3 Empathetic
 * Feedback 은 격려를 요구하지 최면을 요구하지 않는다). 그때는 순위를 말하지 않고
 * 개인 최고를 말한다 — 그것은 참인 데다, 다음 판에 실제로 깰 수 있는 목표다.
 */
export function rankLine(row: { myRank: number; playerCount: number; bestScore: number }): string {
  if (row.playerCount <= 1) return `내 최고 ${row.bestScore.toLocaleString()}점 · 아직 나만 기록했어요`
  if (row.myRank === 1) return `${row.playerCount}명 중 1위 · 최고 ${row.bestScore.toLocaleString()}점`
  return `${row.playerCount}명 중 ${row.myRank}위 · 최고 ${row.bestScore.toLocaleString()}점`
}

/** 순위표 전체에 붙는 표본 고지. 참가자가 적으면 그 사실을 먼저 말한다. */
export function sampleNote(playerCount: number, period: RankPeriod): string {
  const p = RANK_PERIODS.find((x) => x.key === period)?.label ?? '전체'
  if (playerCount === 0) return `${p} 기록이 아직 없어요 — 첫 기록을 남기면 여기 올라옵니다.`
  if (playerCount === 1) return `${p} 참가자 1명 — 순위보다 내 최고 기록을 목표로 삼아 보세요.`
  if (playerCount < 5) return `${p} 참가자 ${playerCount}명 — 아직 표본이 작아요.`
  return `${p} 참가자 ${playerCount}명`
}

/** 랭킹에 쓸 게임 이름. 카탈로그 밖 slug 는 그대로 보여 준다(조용히 숨기지 않는다). */
export function rankGameName(slug: GameSlug): string {
  return GAME_BY_SLUG[slug]?.name ?? slug
}
