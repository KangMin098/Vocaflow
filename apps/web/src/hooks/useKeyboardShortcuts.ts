// apps/web/src/hooks/useKeyboardShortcuts.ts

'use client'

import { useEffect } from 'react'

interface KeyboardShortcuts {
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onSpace?: () => void
  onBookmark?: () => void
  onInsight?: () => void
  onFocusMode?: () => void
  onEscape?: () => void
}

export function useKeyboardShortcuts(handlers: KeyboardShortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 입력 필드에서는 비활성
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isCmd = e.metaKey || e.ctrlKey

      // Cmd+. → Insight
      if (isCmd && e.key === '.') {
        e.preventDefault()
        handlers.onInsight?.()
        return
      }

      // Cmd+F → Focus Mode
      if (isCmd && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        handlers.onFocusMode?.()
        return
      }

      // Esc → close all
      if (e.key === 'Escape') {
        handlers.onEscape?.()
        return
      }

      // ← / →
      if (e.key === 'ArrowLeft' && !isCmd) {
        e.preventDefault()
        handlers.onArrowLeft?.()
        return
      }
      if (e.key === 'ArrowRight' && !isCmd) {
        e.preventDefault()
        handlers.onArrowRight?.()
        return
      }

      // Space → Play/Pause
      if (e.key === ' ' && target.tagName !== 'BUTTON') {
        e.preventDefault()
        handlers.onSpace?.()
        return
      }

      // B → Bookmark
      if (e.key.toLowerCase() === 'b' && !isCmd) {
        e.preventDefault()
        handlers.onBookmark?.()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handlers])
}
