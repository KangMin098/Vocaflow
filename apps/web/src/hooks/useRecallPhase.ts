// apps/web/src/hooks/useRecallPhase.ts

'use client'

import { useEffect, useRef, useState } from 'react'

interface UseRecallPhaseParams {
  duration: number // ms (default 3000)
  onComplete: () => void
  enabled: boolean // recall 단계 활성 여부
  resetKey: number // 카드 변경 시 reset
  hintAt?: number // 첫 글자 hint 노출 시점 ms (default 1500)
}

export function useRecallPhase({
  duration = 3000,
  onComplete,
  enabled,
  resetKey,
  hintAt = 1500,
}: UseRecallPhaseParams) {
  const [progress, setProgress] = useState(0) // 0 ~ 100
  const [hintVisible, setHintVisible] = useState(false)
  const startRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) {
      setProgress(0)
      setHintVisible(false)
      return
    }

    setProgress(0)
    setHintVisible(false)
    startRef.current = Date.now()

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min((elapsed / duration) * 100, 100)
      setProgress(pct)

      if (elapsed >= hintAt && !hintVisible) {
        setHintVisible(true)
      }

      if (pct >= 100) {
        if (timerRef.current) clearInterval(timerRef.current)
        onComplete()
      }
    }, 50)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled, duration, hintAt, hintVisible, onComplete, resetKey])

  return { progress, hintVisible }
}
