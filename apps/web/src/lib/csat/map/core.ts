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
  /** 임시 대응(DB 변경 없음) — 기존 역량 라인. **legacy proxy 계산일 뿐 vNext 능력 정의가 아니다** */
  lines: string[]
  group: 'core' | 'performance'
  /** vNext 와 다른 점(학생 화면 한 줄) — 기존 라인 대응이 미래 구조로 굳지 않게 */
  legacyNote?: string
}

export const CORE_AXES: CoreAxisDef[] = [
  // 표시명은 vNext 이름(2026-10-07 사용자 결정) — 문장 이해 = 구조로 문장 의미를 만드는 능력(번역 · 구문 분석 아님),
  // 글 이해 = 문장 관계 → 글 구조 → 중심 의미 → 추론. 「재진술」 카드는 만들지 않는다(V · R · E 로 나뉘어 들어간다)
  { code: 'V', name: '어휘 · 표현', question: '단어 · 표현이 의미로 바로 연결되는가', lines: ['A1'], group: 'core' },
  { code: 'S', name: '문장 이해', question: '문장의 구조와 의미를 정확하게 처리하는가', lines: ['A2', 'A8'], group: 'core' },
  { code: 'R', name: '글 이해', question: '여러 문장을 이어 글 전체의 의미와 논리를 만드는가', lines: ['A3', 'A6'], group: 'core', legacyNote: 'A6(배경지식)은 앞으로 글 이해가 아니라 맥락 자원으로 옮겨요 — 지금은 기존 계산과 맞추려고 임시로 더해요' },
  { code: 'E', name: '근거 · 선지 판단', question: '글의 의미를 선지와 이어 정답 · 오답을 가리는가', lines: ['A4', 'A5'], group: 'core', legacyNote: 'A4 는 앞으로 다른 항목으로 나뉘어요 — 지금은 기존 계산과 맞추려고 임시로 더해요' },
  { code: 'L', name: '듣기', question: '음성을 실시간으로 단어 · 문장 · 의미로 바꾸는가', lines: ['A7'], group: 'core' },
  { code: 'X', name: '실전 수행', question: '처리 속도 · 시간 배분 · 풀이 순서 · 집중', lines: ['A9'], group: 'performance' },
]

/**
 * 이번 단계에서 **명시적으로** 「데이터 없음 · 진단 필요」로 두는 역량 — A7(듣기)은 문항 태그가 0이고,
 * 엔진의 듣기 규칙(1~17번 → A7)은 태그 근거가 아니다. 테이블 태그 수와 무관하게 고정한다(태그가 생겨도 별도 결정 전까지).
 */
export const NO_DATA_ATTRIBUTES: readonly string[] = ['A7']

/** 현재 계산이 legacy proxy 임을 밝히는 문구 — 카드 · 상세 지도가 함께 쓴다 */
export const LEGACY_PROXY_LABEL = '현재 계산(기존 라인 대응)'
export const LEGACY_DETAIL_NOTE = '기출 상세 분석은 내 기록을 54개 항목으로 나눠 왜 이런 판단이 나왔는지 보여 줘요. 무엇을 어떤 순서로 키울지는 학습 지도에서 봐요 — 54개 항목이 학습 순서는 아니에요.'

/** 관찰 수준 구분선(core.weak · core.watch)의 성격 — 교육적으로 검증된 기준이 아니다 */
export const THRESHOLD_NOTE = '관찰 낮음 · 중간 · 높음을 가르는 선은 교육적으로 검증된 기준이 아니라, 지금의 규칙 기반 관찰을 화면에서 세 칸으로 나누려고 정한 표시 기준이에요.'

/** 오답 원인 판정과 지도 상태의 관계 — 원인 확인은 다음 진단 순서만 정한다 */
export const CAUSE_NOTE = '풀이 기록으로 오답 원인이 확인돼도 이 카드는 바로 바뀌지 않아요. 원인 확인은 다음에 할 진단의 순서만 정하고, 카드 상태는 직접 진단으로 확인된 결과만 바꿔요.'

