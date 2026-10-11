// apps/web/src/lib/csat/map/v4/types.ts
//
// 학습 지도 rev4.0 교육 정의의 타입 — 원천은 docs/csat-learner/v4/*.json(설계 PR #205),
// 런타임 값은 생성물 definition.data.ts(scripts/csat/map/v4/gen-definition.mjs)로만 들어온다(요청마다 파일을 읽지 않는다).

export type Domain = 'V' | 'S' | 'R' | 'E' | 'L' | 'X'
export type TaskId = string

/** canon_candidate = 정본 rev2.1 §3 후보 · hold = 정본 보류(§20 — 정의만, 요구 · 실행 없음) */
export type TaskStatus = 'canon_candidate' | 'proposed' | 'hold'
/** 앱 안 직접 확인 준비 상태(정의 시점) — 실제 실행 가능 여부는 확인 링크 · 문항이 정한다 */
export type DirectCheck = 'live' | 'ready' | 'content_needed' | 'blocked'

export interface V4Task {
  id: TaskId
  display: string
  axis: Domain
  kind: 'atomic' | 'integrated'
  status: TaskStatus
  name: string
  goal: string
  conditions: string
  evidence: string
  /** 설계 기준(설계자용 메모 포함 — 학습자 화면에 쓰지 않는다) */
  criterion: string
  /** 학습자에게 보이는 「다 했다고 보는 기준」 */
  learner_criterion: string
  quantity_policy: string
  direct_check: DirectCheck
  methods: string[]
  assets: string[]
}

export type LineDecision = '유지' | '통합' | '분할' | '재분류' | '보류'
export interface V4Line {
  crosswalk_status: string
  decision: LineDecision
  layer: string
  v4: TaskId[]
  performance_goal: boolean
}

export type RelationType = 'PREREQUISITE' | 'SUPPORTS' | 'PART_OF' | 'INTEGRATES_WITH' | 'TRANSFERS_TO' | 'ALTERNATIVE_PATH' | 'DIAGNOSE_WITH' | 'REMEDIATES'
export interface V4Relation {
  id: string
  type: RelationType
  from: TaskId
  to: TaskId
  basis: string
  ref: string
  status: 'proposed' | 'approved'
}

export interface V4Template {
  id: string
  name: string
  goal: string
  core: TaskId[]
  support: TaskId[]
  relations: string[]
  method: string[]
  protocol: number[]
  content_keys: string[]
  criterion: string
  readiness: DirectCheck
  hold: boolean
}

export interface V4Data {
  version: string
  domains: { axis: Domain; name: string }[]
  tasks: V4Task[]
  lines: Record<string, V4Line>
  activityClass: Record<string, 'LA' | 'DC' | 'LM' | 'MC' | 'MG'>
  activityTaskOverride: Record<string, TaskId[]>
  inAppExecution: Record<string, 'live' | 'draft'>
  relations: V4Relation[]
  templates: V4Template[]
}
