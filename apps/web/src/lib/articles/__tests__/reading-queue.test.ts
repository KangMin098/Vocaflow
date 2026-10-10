// apps/web/src/lib/articles/__tests__/reading-queue.test.ts
// apps/web/src/lib/articles/__tests__/reading-queue.test.ts
import { describe, expect, it } from 'vitest'
import { isReadingAdaptationSourceId } from '../reading-queue'

describe('generic ACP reading queue boundary', () => {
  it('holds reading children and preserves ordinary or null source IDs', () => {
    expect(isReadingAdaptationSourceId('reading:source:target')).toBe(true)
    expect(isReadingAdaptationSourceId('adapt:source:3')).toBe(false)
    expect(isReadingAdaptationSourceId(null)).toBe(false)
  })
})