/** 목표 점수 계산의 성격 — 능력 목표가 아니라 시험 수행 전략 */
export const GOAL_STRATEGY_NOTE = '목표 점수에서 나온 「반드시 맞혀야 하는 문항」은 시험 수행 전략 계산이에요. 능력 목표가 아니에요.'

/** 과제와 능력 상태의 분리 */
export const TASK_NOTE = '학습 활동은 능력 상태와 따로 기록해요. 활동을 마쳐도 관찰 상태는 바뀌지 않아요.'

/**
 * 성장 경로(Learning Progression) — 별도 점수 카드가 아니라 V · S · R · E · X 를 관통하는 순서(2026-10-07 사용자 결정).
 * 화면에는 순서만 보이고 단계별 값은 내지 않는다(측정 근거 없음).
 */
export const LEARNING_PROGRESSION: readonly { step: string; axes: CoreCode[] }[] = [
  { step: '어휘 · 표현', axes: ['V'] },
  { step: '문장 의미', axes: ['S'] },
  { step: '문장 관계', axes: ['R'] },
  { step: '글 구조', axes: ['R'] },
  { step: '중심 의미', axes: ['R'] },
  { step: '본문 ↔ 선지', axes: ['E'] },
  { step: '근거 판단', axes: ['E'] },
  { step: '시간 내 통합', axes: ['X'] },
]

/** 영역(축) 역할 — 학생 숙달 노드인지, 측정 렌즈 · 오답 분류 · 행동 진단 · 방법 도구인지 */
export type AxisRole = 'ability_proxy' | 'lens' | 'error' | 'behavior' | 'method' | 'performance'  // 'error' = 선지 함정(Choice Trap) — 이름은 호환을 위해 유지
export const AXIS_ROLE: Record<string, { role: AxisRole; label: string; desc: string }> = {
  A: { role: 'ability_proxy', label: '역량 관찰(규칙 기반)', desc: '유형 → 역량 대응표에서 상속된 관찰값이에요. 실제 실력 수준이 아니에요.' },
  B: { role: 'lens', label: '측정 정보(능력 아님)', desc: '문항 유형 렌즈예요. 문항유형은 능력이 아니라, 학생 능력이 관찰되는 조건이에요.' },
  // C = Choice Trap — 오답 선지가 지문을 비튼 방식(문항 · 선지 특성). 학생이 왜 틀렸는지(Learner Error Cause)는 지도 노드가 아니라
  // Attempt Evidence Layer 에서 다룬다(2026-10-03 사용자 결정 · docs/csat-learner/ERROR_EVIDENCE_DESIGN.md).
  C: { role: 'error', label: '문항 특성(능력 아님)', desc: '선지 함정 · 문항 특성이에요. 오답 선지가 지문을 어떻게 비틀었는지예요. 학생이 왜 틀렸는지는 이 노드가 말하지 않아요 — 원인은 풀이 기록으로 따로 확인해요.' },
  D: { role: 'behavior', label: '학습 · 행동 정보', desc: '풀이 습관 신호예요. 능력이 아니라 행동을 봐요.' },
  I: { role: 'method', label: '학습 · 행동 정보', desc: '진단 결과에 따라 꺼내 쓰는 학습 방법 도구예요. 능력이 아니에요.' },
  J: { role: 'performance', label: '실전 · 상황', desc: '실전 수행(시간 · 순서 · 집중)과 시험 상황 정보예요. 능력 카드가 아니에요.' },
}
export const roleOf = (axisCode: string | null | undefined) => (axisCode ? AXIS_ROLE[axisCode]?.role ?? null : null)

/**
 * 기존 상세 지도의 열 — 종류마다 한 열(참조 3B Access map 의 「종류별 열」 구조 · spec.json layout).
 * 핵심 능력(A)만 첫 열에 두고, 측정 정보 · 문항 특성 · 학습 · 행동 · 실전 · 상황은 각자 열로 떼어 능력 노드처럼 읽히지 않게 한다
 * (2026-10-07 vNext 정렬 1단계). 비어 있는 열도 머리는 남긴다. 여기에 없는 영역은 마지막 열로 간다(조용히 사라지지 않게).
 */
