// apps/web/src/components/csat/judgment/useReveal.ts
// 공개 자료는 학습자가 요청할 때만 받는다(마운트 시 호출 없음). 판본이 다르면 근거를 보여 주지 않고 오류로 둔다.
'use client'

import { useCallback, useRef, useState } from 'react'
import { checkReveal } from '@/lib/csat/judgment/evidence'
import type { JudgmentItem, RevealProvider, RevealState } from '@/lib/csat/judgment/types'

export function useReveal(item: JudgmentItem, provider: RevealProvider) {
  const [state, setState] = useState<RevealState>({ status: 'hidden' })
  const seq = useRef(0)
  const request = useCallback(async () => {
    const my = ++seq.current
    setState({ status: 'loading' })
    try {
      const raw = await provider({ id: item.id, version: item.version })
      if (my !== seq.current) return
      const checked = checkReveal(item, raw)
      setState(checked.ok ? { status: 'shown', data: checked.data } : { status: 'error', reason: checked.reason })
    } catch {
      if (my === seq.current) setState({ status: 'error', reason: 'fetch' })
    }
  }, [item, provider])
  return { state, request }
}

export const REVEAL_ERROR_TEXT: Record<'fetch' | 'version' | 'shape', string> = {
  fetch: '해설을 불러오지 못했다. 다시 시도할 수 있다.',
  version: '해설 판본이 이 원문 판본과 달라 근거 연결을 보여 주지 않는다.',
  shape: '해설 자료 형식이 올바르지 않아 보여 주지 않는다.',
}
