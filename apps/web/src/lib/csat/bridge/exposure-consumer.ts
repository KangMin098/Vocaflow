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

/**
 * 문항 → 정규화 지문 키(exposure-ledger.normalizedPassageKey). undefined/null = 식별 불가.
 * K6-a: DB 함수 learning_attempt_independence 는 같은 item_ref 만 본다. 앱 원장(exposure-ledger)은 같은 지문을 쓰는 다른 문항의 노출도 노출로 본다.
 * 이 소비자는 앱 기준을 따른다 — 같은 지문 문항의 정답 노출은 이 시도에도 노출이고, 지문을 식별하지 못하면 X0 을 주지 않는다.
 */
export type PassageOf = (itemRef: string) => string | null | undefined

export interface ExposureJudgement {
  level: ExposureLevel
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'passage_unknown' | 'default'
  /** 서버가 관측할 수 없는 외부 노출(답지 · 검색 · 교재 · 구두 도움) — 언제나 UNKNOWN */
  external: 'UNKNOWN'
}

const at = (s: string) => Date.parse(s)

/**
 * 시도 하나의 노출 수준 — rows 는 그 학습자의 **전체** 원장 행(문항으로 걸러 읽으면 같은 지문의 다른 문항 노출을 놓친다).
 * passageOf 가 없거나 이 문항 · 원장 행 문항의 지문을 식별하지 못하면 X0 을 주지 않는다(passage_unknown).
 */
export function exposureLevelOf(a: AttemptForExposure, rows: readonly ExposureRow[], passageOf?: PassageOf): ExposureJudgement {
  const j = (level: ExposureLevel, rule: ExposureJudgement['rule']): ExposureJudgement => ({ level, rule, external: 'UNKNOWN' })
  if (!a.exposureOrderAt || !Number.isFinite(at(a.exposureOrderAt))) return j('X_UNKNOWN', 'R1')
  if (!a.itemRef) return j('X_UNKNOWN', 'R2')
  const order = at(a.exposureOrderAt)
  const mine = passageOf?.(a.itemRef) ?? null
  // 같은 문항, 또는 같은 지문을 쓰는 다른 문항의 노출
  const related = (r: ExposureRow) => r.itemRef === a.itemRef || (mine !== null && passageOf?.(r.itemRef) === mine)
  const passageUnknown = mine === null || rows.some((r) => r.itemRef !== a.itemRef && !passageOf?.(r.itemRef))
  const win = rows.filter((r) => related(r) && Number.isFinite(at(r.receivedAt)) && at(r.receivedAt) <= order)
  // 시각을 읽을 수 없는 관련 행 — 창 안인지 모른다
  const unreadable = rows.some((r) => related(r) && !Number.isFinite(at(r.receivedAt)))
  if (win.some((r) => r.kind === 'answer_direct')) return j('X3', 'R3')
  if (a.afterExplanation) return j('X3', 'R4')
  if (a.afterViewedFirst) return j('X3', 'R5')
  if (a.helpLevel === 'viewed_first') return j('X3', 'R6')
  if (win.some((r) => r.kind === 'decisive_hint')) return j('X2', 'R7')
  if (win.some((r) => r.clockSuspect) || unreadable) return j('X_UNKNOWN', 'R8')
  if (a.timingUncertain) return j('X_UNKNOWN', 'R9')
  if (a.helpLevel === null) return j('X_UNKNOWN', 'R10')
  if (a.helpLevel === 'hint') return passageUnknown ? j('X_UNKNOWN', 'passage_unknown') : j('X1', 'R11')
  if (a.helpLevel === 'independent' && win.length === 0) return passageUnknown ? j('X_UNKNOWN', 'passage_unknown') : j('X0', 'R12')
  return j('X_UNKNOWN', 'default')
}

/** 문항 단위(아직 시도 전) — 지금까지 원장에 정답 · 결정적 단서 노출이 있는가. 원장을 못 읽었으면 unknown */
export function itemExposureNow(itemRef: string, rows: readonly ExposureRow[] | null, passageOf?: PassageOf): 'answer_seen' | 'hint_seen' | 'none_observed' | 'unknown' {
  if (rows === null) return 'unknown'
  const p = passageOf?.(itemRef) ?? null
  const mine = rows.filter((r) => r.itemRef === itemRef || (p !== null && passageOf?.(r.itemRef) === p))
  if (mine.some((r) => r.kind === 'answer_direct')) return 'answer_seen'
  if (mine.some((r) => r.kind === 'decisive_hint')) return 'hint_seen'
  // 지문을 식별하지 못하면 「관측된 노출 없음」도 확정하지 않는다
  if (p === null || rows.some((r) => r.itemRef !== itemRef && !passageOf?.(r.itemRef))) return 'unknown'
  return 'none_observed'
}

export function parseIndependence(v: unknown): IndependenceStatus | null {
  return typeof v === 'string' && (INDEPENDENCE_STATUSES as readonly string[]).includes(v) ? (v as IndependenceStatus) : null
}
