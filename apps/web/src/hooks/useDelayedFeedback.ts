// apps/web/src/hooks/useDelayedFeedback.ts

'use client'

import { evaluateInput } from '@/lib/spellforge/scoring'
import type { ConfirmResult } from '@/types/spellforge'
import { useCallback, useState } from 'react'

export function useDelayedFeedback() {
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<ConfirmResult | null>(null)

  const confirm = useCallback((input: string, target: string): ConfirmResult => {
    const evalResult = evaluateInput(input, target)
    setResult(evalResult)
    setConfirmed(true)
    return evalResult
  }, [])

  const reset = useCallback(() => {
    setConfirmed(false)
    setResult(null)
  }, [])

  return { confirmed, result, confirm, reset }
}
