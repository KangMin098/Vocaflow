// packages/library-pipeline/src/textbook/review-digest.test.ts
import { describe, expect, it } from 'vitest'

import {
  REVIEW_DIGEST_LENGTH,
  canonicalJson,
  freshnessOf,
  reviewDigest,
  tallyFreshReviews,
} from './review-digest'

const PAYLOAD = {
  sentences: ['A trend appeared.', 'It held for years.'],
  underlines: [
    { word: 'a', label: '①', sentenceIdx: 0 },
    { word: 'an', label: '②', sentenceIdx: 1 },
  ],
}
const KEY = { position: 2, original: 'a', explanation_ko: '② 가 틀렸다. 관사 규칙이다.' }

describe('canonicalJson — jsonb 왕복을 견딘다', () => {
  // ⚠️ 이 저장소가 실제로 빠진 함정이다 — Postgres 가 키를 다시 정렬해 저장해서,
  //   내용이 같은데 문자열이 달라 「같음」 판정이 한 번도 안 맞았다(802행이 불었다).
  it('키 순서가 달라도 같은 문자열이다', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
  })

  it('깊은 곳의 키 순서도 고른다', () => {
    expect(canonicalJson({ x: { p: 1, q: 2 } })).toBe(canonicalJson({ x: { q: 2, p: 1 } }))
  })

  it('배열 안 객체의 키도 고른다', () => {
    expect(canonicalJson([{ m: 1, n: 2 }])).toBe(canonicalJson([{ n: 2, m: 1 }]))
  })

  // ⚠️ 선지 ①~⑤ 와 밑줄 자리는 순서가 곧 내용이다 — 정렬하면 다른 문항이 된다.
  it('배열 순서는 건드리지 않는다', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })

  it('null 과 없는 키를 구별한다', () => {
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}))
  })
})

describe('reviewDigest', () => {
  it('sha256 hex 64자다', () => {
    const d = reviewDigest(PAYLOAD, KEY)
    expect(d).toHaveLength(REVIEW_DIGEST_LENGTH)
    expect(d).toMatch(/^[0-9a-f]{64}$/)
  })

  it('같은 내용이면 키 순서가 달라도 같은 판이다', () => {
    const shuffled = { explanation_ko: KEY.explanation_ko, original: KEY.original, position: KEY.position }
    expect(reviewDigest(PAYLOAD, shuffled)).toBe(reviewDigest(PAYLOAD, KEY))
  })

  // ⚠️ 이것이 이 모듈이 생긴 이유다 — 해설을 고치면 tutor 가 본 것이 바뀐다.
  it('해설이 바뀌면 판이 바뀐다', () => {
    const fixed = { ...KEY, explanation_ko: '② 가 틀렸다. 나머지 ① "a" 는 지문 그대로다.' }
    expect(reviewDigest(PAYLOAD, fixed)).not.toBe(reviewDigest(PAYLOAD, KEY))
  })

  it('지문이 바뀌면 판이 바뀐다', () => {
    const edited = { ...PAYLOAD, sentences: ['A trend appeared.', 'It faded.'] }
    expect(reviewDigest(edited, KEY)).not.toBe(reviewDigest(PAYLOAD, KEY))
  })

  it('정답 자리가 바뀌면 판이 바뀐다', () => {
    expect(reviewDigest(PAYLOAD, { ...KEY, position: 1 })).not.toBe(reviewDigest(PAYLOAD, KEY))
  })

  it('없는 값도 던지지 않고 판을 낸다', () => {
    expect(reviewDigest(null, null)).toMatch(/^[0-9a-f]{64}$/)
    expect(reviewDigest(undefined, undefined)).toBe(reviewDigest(null, null))
  })
})

