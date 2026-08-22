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
  DEFAULT_SLOTS,
  SERIES_SPINE,
  measureSeriesFill,
  type Inventory,
  type SeriesRung,
} from '@vocaflow/library-pipeline'

/** 한 권이 서가에 서려면 최소 이만큼은 있어야 한다. */
export const SHELF_MIN_ITEMS = 60

/**
 * DB 에 **문항으로** 저장되지 않고 사전에서 생성되는 유형(elementary.ts).
 *
 * ⚠️ "조회 실패와 무관하다" 고 적어 뒀던 것은 **틀렸다.** 생성 가능 수를 세려면
 *    `shared_dictionary` 를 읽어야 하고, 그 표의 RLS 는 `authenticated` 전용이다.
 *    그래서 **비로그인 서가**(공개 표면)에서는 초등 재고가 0으로 내려왔고, 화면은 그것을
 *    '근간 예정'(재료 없음)으로 인쇄했다 — 계단 1·2 가 거짓으로 비어 보였다
 *    (실측 2026-08-22: 로그인 7/7 vs 비로그인 5/7).
 *    이 화면이 `unmeasured` 를 만든 이유와 **똑같은 사고**를 한 겹 아래에서 반복한 것이다.
 */
/**
 * 단원 기본 구성 — 정본은 `compose-unit.DEFAULT_SLOTS`.
 *
 * ⚠️ 여기 값을 **복사해 두고** 주석에 "export 하면 import 할 것" 이라고 적어 뒀었다.
 *    확인해 보니 **이미 export 되고 있었다**(실측 2026-08-22). 주석이 스스로를 유예시킨 셈이다 —
 *    "나중에 고치자" 는 메모는 고쳐지지 않는다. 지금 import 한다.
 */
const SLOTS: Record<string, number> = DEFAULT_SLOTS

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
  /**
   * 이 권의 지문이 **어디서 왔는가** — 갈래별 문항 수.
   *
   * ⚠️ 못 읽었으면 빈 객체다. 화면은 "출처 없음" 이 아니라 **표시하지 않는 것**으로 처리한다 —
   *    0 과 "못 잼" 을 구별하는 이 파일의 규칙이 여기에도 그대로 적용된다.
   */
  bySource: SourceCounts
}

/** 갈래별 문항 수. V레벨 여럿을 쓰는 권은 합산된다. */
export type SourceCounts = Record<string, number>

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
  /** V레벨 → 갈래 → 문항 수. 조회가 막히면 빈 맵을 넘긴다(화면이 출처를 안 보인다). */
  sourcesByLevel: Readonly<Record<number, SourceCounts>> = {},
  /**
   * DB 저장 유형(순서·삽입·어휘·어법 등)의 재고를 실제로 읽었는가.
   * 조회가 RLS·오류로 막히면 false 를 넘겨야 한다 — 그래야 화면이 '못 잼' 을 말한다.
   */
  measured = true,
  spine: readonly SeriesRung[] = SERIES_SPINE,
  /**
   * 초등 3종의 **생성 가능 수**(교육과정 어휘 보유량)를 실제로 읽었는가.
   *
   * 별도 인자인 이유: 두 재고는 **출처가 다르고 따로 실패한다.** 문항은 집계 RPC 에서,
   * 어휘는 `shared_dictionary` 에서 온다. 하나로 묶으면 한쪽만 막혔을 때 나머지까지
   * '못 잼' 이 되거나(과잉) 한쪽 실패가 묻힌다(과소) — 실제로 겪은 것은 후자다.
   */
  elementaryMeasured = true,
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
        maxUnits: maxUnitsOf(r.byType, r.rung.types),
    // 권이 여러 V레벨을 쓰면 갈래 수를 합친다.
    bySource: r.rung.vLevels.reduce<SourceCounts>((acc, lv) => {
      for (const [family, n] of Object.entries(sourcesByLevel[lv] ?? {})) {
        acc[family] = (acc[family] ?? 0) + n
      }
      return acc
    }, {}),
    // 이 계단이 쓰는 재고를 **전부** 읽었는가. 하나라도 못 읽었으면 총계는 뜻이 없다 —
    // 섞인 계단(초등 유형 + 저장 유형)에서 한쪽만 빠지면 총계가 조용히 작아진다.
    status: statusOf(
      r.total,
      r.emptyTypes,
      r.rung.types,
      r.rung.types.every((t) => (ELEMENTARY_ONLY.has(t) ? elementaryMeasured : measured)),
    ),
  }))

  return {
    brand: fill.brand,
    volumes,
    readyCount: volumes.filter((v) => v.status === 'ready').length,
    hasUnmeasured: volumes.some((v) => v.status === 'unmeasured'),
  }
}
