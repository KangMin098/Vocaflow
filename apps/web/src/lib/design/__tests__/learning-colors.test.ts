// apps/web/src/lib/design/__tests__/learning-colors.test.ts
import { describe, expect, it } from 'vitest'
import { ACTIVITY_TINT, FACET_ACTIVITY, moduleActivityTint } from '../learning-colors'
import { getLearnerColorRole } from '../learner-palette'

describe('PC activity identity across entry and learning routes', () => {
  it('does not change recall identity when entering a different recall tool', () => {
    for (const [module, route] of [['flashcard', '/flashcard'], ['wordblitz', '/wordblitz'], ['pairflip', '/pairflip']] as const) {
      expect(moduleActivityTint(module)).toBe(ACTIVITY_TINT[FACET_ACTIVITY.recognize])
      expect(getLearnerColorRole(route)?.palette).toBe(moduleActivityTint(module))
    }
  })
  it('distinguishes constructing a form from selecting a known answer', () => {
    expect(FACET_ACTIVITY.build).toBe('produce')
    expect(ACTIVITY_TINT[FACET_ACTIVITY.build]).toBe(moduleActivityTint('spellforge'))
    expect(ACTIVITY_TINT[FACET_ACTIVITY.build]).not.toBe(moduleActivityTint('pairflip'))
  })
  it('keeps stored material identity but follows the task once a session starts', () => {
    expect(getLearnerColorRole('/wordvault')?.palette).toBe(moduleActivityTint('wordvault'))
    expect(getLearnerColorRole('/wordvault/study')?.palette).toBe(moduleActivityTint('flashcard'))
    expect(getLearnerColorRole('/library/textbooks/series/step/practice')?.palette).toBe(moduleActivityTint('scriptquiz'))
    expect(getLearnerColorRole('/dashboard')?.palette).toBe(moduleActivityTint('dashboard'))
  })
})
