// apps/web/src/lib/comic/__tests__/drain-display.test.ts
import { describe, expect, it } from 'vitest'
import { formatDrainTimestamp } from '../drain-display'

describe('drain timestamp presentation', () => {
  it('uses the same KST date for equivalent timestamps across a day boundary', () => {
    expect(formatDrainTimestamp('2026-10-19T16:02:03Z')).toBe('2026.10.20 01:02:03 KST')
    expect(formatDrainTimestamp('2026-10-20T01:02:03+09:00')).toBe('2026.10.20 01:02:03 KST')
  })
  it('does not invoke locale formatting whose punctuation differs between runtimes', () => {
    const previous = Date.prototype.toLocaleString
    Date.prototype.toLocaleString = () => { throw new Error('locale formatting is not deterministic') }
    try { expect(formatDrainTimestamp('2026-01-01T00:00:00Z')).toBe('2026.01.01 09:00:00 KST') }
    finally { Date.prototype.toLocaleString = previous }
  })
  it('keeps invalid timestamps visibly unmeasured', () => {
    expect(formatDrainTimestamp('invalid')).toBe('—')
  })
})
