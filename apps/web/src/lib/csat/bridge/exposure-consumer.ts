// apps/web/src/lib/csat/bridge/exposure-consumer.ts
//
// H4 — P6 노출 원장(learning_exposures · learning_attempt_independence) 소비자(순수). 원장 · RPC 를 새로 만들지 않는다.
//   규칙 정본: 대량작업 E `05_EXPOSURE_ELIGIBILITY_MODEL.md` §3(R1~R12). 창 = 같은 학습자 · 문항에서 received_at ≤ exposure_order_at(동률 포함).
//   창 안 최대 노출이 이긴다: X3 > X2 > X_UNKNOWN > X1 > X0. X0 은 언제나 「서버 관측 범위 안」 — 외부 노출은 항상 UNKNOWN.
//   서버 조회는 exposure-reader.ts(읽기 전용) — 이 파일은 행을 받아 판정만 한다.

export type ExposureLevel = 'X0' | 'X1' | 'X2' | 'X3' | 'X_UNKNOWN'

/** learning_attempt_independence 반환값(P6 v3) — null = 그 시도 없음 */
export type IndependenceStatus = 'legacy_unknown' | 'not_check_phase' | 'helped' | 'after_exposure' | 'timing_held' | 'unbound' | 'ungraded' | 'repeat' | 'independent_candidate'

export const INDEPENDENCE_STATUSES: readonly IndependenceStatus[] = ['legacy_unknown', 'not_check_phase', 'helped', 'after_exposure', 'timing_held', 'unbound', 'ungraded', 'repeat', 'independent_candidate']

export interface ExposureRow {
  itemRef: string
  kind: 'answer_direct' | 'decisive_hint'
  source: string
  receivedAt: string
  clockSuspect: boolean
  analysisVersion: number | null
}

export interface AttemptForExposure {
  itemRef: string | null
  /** 시도 순서 시각(P6 트리거) — 없으면 추적 이전 */
  exposureOrderAt: string | null
  helpLevel: string | null
  afterExplanation: boolean
  afterViewedFirst: boolean
  timingUncertain: boolean
}

export interface ExposureJudgement {
  level: ExposureLevel
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'default'
  /** 서버가 관측할 수 없는 외부 노출(답지 · 검색 · 교재 · 구두 도움) — 언제나 UNKNOWN */
  external: 'UNKNOWN'
}

const at = (s: string) => Date.parse(s)

/** 시도 하나의 노출 수준 — rows 는 그 학습자의 원장 행(다른 문항 행이 섞여도 된다) */
export function exposureLevelOf(a: AttemptForExposure, rows: readonly ExposureRow[]): ExposureJudgement {
  const j = (level: ExposureLevel, rule: ExposureJudgement['rule']): ExposureJudgement => ({ level, rule, external: 'UNKNOWN' })
  if (!a.exposureOrderAt || !Number.isFinite(at(a.exposureOrderAt))) return j('X_UNKNOWN', 'R1')
  if (!a.itemRef) return j('X_UNKNOWN', 'R2')
  const order = at(a.exposureOrderAt)
  const win = rows.filter((r) => r.itemRef === a.itemRef && Number.isFinite(at(r.receivedAt)) && at(r.receivedAt) <= order)
  // 시각을 읽을 수 없는 같은 문항 행 — 창 안인지 모른다
  const unreadable = rows.some((r) => r.itemRef === a.itemRef && !Number.isFinite(at(r.receivedAt)))
  if (win.some((r) => r.kind === 'answer_direct')) return j('X3', 'R3')
  if (a.afterExplanation) return j('X3', 'R4')
  if (a.afterViewedFirst) return j('X3', 'R5')
  if (a.helpLevel === 'viewed_first') return j('X3', 'R6')
  if (win.some((r) => r.kind === 'decisive_hint')) return j('X2', 'R7')
  if (win.some((r) => r.clockSuspect) || unreadable) return j('X_UNKNOWN', 'R8')
  if (a.timingUncertain) return j('X_UNKNOWN', 'R9')
  if (a.helpLevel === null) return j('X_UNKNOWN', 'R10')
  if (a.helpLevel === 'hint') return j('X1', 'R11')
  if (a.helpLevel === 'independent' && win.length === 0) return j('X0', 'R12')
  return j('X_UNKNOWN', 'default')
}

/** 문항 단위(아직 시도 전) — 지금까지 원장에 정답 · 결정적 단서 노출이 있는가. 원장을 못 읽었으면 unknown */
export function itemExposureNow(itemRef: string, rows: readonly ExposureRow[] | null): 'answer_seen' | 'hint_seen' | 'none_observed' | 'unknown' {
  if (rows === null) return 'unknown'
  const mine = rows.filter((r) => r.itemRef === itemRef)
  if (mine.some((r) => r.kind === 'answer_direct')) return 'answer_seen'
  if (mine.some((r) => r.kind === 'decisive_hint')) return 'hint_seen'
  return 'none_observed'
}

export function parseIndependence(v: unknown): IndependenceStatus | null {
  return typeof v === 'string' && (INDEPENDENCE_STATUSES as readonly string[]).includes(v) ? (v as IndependenceStatus) : null
}
