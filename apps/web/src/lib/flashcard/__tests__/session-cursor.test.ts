// apps/web/src/lib/flashcard/__tests__/session-cursor.test.ts
//
// **새로고침해도 하던 자리에서 이어진다** — 그리고 다른 큐·낡은 커서·끝난 세션에는 잇지 않는다.
//
// 이 회귀는 실측 결함에서 나왔다(2026-09-05): 진행 위치가 `useState(0)` 뿐이라 30장 중
// 12장을 평가하고 새로고침하면 1번부터 다시였다. 커서 하나면 되는데, 그 커서가 **잘못 이으면**
// (다른 큐의 12번째 · 어제의 12번째 · 이미 끝난 세션의 끝) 결함이 더 낯설어진다.
// 그래서 "잇는다" 보다 "잇지 않는다" 를 더 많이 잰다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

const g = globalThis as unknown as Record<string, unknown>
let local: MemoryStorage

beforeEach(() => {
  local = new MemoryStorage()
  g.window = g.window ?? {}
  g.localStorage = local
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-05T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  delete g.window
  delete g.localStorage
})

const Q = ['w1', 'w2', 'w3', 'w4', 'w5']

describe('이어보기 커서', () => {
  it('같은 큐면 저장한 자리에서 잇는다', async () => {
    const c = await import('../session-cursor')
    c.saveCursor(Q, 3)
    expect(c.resumeIndexFor(Q)).toBe(3)
  })

  it('큐가 다르면(단어·순서) 잇지 않는다 — 다른 큐의 3번째는 다른 단어다', async () => {
    const c = await import('../session-cursor')
    c.saveCursor(Q, 3)
    expect(c.resumeIndexFor(['w1', 'w2', 'w3', 'w4', 'w6'])).toBe(0)
    expect(c.resumeIndexFor(['w2', 'w1', 'w3', 'w4', 'w5'])).toBe(0)
    expect(c.resumeIndexFor(Q.slice(0, 4))).toBe(0)
  })

  it('6시간이 지난 커서는 잇지 않고 지운다', async () => {
    const c = await import('../session-cursor')
    c.saveCursor(Q, 2)
    vi.setSystemTime(new Date('2026-09-05T16:00:01.000Z'))
    expect(c.resumeIndexFor(Q)).toBe(0)
    expect(local.getItem('vocaflow-flashcard-cursor')).toBeNull()
  })

  it('끝을 넘긴 커서는 처음부터다 — 그대로 두면 완료 화면만 보인다', async () => {
    const c = await import('../session-cursor')
    c.saveCursor(Q, Q.length)
    expect(c.resumeIndexFor(Q)).toBe(0)
    expect(local.getItem('vocaflow-flashcard-cursor')).toBeNull()
  })

  it('지우면 잇지 않는다', async () => {
    const c = await import('../session-cursor')
    c.saveCursor(Q, 4)
    c.clearCursor()
    expect(c.resumeIndexFor(Q)).toBe(0)
  })

  it('망가진 저장값은 무시한다', async () => {
    local.setItem('vocaflow-flashcard-cursor', '{"queueKey":1,"idx":"x"}')
    const c = await import('../session-cursor')
    expect(c.resumeIndexFor(Q)).toBe(0)
    local.setItem('vocaflow-flashcard-cursor', 'not json')
    expect(c.resumeIndexFor(Q)).toBe(0)
  })
})
