// apps/web/src/hooks/useActiveHint.ts

'use client'

import { useCallback, useRef, useState } from 'react'

const HINT_DURATION_MS = 1500

export function useActiveHint(onHintEnd?: () => void) {
  const [isHintActive, setIsHintActive] = useState(false)
  const [hintCount, setHintCount] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const triggerHint = useCallback(() => {
    setIsHintActive(true)
    setHintCount((c) => c + 1)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setIsHintActive(false)
      onHintEnd?.()
    }, HINT_DURATION_MS)
  }, [onHintEnd])

  const resetHints = useCallback(() => {
    setHintCount(0)
    setIsHintActive(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { isHintActive, hintCount, triggerHint, resetHints }
}
