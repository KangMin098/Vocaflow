// apps/web/src/lib/ui/use-popover-focus.ts
// Anchored nonmodal panels: enter on open, restore on dismiss, allow Tab to leave.
'use client'

import { useEffect, type RefObject } from 'react'

export function usePopoverFocus(panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selected = panel.querySelector<HTMLElement>('[aria-current="page"], button[aria-pressed="true"]')
    const first = panel.querySelector<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')
    ;(selected ?? first)?.focus({ preventScroll: true })
    return () => {
      const current = document.activeElement
      // Preserve focus deliberately moved outside (e.g. Tab); a removed child leaves body active.
      if (opener?.isConnected && (panel.contains(current) || current === document.body)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [panelRef])
}
