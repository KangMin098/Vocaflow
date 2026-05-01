// apps/web/src/hooks/useTypingMode.ts

'use client'

import type { SpellForgeMode } from '@/types/spellforge'
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'spellforge:mode'

export function useTypingMode() {
  const [mode, setModeState] = useState<SpellForgeMode>(() => {
    if (typeof window === 'undefined') return 'delayed'
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'realtime' || saved === 'delayed' || saved === 'blind') {
      return saved
    }
    return 'delayed'
  })

  const setMode = useCallback((newMode: SpellForgeMode) => {
    setModeState(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode)
    }
  }, [])

  return { mode, setMode }
}
