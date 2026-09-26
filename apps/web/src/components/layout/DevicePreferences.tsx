// apps/web/src/components/layout/DevicePreferences.tsx
//
// **기기 취향을 실제로 적용하는 자리.**
//
// ── 왜 이것이 셸에 있나 (실측 2026-09-05) ────────────────────────────
// `/settings` 의 「모션 감소」는 React state 만 바꾸고 아무 일도 하지 않으면서
// 「저장됨」을 띄우고 있었다. 저장은 설정 화면이 하지만 **적용은 모든 화면에서**
// 되어야 하므로, 읽고 칠하는 쪽은 셸에 둔다(테마가 `app/layout.tsx` 의 인라인
// 스크립트에서 칠해지는 것과 같은 구조다).
//
// ── 왜 CSS 를 여기서 들고 있나 ───────────────────────────────────────
// `globals.css` 의 전역 규칙은 **OS 설정**(`prefers-reduced-motion`)에만 걸려 있다.
// 앱 안의 토글은 OS 를 바꿀 수 없으므로 별도 후크(`data-reduced-motion`)가 필요하고,
// 그 규칙이 이 컴포넌트의 존재 이유라 같은 파일에 둔다 — 떨어뜨리면 한쪽만 바뀐다.
//
// ⚠️ **끄기가 아니라 낮추기다**(CLAUDE.md 모션 예산).
//    · 전환 시간은 `--dur-fast` 로 낮추고, 전환 대상을 **움직이지 않는 속성**으로 제한한다
//      (이동·회전·크기는 중간 프레임 없이 최종값으로 간다. 페이드는 남는다).
//    · **여기 규칙은** `@keyframes` 를 건드리지 않는다. 스켈레톤·스피너는 장식이 아니라 상태
//      표시라, 멈추면 로딩 중인지 멈춘 건지 구별할 수 없다(globals.css §4.4 가 적어 둔 어긋남).
//
// ── `data-reduced-motion` 을 읽는 곳이 하나 더 있다 (2026-09-23) ───────
// `globals.css` §4.5 「살아 있는 표면」의 앰비언트 루프·시차(`.vf-float` · `.vf-flow` ·
// `.vf-breathe` · `.vf-parallax`)가 이 후크를 **선택자로** 본다 — 켜는 쪽에서
// `:root:not([data-reduced-motion='on'])` 로 걸러진다. 장식적 루프는 상태 표시가 아니므로
// 그쪽은 실제로 **멈춘다**(여기 전환 규칙과 다른 판단이고, 그래서 규칙도 그쪽에 있다).
// 이 파일이 후크 이름을 바꾸면 그 루프들이 조용히 안 꺼진다 — `motion-contract` 회귀가 센다.

'use client'

import { useCallback, useEffect, useState } from 'react'

export const MOTION_STORAGE_KEY = 'vocaflow-reduced-motion'
export const MOTION_CHANGE_EVENT = 'vocaflow:motion-change'

/** `system` = OS 설정을 따른다(키 없음). 학습자가 만지면 on/off 로 확정된다. */
export type MotionPreference = 'system' | 'on' | 'off'

const MOTION_ATTR = 'data-reduced-motion'

function osPrefersReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function readMotionPreference(): MotionPreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(MOTION_STORAGE_KEY)
    return stored === 'on' || stored === 'off' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function isReducedMotionActive(preference: MotionPreference): boolean {
  if (preference === 'on') return true
  if (preference === 'off') return false
  return osPrefersReduced()
}

/** 칠하고 저장한다. **저장 실패 시 false** — 화면이 "저장됨" 을 말해도 되는지의 근거. */
export function applyMotionPreference(preference: MotionPreference): boolean {
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  if (isReducedMotionActive(preference)) root.setAttribute(MOTION_ATTR, 'on')
  else root.removeAttribute(MOTION_ATTR)

  let saved = false
  try {
    if (preference === 'system') localStorage.removeItem(MOTION_STORAGE_KEY)
    else localStorage.setItem(MOTION_STORAGE_KEY, preference)
    saved = true
  } catch {
    saved = false
  }
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT))
  return saved
}

/** 설정 화면이 쓰는 훅. 첫 렌더는 서버와 같은 값이어야 하므로 'system' 에서 시작한다. */
export function useMotionPreference() {
  const [preference, setPreferenceState] = useState<MotionPreference>('system')
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = readMotionPreference()
      setPreferenceState(next)
      setActive(isReducedMotionActive(next))
    }
    sync()
    setReady(true)
    window.addEventListener(MOTION_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MOTION_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setPreference = useCallback((next: MotionPreference): boolean => {
    setPreferenceState(next)
    setActive(isReducedMotionActive(next))
    return applyMotionPreference(next)
  }, [])

  return { preference, active, setPreference, ready }
}

/**
 * 전환만 낮추고 keyframe 은 남기는 규칙. 위 머리 주석의 근거를 그대로 옮긴 것이다.
 *
 * `transform: none` 으로 지우지 않는 이유도 globals.css 와 같다 — 이 저장소는
 * `-translate-x-1/2` 로 중앙 정렬하는 요소가 많아 그렇게 하면 레이아웃이 무너진다.
 */
const REDUCED_MOTION_CSS = `
[data-reduced-motion='on'] *,
[data-reduced-motion='on'] *::before,
[data-reduced-motion='on'] *::after {
  transition-duration: var(--dur-fast) !important;
  transition-delay: 0ms !important;
  transition-property: opacity, color, background-color, border-color, outline-color,
    box-shadow, fill, stroke !important;
  scroll-behavior: auto !important;
}
`

/**
 * 셸에 한 번 놓인다. 저장된 취향을 칠하고, 그 취향을 실현하는 규칙을 싣는다.
 *
 * 테마는 `app/layout.tsx` 의 인라인 스크립트가 **첫 페인트 전에** 칠한다.
 * **모션도 이제 거기서 같이 칠한다**(2026-09-23) — `globals.css` §4.5 의 상시 루프가
 * 생기면서 "첫 프레임에 늦어도 된다" 가 더는 맞지 않게 됐다. 마운트 뒤에 칠하면
 * 모션을 끈 사람에게 **한 프레임 동안 삽화가 번쩍인다.**
 * 여기 `useEffect` 는 그 값을 **다시** 칠한다(같은 값이라 깜빡이지 않는다) — 선행
 * 스크립트가 막혔거나(CSP) localStorage 가 나중에 바뀐 경우의 안전망이고,
 * 아래 `matchMedia` 구독이 'system' 인 동안의 OS 변경을 계속 따라간다.
 */
export function DevicePreferences() {
  useEffect(() => {
    applyMotionPreference(readMotionPreference())
  }, [])

  useEffect(() => {
    // 'system' 인 동안 OS 설정이 바뀌면 따라간다 — 안 그러면 고른 순간의 값에 굳는다.
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => {
      if (readMotionPreference() === 'system') applyMotionPreference('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return <style dangerouslySetInnerHTML={{ __html: REDUCED_MOTION_CSS }} />
}
