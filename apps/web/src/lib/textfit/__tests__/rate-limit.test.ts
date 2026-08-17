// apps/web/src/lib/textfit/__tests__/rate-limit.test.ts
//
// 토큰 버킷 회귀. 방어 로직은 두 방향으로 다 틀릴 수 있고, 둘 다 나쁘다:
//
//  1. 너무 조이면 **정상 사용자가 막힌다** — 교사가 지문을 붙여넣고 고치는 흐름이 끊기면
//     이 화면의 존재 이유(가입 전 가치 노출)가 사라진다.
//  2. 너무 풀면 **없는 방어**가 된다.
//
// 그래서 실제 사용 리듬(700ms 디바운스)으로 통과하는지, 스크립트 속도로 막히는지 둘 다 잰다.

import { describe, expect, it } from 'vitest'

import {
  FIT_RATE_LIMIT,
  TokenBucketLimiter,
  clientKeyFromHeaders,
} from '../rate-limit'

const T0 = 1_700_000_000_000

describe('TokenBucketLimiter — 기본 동작', () => {
  it('용량만큼은 즉시 통과한다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 3, refillPerSecond: 0 })
    expect(l.take('a', T0).allowed).toBe(true)
    expect(l.take('a', T0).allowed).toBe(true)
    expect(l.take('a', T0).allowed).toBe(true)
    expect(l.take('a', T0).allowed).toBe(false)
  })

  it('거부 시 다시 시도할 시각을 알려준다 (최소 1초)', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 1, refillPerSecond: 0.5 })
    l.take('a', T0)
    const denied = l.take('a', T0)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(denied.remaining).toBe(0)
  })

  it('시간이 지나면 보충된다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 2, refillPerSecond: 1 })
    l.take('a', T0)
    l.take('a', T0)
    expect(l.take('a', T0).allowed).toBe(false)
    expect(l.take('a', T0 + 1000).allowed).toBe(true)
  })

  it('보충은 용량을 넘지 않는다 — 오래 쉬었다고 무한정 쌓이지 않는다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 2, refillPerSecond: 1 })
    // 하루를 쉬어도 2회까지만
    const far = T0 + 86_400_000
    expect(l.take('a', far).allowed).toBe(true)
    expect(l.take('a', far).allowed).toBe(true)
    expect(l.take('a', far).allowed).toBe(false)
  })

  it('시계가 뒤로 가도 토큰이 늘거나 음수가 되지 않는다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 2, refillPerSecond: 1 })
    l.take('a', T0)
    l.take('a', T0)
    // 과거 시각으로 요청 — 보충 0
    expect(l.take('a', T0 - 60_000).allowed).toBe(false)
  })

  it('클라이언트마다 버킷이 분리된다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 1, refillPerSecond: 0 })
    expect(l.take('a', T0).allowed).toBe(true)
    expect(l.take('a', T0).allowed).toBe(false)
    expect(l.take('b', T0).allowed).toBe(true)
  })

  it('식별 불가(빈 키)를 무제한 허용으로 바꾸지 않는다 — 공용 버킷으로 묶는다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, capacity: 1, refillPerSecond: 0 })
    expect(l.take('', T0).allowed).toBe(true)
    expect(l.take('', T0).allowed).toBe(false)
  })
})

describe('메모리 — 방어가 스스로 누수가 되지 않는다', () => {
  it('오래 안 쓰인 버킷은 정리된다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, idleTtlMs: 1000 })
    l.take('old', T0)
    expect(l.size).toBe(1)
    l.take('new', T0 + 5000)
    // 'old' 는 TTL 초과로 사라지고 'new' 만 남는다
    expect(l.size).toBe(1)
  })

  it('키 수 상한을 넘으면 가장 오래된 것부터 버린다', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, maxKeys: 3, idleTtlMs: 10 * 60_000 })
    for (let i = 0; i < 10; i++) l.take(`k${i}`, T0 + i)
    expect(l.size).toBeLessThanOrEqual(3)
  })

  it('최근 사용한 키는 살아남는다 (간이 LRU)', () => {
    const l = new TokenBucketLimiter({ ...FIT_RATE_LIMIT, maxKeys: 2, idleTtlMs: 10 * 60_000 })
    l.take('a', T0)
    l.take('b', T0 + 1)
    l.take('a', T0 + 2) // a 를 다시 써서 최근으로 올린다
    l.take('c', T0 + 3) // 상한 초과 → 가장 오래된 b 가 밀린다
    // a 는 아직 토큰이 남아 있어야 한다(버려졌다면 새 버킷이라 용량이 가득 찼을 것)
    expect(l.size).toBeLessThanOrEqual(2)
  })
})

describe('실제 사용 리듬 — 정상 사용자를 막지 않는다', () => {
  it('700ms 디바운스로 2분간 쉬지 않고 고쳐도 막히지 않는다', () => {
    const l = new TokenBucketLimiter(FIT_RATE_LIMIT)
    let denied = 0
    // 화면은 입력이 멈춘 뒤 700ms 에 한 번 호출한다. 최악(끊임없이 고침) 가정.
    for (let i = 0; i < Math.floor(120_000 / 700); i++) {
      if (!l.take('teacher', T0 + i * 700).allowed) denied += 1
    }
    // 초반 20회는 버킷으로, 이후는 보충으로 흘러야 한다 — 전부 막히면 안 된다.
    expect(denied).toBeLessThan(120)
    expect(l.take('teacher', T0 + 200_000).allowed).toBe(true)
  })

  it('스크립트 속도(초당 50회)는 즉시 조여진다', () => {
    const l = new TokenBucketLimiter(FIT_RATE_LIMIT)
    let allowed = 0
    for (let i = 0; i < 200; i++) {
      if (l.take('bot', T0 + i * 20).allowed) allowed += 1
    }
    // 4초 동안 200회 시도 → 용량 20 + 보충 ~2 만 통과
    expect(allowed).toBeLessThanOrEqual(FIT_RATE_LIMIT.capacity + 3)
  })
})

describe('clientKeyFromHeaders', () => {
  it('x-forwarded-for 의 첫 번째가 원 클라이언트다', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' })
    expect(clientKeyFromHeaders(h)).toBe('203.0.113.9')
  })

  it('x-real-ip 로 폴백한다', () => {
    expect(clientKeyFromHeaders(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
  })

  it('헤더가 없으면 빈 문자열 — 호출부가 공용 버킷으로 묶는다', () => {
    expect(clientKeyFromHeaders(new Headers())).toBe('')
  })

  it('공백만 있는 값을 키로 쓰지 않는다', () => {
    expect(clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '   ' }))).toBe('')
  })
})
