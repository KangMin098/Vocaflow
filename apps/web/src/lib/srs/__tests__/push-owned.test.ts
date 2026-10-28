// apps/web/src/lib/srs/__tests__/push-owned.test.ts
// 새 평가는 판 주인의 큐에만 — 주인 미정이어도 긍정 확인된 판의 새 평가는 그 사람 몫으로 남고(유실 · 주인 없는 보류 없음),
// 주인이 다른 사람이면 넣지 않는다. 실제 session-storage(localStorage) 로 확인한다.
import { beforeEach, describe, expect, it } from 'vitest'

class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}
;(globalThis as unknown as { window: unknown }).window = globalThis
;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()

const { pushOwnedResult } = await import('../push-owned')
const { setSrsQueueOwner, getPendingResults } = await import('../session-storage')

const item = (word: string) => ({ cardId: word, word, cardUpdate: {}, rating: 3, reviewedAt: `2026-10-28T00:00:0${word.length % 10}.000Z`, module: 'spellforge' }) as never
const raw = () => JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { word: string; owner?: string }[]

beforeEach(() => {
  localStorage.clear()
  setSrsQueueOwner(null)
})

describe('pushOwnedResult', () => {
  it('주인 = 판 주인이면 그대로 넣는다', () => {
    setSrsQueueOwner('a')
    pushOwnedResult(item('harvest'), 'a')
    expect(raw()).toEqual([expect.objectContaining({ word: 'harvest', owner: 'a' })])
  })

  it('주인 미정 + 긍정 확인: 이 새 평가만 판 주인 몫으로 남고, 주인이 그 사람으로 정해지면 그 사람의 대기 평가로 읽힌다', () => {
    pushOwnedResult(item('harvest'), 'a')
    expect(raw()).toEqual([expect.objectContaining({ word: 'harvest', owner: 'a' })])
    setSrsQueueOwner('a')
    expect(getPendingResults().map((p) => p.word)).toEqual(['harvest'])
  })

  it('주인 미정 + 확인 안 됨(checking · changed)이면 넣지 않는다', () => {
    pushOwnedResult(item('harvest'), 'a', () => false)
    expect(raw()).toEqual([])
  })

  it('주인이 다른 사람이면 넣지 않는다 · 그 사람의 대기 평가에도 나타나지 않는다', () => {
    setSrsQueueOwner('b')
    pushOwnedResult(item('harvest'), 'a')
    expect(raw()).toEqual([])
    expect(getPendingResults()).toEqual([])
  })

  it('이미 있던 주인 없는 항목은 그대로 — 인수하지 않는다', () => {
    localStorage.setItem('srs_pending', JSON.stringify([{ cardId: 'old', word: 'old', cardUpdate: {}, rating: 3, reviewedAt: '2026-01-01T00:00:00.000Z', module: 'flashcard' }]))
    pushOwnedResult(item('harvest'), 'a')
    expect(raw()).toEqual([expect.objectContaining({ word: 'old' }), expect.objectContaining({ word: 'harvest', owner: 'a' })])
    expect(raw()[0].owner).toBeUndefined()
  })

  it('로그인 없이 한 판(viewer null) · 미지정은 기존 그대로', () => {
    pushOwnedResult(item('harvest'), null)
    pushOwnedResult(item('drought'), undefined)
    expect(raw().map((r) => r.owner)).toEqual([undefined, undefined])
  })
})
