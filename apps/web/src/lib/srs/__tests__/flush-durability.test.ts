// apps/web/src/lib/srs/__tests__/flush-durability.test.ts
//
// **평가는 탭보다 오래 산다** — 세션을 완주하지 않고 떠나도 남는가.
//
// 이 회귀는 실측 결함에서 나왔다(2026-09-05): flush 는 "완주" 에만 걸려 있었고 큐는
// `sessionStorage` 였다. 30장 중 12장을 평가하고 ✕ 로 나가면 그 12장은 같은 탭에서
// 다음 세션을 **끝까지** 마칠 때만 올라갔고, 탭을 닫으면 영구히 사라졌다.
//
// 여기서 재는 것은 세 가지다:
//   ① 큐가 `localStorage` 에 산다 (탭을 닫아도 남는다)
//   ② 옛 `sessionStorage` 큐를 **버리지 않고** 옮긴다
//   ③ 떠나는 순간 전송이 실제로 나가고, 나갔으면 큐를 비운다
//
// ⚠️ 서버의 멱등 가드(중복 적재 방지)는 DB 가 필요해 여기서 못 잰다 —
//    `flush-actions.ts` 주석에 근거를 남겼고, 그 검증은 통합 테스트의 몫이다.
//    **여기서 재지 않는 것을 잰 것처럼 세지 않는다.**

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
  clear() {
    this.map.clear()
  }
  get size() {
    return this.map.size
  }
}

const g = globalThis as unknown as Record<string, unknown>

/** Node 20+ 의 `navigator` 는 getter 전용이라 대입이 던진다 — 속성을 다시 정의한다. */
function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  })
}

let local: MemoryStorage
let session: MemoryStorage
let beaconCalls: { url: string; body: string }[]

beforeEach(() => {
  local = new MemoryStorage()
  session = new MemoryStorage()
  beaconCalls = []
  g.window = g.window ?? {}
  g.localStorage = local
  g.sessionStorage = session
  g.Blob = class {
    parts: unknown[]
    constructor(parts: unknown[]) {
      this.parts = parts
    }
    text() {
      return String(this.parts[0])
    }
  }
  // Node 20+ 의 `navigator` 는 **getter 전용** 전역이라 대입이 던진다 —
  // 스텁을 심으려면 속성 자체를 다시 정의해야 한다.
  setNavigator({
    sendBeacon: (url: string, blob: { parts: unknown[] }) => {
      beaconCalls.push({ url, body: String(blob.parts[0]) })
      return true
    },
  })
  vi.resetModules()
})

afterEach(() => {
  delete g.window
  delete g.localStorage
  delete g.sessionStorage
  delete (globalThis as unknown as Record<string, unknown>).navigator
  delete g.Blob
})

const item = (word: string, at: string) => ({
  cardId: `card-${word}`,
  word,
  cardUpdate: {},
  rating: 3,
  reviewedAt: at,
  module: 'flashcard',
})

describe('평가 대기열은 탭보다 오래 산다', () => {
  it('평가는 localStorage 에 쌓인다 — sessionStorage 가 아니다', async () => {
    const store = await import('../session-storage')
    store.pushPendingResult(item('science', '2026-09-05T01:00:00.000Z'))

    expect(local.getItem('srs_pending')).not.toBeNull()
    expect(session.getItem('srs_pending')).toBeNull()
    expect(store.getPendingResults()).toHaveLength(1)
  })

  it('옛 sessionStorage 큐를 버리지 않고 옮긴다', async () => {
    session.setItem('srs_pending', JSON.stringify([item('study', '2026-09-05T01:00:00.000Z')]))
    const store = await import('../session-storage')
    store.pushPendingResult(item('create', '2026-09-05T01:01:00.000Z'))

    const words = store.getPendingResults().map((p) => p.word).sort()
    expect(words).toEqual(['create', 'study'])
    // 옮긴 뒤에는 옛 자리를 비운다 — 안 비우면 다음 읽기에서 또 합쳐져 두 번 올라간다.
    expect(session.getItem('srs_pending')).toBeNull()
  })

  it('비우면 두 저장소 모두 비운다', async () => {
    session.setItem('srs_pending', JSON.stringify([item('abandon', '2026-09-05T01:00:00.000Z')]))
    const store = await import('../session-storage')
    store.pushPendingResult(item('effective', '2026-09-05T01:02:00.000Z'))
    store.clearPendingResults()

    expect(store.getPendingResults()).toEqual([])
    expect(local.getItem('srs_pending')).toBeNull()
    expect(session.getItem('srs_pending')).toBeNull()
  })
})

describe('떠나는 순간 전송', () => {
  it('큐가 있으면 beacon 으로 보내고 큐를 비운다', async () => {
    const store = await import('../session-storage')
    store.pushPendingResult(item('develop', '2026-09-05T02:00:00.000Z'))
    store.pushPendingResult(item('achieve', '2026-09-05T02:00:01.000Z'))

    const { flushOnLeave } = await import('../flush-session')
    flushOnLeave()

    expect(beaconCalls).toHaveLength(1)
    expect(beaconCalls[0].url).toBe('/api/srs/flush')
    const sent = JSON.parse(beaconCalls[0].body) as { items: { word: string }[] }
    expect(sent.items.map((i) => i.word)).toEqual(['develop', 'achieve'])
    // 응답을 못 받는 전송이므로 "성공 후 비우기" 가 불가능하다 — 보낸 즉시 비운다.
    // 이중 적용은 서버가 (vocabulary_id, attempted_at) 로 막는다.
    expect(store.getPendingResults()).toEqual([])
  })

  it('빈 큐면 아무것도 보내지 않는다', async () => {
    const { flushOnLeave } = await import('../flush-session')
    flushOnLeave()
    expect(beaconCalls).toHaveLength(0)
  })

  it('beacon 이 실패하면 큐를 지우지 않는다 — 유실을 만들지 않는다', async () => {
    setNavigator({ sendBeacon: () => false })
    // keepalive fetch 폴백도 막아 "보낼 길이 없는" 상황을 만든다.
    g.fetch = () => {
      throw new Error('offline')
    }
    const store = await import('../session-storage')
    store.pushPendingResult(item('fundamental', '2026-09-05T03:00:00.000Z'))

    const { flushOnLeave } = await import('../flush-session')
    flushOnLeave()

    expect(store.getPendingResults()).toHaveLength(1)
    delete g.fetch
  })
})
