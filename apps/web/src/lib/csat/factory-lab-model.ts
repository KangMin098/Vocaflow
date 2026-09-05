// apps/web/src/lib/csat/factory-lab-model.ts
//
// **전략 연구소 두 화면의 순수 모델** — 타입과 판정만. DB 도 파일도 안 읽는다.
//
// 왜 실측(`factory-views.ts`)에서 갈라 두나: 실측 쪽은 `server-only` 를 import 하므로
// 클라이언트 컴포넌트가 거기서 값을 하나라도 가져오면 **빌드가 통째로 깨진다**
// (실측 2026-09-05: `verdictOf` 를 화면이 가져다 쓰자 `/admin/csat/strategy` 가 500 이 났다).
// 판정 규칙은 화면과 서버가 **같은 것**을 써야 하므로 여기 한 곳에 둔다.

import type { SeriesItemType } from '@vocaflow/library-pipeline'

import type { BenchFile } from './factory-bench'

export interface MarketView {
  warehouse: BenchFile | null
  volume: BenchFile | null
  target: number
  /** 리포트를 하나도 못 읽었을 때만. 개별 모드의 null 과 다르다. */
  loadError: string | null
}

/**
 * 목표에 닿을 수 있는가를 **출판사마다** 따진다.
 *
 * `reachableMax` 가 목표보다 낮으면 그 출판사에 대해서는 **지금 코퍼스로는 산술적으로 불가능**이다
 * — 파이프라인을 아무리 고쳐도 안 오른다. 막고 있는 것은 우리가 아니라 **증거**이고, 할 일은
 * 집필이 아니라 그 출판사의 정답해설 자료를 구하는 것이다. 이 구분을 화면이 흐리면
 * 관리자는 오르지 않는 지표에 배치를 계속 돌린다.
 */
export function verdictOf(
  p: { overallIndex: number | null; reachableMax: number | null },
  target: number,
): 'reached' | 'closable' | 'evidence-bound' | 'unmeasured' {
  if (p.overallIndex == null) return 'unmeasured'
  if (p.overallIndex >= target) return 'reached'
  if (p.reachableMax != null && p.reachableMax < target) return 'evidence-bound'
  return 'closable'
}

export const VERDICT_KO: Record<
  ReturnType<typeof verdictOf>,
  { label: string; color: string; hint: string }
> = {
  reached: { label: '도달', color: '#2E7D5A', hint: '이 출판사 규격으로는 목표를 넘겼다' },
  closable: {
    label: '좁힐 수 있다',
    color: '#B5803A',
    hint: '잰 축의 천장이 목표 위에 있다 — 파이프라인을 고치면 오른다',
  },
  'evidence-bound': {
    label: '증거가 막는다',
    color: '#9C3A30',
    hint: '잰 축만으로는 천장이 목표에 못 닿는다 — 집필이 아니라 자료를 구해야 한다',
  },
  unmeasured: { label: '못 잼', color: '#8A8278', hint: '이 출판사 표본으로는 축을 하나도 못 쟀다' },
}

/** 이원목적분류표 한 칸 — 학령(연령) × 수준(V-Level) × 유형. */
export interface BlueprintCell {
  type: SeriesItemType
  typeKo: string
  /** DB 로 셀 수 있는 유형인가. 초등 3종은 사전의 순수 함수라 저장되지 않는다. */
  countable: boolean
  /** 재고. 못 셌으면 null, 셀 수 없는 유형이면 null 과 `countable:false`. */
  count: number | null
}

export interface BlueprintRung {
  step: number
  schoolBand: string
  vLevels: number[]
  volumeTitle: string
  rationale: string
  cells: BlueprintCell[]
  /** 셀 수 있는 칸 중 재고 0 — **사다리가 끊긴 자리**다. */
  emptyTypes: string[]
}

export interface BlueprintView {
  rungs: BlueprintRung[]
  /** 단계 게이트 임계 — 설계가 정한 합격선. 화면이 근거로 쓴다. */
  gates: { stage: string; metric: string; threshold: number; isLocked: boolean; note: string | null }[]
  /** 전체 유형 축 — 표의 열. 사다리 전체가 쓰는 유형의 합집합. */
  typeAxis: { type: string; typeKo: string; countable: boolean }[]
  loadError: string | null
}

/**
 * 초등 3종은 **DB 에 없다** — 사전의 순수 함수라 저장할 이유가 없다(`series.ts`).
 * 표에서 이 셋을 "재고 0" 으로 그리면 초등 계단이 거짓으로 끊겨 보이고, 관리자는 있지도 않은
 * 구멍을 메우러 간다. 그래서 **셀 수 없음**으로 따로 표시한다.
 */
export const PURE_FUNCTION_TYPES: ReadonlySet<string> = new Set([
  'rhyme',
  'word_meaning',
  'spell_blank',
])
