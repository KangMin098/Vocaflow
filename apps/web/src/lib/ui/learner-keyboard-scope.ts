// apps/web/src/lib/ui/learner-keyboard-scope.ts
/** A PC learner modal owns keyboard input; session shortcuts must not rate/exit behind it. */
export function learnerModalOwnsKeyboard(): boolean {
  return window.matchMedia('(min-width: 1024px)').matches
    && !!document.querySelector('[data-learner-pc-color="tines"]')
    && !!document.querySelector('[role="dialog"][aria-modal="true"]')
}

const NATIVE_KEY_OWNER = 'input, textarea, select, button, a[href], [role="button"], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'

/**
 * 키를 받은 곳이 제 키를 쓰는 기본 조작부(입력 · 선택 · 단추 · 링크 · 편집 영역)인가.
 * 그렇다면 화면 전역 단축키는 키를 먹지 않는다 — 포커스된 단추의 Space/Enter 는 그 단추를 눌러야 한다(2026-10-28 WordVault 반례).
 */
export function nativeControlOwnsKey(target: EventTarget | null): boolean {
  const el = target as (Element & { isContentEditable?: boolean }) | null
  if (!el || typeof el.closest !== 'function') return false
  if (el.isContentEditable) return true
  return el.closest(NATIVE_KEY_OWNER) !== null
}
