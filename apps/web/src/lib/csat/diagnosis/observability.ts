// apps/web/src/lib/csat/diagnosis/observability.ts
//
// 진단축 관측가능성 · 식별성(2026-10-08) — 「이 시험의 문항 태그 구조로 어느 축을 따로 알아볼 수 있는가」.
// 학습 지도 순위가 맞히는지(정확도)와 별개로, 정보 구조상 **맞힐 수 있는지**를 먼저 잰다. 순수 함수 — DB · 시계 없음.
//   · 축 = 핵심 지도 축(V=A1 · S=A2+A8 · R=A3+A6 · E=A4+A5 · X=A9). L(A7)은 문항 태그가 아니라 듣기 규칙 · NO_DATA 정책이라 여기서 다루지 않는다.
//   · 관측 가능(count) = 엔진과 같은 규칙 — 축의 라인 중 하나라도 연결 문항 ≥ 최소 관측(5).
//   · 독립 정보 = 1 − R²₀(이 축 0/1 열을 다른 핵심 축 열들로 절편 없이 최소제곱 설명한 몫 — ‖잔차‖² / ‖열‖²). 0 이면 다른 축들의 조합과
//     같은 정보, 1 이면 겹침 없음. 절편을 넣지 않는다: 모든 문항에 축이 하나 이상 붙으면 축 열의 합 = 절편이라, 절편을 넣으면 어떤 축이든
//     「다른 축 + 절편」으로 완벽히 설명되는 인공물이 생긴다(2026-10-08 테스트로 확인).
//   · 상태: absent(연결 0) · insufficient(최소 관측 미달) · confounded(다른 축에 포함 · 독립 정보 < CONFOUND_INDEPENDENCE ·
//     핵심 축인데 단독 문항 0) · observable.
// 여기의 문턱(CONFOUND_INDEPENDENCE)은 분석 분류용이다 — 제품 순위 규칙이 아니다.

import { ATTRIBUTE_CODES, type AttributeCode } from './engine/types'

export const OBS_AXES = ['V', 'S', 'R', 'E', 'X'] as const
export type ObsAxis = (typeof OBS_AXES)[number]
export const OBS_AXIS_LINES: Readonly<Record<ObsAxis, readonly AttributeCode[]>> = { V: ['A1'], S: ['A2', 'A8'], R: ['A3', 'A6'], E: ['A4', 'A5'], X: ['A9'] }
/** 독립 정보가 이보다 작으면 confounded(분석 분류 기준 · 2026-10-08) */
export const CONFOUND_INDEPENDENCE = 0.2
export const MIN_OBS = 5

export interface ObsItem { no: number; weights: Partial<Record<AttributeCode, number>> }
export type AxisStatus = 'absent' | 'insufficient' | 'confounded' | 'observable'

export interface AxisObs {
  axis: ObsAxis
  tagged: number
  lineCounts: Partial<Record<AttributeCode, number>>
  observableByCount: boolean
  /** 핵심 축(V S R E) 중 이 축만 붙은 문항 수(X 는 성능 축이라 「다른 축」에서 뺀다) */
  unique: number
  /** 1 − R² — 다른 핵심 축 열로 설명되지 않는 몫 */
  independence: number | null
  /** 이 축 문항이 전부 그 축에도 붙어 있는 축(포함 관계) */
  nestedIn: ObsAxis[]
  status: AxisStatus
}

export interface PairObs {
  a: ObsAxis
  b: ObsAxis
  both: number
  aOnly: number
  bOnly: number
  jaccard: number | null
  /** P(b | a) — a 가 붙은 문항 중 b 도 붙은 비율 */
  bGivenA: number | null
  aGivenB: number | null
  relation: 'identical' | 'a_in_b' | 'b_in_a' | 'disjoint' | 'overlap' | 'absent'
}

const has = (it: ObsItem, c: AttributeCode) => (it.weights[c] ?? 0) > 0
export const axisTagged = (it: ObsItem, axis: ObsAxis) => OBS_AXIS_LINES[axis].some((c) => has(it, c))
const CORE: readonly ObsAxis[] = ['V', 'S', 'R', 'E']

