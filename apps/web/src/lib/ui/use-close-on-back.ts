// apps/web/src/lib/ui/use-close-on-back.ts
'use client'

import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react'

interface Popup {
  id: string
  order: number
  active: boolean
  registered: boolean
  unwound: number
  barrier: boolean
  canClose: () => boolean
  openHref: () => string
  after: (() => void) | null
  href: string
  returnHref: string | undefined
  baseHref: string
  baseState: Record<string, unknown>
  closedHref?: string
}
const popups: Popup[] = []
const mounting = new Set<Popup>()
const handled = new WeakSet<PopStateEvent>()
let sequence = 0
let mountingQueued = false
let unwindTimer: ReturnType<typeof setTimeout> | null = null
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function ensurePendingBarrier() {
  const popup = popups.filter(p => p.active).at(-1)
  if (!popup || popup.barrier || popup.canClose() || window.history.state?.vocaflowOverlayId !== popup.id) return
  // The router reads location before later Window listeners. Keep one same-URL
  // entry above the dialog while pending, so ordinary Back cannot remove its query.
  popup.barrier = true
  window.history.pushState({ ...window.history.state, vocaflowPendingId: popup.id }, '', popup.openHref())
}

function restorePendingEntries(event: PopStateEvent) {
  const active = popups.filter(p => p.active)
  const target = active.findIndex(p => p.id === event.state?.vocaflowOverlayId)
  const push = (state: Record<string, unknown>, href: string) => {
    // Use Next's public History API path so its earlier popstate restoration is
    // followed by the selected URL, including when several entries were skipped.
    const { __NA, _N, ...rest } = state
    void __NA; void _N
    window.history.pushState(rest, '', href)
  }
  if (target < 0 && active.length && event.state?.vocaflowBaseId !== active[0].id) {
    // Preserve the saved router tree on this intermediate entry. The following
    // public push then copies that tree, rather than a traversed foreign route.
    window.history.pushState(active[0].baseState, '', active[0].baseHref)
  }
  if (target >= 0 && active[target].barrier && event.state?.vocaflowPendingId !== active[target].id) {
    push({ ...event.state, vocaflowPendingId: active[target].id }, active[target].openHref())
  }
  // A push prunes all skipped forward entries. Recreate every missing active
  // ancestor too, rather than counting a barrier whose normal entry is gone.
  for (const popup of active.slice(target + 1)) {
    const { vocaflowPendingId, ...state } = popup.baseState
    void vocaflowPendingId
    push({ ...state, vocaflowOverlay: true, vocaflowOverlayId: popup.id }, popup.openHref())
    if (popup.barrier) push({ ...window.history.state, vocaflowPendingId: popup.id }, popup.openHref())
    popup.unwound = 0
  }
  ensurePendingBarrier()
}

