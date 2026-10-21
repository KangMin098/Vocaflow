// apps/web/src/lib/ui/use-escape-key.ts
//
// 열린 팝오버·패널을 Esc 로 닫는다(DD-83 · learner-tines-audit B4).
// 모달은 `components/ui/Dialog` 가 Esc 를 이미 갖고 있다 — 이 훅은 Dialog 를 쓰지 않는 앵커형 팝오버·곁 패널용이다.
// 닫힌 동안에는 듣지 않는다: 닫힌 팝오버가 Esc 를 삼키면 바깥(세션 종료 등)의 Esc 가 죽는다.

import { useEffect, useRef } from 'react'

export function useEscapeKey(active: boolean, onEscape: () => void) {
  // 호출부가 매 렌더 새 함수를 넘겨도 리스너를 다시 걸지 않는다.
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])
}
