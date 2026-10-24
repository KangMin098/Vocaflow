// apps/web/src/components/csat/f08-proto/useProtoState.ts
//
// 세 후보가 같은 상태 모델을 쓴다 — 후보 사이 차이가 상태가 아니라 **화면 구조와 조작 순서**에서만 나오게.
// 상태는 후보별 sessionStorage 에 남아 다른 화면에 갔다 와도 판단·근거·강의 위치·스크롤이 돌아온다.

'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'

import type { CandidateId, OwnMark, ProtoReveal } from '@/lib/csat/f08-proto/types'

export interface Revision { n: number; from: OwnMark | null; to: OwnMark; afterReveal: boolean }

export interface ProtoState {
  activeChoice: number | null
  marks: Record<number, OwnMark>
  links: Record<number, number[]>
  /** 선지 × 조건 확인 — B 후보의 조건 대조표 */
  conditions: Record<string, 'met' | 'unmet' | 'unsure'>
  linking: boolean
  scopeOn: boolean
  tool: string | null
  compare: number[]
  cue: number
  revisions: Revision[]
  reveal: ProtoReveal | null
  scrollY: number
}

const INITIAL: ProtoState = {
  activeChoice: null, marks: {}, links: {}, conditions: {}, linking: false, scopeOn: false, tool: null,
  compare: [], cue: 0, revisions: [], reveal: null, scrollY: 0,
}

export type Action =
  | { type: 'choose'; n: number | null }
  | { type: 'mark'; n: number; mark: OwnMark }
  | { type: 'toggleLink'; n: number; sentence: number }
  | { type: 'condition'; key: string; value: 'met' | 'unmet' | 'unsure' }
  | { type: 'linking'; on: boolean }
  | { type: 'scope'; on: boolean }
  | { type: 'tool'; tool: string | null }
  | { type: 'compare'; n: number }
  | { type: 'cue'; index: number }
  | { type: 'reveal'; reveal: ProtoReveal }
  | { type: 'scroll'; y: number }
  | { type: 'reset' }
  | { type: 'restore'; state: ProtoState }

export function reducer(s: ProtoState, a: Action): ProtoState {
  switch (a.type) {
    case 'choose':
      return { ...s, activeChoice: a.n, linking: a.n === null ? false : s.linking }
    case 'mark': {
      const from = s.marks[a.n] ?? null
      if (from === a.mark) return s
      return { ...s, marks: { ...s.marks, [a.n]: a.mark }, revisions: [...s.revisions, { n: a.n, from, to: a.mark, afterReveal: !!s.reveal }] }
    }
    case 'toggleLink': {
      const cur = s.links[a.n] ?? []
      const next = cur.includes(a.sentence) ? cur.filter((x) => x !== a.sentence) : [...cur, a.sentence].sort((x, y) => x - y)
      return { ...s, links: { ...s.links, [a.n]: next } }
    }
    case 'condition':
      return { ...s, conditions: { ...s.conditions, [a.key]: a.value } }
    case 'linking':
      return { ...s, linking: a.on }
    case 'scope':
      return { ...s, scopeOn: a.on }
    case 'tool':
      return { ...s, tool: a.tool }
    case 'compare': {
      if (s.compare.includes(a.n)) return { ...s, compare: s.compare.filter((x) => x !== a.n) }
      return { ...s, compare: [...s.compare, a.n].slice(-2) }
    }
    case 'cue':
      return { ...s, cue: a.index }
    case 'reveal':
      return { ...s, reveal: a.reveal }
    case 'scroll':
      return { ...s, scrollY: a.y }
    case 'reset':
      return INITIAL
    case 'restore':
      return { ...INITIAL, ...a.state }
  }
}

export function storageKey(candidate: CandidateId, itemId: string): string {
  return `f08proto:${candidate}:${itemId}`
}

export function useProtoState(candidate: CandidateId, itemId: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  // 복원이 끝나기 전에는 저장하지 않는다 — dev StrictMode 가 effect 를 두 번 돌리면 초기 상태가 저장본을 덮었다.
  const [ready, setReady] = useState(false)
  const key = storageKey(candidate, itemId)

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key)
      if (raw) {
        const saved = JSON.parse(raw) as ProtoState
        dispatch({ type: 'restore', state: saved })
        requestAnimationFrame(() => window.scrollTo(0, saved.scrollY ?? 0))
      }
    } catch {
      /* 저장소가 막혀 있으면 새로 시작한다 */
    }
    setReady(true)
  }, [key])

  useEffect(() => {
    if (!ready) return
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* 저장 실패는 화면 동작을 막지 않는다 */
    }
  }, [key, state, ready])

  useEffect(() => {
    let t: number | undefined
    const onScroll = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => dispatch({ type: 'scroll', y: window.scrollY }), 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const reset = useCallback(() => {
    try { window.sessionStorage.removeItem(key) } catch { /* 무시 */ }
    dispatch({ type: 'reset' })
  }, [key])

  return { state, dispatch, reset }
}
