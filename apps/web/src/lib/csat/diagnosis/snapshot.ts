// apps/web/src/lib/csat/diagnosis/snapshot.ts
//
// csat_dx_snapshot 한 행의 화면용 모양 + 조회. 학습자(본인 RLS)·관리자(service role) 모두 같은 함수로 읽는다.

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AttributeCode,
  AttributeMastery,
  ConfidenceLevel,
  HabitFlag,
  RecommendedLine,
  ScenarioForecast,
  SessionMode,
  TrapFamily,
  TrapVulnerability,
} from './engine/types'

export interface SnapshotView {
  id: string
  computedAt: string
  trigger: string
  engineVersion: string
  settingsId: number | null
  rawScore: number | null
  ability: number | null
  gradeEst: number | null
  attributeMastery: Record<AttributeCode, AttributeMastery>
  trapVulnerability: Partial<Record<TrapFamily, TrapVulnerability>>
  habitFlags: HabitFlag[]
  forecast: { hard: ScenarioForecast; normal: ScenarioForecast; easy: ScenarioForecast }
  confidence: ConfidenceLevel
  recommendedLines: RecommendedLine[]
  evidence: {
    examSessions: number
    diagnosticSessions: number
    responses: number
    diagnosedResponses: number
    scoreOnlySessions: number
    adjusted?: boolean
    trend?: { sessionId: string; takenAt: string; mode: SessionMode; raw: number | null; adjusted: number | null }[]
  }
}

const COLS =
  'id, computed_at, trigger, engine_version, settings_id, raw_score, adjusted_score, grade_est, attribute_mastery, trap_vulnerability, habit_flags, forecast, confidence, recommended_lines, evidence'

type Row = Record<string, unknown>

export function toView(r: Row): SnapshotView {
  return {
    id: r.id as string,
    computedAt: r.computed_at as string,
    trigger: r.trigger as string,
    engineVersion: r.engine_version as string,
    settingsId: (r.settings_id as number | null) ?? null,
    rawScore: (r.raw_score as number | null) ?? null,
    ability: r.adjusted_score === null || r.adjusted_score === undefined ? null : Number(r.adjusted_score),
    gradeEst: (r.grade_est as number | null) ?? null,
    attributeMastery: r.attribute_mastery as SnapshotView['attributeMastery'],
    trapVulnerability: r.trap_vulnerability as SnapshotView['trapVulnerability'],
    habitFlags: r.habit_flags as HabitFlag[],
    forecast: r.forecast as SnapshotView['forecast'],
    confidence: r.confidence as ConfidenceLevel,
    recommendedLines: r.recommended_lines as RecommendedLine[],
    evidence: r.evidence as SnapshotView['evidence'],
  }
}

/** 최근 스냅샷 n개(최신 먼저) — 표시용이라 의도적으로 자른다 */
export async function loadSnapshots(db: SupabaseClient, userId: string, limit = 50): Promise<SnapshotView[]> {
  const { data, error } = await db.from('csat_dx_snapshot').select(COLS).eq('user_id', userId)
    .order('computed_at', { ascending: false }).order('id').limit(limit)
  if (error) throw new Error(`진단 조회 실패: ${error.message}`)
  return (data ?? []).map((r) => toView(r as Row))
}

export async function loadHabitFeedback(db: SupabaseClient, snapshotIds: string[]): Promise<Record<string, Record<string, boolean>>> {
  if (snapshotIds.length === 0) return {}
  const { data, error } = await db.from('csat_dx_habit_feedback').select('snapshot_id, habit_code, agreed').in('snapshot_id', snapshotIds)
  if (error) throw new Error(`습관 응답 조회 실패: ${error.message}`)
  const out: Record<string, Record<string, boolean>> = {}
  for (const r of data ?? []) (out[r.snapshot_id as string] ??= {})[r.habit_code as string] = r.agreed as boolean
  return out
}

/** 한 줄 요약 — 보통 난도 기준 등급과 어려운 해의 하락 폭 */
export function summaryLine(s: SnapshotView): string {
  if (s.gradeEst === null) return '아직 진단할 기록이 부족해요.'
  const hard = s.forecast?.hard?.grade
  const normal = s.forecast?.normal?.grade
  // 난이도별 예측이 없으면(기준 시험·공식 오답률 미비) 「보통 난도 수능」이라고 말하지 않는다 — 지금 기록 기준만
  if (!normal) return `지금까지 입력한 시험 기준으로 ${s.gradeEst}등급이에요. 시험 난이도를 맞춘 수능 예측은 아직 준비 중이에요.`
  if (hard && hard > normal) return `지금 실력이면 보통 난도 수능에서 ${normal}등급이에요. 어려운 시험에서는 ${hard}등급까지 내려갈 수 있어요.`
  return `지금 실력이면 보통 난도 수능에서 ${normal}등급이에요.`
}
