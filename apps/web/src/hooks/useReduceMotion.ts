// apps/web/src/hooks/useReduceMotion.ts
//
// `prefers-reduced-motion: reduce` 매치 여부 — JS 분기용.
// CSS 전역 가드 (`globals.css §4.5`) 가 1차 방어선이지만, JS-driven
// 애니메이션 (Animated.Value, requestAnimationFrame 등) 분기엔 이 훅 사용.
//
// SSR-안전: 초기값 false → mount 후 정정.

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(QUERY)
    setReduce(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduce(e.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    // Safari < 14 fallback
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [])

  return reduce
}
