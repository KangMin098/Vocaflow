// apps/web/src/hooks/useStudyingMode.ts

'use client'

import { useEffect } from 'react'

/**
 * Card-Only Focus 모드 활성화
 * body.studying 클래스 부여 → 사이드바 페이드
 */
export function useStudyingMode(active: boolean = true) {
  useEffect(() => {
    if (!active) return
    document.body.classList.add('studying')
    return () => {
      document.body.classList.remove('studying')
    }
  }, [active])
}
