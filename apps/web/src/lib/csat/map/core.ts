// apps/web/src/lib/csat/map/core.ts
//
// 학습 지도 의미론 — 핵심 지도(Core V/S/R/E/L + Performance X)와 노드 역할. 순수 함수(DB · 시계 없음).
// 원칙(2026-10-03 사용자 결정): **현재 데이터가 증명하지 못하는 것을 숙달도처럼 표현하지 않는다.**
//   · 지금 역량 값은 유형 → 역량 대응표에서 상속된 규칙 기반 proxy(rule_proxy)다 — 실제 V/S/R/E/L 숙달도가 아니다.
//   · 숙달도(% · 레벨) · 「핵심 병목」 확정 · 목표 점수 기준 병목 추천 · 학습 Route 선택은 하지 않는다 — 진단을 처방한다.

import type { MapModel, MapSettings } from './model'

/**
 * 진단 근거 수준.
 *   rule_proxy         — 유형 → 역량 대응표 상속값(지금 전부)
 *   item_tagged        — 문항별 하위 능력 태깅(학생 진단을 증명하지 않는다 — 문항 쪽 근거일 뿐)
 *   verified_diagnosis — 검증된 학생 진단(태깅 + 응답 근거 + 보정). 「정밀 진단 미실시」 해제와 Route 선택은 이것일 때만
 */
export type DiagnosisBasis = 'rule_proxy' | 'item_tagged' | 'verified_diagnosis'
export const CURRENT_BASIS: DiagnosisBasis = 'rule_proxy'

export type CoreCode = 'V' | 'S' | 'R' | 'E' | 'L' | 'X'

export interface CoreAxisDef {
  code: CoreCode
  name: string
  question: string
  /** 임시 대응(DB 변경 없음) — 기존 역량 라인 */
  lines: string[]
  group: 'core' | 'performance'
}

export const CORE_AXES: CoreAxisDef[] = [
  { code: 'V', name: '어휘', question: '단어 · 표현이 의미로 바로 연결되는가', lines: ['A1'], group: 'core' },
  { code: 'S', name: '문장해석', question: '문장의 구조와 의미를 정확하게 처리하는가', lines: ['A2', 'A8'], group: 'core' },
  { code: 'R', name: '독해', question: '여러 문장을 이어 글 전체의 의미와 논리를 만드는가', lines: ['A3', 'A6'], group: 'core' },
  { code: 'E', name: '근거판단', question: '글의 의미를 선지와 이어 정답 · 오답을 가리는가', lines: ['A4', 'A5'], group: 'core' },
  { code: 'L', name: '듣기', question: '음성을 실시간으로 단어 · 문장 · 의미로 바꾸는가', lines: ['A7'], group: 'core' },
  { code: 'X', name: '실전 실행', question: '처리 속도 · 시간 배분 · 풀이 순서 · 집중', lines: ['A9'], group: 'performance' },
]

/**
 * 이번 단계에서 **명시적으로** 「데이터 없음 · 진단 필요」로 두는 역량 — A7(듣기)은 문항 태그가 0이고,
 * 엔진의 듣기 규칙(1~17번 → A7)은 태그 근거가 아니다. 테이블 태그 수와 무관하게 고정한다(태그가 생겨도 별도 결정 전까지).
 */
export const NO_DATA_ATTRIBUTES: readonly string[] = ['A7']

/** 영역(축) 역할 — 학생 숙달 노드인지, 측정 렌즈 · 오답 분류 · 행동 진단 · 방법 도구인지 */
export type AxisRole = 'ability_proxy' | 'lens' | 'error' | 'behavior' | 'method' | 'performance'  // 'error' = 선지 함정(Choice Trap) — 이름은 호환을 위해 유지
export const AXIS_ROLE: Record<string, { role: AxisRole; label: string; desc: string }> = {
  A: { role: 'ability_proxy', label: '역량 관찰(규칙 기반)', desc: '유형 → 역량 대응표에서 상속된 관찰값이에요. 실제 실력 수준이 아니에요.' },
  B: { role: 'lens', label: '측정 렌즈', desc: '문항유형은 능력이 아니라, 학생 능력이 관찰되는 조건이에요.' },
  // C = Choice Trap — 오답 선지가 지문을 비튼 방식(문항 · 선지 특성). 학생이 왜 틀렸는지(Learner Error Cause)는 지도 노드가 아니라
  // Attempt Evidence Layer 에서 다룬다(2026-10-03 사용자 결정 · docs/csat-learner/ERROR_EVIDENCE_DESIGN.md).
  C: { role: 'error', label: '선지 함정 · 문항 특성', desc: '오답 선지가 지문을 어떻게 비틀었는지예요. 학생이 왜 틀렸는지는 이 노드가 말하지 않아요 — 원인은 풀이 기록으로 따로 확인해요.' },
  D: { role: 'behavior', label: '행동 진단', desc: '풀이 습관 신호예요. 능력이 아니라 행동을 봐요.' },
  I: { role: 'method', label: '학습 방법', desc: '진단 결과에 따라 꺼내 쓰는 방법 도구예요. 달성할 대상이 아니에요.' },
  J: { role: 'performance', label: '시험 운영', desc: '실전 실행(시간 · 순서 · 집중)에 속해요.' },
}
export const roleOf = (axisCode: string | null | undefined) => (axisCode ? AXIS_ROLE[axisCode]?.role ?? null : null)

