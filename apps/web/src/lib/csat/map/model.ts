// apps/web/src/lib/csat/map/model.ts
//
// 학습 지도 모델 조립 — 로더(load.ts)가 모은 원자료 → 노드별 목표율 · 성취율 · 상태. 순수 함수(DB · 시계 없음).
// 규칙 정본: .agent-plan.md §4 · 계산 부품: target.ts.

import {
  aggregate,
  completionRate,
  itemKey,
  lineStatus,
  lineTarget,
  splitMust,
  type AggregateStatus,
  type ItemKey,
  type RefItem,
  type ReferenceSelection,
} from './target'

export interface MapNodeRow {
  code: string
  kind: 'goal' | 'axis' | 'line' | 'principle' | 'track'
  name: string
  axis: string | null
  track: string | null
  summary: string | null
  why: string | null
  signal: string | null
  evidence_status: 'sourced' | 'pending'
  sort: number
}

export interface MapEdgeRow {
  id: number
  from_code: string
  to_code: string
  kind: 'goal' | 'member' | 'reason' | 'route'
  basis: 'direct' | 'inferred' | 'pending'
}

export interface MapTaskRow {
  id: string
  line_code: string
  ord: number
  title: string
  how: string
  cadence: string
  done_when: string
  material: 'past' | 'core'
  method_line: string | null
}

export interface MapSettings {
  default_goal: number
  reference_exams: number
  status: { near: number }
  min_coverage: number
  goal_presets: number[]
  /** 핵심 지도 관찰 후보 기준 — 관찰값 < weak 취약 후보 · < watch 추가 확인 필요(목표율과 무관) */
  core: { weak: number; watch: number }
}

export interface MapStat {
  n: number
  value: number | null
  status: 'ok' | 'insufficient'
  /** 분모(배점 × 감쇠 합) — 순위 축소 추정용, 옛 스냅샷에는 없다 */
  den?: number
}

export interface SnapshotInput {
  attributePoints: Record<string, MapStat>
  lineAccuracy: Record<string, MapStat>
  trapAvoidance: Record<string, MapStat>
  /** 활성 습관 신호 코드(habit_flags[].code) */
  habitCodes: string[]
  /** 습관별 평가 가능 여부(evidence.habitEvaluable) — 옛 스냅샷에는 없다 */
  habitEvaluable?: Record<string, { evaluable: boolean; n: number; need: number }>
  /** 최신 기록 원점수 — 목표 노드의 「현재 점수」 */
  currentScore: number | null
  examSessions: number
  responses: number
}

export interface MapRaw {
  nodes: MapNodeRow[]
  edges: MapEdgeRow[]
  tasks: MapTaskRow[]
  settings: MapSettings
  /** 학습자가 정한 목표 점수. 없으면 설정 기본값 */
  goal: number | null
  doneTaskIds: Set<string>
  selection: ReferenceSelection
  /** 기준 시험별 45문항(배점 · 오답률) */
  itemsByExam: Record<string, RefItem[]>
  /** 라인 → 연결된 기준 시험 문항 키 */
  lineItems: Record<string, ItemKey[]>
  /** 습관 신호 코드 → D 라인 */
  habitLine: Record<string, string>
  /** 이 습관 신호 코드 → 신호 */
  snapshot: SnapshotInput | null
  /** 이번 단계에서 「데이터 없음 · 진단 필요」로 고정하는 역량 라인(core.ts NO_DATA_ATTRIBUTES) — 관찰값을 쓰지 않는다 */
  noData?: readonly string[]
}

export type NodeStatus = AggregateStatus | 'tasks_only'
/** 신호 있음 · 해소됨(지금 근거로 보아 나타나지 않음) · 판단 불가(근거 부족 · 옛 스냅샷) */
export type HabitState = 'active' | 'resolved' | 'unknown'

