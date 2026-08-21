// apps/web/src/lib/textbook/shelf-filter.ts
//
// 서가의 **분류 축** — 순수 계산. 화면(`TextbookShelf`)은 이 결과만 그린다.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
//    (`shelf.ts` 와 같은 이유).
//
// ── 왜 축을 코드에서 적지 않고 재고에서 뽑는가 ──────────────────────────
// 서점 교재 코너의 분류표는 **꽂혀 있는 책에서** 나온다 — 고등 교재가 하나도 없는데
// '고등' 칸을 만들어 두면 손님은 그 칸을 열어 보고 빈 것을 확인하는 데 시간을 쓴다.
// 그래서 축의 값은 `SERIES_SPINE` 이 실제로 내놓은 권들에서만 뽑는다. 시리즈가 늘거나
// 유형 구성이 바뀌면 필터도 **자동으로** 따라간다 — 손으로 적은 목록은 반드시 갈린다.
//
// ── 세 축을 고른 근거 ───────────────────────────────────────────────────
//   학령 — 시중 교재 코너의 1차 분류(초/중/고). 학부모·교사가 먼저 찾는 축이다.
//   수준 — 같은 학년 안에서도 실력이 갈린다. V-Level 이 그 눈금(`vocaflow_levels`).
//   유형 — "무엇을 시키는 책인가". 독해·어법·순서처럼 시중 교재가 표지에 쓰는 것.

import type { ShelfVolume } from './shelf'
import { TYPE_GUIDE } from './type-guide'

export type ShelfAxis = 'school' | 'level' | 'type'

export const SHELF_AXES = ['school', 'level', 'type'] as const

export interface FacetOption {
  /** 필터 값(선택 상태의 키) */
  value: string
  /** 학습자가 읽는 이름 */
  label: string
  /** 이 값에 걸리는 권 수 — 0 인 값은 애초에 만들지 않는다 */
  count: number
}

export type Facets = Record<ShelfAxis, FacetOption[]>

/** 축별 선택. 빈 배열 = 그 축은 안 거른다(전체). */
export type Selection = Record<ShelfAxis, readonly string[]>

export const EMPTY_SELECTION: Selection = { school: [], level: [], type: [] }

export const AXIS_LABEL: Record<ShelfAxis, string> = {
  school: '학령',
  level: '수준',
  type: '유형',
}

/** 한 권이 어떤 축 값들을 갖는가 — 필터와 패싯이 **같은 함수**를 써야 갈리지 않는다. */
function valuesOf(v: ShelfVolume, axis: ShelfAxis): string[] {
  switch (axis) {
    case 'school':
      return [v.schoolBand]
    case 'level':
      return v.vLevels.map((n) => `V${n}`)
    case 'type':
      return [...v.types]
  }
}

function labelOf(axis: ShelfAxis, value: string): string {
  return axis === 'type' ? (TYPE_GUIDE[value]?.label ?? value) : value
}

/**
 * 재고 → 축 목록.
 *
 * 순서는 **권의 순서**를 따른다(계단 1→7). 가나다 정렬을 하면 '고등' 이 '초등' 앞에 와서
 * 사다리를 거꾸로 읽게 만든다 — 이 서가에서 순서는 곧 난이도다.
 */
export function buildFacets(volumes: readonly ShelfVolume[]): Facets {
  const out = {} as Facets
  for (const axis of SHELF_AXES) {
    const seen = new Map<string, number>()
    for (const v of volumes) {
      for (const val of valuesOf(v, axis)) seen.set(val, (seen.get(val) ?? 0) + 1)
    }
    out[axis] = [...seen.entries()].map(([value, count]) => ({
      value,
      label: labelOf(axis, value),
      count,
    }))
  }
  return out
}

/**
 * 선택 → 걸러진 권.
 *
 * 축 **사이는 AND**, 축 **안은 OR** 다. 시중 서가의 "중등 + (독해 or 어법)" 이 이 규칙이고,
 * 축 안까지 AND 로 걸면 유형을 둘 고르는 순간 대개 0권이 되어 필터가 쓸모없어진다.
 */
export function filterVolumes(volumes: readonly ShelfVolume[], sel: Selection): ShelfVolume[] {
  return volumes.filter((v) =>
    SHELF_AXES.every((axis) => {
      const picked = sel[axis]
      if (picked.length === 0) return true
      const has = valuesOf(v, axis)
      return picked.some((p) => has.includes(p))
    }),
  )
}

/** 값 하나를 켜고 끈다. 화면이 배열 조작을 다시 짜지 않도록 여기서 준다. */
export function toggleValue(sel: Selection, axis: ShelfAxis, value: string): Selection {
  const cur = sel[axis]
  return {
    ...sel,
    [axis]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value],
  }
}

/** 지금 몇 개를 걸어 뒀는가 — "조건 해제" 를 낼지 판단한다. */
export function selectionCount(sel: Selection): number {
  return SHELF_AXES.reduce((n, a) => n + sel[a].length, 0)
}
