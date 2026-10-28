// apps/web/src/components/csat/diagnosis/map/__tests__/task-proximity.test.ts
import { describe, expect, it } from 'vitest'
import { nearestTask } from '../task-proximity'

const cards = [
  { id: 'a', left: 20, right: 226, top: 20, bottom: 66 },
  { id: 'b', left: 20, right: 226, top: 80, bottom: 126 },
]
describe('TASK connection preview proximity', () => {
  it('finds a card inside it and just outside all four edges', () => {
    for (const [x, y] of [[100, 40], [8, 40], [238, 40], [100, 8], [100, 67]]) {
      expect(nearestTask({ x, y }, cards, 12)).toBe('a')
    }
  })
  it('chooses the nearer card between rows and uses real corner distance', () => {
    expect(nearestTask({ x: 100, y: 76 }, cards, 12)).toBe('b')
    expect(nearestTask({ x: 10, y: 10 }, cards, 12)).toBeNull()
  })
  it('clears beyond the reach and ignores hidden cards', () => {
    expect(nearestTask({ x: 7, y: 40 }, cards, 12)).toBeNull()
    expect(nearestTask({ x: 0, y: 0 }, [{ id: 'hidden', left: 0, right: 0, top: 0, bottom: 0 }], 12)).toBeNull()
  })
})
