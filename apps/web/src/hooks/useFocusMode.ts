// apps/web/src/hooks/useFocusMode.ts

'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { PREFS_CHANGE_EVENT, readPrefs } from '@/lib/settings/device-prefs'

const IDLE_TIMEOUT_MS = 30_000 // 30초 무활동 → 자동 진입

export function useFocusMode() {
  const pathname = usePathname()
  const [isFocusMode, setIsFocusMode] = useState(false)

  // 설정의 「집중 모드」 토글이 실제로 여기를 움직인다 (2026-09-05 전까지는 토글이
  // 어디에도 닿지 않았다). 끄면 **자동 진입만** 멈춘다 — 손으로 켜는 것은 그대로다.
  // 첫 렌더는 서버와 같은 값(true)이어야 하므로 마운트 뒤에 저장값으로 맞춘다.
  const [autoEnter, setAutoEnter] = useState(true)
  useEffect(() => {
    const sync = () => setAutoEnter(readPrefs().focusMode)
    sync()
    window.addEventListener(PREFS_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const enable = useCallback(() => setIsFocusMode(true), [])
  const disable = useCallback(() => setIsFocusMode(false), [])
  const toggle = useCallback(() => setIsFocusMode((o) => !o), [])

  // 라우트 변경 시 강제 reset (이전 페이지 stale 차단)
  useEffect(() => {
    setIsFocusMode(false)
    document.body.classList.remove('focus-mode')
  }, [pathname])

  // body 클래스 동기화 — 항상 cleanup 보장
  useEffect(() => {
    if (isFocusMode) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
    return () => document.body.classList.remove('focus-mode')
  }, [isFocusMode])

  // 30초 무활동 → 자동 진입 (설정에서 껐으면 타이머를 걸지 않는다)
  useEffect(() => {
    if (!autoEnter) return
    let idleTimer: NodeJS.Timeout | null = null

    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        if (!isFocusMode) enable()
      }, IDLE_TIMEOUT_MS)
    }

    const handleActivity = () => resetTimer()

    document.addEventListener('mousemove', handleActivity)
    document.addEventListener('keydown', handleActivity)
    document.addEventListener('scroll', handleActivity, { passive: true })

    resetTimer()

    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      document.removeEventListener('mousemove', handleActivity)
      document.removeEventListener('keydown', handleActivity)
      document.removeEventListener('scroll', handleActivity)
    }
  }, [isFocusMode, enable, autoEnter])

  // 마우스 상단 이동 시 자동 해제
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY < 80 && isFocusMode) disable()
    }
    document.addEventListener('mousemove', handler)
    return () => document.removeEventListener('mousemove', handler)
  }, [isFocusMode, disable])

  return { isFocusMode, enable, disable, toggle }
}
