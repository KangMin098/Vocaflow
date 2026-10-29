// apps/web/src/lib/dictation/__tests__/retry-missed.test.ts
// @vitest-environment node
// T-0221 — 결과의 틀림·건너뜀 **원래 문항 그대로** 다시 받아쓰기(T0221_RETRY_UNIT_DECISION_20261029).
// 고르기 → 계정 봉투 → 실제 소비(resolveMissedRetrySource) → 실제 문항 조립(createDictationSession · buildItems)까지:
// 선택한 expected 전체 = 설정 자료 단위 = 시작 문항, 문자열 삭제 0 · 계정 가드 · 쓰기 0.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ startedItems: [] as string[][], writes: [] as string[] }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/dictation/storage', () => ({ saveSession: () => true, getSession: () => null }))
vi.mock('@/lib/dictation/persist', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dictation/persist')>('@/lib/dictation/persist')
  return {
    ...actual,
    // 실제 문항 조립(buildItems) 결과가 여기로 온다 — DB 대신 기록만
    startDictationSession: async (_c: unknown, _s: unknown, _cfg: unknown, _n: number, items: Array<{ expectedText: string }>) => {
      h.startedItems.push(items.map((i) => i.expectedText))
      return { id: 'local-test', persisted: false, identityChanged: false }
    },
  }
})

import {
  isMissedAttempt,
  missedItems,
  missedRetryPayload,
  MISSED_RETRY_HREF,
  MISSED_RETRY_KEY,
  readMissedRetry,
  resolveMissedRetrySource,
  stashMissedRetry,
  type MissedAttemptInput,
} from '../retry-missed'
import { CUSTOM_SCRIPT_KEY, resolveDictationSource, stashCustomScript } from '../source'
import { createDictationSession } from '@/hooks/dictation/useDictationSession'
import type { DictationConfig } from '../types'

const A = 'The river was quiet in the early morning light.'
const B = 'She opened the window and listened to the birds.'
const C = 'Nobody in the village knew where the old road went.'
const STOP = 'He said "Stop!" Then he walked back to the old house.'
const W25 = 'The old woman watched the children playing quietly in the garden beside the school while her husband carefully repaired the wooden gate near the road.'
const Q1 = 'The old man looked out across the empty field and said, "We will plant the corn again next spring."'
const Q2 = 'His daughter shook her head slowly and answered, "The ground is too dry for anything to grow here."'
const PAREN = 'The guide pointed at the map (the old one from the museum.) Everyone leaned closer to see the river.'
const ABBR = 'Mr. Brown walked to the station before the morning train left.'

const at = (itemIdx: number, expected: string, accuracy: number, skipped = false): MissedAttemptInput => ({ itemIdx, expected, accuracy, skipped })
const CONFIG: DictationConfig = { chunkSize: 1, count: 'all', order: 'sequential', scoring: 'smart', cefr: 'B1', speed: 1, autoRepeat: 2, hintsAllowed: true, voice: '' }

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
const writes = (calls: string[]) => calls.filter((c) => /\.(insert|update|upsert|delete)$/.test(c) || c.startsWith('rpc.'))

const g = globalThis as unknown as { window?: { sessionStorage: MemoryStorage } }
beforeEach(() => { g.window = { sessionStorage: new MemoryStorage() }; h.startedItems.length = 0 })
afterEach(() => { delete g.window })

/** 결과(A) → 봉투 → 설정 소비 → 실제 문항 조립. 각 단계의 단위 목록을 돌려준다. */
async function endToEnd(attempts: MissedAttemptInput[]) {
  const payload = missedRetryPayload('원래 글', attempts)
  if (!payload) return null
  stashMissedRetry('user-a', payload)
  const { client, calls } = stubClient()
  const src = await resolveMissedRetrySource(client as never, 'user-a')
  const session = src ? await createDictationSession(src, CONFIG, null, 'user-a') : null
  return { selected: payload.items, setup: src?.sentences.map((s) => s.text) ?? [], started: h.startedItems.at(-1) ?? [], session, writes: writes(calls) }
}

