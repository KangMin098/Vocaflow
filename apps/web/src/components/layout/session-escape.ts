// apps/web/src/components/layout/session-escape.ts
//
// Esc 소유권 — **여기 한 곳**에서 정한다.
//
// 왜 생겼나 (v08.7 결함 B1):
//   SessionFrame 은 풀스크린 세션에서 window keydown 으로 `Esc = 세션 닫기` 를 잡는다.
//   그런데 게임 6종(lexicon-estate · lexicon-hands · morpheme-rules · morphmerge ·
//   word-customs · spellforge)도 같은 키를 자기 조작으로 쓰고, 브리핑 본문과 화면의
//   <Kbd>Esc</Kbd> 로 학습자에게 **약속까지 해 두었다**. 두 리스너가 모두 발화해서
//   "카드를 내려놓는 **동시에** /arcade 로 튕겨 나가는" 사고가 났다 —
//   `preventDefault()` 는 기본 동작만 막을 뿐 다른 리스너를 막지 않는다.
//
// 규칙 (복제 금지 · 이 세 줄이 전부다):
//   1. 키 리스너는 **SessionFrame 하나뿐**이다. 게임은 리스너를 달지 않고 의사만 등록한다.
//   2. 등록한 핸들러가 `true` 를 돌려주면 = 세션이 그 Esc 를 **소비했다** → 셸은 물러난다.
//   3. `false` 를 돌려주면 = 지금은 취소할 것이 없다 → 셸이 세션을 닫는다.
//
//   그래서 "카드를 들고 있을 때만 Esc 가 내 것" 같은 상태 의존 소유권이 게임 안에서
//   자연스럽게 표현되고, Esc 로 나가는 것이 의도인 게임(wordfall-cadence · pirate-quest)도
//   같은 규칙 하나로 정리된다.
//
// 모듈 싱글턴인 이유: 풀스크린 세션은 한 번에 하나뿐이고, 컨텍스트로 만들면 셸 밖에서
// 렌더되는 게임(스토리북·브리핑 미리보기)에서 프로바이더 누락으로 조용히 깨진다.
// 여기서는 등록만 사라지고 셸이 없으면 아무 일도 일어나지 않는다.

'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

/** `true` = 이 Esc 를 세션이 소비했다(셸은 닫지 않는다). */
export type SessionEscapeHandler = () => boolean

const stack: SessionEscapeHandler[] = []
const subscribers = new Set<() => void>()

function notify() {
  for (const fn of subscribers) fn()
}

/** 세션이 Esc 를 쓰겠다고 등록. 해제 함수를 돌려준다. */
export function registerSessionEscape(handler: SessionEscapeHandler): () => void {
  stack.push(handler)
  notify()
  return () => {
    const i = stack.indexOf(handler)
    if (i >= 0) stack.splice(i, 1)
    notify()
  }
}

/**
 * 셸 전용 — 등록된 핸들러를 **나중 것부터** 물어본다.
 * 하나라도 소비하면 true. 아무도 안 쓰면 false 이고, 그때만 셸이 세션을 닫는다.
 */
export function consumeSessionEscape(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]!()) return true
  }
  return false
}

/**
 * 게임/세션에서 Esc 를 선언한다.
 *
 * @example
 *   useSessionEscape(() => {
 *     if (!heldCard) return false   // 취소할 것이 없다 — 셸이 닫게 둔다
 *     cancelAppraise()
 *     return true
 *   })
 */
export function useSessionEscape(handler: SessionEscapeHandler): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => registerSessionEscape(() => ref.current()), [])
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

/**
 * 지금 화면의 세션이 Esc 를 가져갔는가 — 셸이 닫기 버튼 라벨에서 "(Esc)" 를 뗄 때 쓴다.
 * (Esc 가 내 것이 아닌데 라벨이 그렇다고 말하면, 그 라벨이 곧 [B1] 과 같은 종류의 거짓이다.)
 */
export function useSessionEscapeClaimed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => stack.length > 0,
    () => false,
  )
}
