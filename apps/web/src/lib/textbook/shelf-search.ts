// apps/web/src/lib/textbook/shelf-search.ts
//
// 교재 매대의 **찾기(검색) · 줄세우기(정렬) · 좁히기(상태)** — 순수 함수.
//
// ── 왜 이게 없으면 매대가 아닌가 ────────────────────────────────────
// 상업 교재 카탈로그(NE_Books 관측 2026-08-30)는 89종을 놓고 **검색창 · 정렬 4종 ·
// 목록/격자 · 판매중만 보기**를 함께 낸다. 우리는 7권이라 "적으니 필요 없다" 고 넘겨 왔는데,
// 매대 지수를 실제로 재 보니 이 축이 **0/9** 였고 기하평균이 통째로 0 이 됐다
// (`scripts/textbook/catalog-benchmark.mjs`). 권 수가 적은 것과 찾을 방법이 없는 것은 다른 문제다.
//
// ── 우리 정렬이 저쪽과 다른 점 ──────────────────────────────────────
// NE 의 정렬(최신순·과거순·조회순·가나다순)은 **메타데이터**를 줄세운다. 우리는 재고를 실측하므로
// **내용물**로 줄세울 수 있다 — 문항이 많은 권, 유형이 다양한 권. 이건 종이 카탈로그가
// 구조적으로 못 하는 정렬이다(낱권 수록 문항 수를 세어 두지 않는다).
//
// ⚠️ 정렬은 **전순서(total order)** 여야 한다. 비교값이 같을 때 계단 번호로 반드시 끊는다 —
//    안 그러면 같은 조건에서 순서가 흔들려 "새로고침하면 순서가 바뀐다" 는 버그가 된다.

import type { ShelfVolume } from './shelf'
import { TYPE_GUIDE } from './type-guide'

/** 정렬 하나. `id` 는 URL·테스트가 쓰는 안정 키다. */
export interface ShelfSort {
  id: string
  label: string
  /** 라벨이 말하지 않는 것 — 무엇을 기준으로 줄세우는지 */
  says: string
  compare: (a: ShelfVolume, b: ShelfVolume) => number
}

/** 계단 번호로 끊는 tie-breaker. 모든 정렬의 마지막 비교다. */
const byStep = (a: ShelfVolume, b: ShelfVolume) => a.step - b.step

export const SHELF_SORTS: readonly ShelfSort[] = [
  {
    id: 'step',
    label: '계단 순',
    says: '초등 → 고등, 배우는 차례대로',
    compare: byStep,
  },
  {
    id: 'step-desc',
    label: '높은 계단부터',
    says: '고3부터 거꾸로 — 수능이 급한 학습자용',
    compare: (a, b) => b.step - a.step,
  },
  {
    id: 'items',
    label: '문항 많은 순',
    says: '지금 풀 수 있는 문항이 많은 권부터',
    compare: (a, b) => b.itemCount - a.itemCount || byStep(a, b),
  },
  {
    id: 'types',
    label: '유형 많은 순',
    says: '한 권에서 다루는 문제 유형이 다양한 순',
    compare: (a, b) => b.types.length - a.types.length || byStep(a, b),
  },
  {
    id: 'title',
    label: '가나다순',
    says: '권 제목 순서',
    // ⚠️ `localeCompare` 를 ko 로 고정한다 — 서버/브라우저 로캘에 따라 결과가 달라지면
    //    SSR 과 클라이언트 렌더가 어긋나 hydration 이 깨진다.
    compare: (a, b) => a.title.localeCompare(b.title, 'ko') || byStep(a, b),
  },
] as const

export const DEFAULT_SORT = SHELF_SORTS[0].id

export function sortVolumes(volumes: readonly ShelfVolume[], sortId: string): ShelfVolume[] {
  const sort = SHELF_SORTS.find((s) => s.id === sortId) ?? SHELF_SORTS[0]
  // 원본을 건드리지 않는다 — 호출부가 useMemo 로 캐시하므로 in-place 정렬은 버그가 된다.
  return [...volumes].sort(sort.compare)
}

/**
 * 한 권이 검색어에 걸리는지.
 *
 * 무엇으로 찾게 할 것인가가 이 함수의 전부다. 학습자는 셋 중 하나로 찾는다 —
 *   ① 권 이름("리딩 3")  ② 자기 학년("중3", "고1")  ③ 하려는 것("빈칸", "어법")
 * 그래서 제목·학령·V레벨·**유형 한글 이름**까지 한 자루에 넣는다. 유형을 빼면
 * "빈칸" 으로 검색했을 때 빈칸 문항 3,930개를 가진 권이 안 나온다.
 */
function haystack(v: ShelfVolume): string {
  const typeNames = v.types.flatMap((t) => {
    const g = TYPE_GUIDE[t]
    return g ? [t, g.label] : [t]
  })
  return [v.title, v.schoolBand, ...v.vLevels.map((n) => `V${n}`), ...typeNames]
    .join(' ')
    .toLowerCase()
}

/**
 * 검색어로 좁힌다. 공백으로 나눈 **모든** 토큰이 걸려야 한다(AND).
 *
 * ⚠️ OR 로 하면 "중등 빈칸" 이 중등 아닌 권까지 끌고 온다 — 토큰을 더할수록 결과가
 *    늘어나는 검색은 학습자가 좁히려는 의도와 정반대로 움직인다.
 */
export function searchVolumes(volumes: readonly ShelfVolume[], query: string): ShelfVolume[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [...volumes]
  return volumes.filter((v) => {
    const hay = haystack(v)
    return tokens.every((t) => hay.includes(t))
  })
}

/**
 * '준비된 권만 보기' — NE_Books 의 '판매중 교재만 보기' 에 대응한다.
 *
 * ⚠️ `unmeasured`(못 잼)를 **걸러내지 않는다.** 못 잰 것을 "준비 안 됨" 으로 처리하면
 *    이 파일 계열이 계속 싸워 온 그 거짓말(0 과 못 잼을 같게 취급)을 필터가 다시 만든다.
 *    준비됐는지 모르는 것은 숨기는 대신 그대로 보여 주고, 학습자가 판단하게 둔다.
 */
export function onlyReady(volumes: readonly ShelfVolume[], enabled: boolean): ShelfVolume[] {
  if (!enabled) return [...volumes]
  return volumes.filter((v) => v.status === 'ready' || v.status === 'unmeasured')
}

/** 매대 진열 방식. 격자는 표지를 크게, 목록은 유형 칩까지 보여 준다. */
export type ShelfView = 'list' | 'grid'

export const SHELF_VIEWS: readonly { id: ShelfView; label: string }[] = [
  { id: 'list', label: '목록 보기' },
  { id: 'grid', label: '격자 보기' },
] as const
