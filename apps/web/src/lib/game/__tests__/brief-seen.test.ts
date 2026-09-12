// apps/web/src/lib/game/__tests__/brief-seen.test.ts
//
// 첫 플레이 브리핑 기록 회귀.
//
// 이 파일이 지키는 계약은 둘이다:
//   ① 저장이 막힌 환경(프라이빗 모드)에서도 **던지지 않는다** — 던지면 게임이 통째로 안 열린다.
//   ② 서버에서는 항상 "못 봤다" 다 — 렌더 중 호출하면 hydration 이 깨지므로, 그 사실을
//      테스트로 못 박아 두고 호출부(useBriefGate)는 effect 안에서만 묻는다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isBriefSeen, markBriefSeen, resetBriefSeen, seenCount } from '@/lib/game/brief-seen'

const KEY = 'vocaflow-brief-seen'

/** jsdom 없이 도는 환경이라 최소 localStorage 를 손으로 세운다. */
function installStorage(impl?: Partial<Storage>) {
  const store = new Map<string, string>()
  const base: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, v),
  }
  const storage = { ...base, ...impl } as Storage
  vi.stubGlobal('window', { localStorage: storage })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('브리핑 열람 기록', () => {
  // 블록 본문으로 둔다 — 화살표가 Storage 를 반환하면 vitest 가 그것을 cleanup 콜백으로 읽는다.
  beforeEach(() => {
    installStorage()
  })

  it('처음에는 아무것도 본 적이 없다', () => {
    expect(isBriefSeen('cascade')).toBe(false)
    expect(seenCount()).toBe(0)
  })

  it('표시하면 그 게임만 본 것이 된다', () => {
    markBriefSeen('cascade')
    expect(isBriefSeen('cascade')).toBe(true)
    expect(isBriefSeen('connections')).toBe(false)
    expect(seenCount()).toBe(1)
  })

  it('같은 게임을 두 번 표시해도 개수는 하나다', () => {
    markBriefSeen('cascade')
    markBriefSeen('cascade')
    expect(seenCount()).toBe(1)
  })

  it('리셋하면 전부 잊는다 — "튜토리얼 다시 보기"', () => {
    markBriefSeen('cascade')
    markBriefSeen('connections')
    expect(seenCount()).toBe(2)
    resetBriefSeen()
    expect(seenCount()).toBe(0)
    expect(isBriefSeen('cascade')).toBe(false)
  })
})

describe('망가진 저장소를 만나도 게임을 막지 않는다', () => {
  it('setItem 이 던져도 markBriefSeen 은 던지지 않는다 (프라이빗 모드)', () => {
    installStorage({
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
    })
    expect(() => markBriefSeen('cascade')).not.toThrow()
    // 기록이 안 됐으므로 다음에 또 보여 준다 — 성가시지만 안전한 쪽.
    expect(isBriefSeen('cascade')).toBe(false)
  })

  it('getItem 이 던져도 isBriefSeen 은 false 를 준다', () => {
    installStorage({
      getItem: () => {
        throw new DOMException('SecurityError')
      },
    })
    expect(() => isBriefSeen('cascade')).not.toThrow()
    expect(isBriefSeen('cascade')).toBe(false)
  })

  it('저장된 값이 JSON 이 아니어도 무너지지 않는다', () => {
    const s = installStorage()
    s.setItem(KEY, '{not json')
    expect(isBriefSeen('cascade')).toBe(false)
    expect(seenCount()).toBe(0)
  })

  it('저장된 값이 배열이면 무시한다 — 타입만 맞다고 믿지 않는다', () => {
    const s = installStorage()
    s.setItem(KEY, '["cascade"]')
    expect(isBriefSeen('cascade')).toBe(false)
  })

  it('removeItem 이 던져도 resetBriefSeen 은 던지지 않는다', () => {
    installStorage({
      removeItem: () => {
        throw new DOMException('SecurityError')
      },
    })
    expect(() => resetBriefSeen()).not.toThrow()
  })
})

describe('서버 렌더', () => {
  it('window 가 없으면 항상 false — 호출부는 effect 안에서만 물어야 한다', () => {
    vi.stubGlobal('window', undefined)
    expect(isBriefSeen('cascade')).toBe(false)
    expect(seenCount()).toBe(0)
    expect(() => markBriefSeen('cascade')).not.toThrow()
    expect(() => resetBriefSeen()).not.toThrow()
  })
})
