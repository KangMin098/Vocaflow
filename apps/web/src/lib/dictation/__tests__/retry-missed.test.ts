// apps/web/src/lib/dictation/__tests__/retry-missed.test.ts
// @vitest-environment node
// T-0221 — 결과의 틀림·건너뜀 문장만 다시 받아쓰기: 문장 고르기 · 계정에 묶인 재시도 봉투 · 실제 소비 경로(resolveMissedRetrySource) 대역 흐름 · 쓰기 0.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isMissedAttempt,
  missedRetryPayload,
  missedSentences,
  MISSED_RETRY_HREF,
  MISSED_RETRY_KEY,
  readMissedRetry,
  resolveMissedRetrySource,
  stashMissedRetry,
  type MissedAttemptInput,
} from '../retry-missed'
import { CUSTOM_SCRIPT_KEY, resolveDictationSource } from '../source'

const A = 'The river was quiet in the early morning light.'
const B = 'She opened the window and listened to the birds.'
const C = 'Nobody in the village knew where the old road went.'
// 닫는 따옴표로 끝나는 긴 문장 둘 — 이어 붙였다 다시 쪼개면 경계를 잃고(합쳐 34단어 초과) 전부 걸러지던 반례(리뷰 P2)
const Q1 = 'The old man looked out across the empty field and said, "We will plant the corn again next spring."'
const Q2 = 'His daughter shook her head slowly and answered, "The ground is too dry for anything to grow here."'

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
  it('모두 맞힌 결과는 null — 단추를 그리지 않는다', () => {
    expect(missedRetryPayload('글', [at(0, A, 100), at(1, B, 100)])).toBeNull()
    expect(missedRetryPayload('글', [])).toBeNull()
  })
  it('문항 순서대로 · 같은 문장은 한 번만 · 맞힌 문장은 빠진다', () => {
    expect(missedSentences([at(2, C, 40), at(0, A, 100), at(1, B, 0, true), at(3, C, 70)])).toEqual([B, C])
  })
  it('묶음 문항(여러 문장)은 문장 단위로 펼친다', () => {
    expect(missedSentences([at(0, `${A} ${B}`, 80)])).toEqual([A, B])
  })
  it('재시도 뒤 다시 건너뜀 — 따옴표 문장 둘이 한 문항으로 묶여 저장돼도 원래 두 문장으로 되돌린다(리뷰 r2 P2)', () => {
    const chunk = `${Q1} ${Q2}`
    expect(missedSentences([at(0, chunk, 0, true)])).toEqual([Q1, Q2])
    expect(missedRetryPayload('대화 · 틀린 문장 다시', [at(0, chunk, 0, true)])?.sentences).toEqual([Q1, Q2])
  })
  it('따옴표 경계 보강은 약어를 쪼개지 않는다', () => {
    const s = 'Mr. Brown walked to the station before the morning train left.'
    expect(missedSentences([at(0, s, 0, true)])).toEqual([s])
  })
  it('제목과 문장 배열 — 이어 붙이지 않는다', () => {
    const r = missedRetryPayload('강의', [at(0, B, 50), at(1, C, 0, true)])
    expect(r).toEqual({ title: '강의 · 틀린 문장 다시', sentences: [B, C] })
  })
})

// ── 봉투 · 소비 대역 흐름(integration stub) ──
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

describe('대역 흐름 — 결과(A) → 계정 봉투 → 설정 화면 소비', () => {
  const g = globalThis as unknown as { window?: { sessionStorage: MemoryStorage } }
  beforeEach(() => { g.window = { sessionStorage: new MemoryStorage() } })
  afterEach(() => { delete g.window })
  const storage = () => g.window!.sessionStorage

  it('A→A: 넘긴 문장들로만 자료 · 쓰기 0 · 원 결과 불변 · 붙여넣기 전역 키는 건드리지 않는다', async () => {
    const attempts = [at(0, A, 100), at(1, B, 60), at(2, C, 0, true)]
    const before = JSON.stringify(attempts)
    expect(stashMissedRetry('user-a', missedRetryPayload('원래 글', attempts)!)).toBe(true)
    expect(storage().getItem(CUSTOM_SCRIPT_KEY)).toBeNull()
    expect(MISSED_RETRY_HREF).toBe('/dictate/setup?retry=missed')
    const { client, calls } = stubClient()
    const src = await resolveMissedRetrySource(client as never, 'user-a')
    expect(src?.kind).toBe('custom')
    expect(src?.title).toBe('원래 글 · 틀린 문장 다시')
    expect(src?.sentences.map((s) => s.text)).toEqual([B, C])
    expect(writes(calls)).toEqual([])
    expect(JSON.stringify(attempts)).toBe(before)
  })
  it('A→B: 같은 탭에서 B 로 바뀌면 A 의 문장·제목을 꺼내지 않는다 — 조회도 0 · 봉투는 지우지 않는다', async () => {
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
    expect(stashMissedRetry(null, { title: 't', sentences: [B] })).toBe(false)
    expect(storage().getItem(MISSED_RETRY_KEY)).toBeNull()
  })
  it('깨진 · 옛 모양 · 주인 없는 봉투는 거절', () => {
    for (const raw of ['{', JSON.stringify({ title: 't', sentences: [B] }), JSON.stringify({ v: 1, title: 't', sentences: [B] }), JSON.stringify({ v: 1, ownerId: 'user-a', title: 't', sentences: [B, 3] }), JSON.stringify({ v: 2, ownerId: 'user-a', title: 't', sentences: [B] })]) {
      storage().setItem(MISSED_RETRY_KEY, raw)
      expect(readMissedRetry('user-a')).toBeNull()
    }
  })
  it('같은 탭 재진입(새로 고침): 같은 계정이면 다시 같은 자료 · 그 사이 B 로 바뀌었으면 없음', async () => {
    stashMissedRetry('user-a', missedRetryPayload('글', [at(0, B, 0, true), at(1, C, 10)])!)
    const first = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
    const again = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
    expect(again?.sentences.map((s) => s.text)).toEqual(first?.sentences.map((s) => s.text))
    expect(await resolveMissedRetrySource(stubClient().client as never, 'user-b')).toBeNull()
  })
  it('일반 붙여넣기 진입(?custom=1)은 재시도 봉투를 읽지 않는다', async () => {
    stashMissedRetry('user-a', missedRetryPayload('글', [at(0, B, 0, true)])!)
    expect(await resolveDictationSource(stubClient().client as never, { custom: true, userId: 'user-a' })).toBeNull()
  })
  it('따옴표로 끝나는 긴 문장 둘 — 경계를 보존해 두 문장 그대로 · 단추 수 = 시작될 수', async () => {
    const p = missedRetryPayload('대화', [at(0, Q1, 40), at(1, Q2, 0, true)])!
    expect(p.sentences).toEqual([Q1, Q2])
    stashMissedRetry('user-a', p)
    const src = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
    expect(src?.sentences.map((s) => s.text)).toEqual([Q1, Q2])
    expect(src?.sentences.length).toBe(p.sentences.length)
  })
})