export interface LayerColumn {
  key: 'core' | 'measure' | 'item' | 'learning' | 'context'
  label: string
  axes: string[]
}
export const LAYER_COLUMNS: readonly LayerColumn[] = [
  { key: 'core', label: '핵심 능력', axes: ['A'] },
  { key: 'measure', label: '측정 정보', axes: ['B'] },
  { key: 'item', label: '문항 특성', axes: ['C'] },
  { key: 'learning', label: '학습 · 행동', axes: ['D', 'I'] },
  { key: 'context', label: '실전 · 상황', axes: ['J'] },
]
/** 영역 코드 → 열 순번(LAYER_COLUMNS 기준). 모르는 영역은 마지막 열 */
export function layerIndexOf(axisCode: string): number {
  const i = LAYER_COLUMNS.findIndex((c) => c.axes.includes(axisCode))
  return i >= 0 ? i : LAYER_COLUMNS.length - 1
}

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
  /** 관찰값을 낸 라인 중 가장 적은 관측 수 — 순위 안정 판정용(관찰값이 없으면 null) */
  minLineN: number | null
}

/**
 * 「먼저 확인」 1위를 믿을 수 있는 조건(2026-10-08 보정 — scripts/csat/diagnosis/ranking-calibrate.mts ·
 * docs/csat-learner/pilot-runs/ranking-stability-20261008.md). 합성 학습자 2생성기 × 1,000명에서 태그 하나 바꾸기 ·
 * 문항 하나 빼기에 1위가 유지되는 비율이 조건 없이 41~46% → 세 조건 모두일 때 94~95%. 하나라도 어긋나면 1위를 확정하지 않는다.
 * **교육적 기준이 아니라 내부 안정성 기준**이다(2026-10-08 사용자 승인 계약) — 시험 · 검수 데이터가 바뀌면 같은 스크립트로 다시 잰다.
 *   margin   — 1위와 2위(관찰값이 있는 축) 관찰값 차
 *   headroom — 1위 관찰값이 「관찰 낮음」 선(core.weak)보다 얼마나 아래인가(선 바로 아래면 문항 하나로 후보에서 빠진다)
 *   minLineN — 1위 축의 각 라인 관측 수(최소 관측 5 바로 위면 문항 하나로 근거 부족이 된다)
 */
export const RANKING_GATE = { margin: 0.05, headroom: 0.05, minLineN: 6 } as const

/**
 * 순위 판정 — clear: 1위를 「먼저 확인」으로 보인다 · unstable: 1위와 경쟁 축(rival)을 가르는 확인 하나로 보낸다 ·
 * none: 후보 없음. 근거 부족 축은 순위에 들어오지 않는다(status insufficient — 「문제 없음」이 아니라 「판단할 기록 부족」).
 */
export interface Ranking {
  kind: 'clear' | 'unstable' | 'none'
  top: CoreCode | null
  rival: CoreCode | null
  /** unstable 인 이유(여럿일 수 있다) */
  reasons: ('near_tie' | 'near_line' | 'thin_evidence')[]
}

