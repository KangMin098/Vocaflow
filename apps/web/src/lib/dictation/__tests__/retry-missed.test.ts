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
  it('조각 하나라도 규칙 밖이면 나누지 않는다 — 짧은 인용 「He said "Stop!"」 이 빠지지 않는다(리뷰 r3 P2)', () => {
    const s = 'He said "Stop!" Then he walked back to the old house.'
    expect(missedSentences([at(0, s, 0, true)])).toEqual([s])
    expect(missedRetryPayload('글', [at(0, s, 0, true)])?.sentences).toEqual([s])
  })
  it('22문장 — 모두 그대로 22개', () => {
    const many = Array.from({ length: 22 }, (_, k) => at(k, `The garden near the school looked different on day number ${k + 1} of the trip.`, 50))
    expect(missedSentences(many)).toHaveLength(22)
  })
  it('제목과 문장 배열 — 이어 붙이지 않는다', () => {
    const r = missedRetryPayload('강의', [at(0, B, 50), at(1, C, 0, true)])
    expect(r).toEqual({ title: '강의 · 틀린 문장 다시', sentences: [B, C] })
  })
})

// ── 규칙표(runtime/team-pilot-20261028/pb-t0221-split-rules.md rev 1) 전 행 ──
const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean))
const sameWords = (input: string[], output: string[]) => {
  const i = words(input.join(' ')), o = words(output.join(' '))
  return i.size === o.size && [...i].every((w) => o.has(w))
}
const STOP = 'He said "Stop!" Then he walked back to the old house.'
const L27 = 'After a long and difficult week at the factory the workers finally gathered in the small hall to hear what the new manager wanted to tell them.'
const L32 = 'When the long winter finally ended and the snow began to melt across the valley the farmers returned to their fields to prepare the soil for planting long before the spring rains.'
const L40 = 'The committee met every Thursday evening in the back room of the public library to argue about the budget the schedule the new building and the many small problems that nobody else in the whole town wanted to think about.'
describe('규칙표 rev 1 — 제거 0', () => {
  const rows: Array<[string, string[], string[]]> = [
    ['R1 짧은+긴 묶음(r3 반례)', [`${STOP} ${L27}`], [STOP, L27]],
    ['R2 따옴표 두 유효 문장', [`${Q1} ${Q2}`], [Q1, Q2]],
    ['R3 약어', ['Mr. Brown walked to the station before the morning train left.'], ['Mr. Brown walked to the station before the morning train left.']],
    ['R5 Stop 단독', [STOP], [STOP]],
    ['R6 세 문장 묶음', [`${A} ${B} ${C}`], [A, B, C]],
    ['R7 상한 초과 단일 문장', [L40], [L40]],
    // 뒤에 B 가 있어 나눌 수 있는 문항이지만, 3단어 조각을 L32 와 합치면 35단어 → 문항 전체를 나누지 않는다
    ['R8 합치면 상한 초과 → 나누지 않음', [`He said "Stop!" ${L32} ${B}`], [`He said "Stop!" ${L32} ${B}`]],
    ['R9 끝 조각이 짧음 → 앞과 합침', ['She looked at the door and finally whispered the word, "Go!"'], ['She looked at the door and finally whispered the word, "Go!"']],
  ]
  for (const [name, input, expected] of rows) {
    it(name, () => {
      const out = missedSentences(input.map((x, k) => at(k, x, 0, true)))
      expect(out).toEqual(expected)
      expect(sameWords(input, out)).toBe(true)
      expect(missedRetryPayload('t', input.map((x, k) => at(k, x, 0, true)))?.sentences.length).toBe(expected.length)
    })
  }
  it('R1 의 단어 수 전제 — 11 · 27 · 합 34 초과', () => {
    expect(STOP.split(/\s+/).length).toBe(11)
    expect(L27.split(/\s+/).length).toBe(27)
    expect(L32.split(/\s+/).length).toBe(32)
    expect(L40.split(/\s+/).length).toBe(40)
  })
  it('R4 22문장 — 22개 · 단어 집합 같음', () => {
    const input = Array.from({ length: 22 }, (_, k) => `The garden near the school looked different on day number ${k + 1} of the trip.`)
    const out = missedSentences(input.map((x, k) => at(k, x, 50)))
    expect(out).toEqual(input)
    expect(sameWords(input, out)).toBe(true)
  })
  it('R10 같은 문장 반복 — 한 번만(단어 집합은 같음)', () => {
    const out = missedSentences([at(0, B, 0, true), at(1, B, 30)])
    expect(out).toEqual([B])
    expect(sameWords([B, B], out)).toBe(true)
  })
  it('상한 초과 문항도 재시도 자료에서 걸러지지 않는다(keepAll) — 일반 붙여넣기 필터는 그대로', async () => {
    const g = globalThis as unknown as { window?: { sessionStorage: MemoryStorage } }
    g.window = { sessionStorage: new MemoryStorage() }
    try {
      stashMissedRetry('user-a', missedRetryPayload('긴 글', [at(0, L40, 0, true), at(1, `${STOP} ${L27}`, 20)])!)
      const src = await resolveMissedRetrySource(stubClient().client as never, 'user-a')
      expect(src?.sentences.map((s) => s.text)).toEqual([L40, STOP, L27])
    } finally {
      delete g.window
    }
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
