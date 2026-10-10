// apps/web/src/lib/csat/diagnosis/snapshot.ts
//
// csat_dx_snapshot 한 행의 화면용 모양 + 조회. 학습자 · 관리자 모두 같은 함수로 읽는다(서버 전용 — service role).
// Reveal Gate: 보류 시험(오답 원인 Pilot 수집 중) 기록이 하나라도 있는 학습자의 스냅샷은 내보내지 않는다 — DB 정책
// csat_dx_snapshot_own_select(user_has_embargoed_session)와 같은 판정을 service role 경로에도 건다(embargo-gate · 판정 실패면 보류).
// 공개 전이(capture 완료 · 종료) 뒤 스냅샷 재계산은 csat_ec_reveal_outbox 처리기의 몫이다.

import type { LineStat as MapLineStat } from './engine/map-evidence'
import type { SupabaseClient } from '@supabase/supabase-js'

import { userHasHeldSession } from '../embargo-gate'

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
    /** 학습 지도용 성취율(가산 키 — 옛 스냅샷에는 없다) */
    lineAccuracy?: Record<string, MapLineStat>
    attributePoints?: Record<string, MapLineStat>
    /** 틀린 V 문항의 다른 축 겹침(map-evidence VOverlap · 2026-10-08) */
    vOverlap?: { wrongV: number; R: number; E: number; X: number }
    trapAvoidance?: Record<string, MapLineStat>
    habitEvaluable?: Record<string, { evaluable: boolean; n: number; need: number }>
    mapStatus?: 'ok' | 'off' | 'failed'
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
  // 판정은 embargo-gate 자신의 service role 로 — 받은 db 가 학습자 RLS 면 보류 세션이 안 보여 「없음」으로 열린다(fail-open)
  if (await userHasHeldSession(userId)) return []
  // 최근 계산분을 넉넉히 받아 「입력 리비전」으로 다시 줄 세운다 — 동시 저장에서는 늦게 끝난 계산이
  // 더 적은 기록을 봤을 수 있다. 기록 수 → 입력 워터마크 → 계산 시각 순(sortByRevision)
  const { data, error } = await db.from('csat_dx_snapshot').select(`${COLS}, inputs_as_of`).eq('user_id', userId)
    .order('computed_at', { ascending: false }).order('id').limit(limit + 10)
  if (error) throw new Error(`진단 조회 실패: ${error.message}`)
  return sortByRevision((data ?? []) as Row[]).slice(0, limit).map(toView)
}

/** 입력 리비전 순(최신 먼저) — 본 기록 수(세션은 지우지 않으므로 단조 증가) → 입력 워터마크 → 설정 버전 → 계산 시각 */
export function sortByRevision<R extends Record<string, unknown>>(rows: R[]): R[] {
  const count = (r: R) => {
    const ev = (r.evidence ?? {}) as { examSessions?: number; diagnosticSessions?: number }
    return (ev.examSessions ?? 0) + (ev.diagnosticSessions ?? 0)
  }
  return [...rows].sort((a, b) =>
    count(b) - count(a)
    || String(b.inputs_as_of ?? '').localeCompare(String(a.inputs_as_of ?? ''))
    // 같은 입력이면 더 새 설정 버전으로 계산한 것이 최신(설정 전환을 사이에 둔 동시 계산)
    || Number(b.settings_id ?? 0) - Number(a.settings_id ?? 0)
    || String(b.computed_at ?? '').localeCompare(String(a.computed_at ?? '')))
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