/**
 * 핵심 축 관찰 상태 — rule_proxy 에서는 관찰값 수준만 말한다(2026-10-03 사용자 결정).
 * 취약 · 양호 · 숙달 · 부족 역량 · 핵심 병목 같은 판정 어휘는 verified_diagnosis 전에는 쓰지 않는다.
 * 「우선 확인 후보」는 카드가 아니라 별도 추천 영역에만 — 관찰값과 진단 결론을 UI 에서 분리한다.
 */
export type CoreStatus = 'obs_low' | 'obs_mid' | 'obs_high' | 'insufficient' | 'no_data'
export const CORE_STATUS_LABEL: Record<CoreStatus, string> = {
  obs_low: '관찰 낮음',
  obs_mid: '관찰 중간',
  obs_high: '관찰 높음',
  insufficient: '진단 근거 부족',
  no_data: '데이터 없음 · 진단 필요',
}

export type ObservedLevel = 'obs_low' | 'obs_mid' | 'obs_high'
/**
 * 관찰값(0~1) → 관찰 수준. 기준은 설정 core.weak · core.watch — 목표 점수와 무관하다.
 * 목표 점수와 역량 수준의 직접 연결은 calibration 뒤 별도로 복원한다.
 */
export function observedLevel(v: number | null, core: MapSettings['core']): ObservedLevel | null {
  if (v === null) return null
  return v < core.weak ? 'obs_low' : v < core.watch ? 'obs_mid' : 'obs_high'
}

export interface CoreAxisView extends CoreAxisDef {
  status: CoreStatus
  /** 라인별 기여 건수의 합(중복 포함) — 서로 다른 응답 수가 아니다 */
  contributions: number
  basis: DiagnosisBasis
  /** 관찰값(0~1) — 화면에 숫자로 내지 않는다(후보 순서에만 쓴다) */
  observed: number | null
}

export interface CoreSummary {
  axes: CoreAxisView[]
  /** 우선 확인 후보(≤2) — 「병목」이 아니다 */
  candidates: CoreCode[]
  /** 지금 필요한 진단(최대 1) — 과제를 처방하지 않는다 */
  nextDiagnosis: string
  /** 처방 Route — verified_diagnosis 전에는 선택하지 않는다 */
  route: { chosen: null; note: string }
  basis: DiagnosisBasis
}

/**
 * 핵심 지도 요약. 후보 판정은 **목표율 · 격차와 무관한 관찰값 기준**(설정 core.weak · core.watch)이라
 * 목표 점수를 바꿔도 결과가 같다. 근거 라인 배점이 min_coverage 미만이면 「진단 근거 부족」.
 */
export function coreSummary(model: Pick<MapModel, 'nodes'>, settings: Pick<MapSettings, 'core' | 'min_coverage'>): CoreSummary {
  const axes: CoreAxisView[] = CORE_AXES.map((def) => {
    const lines = def.lines.filter((c) => !NO_DATA_ATTRIBUTES.includes(c))
    if (lines.length === 0) return { ...def, status: 'no_data', contributions: 0, basis: CURRENT_BASIS, observed: null }
    let weight = 0
    let seenWeight = 0
    let earned = 0
    let contributions = 0
    for (const code of lines) {
      const v = model.nodes[code]
      if (!v) continue
      weight += v.points
      if (v.n !== null) contributions += v.n
      if (v.achieved !== null && v.points > 0) {
        seenWeight += v.points
        earned += v.points * v.achieved
      }
    }
    const coverage = weight > 0 ? seenWeight / weight : 0
    if (seenWeight === 0 || coverage < settings.min_coverage) return { ...def, status: 'insufficient', contributions, basis: CURRENT_BASIS, observed: null }
    const observed = earned / seenWeight
    const status: CoreStatus = observedLevel(observed, settings.core) as ObservedLevel
    return { ...def, status, contributions, basis: CURRENT_BASIS, observed }
  })

  const candidates = axes
    .filter((a) => a.status === 'obs_low')
    .sort((a, b) => (a.observed as number) - (b.observed as number))
    .slice(0, 2)
    .map((a) => a.code)

  const nameOf = (c: CoreCode) => CORE_AXES.find((a) => a.code === c)?.name ?? c
  let nextDiagnosis: string
  if (candidates.includes('V') && candidates.includes('S')) nextDiagnosis = '어휘와 문장해석 중 실제 원인을 구분하기 위한 추가 진단 필요'
  else if (candidates.length === 2) nextDiagnosis = `${nameOf(candidates[0])}와(과) ${nameOf(candidates[1])} 중 실제 원인을 구분하기 위한 추가 진단 필요`
  else if (candidates.length === 1) nextDiagnosis = `${nameOf(candidates[0])} 후보의 실제 원인을 확인하기 위한 추가 진단 필요`
  else if (axes.every((a) => a.status === 'insufficient' || a.status === 'no_data')) nextDiagnosis = '진단 근거가 부족해요 — 시험 기록을 더하면 확인할 수 있어요'
  else nextDiagnosis = '지금 데이터로는 우선 확인할 후보가 없어요'

  return {
    axes,
    candidates,
    nextDiagnosis,
    route: { chosen: null, note: 'Route 미정 — 추가 진단 뒤 결정' },
    basis: CURRENT_BASIS,
  }
}

/** 금지 어휘 — rule_proxy 화면 라벨 · 문구 회귀 검사용(판정 · 숙달 · 수치 능력 · 병목) */
export const FORBIDDEN_WORDS = /숙달|취약|양호|부족 역량|능력\s*\d|레벨\s*\d|달성|병목/