describe('freshnessOf', () => {
  const now: ReadonlyMap<string, string> = new Map([['i1', 'aa'], ['i2', 'bb']])

  it('같은 판이면 current', () => {
    expect(freshnessOf({ item_id: 'i1', persona: 'setter', reviewed_digest: 'aa' }, now)).toBe('current')
  })

  it('다른 판이면 stale', () => {
    expect(freshnessOf({ item_id: 'i1', persona: 'setter', reviewed_digest: 'zz' }, now)).toBe('stale')
  })

  // ⚠️ 판 열이 생기기 전 516행이 여기 해당한다 — 「같다」로 뭉개면 안 읽은 것을 읽었다고 하게 된다.
  it('판 기록이 없으면 unknown — 같음으로 뭉개지 않는다', () => {
    expect(freshnessOf({ item_id: 'i1', persona: 'setter', reviewed_digest: null }, now)).toBe('unknown')
    expect(freshnessOf({ item_id: 'i1', persona: 'setter' }, now)).toBe('unknown')
  })

  it('그 문항의 지금 판을 모르면 unknown', () => {
    expect(freshnessOf({ item_id: 'zzz', persona: 'setter', reviewed_digest: 'aa' }, now)).toBe('unknown')
  })
})

describe('tallyFreshReviews — 지금 판으로만 센다', () => {
  const now: ReadonlyMap<string, string> = new Map([['i1', 'aa'], ['i2', 'aa'], ['i3', 'aa']])
  const trio = (id: string, verdict: string, digest: string | null) =>
    ['setter', 'analyst', 'tutor'].map((persona) => ({ item_id: id, persona, verdict, reviewed_digest: digest }))

  it('지금 판으로 3인이 pass 하면 통과로 센다', () => {
    expect(tallyFreshReviews(trio('i1', 'pass', 'aa'), now).passed).toBe(1)
  })

  // ⚠️ 실제로 일어난 일 — 고쳐도 영원히 안 풀렸다.
  it('낡은 fail 은 차단으로 세지 않는다 — 다시 볼 문항으로 센다', () => {
    const r = tallyFreshReviews(trio('i1', 'fail', 'old'), now)
    expect(r.passed).toBe(0)
    expect(r.settled).toBe(0)
    expect(r.stale).toBe(1)
  })

  it('낡은 pass 도 통과로 세지 않는다 — 안 읽은 것을 읽었다고 하지 않는다', () => {
    expect(tallyFreshReviews(trio('i1', 'pass', 'old'), now).passed).toBe(0)
  })

  it('판 기록이 없는 행은 unknown 으로만 센다', () => {
    const r = tallyFreshReviews(trio('i1', 'pass', null), now)
    expect(r.passed).toBe(0)
    expect(r.unknown).toBe(1)
    expect(r.stale).toBe(0)
  })

  it('같은 눈이 세 번 본 것은 3인이 아니다', () => {
    const rows = [1, 2, 3].map(() => ({ item_id: 'i1', persona: 'setter', verdict: 'pass', reviewed_digest: 'aa' }))
    expect(tallyFreshReviews(rows, now).passed).toBe(0)
  })

  it('한 문항에 두 판이 섞이면 지금 판이 이긴다 — 낡음 목록에서 뺀다', () => {
    const rows = [...trio('i1', 'fail', 'old'), ...trio('i1', 'pass', 'aa')]
    const r = tallyFreshReviews(rows, now)
    expect(r.passed).toBe(1)
    expect(r.stale).toBe(0)
  })

  it('문항마다 따로 센다', () => {
    const rows = [...trio('i1', 'pass', 'aa'), ...trio('i2', 'fail', 'old'), ...trio('i3', 'pass', null)]
    const r = tallyFreshReviews(rows, now)
    expect(r).toEqual({ passed: 1, settled: 1, stale: 1, unknown: 1 })
  })

  it('빈 입력에서 0 을 낸다', () => {
    expect(tallyFreshReviews([], now)).toEqual({ passed: 0, settled: 0, stale: 0, unknown: 0 })
  })
})
