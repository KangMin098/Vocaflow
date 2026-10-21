// apps/web/src/lib/ui/__tests__/learner-keyboard-scope.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerModalOwnsKeyboard } from '../learner-keyboard-scope'

afterEach(() => { vi.unstubAllGlobals() })
describe('learning shortcuts behind a modal', () => {
  it.each([
    { desktop: true, learner: true, modal: true, owns: true },
    { desktop: true, learner: true, modal: false, owns: false },
    { desktop: true, learner: false, modal: true, owns: false },
    { desktop: false, learner: true, modal: true, owns: false },
  ])('owns=$owns for desktop=$desktop learner=$learner modal=$modal', ({ desktop, learner, modal, owns }) => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: desktop }) })
    vi.stubGlobal('document', { querySelector: (selector: string) => selector.includes('data-learner') ? learner : modal })
    expect(learnerModalOwnsKeyboard()).toBe(owns)
  })
})
