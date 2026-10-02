// apps/web/src/lib/csat/map/target.ts
//
// 학습 지도 — 목표율 · 상태 계산(순수 함수. DB · 시계에 접근하지 않는다 — 입력은 호출자가 넣는다).
// 규칙 정본: .agent-plan.md §4. 목표율 · 성취율은 저장하지 않고 화면을 열 때 계산한다.
//
//   1. 기준 시험 = 정답표 45문항 · 배점 합 100 을 갖춘 평가원 시험 중 최근 N회(selectReferenceExams)
//   2. 목표 점수 G → 잃어도 되는 점수 L = 100 − G. 공식 오답률이 있는 문항만, 높은 순으로 누적 배점 ≤ L 까지 「놓쳐도 됨」(splitMust)
//   3. 라인 목표율 = 연결 문항 중 「반드시」 배점 / 연결 문항 배점(lineTarget). 분모 0 이면 null
//   4. 영역 · 원리 · 트랙 · 목표 = 연결 라인의 배점 가중 평균, 상태는 미관측 라인을 보수적으로(aggregate)

export interface ExamCandidate {
  id: string
  label: string
  /** 정렬 키 — 실제 시행 연 × 100 + 월(예: 2025년 9월 = 202509). 호출자가 만든다 */
  held: number
  itemCount: number
  pointsTotal: number
}

export interface ReferenceSelection {
  exams: ExamCandidate[]
  /** 요청한 N 에 모자란 회차 수(0 이면 충족) */
  shortfall: number
  /** 자격 미달로 건너뛴 회차(정답표 없음 · 45문항 아님 · 배점 합 ≠ 100) */
  skipped: ExamCandidate[]
}

/** 정답표 45문항 · 배점 합 100 을 갖춘 시험만 자격이 있다. 최근 순 N회. */
export function selectReferenceExams(candidates: ExamCandidate[], n: number): ReferenceSelection {
  const eligible = (e: ExamCandidate) => e.itemCount === 45 && e.pointsTotal === 100
  const sorted = [...candidates].sort((a, b) => b.held - a.held || a.id.localeCompare(b.id))
  const exams = sorted.filter(eligible).slice(0, n)
  const newest = exams.length > 0 ? exams[exams.length - 1].held : Number.POSITIVE_INFINITY
  // 선정 범위 안에서 자격이 없어 빠진 회차만 알린다(오래된 미달 회차는 노이즈)
  const skipped = sorted.filter((e) => !eligible(e) && e.held >= newest)
  return { exams, shortfall: Math.max(0, n - exams.length), skipped }
}

export interface RefItem {
  examId: string
  no: number
  points: number
  /** 0~1. 없으면 null */
  errorRate: number | null
}

export type ItemKey = `${string}#${number}`
export const itemKey = (i: Pick<RefItem, 'examId' | 'no'>): ItemKey => `${i.examId}#${i.no}`

export interface MustSplit {
  /** 반드시 맞혀야 하는 문항 */
  must: Set<ItemKey>
  /** 놓쳐도 되는 문항 */
  skip: Set<ItemKey>
  /** 오답률이 없어 무조건 「반드시」로 둔 문항 수 */
  missingRate: number
}

/**
 * 한 시험(배점 합 100)의 문항을 나눈다. 목표 점수 G(0~100)에서 L = 100 − G.
 * 오답률이 있는 문항만 「놓쳐도 됨」 후보 — 높은 순(같으면 번호 순)으로 누적 배점이 L 을 넘지 않는 데까지.
 * 오답률 없는 문항은 항상 「반드시」. G = 100 이면 전부 「반드시」(오답률 불필요).
 */
export function splitMust(items: RefItem[], goal: number): MustSplit {
  const budget = Math.max(0, Math.min(100, 100 - goal))
  const must = new Set<ItemKey>()
  const skip = new Set<ItemKey>()
  const candidates = items
    .filter((i) => i.errorRate !== null)
    .sort((a, b) => (b.errorRate as number) - (a.errorRate as number) || a.no - b.no)
  let spent = 0
  const skippable = new Set<ItemKey>()
  for (const c of candidates) {
    if (spent + c.points <= budget) {
      spent += c.points
      skippable.add(itemKey(c))
    }
  }
  for (const i of items) (skippable.has(itemKey(i)) ? skip : must).add(itemKey(i))
  return { must, skip, missingRate: items.filter((i) => i.errorRate === null).length }
}

