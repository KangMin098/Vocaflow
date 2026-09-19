// apps/web/src/lib/library/shelf-url-state.ts
//
// **서가의 고르던 자리를 주소에 싣는다** — 필터·정렬·펼친 만큼의 단일 출처.
//
// ── 왜 (실측 2026-09-05) ────────────────────────────────────────────────
// `/library/books` 에서 필터 6종과 정렬을 걸고 「60권 더 보기」를 세 번 눌러 180장을 편 뒤,
// 시트의 CTA 로 `/text` 나 상세로 나갔다가 **뒤로 돌아오면 전부 초기화**됐다. 312권짜리
// 카탈로그에서 고르던 자리를 매번 다시 만들어야 했고, 스크롤 복원은 훨씬 짧아진 문서 위에
// 떨어졌다. 새로고침·공유·새 탭도 같다 — 조건이 어디에도 안 적혀 있었으니까.
//
// 같은 저장소가 바로 옆 화면에서 이 문제를 이미 진단하고 고쳤다 —
// `components/library/browse/ScriptsBrowser.tsx` 머리의 "왜 시리즈 선택이 `useState` 가
// 아니라 `?series=` 인가". 그 판단이 도서·만화·단어장 탐색에는 적용되지 않았다.
//
// ── 왜 `router.replace` 가 아니라 `history.replaceState` 인가 ───────────
// `router.replace` 는 RSC 왕복을 일으킨다. 칩 하나를 누를 때마다 312권 카탈로그를 다시
// 받아오면 필터가 **네트워크만큼 느려진다** — 조건은 이미 브라우저에 다 있는데도.
// Next 14.2 는 네이티브 History API 를 지원하고 그 변경이 `useSearchParams` 에도 반영된다.
// 그래서 **렌더는 로컬 상태가, 기록은 주소가** 맡는다:
//   · 칩을 누른다 → 상태가 즉시 바뀌어 그린다(왕복 0)
//   · 같은 틱에 주소를 갈아 끼운다 → 새로고침·공유·뒤로 돌아오기가 그 조건으로 열린다
//
// `replaceState` 라 히스토리 항목이 **늘지 않는다.** 이게 요점이다 — 칩을 다섯 번 누른
// 사람이 뒤로가기를 다섯 번 눌러야 서가를 나갈 수 있으면 그건 고친 게 아니라 옮긴 것이다.

'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

/** 주소에 실을 값 하나. `null`·`''` 은 파라미터를 지운다(기본값은 안 적는다). */
export type ShelfParamPatch = Record<string, string | number | boolean | null | undefined>

/**
 * 지금 주소의 쿼리와, 그것을 갈아 끼우는 함수.
 *
 * ⚠️ `setParams` 는 **렌더 결과를 바꾸지 않는다.** 화면은 호출부의 로컬 상태가 그린다.
 *    여기서 하는 일은 "지금 보고 있는 것"을 주소에 받아 적는 것뿐이다.
 */
export function useShelfUrlState() {
  const searchParams = useSearchParams()

  const setParams = useCallback((patch: ShelfParamPatch) => {
    if (typeof window === 'undefined') return
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === '' || value === false) {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    }
    const qs = next.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
    // 이미 그 주소면 아무것도 하지 않는다 — 같은 값을 반복해 써 넣으면
    // `useSearchParams` 구독자가 괜히 다시 렌더된다.
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      return
    }
    window.history.replaceState(window.history.state, '', url)
  }, [])

  return { searchParams, setParams }
}

/** 주소에서 닫힌 열거형 하나를 읽는다. 모르는 값은 `null` — 손으로 고친 주소가 화면을 깨지 않게. */
export function readEnumParam<T extends string>(
  searchParams: ReturnType<typeof useSearchParams>,
  key: string,
  allowed: readonly T[],
): T | null {
  const raw = searchParams?.get(key)
  if (!raw) return null
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null
}

/** 주소에서 양의 정수 하나를 읽는다(펼친 장수 등). 범위를 벗어나면 `null`. */
export function readIntParam(
  searchParams: ReturnType<typeof useSearchParams>,
  key: string,
  max: number,
): number | null {
  const raw = searchParams?.get(key)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return Math.min(n, max)
}
