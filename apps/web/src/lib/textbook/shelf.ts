// apps/web/src/lib/textbook/shelf.ts
//
// 교재 서가의 **순수 계산부** — 재고를 "학습자가 고를 수 있는 권" 으로 바꾼다.
// 조회는 `shelf-query.ts` 가 맡는다.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
//    (`growth-math` · `gateway-state` 와 같은 이유. `react.cache` 하나면 스위트가 통째로 죽는다).
//
// ─────────────────────────────────────────────────────────────
// 왜 필요한가 (실측 2026-08-21)
//
// 교재 파이프라인은 생성기·검사기·리포트·Admin 콘솔·HTML 조판기까지 다 있는데
// **학습자가 볼 수 있는 화면이 0개**였다. 문항 5,492개가 DB 에 있어도 학습자에게는
// 존재하지 않는 것과 같다.
//
// 사다리(`SERIES_SPINE` 7계단)와 채움 계산(`measureSeriesFill`)은 이미 정본이 있다.
// 이 파일은 **새 분류를 만들지 않는다** — 그 위에 "서가에 꽂을 수 있는가" 판정과
// 학습자가 읽을 표시값만 얹는다. 눈금을 새로 만들면 반드시 갈린다.
//
// ⚠️ 초등 3종(`rhyme`·`word_meaning`·`spell_blank`)은 DB 에 저장되지 않는다.
//    사전에서 결정론적으로 생성되므로(`elementary.ts`) 재고에 **생성 가능 수**를 넣어야 하고,
//    안 넣으면 초등 계단이 거짓으로 비어 보인다(`series.ts` 가 명시한 함정).
// ─────────────────────────────────────────────────────────────

import {
  SERIES_SPINE,
  measureSeriesFill,
  type Inventory,
  type SeriesRung,
} from '@vocaflow/library-pipeline'

/** 한 권이 서가에 서려면 최소 이만큼은 있어야 한다. */
export const SHELF_MIN_ITEMS = 60

/** DB 에 저장되지 않고 사전에서 생성되는 유형 — 조회 실패와 무관하다(elementary.ts). */
/** 단원 기본 구성 — 순서 2 + 삽입 2(compose-unit.DEFAULT_SLOTS 와 같은 값).
 *  ⚠️ 두 곳에 적히면 갈린다. 라이브러리가 상수를 export 하면 그것을 import 할 것. */
const SLOTS: Record<string, number> = { order: 2, insert: 2 }

/** 슬롯을 쓰지 않는 계단(초등·중등)은 문항 4개를 한 단원으로 본다. */
const FALLBACK_ITEMS_PER_UNIT = 4

function maxUnitsOf(byType: Record<string, number>, types: readonly string[]): number {
  const slotted = types.filter((t) => t in SLOTS)
  if (slotted.length > 0) {
    return Math.min(...slotted.map((t) => Math.floor((byType[t] ?? 0) / SLOTS[t])))
  }
  const total = types.reduce((s, t) => s + (byType[t] ?? 0), 0)
  return Math.floor(total / FALLBACK_ITEMS_PER_UNIT)
}

const ELEMENTARY_ONLY = new Set(['rhyme', 'word_meaning', 'spell_blank'])

/**
 * 권의 상태 — **"없음" 과 "준비 중" 을 구별한다.**
 *
 * 이 구별이 없으면 학습자는 빈 칸을 "고장" 으로 읽는다. 시장의 교재 코너도
 * 근간(출간)과 근간 예정을 나눠 꽂는다.
 */
export type ShelfStatus =
  /** 지금 펼칠 수 있다 */
  | 'ready'
  /** 재료는 있는데 아직 한 권 분량이 안 된다 */
  | 'building'
  /** 재료가 전혀 없다 — 사다리가 끊긴 자리 */
  | 'empty'
  /**
   * **재고를 세지 못했다.** 0 과 반드시 구별한다.
   *
   * 실측 2026-08-21: csat_dcp_items 의 RLS 정책이 admin 하나뿐이라 학습자 조회가
   * 빈 배열을 돌려줬고, 화면은 그것을 '근간 예정'(재료 없음)으로 인쇄했다 — 문항 1,241개를
   * 가진 계단이 '없음' 으로 보였다. 못 잰 것을 0 으로 적으면 그 화면은 조용히 거짓말한다.
   */
  | 'unmeasured'

