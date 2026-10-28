// apps/web/src/components/csat/judgment/useReveal.ts
// 공개 자료는 학습자가 요청할 때만 받는다(마운트 시 호출 없음). 판본이 다르면 근거를 보여 주지 않고 오류로 둔다.
//
// 공개 상태는 문항 id · 분석 판본 · 단위 판본에 묶인다(T-0151 P1-01). 같은 인스턴스에 다른 문항이 오면
// ① 렌더 시점에 이전 문항의 상태를 버리고 hidden 으로 보이며 ② 진행 중이던 요청의 응답은 버린다.
// 즉 key 로 재마운트하지 않아도 이전 문항의 정답 · 해설이 새 원문 옆에 남지 않는다.
'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { checkReveal } from '@/lib/csat/judgment/evidence'
import { RevealError, type JudgmentItem, type RevealFailure, type RevealProvider, type RevealState } from '@/lib/csat/judgment/types'

// 서버 렌더에는 레이아웃 단계가 없다 — 경고 없이 같은 자리에서 아무것도 하지 않는다
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

type FocusTarget = { hasAttribute(name: string): boolean; setAttribute(name: string, value: string): void; focus(options?: FocusOptions): void }
type FocusRoot = { isConnected?: boolean; querySelector(selector: string): unknown }
type FocusDoc = { activeElement: unknown; body: unknown }

/**
 * 공개 상태 영역으로 포커스를 옮긴다(T-0183). 해설 버튼이 사라진 바로 그 커밋에서 부르면 body 에 머무는 프레임이 없다.
 * 학습자가 다른 곳으로 옮긴 포커스(연결된 body 아닌 요소)는 빼앗지 않는다. 옮겼으면 true.
 */
export function placeRevealFocus(root: FocusRoot | null, status: RevealState['status'], doc: FocusDoc): boolean {
  if (status === 'hidden' || !root || root.isConnected === false) return false
  const active = doc.activeElement as { isConnected?: boolean } | null
  if (active && active !== doc.body && active.isConnected !== false) return false
  const order = status === 'shown' ? ['[data-revealed]', '[data-reveal-choice]'] : status === 'error' ? ['[data-reveal-error]', '[data-reveal-status]'] : ['[data-reveal-loading]', '[data-reveal-status]']
  const target = order.map((s) => root.querySelector(s) as FocusTarget | null).find(Boolean)
  if (!target) return false
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  return true
}

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

  // 요청을 시작한 판단 도구(shell) — 요청 시점에 잡는다(버튼은 공개 뒤 DOM 에서 빠져 closest 로 다시 찾을 수 없다)
  const origin = useRef<Element | null>(null)

  // 로딩 중 재요청 차단 — 버튼은 disabled 대신 aria-disabled 라(포커스 유지) 눌려도 여기서 막는다
  const inflight = useRef<string | null>(null)

  const request = useCallback(async () => {
    const at = revealBinding(item)
    if (inflight.current === at) return
    inflight.current = at
    origin.current = typeof document !== 'undefined' ? document.activeElement?.closest('[data-judgment-shell]') ?? null : null
    const my = ++seq.current
    setHeld({ bind: at, state: { status: 'loading' } })
    const settle = (state: RevealState) => {
      if (inflight.current === at) inflight.current = null
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

  // 포커스 보존(T-0151 디자인 수용 측정에서 발견) — 해설 버튼이 로딩 · 공개 · 오류에서 사라지면 포커스가 body 로 떨어진다.
  // 학습자가 다른 곳으로 옮기지 않았다면 지금 상태의 영역(로딩 문구 · 해설 · 오류)으로 옮긴다. 스크롤은 옮기지 않는다(preventScroll).
  // 레이아웃 단계(그리기 전)에서 옮긴다 — 이전의 다음 프레임 이동은 1~2프레임 body 포커스를 남겼다(T-0182 실측, T-0183).
  const status = state.status
  useIsoLayoutEffect(() => {
    placeRevealFocus(origin.current, status, document)
  }, [status])

  return { state, request }
}

export const REVEAL_ERROR_TEXT: Record<RevealFailure, string> = {
  fetch: '해설을 불러오지 못했다. 다시 시도할 수 있다.',
  version: '해설 판본이 이 원문 판본과 달라 근거 연결을 보여 주지 않는다.',
  shape: '해설 자료 형식이 올바르지 않아 보여 주지 않는다.',
  auth: '해설은 로그인한 뒤에 볼 수 있다.',
  held: '이 시험은 지금 정답 공개가 보류돼 해설을 열 수 없다.',
}
