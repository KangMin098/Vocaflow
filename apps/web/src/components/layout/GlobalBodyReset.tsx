// apps/web/src/components/layout/GlobalBodyReset.tsx
//
// 라우트 변경 시 body 의 stale 상태를 강제 reset.
// 결함 대응:
//   - useFocusMode 가 cleanup 못한 .focus-mode 클래스
//   - NetflixDetailSheet 가 cleanup 못한 body.style.overflow='hidden'
//   - InsightPanel 의 body.style.overflow='hidden' stale
//
// 3중 안전망:
//   1) 초기 마운트 시 reset
//   2) pathname 변경 시 reset (+ raf 1프레임 후 한 번 더)
//   3) 클릭 가능성 보장 — 클릭 이벤트 트리거 시 body 상태 확인

'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

function safeReset() {
  if (typeof document === 'undefined') return
  document.body.style.overflow = ''
  document.body.classList.remove('focus-mode')
}

export function GlobalBodyReset() {
  const pathname = usePathname()

  // 초기 마운트 + 라우트 변경 시 즉시 reset
  useEffect(() => {
    safeReset()
    // raf 한 프레임 후 한 번 더 — 다른 컴포넌트 cleanup 보다 늦게 실행 보장
    const id = requestAnimationFrame(safeReset)
    return () => cancelAnimationFrame(id)
  }, [pathname])

  // 안전망 — 사용자가 클릭/키 입력 시 body 가 잠긴 상태면 즉시 해제
  // (어떤 컴포넌트가 cleanup 못해서 stale 됐을 때 사용자 첫 인터랙션에서 풀림)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handler = () => {
      // overflow=hidden 인데 그 원인이 되는 modal 이 화면에 없으면 stale
      // 보수적 판정 — 라우트 변경 직후이거나 fixed inset-0 + pointer-events-auto 가 없으면 풀기
      const overflowSet = document.body.style.overflow === 'hidden'
      if (!overflowSet) return
      const visibleOverlay = document.querySelector(
        '.fixed.inset-0.pointer-events-auto, [role="dialog"][aria-hidden="false"]',
      )
      if (!visibleOverlay) {
        safeReset()
      }
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    return () => window.removeEventListener('pointerdown', handler, { capture: true })
  }, [])

  return null
}
