// apps/web/src/lib/csat/session/__tests__/memory-idb.ts
//
// store.ts 가 쓰는 IndexedDB 동작(open · get · put · getAllKeys · clear)만 흉내 내는 메모리 대역.
// fake-indexeddb 의존성이 없어 T-0172 공용 기기 시험이 쓴다. `stores()` 는 시험마다 바뀌는 저장소 맵을 돌려준다.

export function memoryIndexedDB(stores: () => Map<string, Map<string, unknown>>) {
  const later = (fn: () => void) => { void Promise.resolve().then(fn) }
  return {
    open: () => {
      const req: Record<string, unknown> & { result?: unknown } = {}
      later(() => {
        const db = {
          objectStoreNames: { contains: (n: string) => stores().has(n) },
          createObjectStore: (n: string) => { stores().set(n, new Map()) },
          close: () => {},
          transaction: (name: string) => {
            const tx: Record<string, unknown> = {}
            const store = stores().get(name) ?? new Map<string, unknown>()
            stores().set(name, store)
            const request = (value: () => unknown) => {
              const r: Record<string, unknown> = {}
              later(() => {
                r.result = value()
                later(() => (tx.oncomplete as (() => void) | undefined)?.())
              })
              return r
            }
            tx.objectStore = () => ({
              get: (k: string) => request(() => structuredClone(store.get(k))),
              put: (v: unknown, k: string) => request(() => { store.set(k, structuredClone(v)); return k }),
              getAllKeys: () => request(() => [...store.keys()]),
              clear: () => request(() => { store.clear() }),
            })
            return tx
          },
        }
        req.result = db
        if (!stores().has('record')) (req.onupgradeneeded as (() => void) | undefined)?.()
        ;(req.onsuccess as (() => void) | undefined)?.()
      })
      return req
    },
  }
}
