// apps/web/src/components/csat/judgment/useReveal.ts
// 공개 자료는 학습자가 요청할 때만 받는다(마운트 시 호출 없음). 판본이 다르면 근거를 보여 주지 않고 오류로 둔다.
//
// 공개 상태는 문항 id · 분석 판본 · 단위 판본에 묶인다(T-0151 P1-01). 같은 인스턴스에 다른 문항이 오면
// ① 렌더 시점에 이전 문항의 상태를 버리고 hidden 으로 보이며 ② 진행 중이던 요청의 응답은 버린다.
// 즉 key 로 재마운트하지 않아도 이전 문항의 정답 · 해설이 새 원문 옆에 남지 않는다.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { checkReveal } from '@/lib/csat/judgment/evidence'
import { RevealError, type JudgmentItem, type RevealFailure, type RevealProvider, type RevealState } from '@/lib/csat/judgment/types'

/** 공개 상태의 결속 키 — 이것이 바뀌면 다른 문항이다 */
export function revealBinding(item: Pick<JudgmentItem, 'id' | 'version'>): string {
  return `${item.id}@a${item.version.analysisVersion}@u${item.version.unitsVersion}@${item.version.unitsHash}`
}

const HIDDEN: RevealState = { status: 'hidden' }

export function useReveal(item: JudgmentItem, provider: RevealProvider) {
  const bind = revealBinding(item)
  const [held, setHeld] = useState<{ bind: string; state: RevealState }>({ bind, state: HIDDEN })
  const seq = useRef(0)
  const live = useRef(bind)
  live.current = bind

  // 문항이 바뀌면 진행 중 요청을 무효화한다
  useEffect(() => {
    seq.current++
  }, [bind])

  const request = useCallback(async () => {
    const my = ++seq.current
    const at = revealBinding(item)
    setHeld({ bind: at, state: { status: 'loading' } })
    const settle = (state: RevealState) => {
      if (my !== seq.current || live.current !== at) return
      setHeld({ bind: at, state })
    }
    try {
      const raw = await provider({ id: item.id, version: item.version })
      const checked = checkReveal(item, raw)
      settle(checked.ok ? { status: 'shown', data: checked.data } : { status: 'error', reason: checked.reason })
    } catch (e) {
      settle({ status: 'error', reason: e instanceof RevealError ? e.reason : 'fetch' })
    }
  }, [item, provider])

  // 렌더 시점 결속 확인 — 상태가 다른 문항 것이거나 공개 자료의 id 가 현재 문항과 다르면 보이지 않는다
  let state = held.bind === bind ? held.state : HIDDEN
  if (state.status === 'shown' && state.data.id !== item.id) state = HIDDEN
  return { state, request }
}

export const REVEAL_ERROR_TEXT: Record<RevealFailure, string> = {
  fetch: '해설을 불러오지 못했다. 다시 시도할 수 있다.',
  version: '해설 판본이 이 원문 판본과 달라 근거 연결을 보여 주지 않는다.',
  shape: '해설 자료 형식이 올바르지 않아 보여 주지 않는다.',
  auth: '해설은 로그인한 뒤에 볼 수 있다.',
  held: '이 시험은 지금 정답 공개가 보류돼 해설을 열 수 없다.',
}
