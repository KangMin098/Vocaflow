// apps/web/src/lib/ui/learner-keyboard-scope.ts
/** A PC learner modal owns keyboard input; session shortcuts must not rate/exit behind it. */
export function learnerModalOwnsKeyboard(): boolean {
  return window.matchMedia('(min-width: 1024px)').matches
    && !!document.querySelector('[data-learner-pc-color="tines"]')
    && !!document.querySelector('[role="dialog"][aria-modal="true"]')
}
