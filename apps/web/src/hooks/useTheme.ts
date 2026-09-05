// apps/web/src/hooks/useTheme.ts
//
// 테마 정본 — **`localStorage['vocaflow-theme']` 하나**.
//
// ── 왜 이 파일이 커졌나 (실측 2026-09-05) ─────────────────────────────
// `/settings` 의 테마 세그먼트는 React state 만 바꾸고 **아무 데도 저장하지 않으면서**
// 「저장됨」 배지를 띄우고 있었다. 그래서 로그인한 학습자에게 테마를 바꿀 수단이
// **앱 전체에 없었다** — 실제로 동작하는 토글은 로그인/가입 화면(`app/(auth)/layout.tsx`)
// 에만 있어서, 다크로 바꾸려면 **로그아웃해야 했다.**
//
// ── 왜 'system' 이 키를 지우는 것인가 ─────────────────────────────────
// 첫 페인트를 담당하는 것은 `app/layout.tsx` 의 인라인 스크립트다. 그 스크립트는
//   stored || (prefersDark ? 'dark' : 'light')
// 로 판정한다. 즉 **키가 없는 상태가 곧 '시스템 따름'** 이다. 'system' 이라는 문자열을
// 저장하면 그 스크립트가 그걸 테마 이름으로 알고 `data-theme="system"` 을 쓴다 —
// 어떤 팔레트에도 해당하지 않아 화면이 조용히 라이트로 떨어진다.
// 그래서 저장 규약은 **light|dark 만 쓰고, system 은 지운다.**

'use client'

import { useCallback, useEffect, useState } from 'react'

/** 실제로 칠해지는 테마 — `data-theme` 에 들어갈 수 있는 값. */
export type ResolvedTheme = 'light' | 'dark'
/** 학습자가 고르는 값. `system` 은 저장하지 않는다(위 주석). */
export type ThemePreference = ResolvedTheme | 'system'

export const THEME_STORAGE_KEY = 'vocaflow-theme'

/** 테마가 바뀌었음을 같은 탭의 다른 컴포넌트에 알린다(`storage` 는 다른 탭에만 뜬다). */
export const THEME_CHANGE_EVENT = 'vocaflow:theme-change'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 저장된 선호. 읽기 실패(사파리 프라이빗 등)는 'system' 으로 접는다. */
export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

/**
 * 선호를 저장하고 즉시 칠한다. **저장이 실패하면 false 를 돌려준다** —
 * 화면이 "저장됨" 이라고 말해도 되는지 판단하는 근거가 이 반환값이다.
 */
export function applyThemePreference(preference: ThemePreference): boolean {
  if (typeof document === 'undefined') return false
  document.documentElement.setAttribute('data-theme', resolveTheme(preference))
  let saved = false
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
    saved = true
  } catch {
    saved = false
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT))
  return saved
}

/**
 * 학습자가 고른 값 그대로를 다루는 훅 — 세 갈래(Light·Dark·System) 컨트롤용.
 *
 * 첫 렌더는 서버와 같은 값('system')을 내야 hydration 이 어긋나지 않는다.
 * 실제 값은 마운트 뒤에 들어온다.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPreferenceState(readThemePreference())
    setReady(true)
    const sync = () => setPreferenceState(readThemePreference())
    window.addEventListener(THEME_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // 'system' 인 동안에는 OS 설정이 바뀌면 따라가야 한다 — 안 그러면 '시스템 따름' 이
  // 거짓말이 된다(고른 순간의 값에 굳는다).
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () =>
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference): boolean => {
    setPreferenceState(next)
    return applyThemePreference(next)
  }, [])

  return { preference, setPreference, ready, resolved: resolveTheme(preference) }
}

/**
 * 두 갈래 토글용 — 기존 호출부(`/text/new` · `/wordvault`)가 쓰는 모양 그대로다.
 * 여기서 토글하면 선호가 light|dark 로 **확정**된다(그것이 사용자의 명시 선택이다).
 */
export function useTheme() {
  const { preference, setPreference } = useThemePreference()
  const theme: ResolvedTheme = resolveTheme(preference)

  const toggleTheme = useCallback(() => {
    setPreference(theme === 'light' ? 'dark' : 'light')
  }, [theme, setPreference])

  return { theme, toggleTheme }
}