export interface NodeValue {
  /** 목표율 0~1 — 눈금. 연결 문항이 없으면 null */
  target: number | null
  /** 현재 성취율 0~1 — 채움. 진단 안 됐으면 null */
  achieved: number | null
  status: NodeStatus
  /** 집계 노드: 진단된 라인 배점 비율(0~1) */
  coverage: number | null
  /** 지표가 저장한 기여 건수. 집계 노드는 연결 라인 건수의 합(중복 포함) — 서로 다른 응답 수가 아니다 */
  n: number | null
  /** 관찰값의 분모(배점 × 감쇠 합) — 순위 축소 추정용. 옛 스냅샷 · 관찰 없음이면 null */
  den?: number | null
  points: number
  /** 과제 완료 */
  tasks: { done: number; total: number; rate: number | null }
  habit: HabitState | null
  /** 습관 판정 근거(관측 n / 필요 need) — 팝업 「현 상태」 */
  habitBasis: { n: number; need: number } | null
  /** 계산 근거 — 반드시 맞혀야 하는 문항(라인) */
  mustItems: RefItem[]
  /** 사람이 읽는 사유(「연결 문항 없음」 「진단 필요」 「노출 부족」…) */
  note: string | null
}

export interface MapModel {
  goal: number
  currentScore: number | null
  reference: { exams: { id: string; label: string }[]; shortfall: number; wanted: number; skipped: string[] }
  /** 오답률이 없어 반드시로 둔 문항 수(기준 시험 합계) · 남은 예산으로 미관측 문항이 더 들어갈 수 있는 시험이 있나 */
  missingRate: number
  mayOverstate: boolean
  /** 스냅샷 전체 기준 근거 데이터 수(노드별 시험 수는 저장하지 않는다) — 스냅샷이 없으면 null */
  evidence: { examSessions: number; responses: number } | null
  /** 진단 근거 수준 — 지금은 전부 규칙 기반 proxy(core.ts DiagnosisBasis) */
  diagnosisBasis: 'rule_proxy' | 'item_tagged' | 'verified_diagnosis'
  nodes: Record<string, NodeValue>
}

const prefix = (code: string) => code.charAt(0)

function emptyValue(): NodeValue {
  return { target: null, achieved: null, status: 'no_items', coverage: null, n: null, points: 0, tasks: { done: 0, total: 0, rate: null }, habit: null, habitBasis: null, mustItems: [], note: null }
}

