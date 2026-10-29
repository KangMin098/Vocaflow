// apps/web/src/lib/dictation/__tests__/retry-missed.test.ts
// @vitest-environment node
// T-0221 — 결과의 틀림·건너뜀 문장만 다시 받아쓰기: 문장 고르기 · 기존 붙여넣기 진입(stash → resolveDictationSource) 대역 흐름 · 쓰기 0.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isMissedAttempt, missedRetryScript, missedSentences, MISSED_RETRY_HREF, type MissedAttemptInput } from '../retry-missed'
import { CUSTOM_SCRIPT_KEY, resolveDictationSource, stashCustomScript } from '../source'
import { splitSentences } from '../text-splitter'

const A = 'The river was quiet in the early morning light.'
const B = 'She opened the window and listened to the birds.'
const C = 'Nobody in the village knew where the old road went.'
const D = 'He wrote the letter twice before he finally sent it'

const at = (itemIdx: number, expected: string, accuracy: number, skipped = false): MissedAttemptInput => ({
  itemIdx,
  expected,
  accuracy,
  skipped,
})

describe('틀림·건너뜀 판정', () => {
  it('정확도 100 이면 맞힘 · 100 미만이거나 건너뜀이면 다시 대상', () => {
    expect(isMissedAttempt(at(0, A, 100))).toBe(false)
    expect(isMissedAttempt(at(0, A, 99.5))).toBe(true)
    expect(isMissedAttempt(at(0, A, 0, true))).toBe(true)
    expect(isMissedAttempt(at(0, A, 100, true))).toBe(true)
  })
  it('모두 맞힌 결과는 null — 버튼을 그리지 않는다', () => {
    expect(missedRetryScript('글', [at(0, A, 100), at(1, B, 100)])).toBeNull()
    expect(missedRetryScript('글', [])).toBeNull()
  })
  it('문항 순서대로 · 같은 문장은 한 번만 · 맞힌 문장은 빠진다', () => {
    const list = missedSentences([at(2, C, 40), at(0, A, 100), at(1, B, 0, true), at(3, C, 70)])
    expect(list).toEqual([B, C])
  })
  it('묶음 문항(여러 문장)은 문장 단위로 펼친다', () => {
    expect(missedSentences([at(0, `${A} ${B}`, 80)])).toEqual([A, B])
  })
  it('다시 쪼개면 정확히 같은 문장들 — 끝 부호 없는 문장도 다음 문장과 붙지 않는다', () => {
    const r = missedRetryScript('강의', [at(0, D, 50), at(1, C, 0, true)])
    expect(r?.count).toBe(2)
    expect(r?.payload.title).toBe('강의 · 틀린 문장 다시')
    expect(splitSentences(r!.payload.script)).toEqual([`${D}.`, C])
  })
})

// ── 대역 흐름(integration stub) — 기존 붙여넣기 진입을 그대로 탄다 ──
class MemoryStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
function stubClient() {
  const calls: string[] = []
  const chain = (table: string): unknown => {
    const q: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'order', 'limit', 'in', 'ilike', 'or']) {
      q[op] = () => { calls.push(`${table}.${op}`); return q }
    }
    for (const op of ['insert', 'update', 'upsert', 'delete']) {
      q[op] = () => { calls.push(`${table}.${op}`); throw new Error(`write ${table}.${op}`) }
    }
    q.then = (res: (v: unknown) => unknown) => res({ data: [], error: null })
    return q
  }
  return { calls, client: { from: (t: string) => chain(t), rpc: (n: string) => { calls.push(`rpc.${n}`); return Promise.resolve({ data: [], error: null }) } } }
}

describe('대역 흐름 — 결과 → 기존 custom 진입 → 새 세션 자료', () => {
  const g = globalThis as unknown as { window?: { sessionStorage: MemoryStorage } }
  beforeEach(() => { g.window = { sessionStorage: new MemoryStorage() } })
  afterEach(() => { delete g.window })

  it('넘긴 문장들로만 자료가 만들어지고 DB 쓰기 0 · 원 결과 배열은 바뀌지 않는다', async () => {
    const attempts = [at(0, A, 100), at(1, B, 60), at(2, C, 0, true)]
    const before = JSON.stringify(attempts)
    const r = missedRetryScript('원래 글', attempts)!
    stashCustomScript(r.payload)
    expect(g.window!.sessionStorage.getItem(CUSTOM_SCRIPT_KEY)).toContain('틀린 문장 다시')
    expect(MISSED_RETRY_HREF).toBe('/dictate/setup?custom=1')

    const { client, calls } = stubClient()
    const src = await resolveDictationSource(client as never, { custom: true, userId: 'u-1' })
    expect(src?.kind).toBe('custom')
    expect(src?.sentences.map((s) => s.text)).toEqual([B, C])
    expect(calls.filter((c) => /\.(insert|update|upsert|delete)$/.test(c))).toEqual([])
    expect(JSON.stringify(attempts)).toBe(before)
  })
})