describe('고르기 — 원래 문항 그대로', () => {
  it('정확도 100 이면 맞힘 · 100 미만이거나 건너뜀이면 다시 대상', () => {
    expect(isMissedAttempt(at(0, A, 100))).toBe(false)
    expect(isMissedAttempt(at(0, A, 99.5))).toBe(true)
    expect(isMissedAttempt(at(0, A, 0, true))).toBe(true)
  })
  it('모두 맞힌 결과는 null — 단추를 그리지 않는다', () => {
    expect(missedRetryPayload('글', [at(0, A, 100), at(1, B, 100)])).toBeNull()
    expect(missedRetryPayload('글', [])).toBeNull()
  })
  it('문항 순서 · 같은 expected 는 한 번만 · 바깥 공백만 제거 · 나누지 않는다', () => {
    expect(missedItems([at(2, C, 40), at(0, A, 100), at(1, `  ${A} ${B}  `, 0, true), at(3, C, 70)])).toEqual([`${A} ${B}`, C])
  })
  it('제목은 「· 틀린 문항 다시」', () => {
    expect(missedRetryPayload('강의', [at(0, B, 50)])?.title).toBe('강의 · 틀린 문항 다시')
  })
})

describe('선택한 expected 전체 = 설정 자료 단위 = 실제 시작 문항 · 삭제 0', () => {
  const cases: Array<[string, string]> = [
    ['일반', B],
    ['닫는 인용', STOP],
    ['닫는 괄호', PAREN],
    ['약어', ABBR],
    ['36단어 두 문장 묶음(root 반례)', `${STOP} ${W25}`],
    ['긴 Q1+Q2 묶음', `${Q1} ${Q2}`],
    ['chunkSize=3 묶음', `${A} ${B} ${C}`],
  ]
  it('36단어 묶음 전제 — 11 + 25 = 36', () => {
    expect(`${STOP} ${W25}`.split(/\s+/).length).toBe(36)
  })
  for (const [name, expected] of cases) {
    it(name, async () => {
      const r = (await endToEnd([at(0, S1, 100), at(1, expected, 0, true)]))!
      expect(r.selected).toEqual([expected])
      expect(r.setup).toEqual([expected])
      expect(r.started).toEqual([expected])
      expect(r.writes).toEqual([])
    })
  }
  it('여러 경우를 한 번에 — 순서 그대로 전부', async () => {
    const all = cases.map(([, e]) => e)
    const r = (await endToEnd(all.map((e, k) => at(k, e, 0, true))))!
    expect(r.setup).toEqual(all)
    expect(r.started).toEqual(all)
  })
})
const S1 = 'This sentence was answered correctly and must not come back.'

describe('재시도 → 다시 건너뜀 → 재시도 · 22문항', () => {
  it('묶음 문항을 재시도에서 또 건너뛰어도 같은 전체 문항 그대로', async () => {
    const chunk = `${STOP} ${W25}`
    const first = (await endToEnd([at(0, chunk, 0, true)]))!
    // 첫 재시도의 문항 정답(expectedText)을 그대로 다시 건너뛴 결과로
    const second = (await endToEnd(first.started.map((e, k) => at(k, e, 0, true))))!
    expect(second.started).toEqual([chunk])
  })
  it('22문항 → 기본 전체 22문항(레벨 추천 수로 자르지 않음)', async () => {
    const many = Array.from({ length: 22 }, (_, k) => at(k, `The garden near the school looked different on day number ${k + 1} of the trip.`, 50))
    const r = (await endToEnd(many))!
    expect(r.selected).toHaveLength(22)
    expect(r.started).toHaveLength(22)
  })
})

