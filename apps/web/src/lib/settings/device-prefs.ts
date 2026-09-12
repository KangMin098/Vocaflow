// apps/web/src/lib/settings/device-prefs.ts
//
// **기기 취향의 단일 출처** — 고른 값을 실제로 저장하고 읽는 자리.
//
// ── 왜 생겼나 (실측 2026-09-05) ──────────────────────────────────────
// `/settings` 의 컨트롤 11개가 전부 `useState` 였다. 무엇을 바꾸든 화면 우측 상단에
// **「저장됨」이 뜨는데 어디에도 저장되지 않았고**, 새로고침하면 전부 원래대로였다.
// 테마 세그먼트도 그중 하나라, 로그인한 학습자에게는 앱 전체에 테마를 바꿀 수단이
// 사실상 없었다(진짜로 동작하는 토글은 로그인 화면에만 있었다).
//
// 저장되지 않는 것을 「저장됨」이라 말하는 화면은 고장보다 나쁘다 — 학습자는 자기가
// 잘못 눌렀다고 생각한다.
//
// ── 무엇을 여기에 두고 무엇을 두지 않는가 ────────────────────────────
// **기기에 남는 취향만** 둔다(테마 · 모션 · 음성 · 학습 표시). 이것들은 계정이 아니라
// 그 브라우저의 성질이고, 서버 왕복 없이 즉시 적용되는 편이 옳다.
//
// 계정에 남아야 하는 것(학급·목표 등)은 여기 두지 않는다. 그리고 **보낼 길이 없는 것은
// 아예 저장하지 않는다** — 알림 3종은 이 저장소에 발송 경로가 0개다
// (web-push · 서비스워커 · 메일 발송 코드가 없다). 저장해 두면 "켰는데 안 온다" 가 된다.
//
// ⚠️ 테마 키는 `app/layout.tsx` 의 선행 스크립트 · `hooks/useTheme.ts` ·
//    `app/(auth)/layout.tsx` 와 **같은 값**이어야 한다. 달라지면 한쪽이 칠한 것을
//    다른 쪽이 덮어 깜빡인다(인증 화면에서 이미 한 번 겪었다).

'use client'

import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'vocaflow-theme'
/** 테마 외 기기 취향을 한 덩이 JSON 으로 — 키가 늘 때마다 저장소 키가 늘지 않게. */
export const PREFS_STORAGE_KEY = 'vocaflow-prefs'
export const PREFS_CHANGE_EVENT = 'vocaflow:prefs-change'

export type ThemePreference = 'light' | 'dark' | 'system'

/** 저장되는 기기 취향. 여기 없는 것은 저장되지 않는다 — 화면도 그렇게 말해야 한다. */
export interface DevicePrefs {
  /** 학습 중 사이드바를 흐리게 — `hooks/useFocusMode.ts` 가 읽는다. */
  focusMode: boolean
  /** 단어 목록에 기억 4색을 칠할지. 끄면 색 대신 글자만 남는다. */
  memoryDecayColors: boolean
  /** 인출 대기 시간 — 플래시카드가 뜻을 가려 두는 길이. */
  recallDelay: 'short' | 'normal' | 'long'
  ttsEnabled: boolean
  ttsSpeed: number
}

export const DEFAULT_PREFS: DevicePrefs = {
  focusMode: true,
  memoryDecayColors: true,
  recallDelay: 'normal',
  ttsEnabled: true,
  ttsSpeed: 1.0,
}

// ── 테마 ────────────────────────────────────────────────────────────

function osPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** 칠하고 저장한다. **저장에 실패하면 false** — 화면이 「저장됨」을 말해도 되는지의 근거다. */
export function applyThemePreference(pref: ThemePreference): boolean {
  if (typeof document === 'undefined') return false
  const resolved = pref === 'system' ? (osPrefersDark() ? 'dark' : 'light') : pref
  document.documentElement.setAttribute('data-theme', resolved)
  let saved = false
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, pref)
    saved = true
  } catch {
    saved = false
  }
  window.dispatchEvent(new CustomEvent(PREFS_CHANGE_EVENT))
  return saved
}

/**
 * 설정 화면이 쓰는 테마 훅.
 *
 * 첫 렌더는 **반드시 서버와 같은 값**('system')이어야 한다 — 마운트 뒤에 실제 값으로
 * 맞춘다. 그러지 않으면 하이드레이션이 어긋나 세그먼트가 한 프레임 잘못 켜진다.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setPreferenceState(readThemePreference())
    sync()
    setReady(true)
    window.addEventListener(PREFS_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    // 'system' 인 동안 OS 가 바뀌면 따라간다 — 안 그러면 고른 순간의 값에 굳는다.
    const onOs = () => {
      if (readThemePreference() === 'system') applyThemePreference('system')
    }
    mq?.addEventListener('change', onOs)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
      mq?.removeEventListener('change', onOs)
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference): boolean => {
    setPreferenceState(next)
    return applyThemePreference(next)
  }, [])

  return { preference, setPreference, ready }
}

// ── 나머지 기기 취향 ────────────────────────────────────────────────

export function readPrefs(): DevicePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<DevicePrefs> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS
    // 저장값을 그대로 믿지 않는다 — 옛 판이나 손으로 고친 값이 섞일 수 있다.
    return {
      focusMode: typeof parsed.focusMode === 'boolean' ? parsed.focusMode : DEFAULT_PREFS.focusMode,
      memoryDecayColors:
        typeof parsed.memoryDecayColors === 'boolean'
          ? parsed.memoryDecayColors
          : DEFAULT_PREFS.memoryDecayColors,
      recallDelay:
        parsed.recallDelay === 'short' ||
        parsed.recallDelay === 'normal' ||
        parsed.recallDelay === 'long'
          ? parsed.recallDelay
          : DEFAULT_PREFS.recallDelay,
      ttsEnabled:
        typeof parsed.ttsEnabled === 'boolean' ? parsed.ttsEnabled : DEFAULT_PREFS.ttsEnabled,
      ttsSpeed:
        typeof parsed.ttsSpeed === 'number' && parsed.ttsSpeed >= 0.5 && parsed.ttsSpeed <= 2
          ? parsed.ttsSpeed
          : DEFAULT_PREFS.ttsSpeed,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** 한 항목을 바꿔 저장한다. **저장 실패 시 false.** */
export function writePref<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]): boolean {
  if (typeof window === 'undefined') return false
  const next = { ...readPrefs(), [key]: value }
  let saved = false
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next))
    saved = true
  } catch {
    saved = false
  }
  window.dispatchEvent(new CustomEvent(PREFS_CHANGE_EVENT))
  return saved
}

/** 설정 화면이 쓰는 훅. 테마와 같은 이유로 첫 렌더는 기본값에서 시작한다. */
export function useDevicePrefs() {
  const [prefs, setPrefs] = useState<DevicePrefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setPrefs(readPrefs())
    sync()
    setReady(true)
    window.addEventListener(PREFS_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const set = useCallback(<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]): boolean => {
    setPrefs((p) => ({ ...p, [key]: value }))
    return writePref(key, value)
  }, [])

  return { prefs, set, ready }
}