export interface ShelfVolume {
  step: number
  /** 권 제목 — `SERIES_SPINE` 이 소유한다. 화면에서 짓지 않는다. */
  title: string
  /** 학령 — `vocaflow_levels.korean_school` 에서 온 값 */
  schoolBand: string
  vLevels: number[]
  /** 이 권이 쓰는 유형 */
  types: string[]
  /** 왜 이 유형 구성인가 — 학습자에게 "이 책이 무엇을 시키는지" 를 말해 준다 */
  rationale: string
  /** 이 권에 쓸 수 있는 문항 수 */
  itemCount: number
  /** 유형별 보유 수 */
  byType: Record<string, number>
  /** 쓰기로 했는데 재고가 0인 유형 — 반쪽인 이유를 밝힌다 */
  emptyTypes: string[]
  status: ShelfStatus
  /**
   * 이 권으로 만들 수 있는 **단원 수의 상한**.
   *
   * ⚠️ 상한이지 예측이 아니다. 실제 조합은 두 규칙을 더 건다 —
   *    ① 문항 지문이 수능 규격(90~200어)일 것 ② 한 단원의 문항은 서로 다른 원글에서 올 것
   *    (compose-unit.ts). 그래서 실제 단원 수는 이 값보다 **적다.**
   *    화면은 반드시 '최대' 라고 적어야 한다 — 상한을 예측처럼 보이면 그 순간 과장 광고가 된다.
   */
  maxUnits: number
}

export interface Shelf {
  brand: string
  volumes: ShelfVolume[]
  /** 지금 펼칠 수 있는 권 수 */
  readyCount: number
  /** 재고를 세지 못한 권이 하나라도 있는가 — 화면이 그 사실을 밝혀야 한다 */
  hasUnmeasured: boolean
}

function statusOf(
  total: number,
  emptyTypes: readonly string[],
  types: readonly string[],
  /** DB 저장 유형의 재고를 실제로 읽었는가. false 면 0 을 '없음' 으로 읽어선 안 된다. */
  measured: boolean,
): ShelfStatus {
  // 못 잰 것을 0 으로 적지 않는다 — 이 화면이 처음 만든 거짓이 정확히 그것이었다.
  if (!measured) return 'unmeasured'
  if (total === 0) return 'empty'
  // 유형이 전부 비어 있으면 총계가 0이므로 여기 오지 않는다. 부분 결손은 분량으로 판정한다.
  if (total < SHELF_MIN_ITEMS || emptyTypes.length === types.length) return 'building'
  return 'ready'
}

/**
 * 재고 → 서가.
 *
 * `measureSeriesFill` 이 계단별 채움을 내고, 여기서는 **표시와 판정만** 더한다.
 * 계단 목록·유형 구성은 손대지 않는다(정본은 `SERIES_SPINE`).
 */
export function buildShelf(
  inventory: Inventory,
  /**
   * DB 저장 유형(순서·삽입·어휘·어법 등)의 재고를 실제로 읽었는가.
   * 조회가 RLS·오류로 막히면 false 를 넘겨야 한다 — 그래야 화면이 '못 잼' 을 말한다.
   */
  measured = true,
  spine: readonly SeriesRung[] = SERIES_SPINE,
): Shelf {
  const fill = measureSeriesFill(inventory, spine)

  const volumes: ShelfVolume[] = fill.rungs.map((r) => ({
    step: r.rung.step,
    title: r.rung.volumeTitle,
    schoolBand: r.rung.schoolBand,
    vLevels: [...r.rung.vLevels],
    types: [...r.rung.types],
    rationale: r.rung.rationale,
    itemCount: r.total,
    byType: r.byType,
    emptyTypes: [...r.emptyTypes],
    // 초등 3종만 쓰는 계단은 DB 조회와 무관하므로 못 잰 것이 아니다.
    maxUnits: maxUnitsOf(r.byType, r.rung.types),
    status: statusOf(
      r.total,
      r.emptyTypes,
      r.rung.types,
      measured || r.rung.types.every((t) => ELEMENTARY_ONLY.has(t)),
    ),
  }))

  return {
    brand: fill.brand,
    volumes,
    readyCount: volumes.filter((v) => v.status === 'ready').length,
    hasUnmeasured: volumes.some((v) => v.status === 'unmeasured'),
  }
}