describe('계정 봉투 · 소비 가드', () => {
  const storage = () => g.window!.sessionStorage
  it('붙여넣기 전역 키는 쓰지 않고, 경로는 ?retry=missed', () => {
    stashMissedRetry('user-a', missedRetryPayload('글', [at(0, B, 0, true)])!)
    expect(storage().getItem(CUSTOM_SCRIPT_KEY)).toBeNull()
    expect(MISSED_RETRY_HREF).toBe('/dictate/setup?retry=missed')
  })
  it('A→B: 꺼내지 않는다 — 조회 0 · 봉투 보존', async () => {
    stashMissedRetry('user-a', missedRetryPayload('A 의 글', [at(0, B, 0, true)])!)
    const { client, calls } = stubClient()
    expect(readMissedRetry('user-b')).toBeNull()
    expect(await resolveMissedRetrySource(client as never, 'user-b')).toBeNull()
    expect(calls).toEqual([])
    expect(storage().getItem(MISSED_RETRY_KEY)).toContain('user-a')
  })
  it('확인 전 · 로그아웃(null) · 빈 계정은 꺼내지 않는다', async () => {
    stashMissedRetry('user-a', missedRetryPayload('A 의 글', [at(0, B, 0, true)])!)
    for (const who of [null, '']) {
      expect(readMissedRetry(who)).toBeNull()
      expect(await resolveMissedRetrySource(stubClient().client as never, who)).toBeNull()
    }
  })
  it('주인 없는 생성은 봉투를 두지 않는다', () => {
    expect(stashMissedRetry(null, { title: 't', items: [B] })).toBe(false)
    expect(storage().getItem(MISSED_RETRY_KEY)).toBeNull()
  })
  it('깨진 · 옛 모양 · 빈/비문자열 항목 봉투는 거절', () => {
    for (const raw of [
      '{',
      JSON.stringify({ title: 't', items: [B] }),
      JSON.stringify({ v: 1, ownerId: 'user-a', title: 't', sentences: [B] }),
      JSON.stringify({ v: 2, title: 't', items: [B] }),
      JSON.stringify({ v: 2, ownerId: 'user-a', title: 't', items: [] }),
      JSON.stringify({ v: 2, ownerId: 'user-a', title: 't', items: [B, 3] }),
      JSON.stringify({ v: 2, ownerId: 'user-a', title: 't', items: [B, '  '] }),
    ]) {
      storage().setItem(MISSED_RETRY_KEY, raw)
      expect(readMissedRetry('user-a')).toBeNull()
    }
  })
  it('같은 탭 재진입: 같은 계정이면 같은 자료 · 그 사이 B 면 없음', async () => {
    stashMissedRetry('user-a', missedRetryPayload('글', [at(0, B, 0, true), at(1, C, 10)])!)
    const first = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
    const again = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
    expect(again?.sentences.map((s) => s.text)).toEqual(first?.sentences.map((s) => s.text))
    expect(await resolveMissedRetrySource(stubClient().client as never, 'user-b')).toBeNull()
  })
  it('원 결과 배열은 바뀌지 않는다', async () => {
    const attempts = [at(0, A, 100), at(1, B, 60), at(2, C, 0, true)]
    const before = JSON.stringify(attempts)
    await endToEnd(attempts)
    expect(JSON.stringify(attempts)).toBe(before)
  })
})

describe('일반 붙여넣기(?custom=1)는 그대로', () => {
  it('재시도 봉투를 읽지 않는다', async () => {
    stashMissedRetry('user-a', missedRetryPayload('글', [at(0, B, 0, true)])!)
    expect(await resolveDictationSource(stubClient().client as never, { custom: true, userId: 'user-a' })).toBeNull()
  })
  it('기존 문장 필터를 그대로 쓴다 — 34단어를 넘는 문장은 붙여넣기에서 여전히 빠진다', async () => {
    const long = `${W25.replace(/\.$/, '')} and then they all went home together slowly after dark that night.`
    expect(long.split(/\s+/).length).toBeGreaterThan(34)
    stashCustomScript({ title: '붙여넣기', script: `${B} ${long}` })
    const src = await resolveDictationSource(stubClient().client as never, { custom: true, userId: 'user-a' })
    expect(src?.sentences.map((s) => s.text)).toEqual([B])
  })
})