export interface CoreSummary {
  axes: CoreAxisView[]
  /** 우선 확인 후보(≤2) — 「병목」이 아니다 */
  candidates: CoreCode[]
  /** 지금 필요한 진단(최대 1) — 과제를 처방하지 않는다 */
  nextDiagnosis: string
  /** 1위를 믿을 수 있는가 — RANKING_GATE */
  ranking: Ranking
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
    if (lines.length === 0) return { ...def, status: 'no_data', contributions: 0, basis: CURRENT_BASIS, observed: null, minLineN: null }
    let weight = 0
    let seenWeight = 0
    let earned = 0
    let contributions = 0
    let minLineN: number | null = null
    for (const code of lines) {
      const v = model.nodes[code]
      if (!v) continue
      weight += v.points
      if (v.n !== null) contributions += v.n
      if (v.achieved !== null && v.points > 0) {
        seenWeight += v.points
        earned += v.points * v.achieved
        minLineN = Math.min(minLineN ?? Infinity, v.n ?? 0)
      }
    }
    const coverage = weight > 0 ? seenWeight / weight : 0
    if (seenWeight === 0 || coverage < settings.min_coverage) return { ...def, status: 'insufficient', contributions, basis: CURRENT_BASIS, observed: null, minLineN: null }
    const observed = earned / seenWeight
    const status: CoreStatus = observedLevel(observed, settings.core) as ObservedLevel
    return { ...def, status, contributions, basis: CURRENT_BASIS, observed, minLineN }
  })

  const candidates = axes
    .filter((a) => a.status === 'obs_low')
    .sort((a, b) => (a.observed as number) - (b.observed as number))
    .slice(0, 2)
    .map((a) => a.code)

  const ranking = rankingOf(axes, settings.core.weak)
  const nameOf = (c: CoreCode) => CORE_AXES.find((a) => a.code === c)?.name ?? c
  let nextDiagnosis: string
  if (candidates.includes('V') && candidates.includes('S')) nextDiagnosis = '어휘 · 표현과 문장 이해 중 실제 원인을 구분하기 위한 추가 진단 필요'
  else if (candidates.length === 2) nextDiagnosis = `${nameOf(candidates[0])}와(과) ${nameOf(candidates[1])} 중 실제 원인을 구분하기 위한 추가 진단 필요`
  else if (candidates.length === 1) nextDiagnosis = `${nameOf(candidates[0])} 후보의 실제 원인을 확인하기 위한 추가 진단 필요`
  else if (axes.every((a) => a.status === 'insufficient' || a.status === 'no_data')) nextDiagnosis = '진단 근거가 부족해요 — 시험 기록을 더하면 확인할 수 있어요'
  else nextDiagnosis = '지금 데이터로는 우선 확인할 후보가 없어요'

  return {
    axes,
    candidates,
    ranking,
    nextDiagnosis,
    route: { chosen: null, note: 'Route 미정 — 추가 진단 뒤 결정' },
    basis: CURRENT_BASIS,
  }
}

/** 1위 안정 판정 — 관찰값이 있는 축만 본다(듣기 · 근거 부족 축 제외). 순수 함수 */
export function rankingOf(axes: readonly Pick<CoreAxisView, 'code' | 'status' | 'observed' | 'minLineN'>[], weak: number): Ranking {
  const seen = axes.filter((a) => a.observed !== null).sort((a, b) => (a.observed as number) - (b.observed as number))
  const top = seen[0]
  if (!top || top.status !== 'obs_low') return { kind: 'none', top: null, rival: null, reasons: [] }
  const second = seen[1] ?? null
  const reasons: Ranking['reasons'] = []
  if (second && (second.observed as number) - (top.observed as number) < RANKING_GATE.margin) reasons.push('near_tie')
  if (weak - (top.observed as number) < RANKING_GATE.headroom) reasons.push('near_line')
  if ((top.minLineN ?? 0) < RANKING_GATE.minLineN) reasons.push('thin_evidence')
  // 경쟁 축이 없으면(관찰된 축이 하나뿐) 가를 상대가 없다 — 1위를 그대로 보이되 이유는 남긴다
  if (reasons.length === 0 || !second) return { kind: 'clear', top: top.code, rival: null, reasons }
  return { kind: 'unstable', top: top.code, rival: second.code, reasons }
}

/** 금지 어휘 — rule_proxy 화면 라벨 · 문구 회귀 검사용(판정 · 숙달 · 수치 능력 · 병목) */
export const FORBIDDEN_WORDS = /숙달|취약|양호|부족 역량|능력\s*\d|레벨\s*\d|달성|병목/
