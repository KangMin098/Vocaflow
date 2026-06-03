// apps/web/src/hooks/useFocusMode.ts

'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const IDLE_TIMEOUT_MS = 30_000 // 30초 무활동 → 자동 진입

export function useFocusMode() {
  const pathname = usePathname()
  const [isFocusMode, setIsFocusMode] = useState(false)

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

  // 30초 무활동 → 자동 진입
  useEffect(() => {
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
  }, [isFocusMode, enable])

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