export function buildMapModel(raw: MapRaw, examLabels: Record<string, string> = {}): MapModel {
  const goal = raw.goal ?? raw.settings.default_goal
  const { near } = raw.settings.status

  // 1) 기준 시험마다 반드시 / 놓쳐도 됨
  const must = new Set<ItemKey>()
  let missingRate = 0
  let mayOverstate = false
  const byKey = new Map<ItemKey, RefItem>()
  for (const exam of raw.selection.exams) {
    const items = raw.itemsByExam[exam.id] ?? []
    for (const i of items) byKey.set(itemKey(i), i)
    const split = splitMust(items, goal)
    for (const k of split.must) must.add(k)
    missingRate += split.missingRate
    mayOverstate = mayOverstate || split.mayOverstate
  }

  const lines = raw.nodes.filter((n) => n.kind === 'line')
  const nodes: Record<string, NodeValue> = {}
  const tasksOf = (codes: string[]) => {
    const set = new Set(codes)
    const rows = raw.tasks.filter((t) => set.has(t.line_code))
    const done = rows.filter((t) => raw.doneTaskIds.has(t.id)).length
    return { done, total: rows.length, rate: completionRate(done, rows.length) }
  }

  // 2) 라인
  for (const l of lines) {
    const v = emptyValue()
    v.tasks = tasksOf([l.code])
    const linked = (raw.lineItems[l.code] ?? []).map((k) => byKey.get(k)).filter((i): i is RefItem => Boolean(i))
    const t = lineTarget(linked, must)
    v.target = t.rate
    v.points = t.points
    v.mustItems = t.mustItems
    const p = prefix(l.code)
    const stat = raw.snapshot ? (p === 'A' ? raw.snapshot.attributePoints[l.code] : p === 'B' ? raw.snapshot.lineAccuracy[l.code] : p === 'C' ? raw.snapshot.trapAvoidance[l.code] : undefined) : undefined
    if (p === 'A' && raw.noData?.includes(l.code)) {
      // 문항 태그 근거가 없는 역량 — 엔진 규칙 값이 있어도 학생에게 관찰값으로 쓰지 않는다
      v.status = 'needs_diagnosis'
      v.note = '데이터 없음 · 진단 필요'
    } else if (p === 'A' || p === 'B' || p === 'C') {
      if (t.rate === null) {
        v.status = 'no_items'
        v.note = '연결 문항 없음'
      } else if (!raw.snapshot || !stat) {
        v.status = 'needs_diagnosis'
        v.note = '진단 필요'
      } else if (stat.status !== 'ok' || stat.value === null) {
        v.status = 'needs_diagnosis'
        v.n = stat.n
        v.note = p === 'C' ? '노출 부족' : '관측 부족'
      } else {
        v.achieved = stat.value
        v.n = stat.n
        v.den = stat.den ?? null
        v.status = lineStatus(stat.value, t.rate, near)
      }
    } else {
      v.status = 'tasks_only'
      if (p === 'D') {
        const code = Object.entries(raw.habitLine).find(([, line]) => line === l.code)?.[0]
        if (code && raw.snapshot) {
          // 신호 있음 = 활성(옛 스냅샷에도 유지) · 해소됨 = 평가 가능한데 신호 없음 · 그 밖(평가 불가 · 키 없음)은 판단 불가
          const ev = raw.snapshot.habitEvaluable?.[code]
          v.habit = raw.snapshot.habitCodes.includes(code) ? 'active' : ev?.evaluable ? 'resolved' : 'unknown'
          if (ev) v.habitBasis = { n: ev.n, need: ev.need }
        }
      }
    }
    nodes[l.code] = v
  }

  // 3) 집계 노드(영역 · 원리 · 트랙 · 목표)
  const linesOf = (n: MapNodeRow): string[] => {
    if (n.kind === 'goal') return lines.map((l) => l.code)
    if (n.kind === 'axis') return lines.filter((l) => l.axis === n.code).map((l) => l.code)
    if (n.kind === 'track') return lines.filter((l) => l.track === n.code).map((l) => l.code)
    return raw.edges.filter((e) => e.kind === 'reason' && e.to_code === n.code).map((e) => e.from_code)
  }
  for (const n of raw.nodes) {
    if (n.kind === 'line') continue
    const codes = linesOf(n)
    const agg = aggregate(
      codes.map((c) => ({ weight: nodes[c]?.points ?? 0, target: nodes[c]?.target ?? null, achieved: nodes[c]?.achieved ?? null })),
      near,
      raw.settings.min_coverage,
    )
    const v = emptyValue()
    v.target = agg.target
    v.achieved = agg.achieved
    v.coverage = agg.status === 'no_items' ? null : agg.coverage
    v.status = agg.status
    v.points = codes.reduce((s, c) => s + (nodes[c]?.points ?? 0), 0)
    v.tasks = tasksOf(codes)
    // 관측 합계(중복 포함) — 연결 라인이 저장한 기여 건수의 합. 같은 응답이 여러 라인에 들어갈 수 있어 서로 다른 응답 수가 아니다
    const ns = codes.map((c) => nodes[c]?.n).filter((n): n is number => typeof n === 'number')
    v.n = ns.length > 0 ? ns.reduce((s, n) => s + n, 0) : null
    // 연결 라인이 전부 과제 전용이면 진단 지표가 없다 — 완료율이 막대가 된다
    if (agg.status === 'no_items' && v.tasks.total > 0) v.status = 'tasks_only'
    v.note = agg.status === 'needs_diagnosis' ? '진단 필요' : agg.status === 'no_items' && v.tasks.total === 0 ? '연결 문항 없음' : null
    nodes[n.code] = v
  }

  return {
    goal,
    currentScore: raw.snapshot?.currentScore ?? null,
    reference: {
      exams: raw.selection.exams.map((e) => ({ id: e.id, label: examLabels[e.id] ?? e.label })),
      shortfall: raw.selection.shortfall,
      wanted: raw.settings.reference_exams,
      skipped: raw.selection.skipped.map((e) => examLabels[e.id] ?? e.label),
    },
    missingRate,
    mayOverstate,
    evidence: raw.snapshot ? { examSessions: raw.snapshot.examSessions, responses: raw.snapshot.responses } : null,
    diagnosisBasis: 'rule_proxy',
    nodes,
  }
}