function registerPending() {
  if (mountingQueued) return
  mountingQueued = true
  queueMicrotask(() => {
    mountingQueued = false
    // Effects run child-first. Render order restores parent -> child history order.
    const batch = [...mounting].filter(p => p.active).sort((a, b) => a.order - b.order)
    mounting.clear()
    for (const popup of batch) {
      popup.registered = true
      popups.push(popup)
      // URL-selected dialogs need a closed-list entry below the overlay. If that
      // entry also contains selected=, Next can restore/reopen it before cleanup.
      const openHref = window.location.href
      let returnHref: URL | null = null
      try { returnHref = popup.returnHref ? new URL(popup.returnHref, openHref) : null } catch { /* Ignore an invalid optional return URL. */ }
      const anchor = returnHref && openHref === popup.href && returnHref.origin === window.location.origin &&
        returnHref.pathname === window.location.pathname && returnHref.href !== openHref
      if (anchor) window.history.replaceState(window.history.state, '', returnHref!.href)
      popup.baseHref = window.location.href
      popup.baseState = { ...window.history.state, vocaflowBaseId: popup.id }
      window.history.replaceState(popup.baseState, '', popup.baseHref)
      window.history.pushState({ ...window.history.state, vocaflowOverlay: true, vocaflowOverlayId: popup.id }, '', anchor ? openHref : '')
    }
    ensurePendingBarrier()
  })
}
function scheduleUnwind() {
  if (unwindTimer !== null) return
  unwindTimer = setTimeout(() => {
    unwindTimer = null
    const closing: Popup[] = []
    while (popups.length && !popups.at(-1)!.active) closing.push(popups.pop()!)
    const entries = closing.flatMap(p => Array.from({ length: Math.max(0, (p.barrier ? 2 : 1) - p.unwound) }, () => p))
    const changedRoute = closing.length > 0 && closing.every(p => new URL(p.href).pathname !== window.location.pathname)
    const replacedAfterClose = !closing.some(p => p.id === window.history.state?.vocaflowOverlayId) && closing.every(p =>
      p.closedHref !== window.location.href && p.baseHref !== window.location.href)
    if (entries.length && (changedRoute || replacedAfterClose)) {
      // A new navigation may have won the turn after close/focus restoration.
      // Its entry is above the closed popup: traversing now would undo that
      // navigation rather than remove the popup. Preserve the user's route.
      ensurePendingBarrier()
      return
    }
    const closedHref = window.location.href
    const changedQuery = entries.some(p => p.href !== closedHref && new URL(p.href).origin === window.location.origin && new URL(p.href).pathname === window.location.pathname)
    const after = () => {
      if (changedQuery) {
        // Closing may remove a selected= query before this traversal. Do not
        // resurrect it from the pre-overlay entry. Next's patched History API
        // must receive a non-internal state to synchronize useSearchParams too.
        const { __NA, _N, ...state } = window.history.state ?? {}
        void __NA; void _N
        window.history.replaceState(state, '', closedHref)
      }
      ensurePendingBarrier()
      closing.forEach(p => p.after?.())
    }
    if (!entries.length) { after(); return }
    // Coalesce a whole closing subtree into one traversal; never race history.back().
    window.addEventListener('popstate', after, { once: true })
    window.history.go(-entries.length)
  }, 0)
}
export interface CloseOnBackOptions {
  /** Same-page URL beneath a URL-selected dialog; retains filters and router state. */
  returnHref?: string
  /** Run navigation only after the popup history entry has actually been removed. */
  afterUnwindRef?: MutableRefObject<(() => void) | null>
  /** Pending operations may refuse closing without consuming their history entry. */
  canClose?: boolean
}
export function useCloseOnBack(open: boolean, onClose: () => void, options?: CloseOnBackOptions): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const canCloseRef = useRef(options?.canClose !== false)
  canCloseRef.current = options?.canClose !== false
  const afterRef = options?.afterUnwindRef
  const returnHrefRef = useRef(options?.returnHref)
  returnHrefRef.current = options?.returnHref
  const openHrefRef = useRef<string>()
  if (open && typeof window !== 'undefined') openHrefRef.current = window.location.href
  const identity = useRef<number>()
  if (identity.current === undefined) identity.current = ++sequence
  const instance = useRef<Popup>()
  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    // Reuse only this instance during StrictMode's cleanup/remount cycle.
    let popup = instance.current
    if (!popup || !popups.includes(popup)) {
      popup = { id: `vocaflow-popup-${identity.current}`, order: identity.current!, active: true, registered: false, unwound: 0, barrier: false, canClose: () => canCloseRef.current, openHref: () => openHrefRef.current ?? window.location.href, after: null, href: window.location.href, returnHref: returnHrefRef.current, baseHref: window.location.href, baseState: {} }
      instance.current = popup
      mounting.add(popup)
      registerPending()
    }
    popup.active = true
    const current = popup
    const onPop = (event: PopStateEvent) => {
      if (handled.has(event) || popups.filter(p => p.active).at(-1) !== current) return
      const ownEntry = event.state?.vocaflowOverlayId === current.id
      if (ownEntry && (!current.barrier || event.state?.vocaflowPendingId === current.id)) return
      handled.add(event)
      if (!canCloseRef.current) {
        restorePendingEntries(event)
        return
      }
      current.unwound = ownEntry ? 1 : current.barrier ? 2 : 1
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      current.active = false
      current.closedHref = window.location.href
      current.after = afterRef?.current ?? null
      if (afterRef) afterRef.current = null
      mounting.delete(current)
      if (current.registered) scheduleUnwind()
    }
  }, [open, afterRef])
  useClientLayoutEffect(() => {
    if (open && !canCloseRef.current) ensurePendingBarrier()
  }, [open, options?.canClose])
}