/** 열 y 를 열들 X 로 절편 없이 최소제곱 — 설명된 몫 R²₀ = 1 − ‖잔차‖² / ‖y‖². y 가 영벡터면 null */
export function rSquared(y: number[], xs: number[][]): number | null {
  const sst = y.reduce((a, b) => a + b * b, 0)
  if (sst === 0) return null
  const cols = xs.filter((x) => x.some((v) => v !== 0))
  if (cols.length === 0) return 0
  const p = cols.length
  // 정규방정식 (XᵀX)β = Xᵀy — 가우스 소거(작은 p), 특이하면 의사역 대신 해당 열을 건너뛴다(rank 결손 = 같은 정보)
  const A = cols.map((ci) => cols.map((cj) => ci.reduce((s, v, k) => s + v * cj[k], 0)))
  const b = cols.map((ci) => ci.reduce((s, v, k) => s + v * y[k], 0))
  const beta = Array(p).fill(0)
  const piv: number[] = []
  const M = A.map((r, i) => [...r, b[i]])
  let row = 0
  for (let col = 0; col < p && row < p; col++) {
    let best = row
    for (let r = row + 1; r < p; r++) if (Math.abs(M[r][col]) > Math.abs(M[best][col])) best = r
    if (Math.abs(M[best][col]) < 1e-9) continue
    ;[M[row], M[best]] = [M[best], M[row]]
    for (let r = 0; r < p; r++) {
      if (r === row) continue
      const f = M[r][col] / M[row][col]
      for (let c = col; c <= p; c++) M[r][c] -= f * M[row][c]
    }
    piv.push(col)
    row++
  }
  piv.forEach((col, r) => { beta[col] = M[r][p] / M[r][col] })
  const fit = y.map((_, k) => cols.reduce((s, c, j) => s + c[k] * beta[j], 0))
  const sse = y.reduce((s, v, k) => s + (v - fit[k]) ** 2, 0)
  return Math.max(0, Math.min(1, 1 - sse / sst))
}

/** 0/1 열들의 rank(가우스 소거) */
export function matrixRank(columns: number[][]): number {
  const M = columns.map((c) => [...c])
  let rank = 0
  const n = M[0]?.length ?? 0
  for (let col = 0; col < n && rank < M.length; col++) {
    let p = rank
    while (p < M.length && Math.abs(M[p][col]) < 1e-9) p++
    if (p === M.length) continue
    ;[M[rank], M[p]] = [M[p], M[rank]]
    for (let r = 0; r < M.length; r++) {
      if (r === rank) continue
      const f = M[r][col] / M[rank][col]
      for (let c = col; c < n; c++) M[r][c] -= f * M[rank][c]
    }
    rank++
  }
  return rank
}

export function pairObs(items: ObsItem[], a: ObsAxis, b: ObsAxis): PairObs {
  let both = 0, aOnly = 0, bOnly = 0
  for (const it of items) {
    const x = axisTagged(it, a), y = axisTagged(it, b)
    if (x && y) both++
    else if (x) aOnly++
    else if (y) bOnly++
  }
  const ua = both + aOnly, ub = both + bOnly, uni = both + aOnly + bOnly
  const relation: PairObs['relation'] = ua === 0 || ub === 0 ? 'absent' : both === 0 ? 'disjoint' : aOnly === 0 && bOnly === 0 ? 'identical' : aOnly === 0 ? 'a_in_b' : bOnly === 0 ? 'b_in_a' : 'overlap'
  return { a, b, both, aOnly, bOnly, jaccard: uni ? both / uni : null, bGivenA: ua ? both / ua : null, aGivenB: ub ? both / ub : null, relation }
}