export interface LineTarget {
  /** 목표율 0~1. 연결 문항이 없으면 null(눈금 · 차이 · 상태 없음) */
  rate: number | null
  /** 연결 문항 배점 합(집계의 가중치) */
  points: number
  mustPoints: number
  /** 계산 근거 — 반드시 맞혀야 하는 문항 */
  mustItems: RefItem[]
}

/** 라인에 연결된 문항(기준 시험 전체)과 「반드시」 집합으로 목표율을 낸다. */
export function lineTarget(linked: RefItem[], must: Set<ItemKey>): LineTarget {
  const points = linked.reduce((n, i) => n + i.points, 0)
  const mustItems = linked.filter((i) => must.has(itemKey(i)))
  const mustPoints = mustItems.reduce((n, i) => n + i.points, 0)
  return { rate: points > 0 ? mustPoints / points : null, points, mustPoints, mustItems }
}

export type LineStatus = 'met' | 'near' | 'short'

/** 분수 비교의 부동소수점 오차 허용 */
const EPS = 1e-9

/** 라인 단위 상태 — 채움(성취)과 눈금(목표)을 그대로 비교한다. near 는 설정값(기본 0.9). */
export function lineStatus(achieved: number, target: number, near: number): LineStatus {
  if (achieved >= target - EPS) return 'met'
  return achieved >= target * near - EPS ? 'near' : 'short'
}

export interface Child {
  /** 연결 배점(가중치) */
  weight: number
  /** 목표율. 연결 문항 없음이면 null → 집계에서 제외 */
  target: number | null
  /** 성취율. 진단 안 됐으면 null */
  achieved: number | null
}

export type AggregateStatus = LineStatus | 'hold' | 'needs_diagnosis' | 'no_items'

export interface Aggregate {
  /** 전체 연결 라인의 배점 가중 평균 — 진단 범위와 무관하게 고정된 눈금. 유효 배점이 없으면 null */
  target: number | null
  /** 진단된 라인의 배점 가중 평균(추정). 진단된 라인이 없으면 null */
  achieved: number | null
  /** 진단된 라인 배점 / 전체 배점 (0~1) */
  coverage: number
  status: AggregateStatus
}

/**
 * 집계 노드(영역 · 원리 · 트랙 · 목표). 미관측 라인은 최악(0)/최선(1)으로 두고 보수적으로 판정한다:
 *   하한 LB ≥ 목표 → 달성 · 상한 UB < 목표×near → 미달 · 전부 진단됐으면 근접 · 그 밖 → 판정 보류.
 * 진단 범위가 minCoverage 미만이면 상태 대신 「진단 필요」.
 */
export function aggregate(children: Child[], near: number, minCoverage: number): Aggregate {
  const live = children.filter((c) => c.target !== null && c.weight > 0)
  const total = live.reduce((n, c) => n + c.weight, 0)
  if (total === 0) return { target: null, achieved: null, coverage: 0, status: 'no_items' }
  const target = live.reduce((n, c) => n + c.weight * (c.target as number), 0) / total
  const seen = live.filter((c) => c.achieved !== null)
  const seenWeight = seen.reduce((n, c) => n + c.weight, 0)
  const earned = seen.reduce((n, c) => n + c.weight * (c.achieved as number), 0)
  const coverage = seenWeight / total
  const achieved = seenWeight > 0 ? earned / seenWeight : null
  if (coverage < minCoverage || achieved === null) return { target, achieved, coverage, status: 'needs_diagnosis' }
  const lb = earned / total
  const ub = (earned + (total - seenWeight)) / total
  let status: AggregateStatus
  if (lb >= target - EPS) status = 'met'
  else if (ub < target * near - EPS) status = 'short'
  else if (coverage === 1) status = 'near'
  else status = 'hold'
  return { target, achieved, coverage, status }
}

/** 과제 완료율(D · I · J 라인과 그 집계). 과제가 없으면 null. */
export function completionRate(done: number, total: number): number | null {
  return total > 0 ? done / total : null
}