export function axisObservability(items: ObsItem[], minObs = MIN_OBS): Record<ObsAxis, AxisObs> {
  const col = (axis: ObsAxis) => items.map((it) => (axisTagged(it, axis) ? 1 : 0))
  const out = {} as Record<ObsAxis, AxisObs>
  for (const axis of OBS_AXES) {
    const lineCounts = Object.fromEntries(OBS_AXIS_LINES[axis].map((c) => [c, items.filter((it) => has(it, c)).length]))
    const tagged = items.filter((it) => axisTagged(it, axis)).length
    const observableByCount = Object.values(lineCounts).some((n) => (n as number) >= minObs)
    const others = CORE.filter((x) => x !== axis)
    const unique = items.filter((it) => axisTagged(it, axis) && !others.some((o) => axisTagged(it, o))).length
    const independence = tagged === 0 ? null : (() => { const r2 = rSquared(col(axis), others.map(col)); return r2 === null ? null : 1 - r2 })()
    const nestedIn = OBS_AXES.filter((o) => {
      if (o === axis || tagged === 0) return false
      const rel = pairObs(items, axis, o).relation
      return rel === 'a_in_b' || rel === 'identical'
    })
    const status: AxisStatus = tagged === 0 ? 'absent' : !observableByCount ? 'insufficient'
      // 핵심 축인데 단독 문항이 0 — 모든 근거 문항이 다른 핵심 축과 함께 붙어 있어 그 축만의 오답을 따로 볼 문항이 없다(X 는 성능 축이라 제외)
      : nestedIn.some((o) => CORE.includes(o)) || (independence !== null && independence < CONFOUND_INDEPENDENCE) || (CORE.includes(axis) && unique === 0) ? 'confounded' : 'observable'
    out[axis] = { axis, tagged, lineCounts, observableByCount, unique, independence, nestedIn, status }
  }
  return out
}

// ── 거짓 1위 재분류 ───────────────────────────────────────────────────────────
// F1 identifiable — 약한 역량 중 하나라도 이 시험에서 관측 가능(라인 ≥ 최소 관측)하고, 그 축이 고른 1위 축과 혼동되지 않는다 → 순위 오류 후보
// F3 confounded   — 관측은 되지만 고른 1위 축과 포함 관계거나 그 축이 confounded, 또는 고른 1위 축에 단독 문항이 없고(모든 근거 문항이
//                   다른 핵심 축과 함께 붙음) 약한 역량의 축과 문항을 나눠 쓴다 — 고른 축의 낮은 값이 약한 축의 오답에서 왔을 수 있어 태그 구조로 가를 수 없다
// F2 unobservable — 약한 역량의 라인 자체가 최소 관측 미달(0 포함) → 순위가 맞힐 수 없는 사례
export type FalseTopClass = 'F1_identifiable' | 'F2_unobservable' | 'F3_confounded'
export const AXIS_OF_ATTR: Readonly<Partial<Record<AttributeCode, ObsAxis>>> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }

export function classifyFalseTop(items: ObsItem[], weak: readonly AttributeCode[], chosen: ObsAxis, minObs = MIN_OBS): FalseTopClass {
  const obs = axisObservability(items, minObs)
  let anyConf = false
  for (const attr of weak) {
    const axis = AXIS_OF_ATTR[attr]
    if (!axis) continue
    const n = items.filter((it) => has(it, attr)).length
    if (n < minObs) continue // 이 역량은 관측 불가
    const rel = pairObs(items, axis, chosen).relation
    const shared = pairObs(items, axis, chosen).both > 0 && obs[chosen].unique === 0
    if (obs[axis].status === 'confounded' || rel === 'a_in_b' || rel === 'identical' || shared) { anyConf = true; continue }
    return 'F1_identifiable'
  }
  return anyConf ? 'F3_confounded' : 'F2_unobservable'
}

/** 여러 시험을 이어 붙인 문항 집합(번호 겹침 방지) */
export const stackExams = (exams: ObsItem[][]): ObsItem[] => exams.flatMap((items, k) => items.map((it) => ({ ...it, no: it.no + 1000 * k })))

export const ATTRS_NO_L: readonly AttributeCode[] = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
