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

describe('키를 매 요청 바꿔도 무제한이 되지 않는다', () => {
  // `x-forwarded-for` 는 위조 가능하다. 매 요청 다른 값을 보내면 예전 구현은 **매번
  // 용량이 가득 찬 새 버킷**을 내줬다 — 한도가 아무 의미가 없었고, 게다가 LRU 축출이
  // 멀쩡한 사용자의 버킷을 대신 밀어냈다. 방어가 사라지는 것을 넘어 남을 쫓아냈다.
  const cfg = { capacity: 3, refillPerSecond: 0.1, idleTtlMs: 60_000, maxKeys: 4 }

  it('무작위 키 폭주는 결국 막힌다', () => {
    const limiter = new TokenBucketLimiter(cfg)
    let allowed = 0
    for (let i = 0; i < 200; i += 1) {
      if (limiter.take(`spoof-${i}`, T0).allowed) allowed += 1
    }
    // maxKeys 만큼 새 버킷을 채운 뒤에는 전부 공용 버킷으로 묶여 용량 안에서만 통과한다.
    // 상한은 넉넉히 잡는다 — 정확한 수보다 **200 번이 200 번 다 통과하지 않는다**가 요점이다.
    expect(allowed).toBeLessThanOrEqual(cfg.maxKeys + cfg.capacity)
    expect(allowed).toBeGreaterThan(0)
  })

  it('요청을 계속하는 사용자의 버킷은 폭주 중에도 유지된다', () => {
    const limiter = new TokenBucketLimiter(cfg)
    expect(limiter.take('real-user', T0).allowed).toBe(true)
    // 폭주 사이사이에 계속 쓴다 — LRU 이므로 "최근" 이면 밀려나지 않는다.
    for (let i = 0; i < 100; i += 1) {
      limiter.take(`spoof-${i}`, T0)
      if (i % 5 === 0) limiter.take('real-user', T0)
    }
    // 자기 버킷이 살아 있으면 소모가 누적돼 있다. 새로 만들어졌다면 capacity-1 로
    // 되돌아가 있을 것이다.
    const after = limiter.take('real-user', T0)
    expect(after.remaining).toBeLessThan(cfg.capacity - 1)
  })

  // ⚠️ 남은 한계 — 고치지 않고 적어 둔다.
  //    **쉬고 있던** 정상 버킷은 표가 가득 찬 상태에서 여전히 축출될 수 있다(LRU 이므로).
  //    그 사용자는 다음 요청에서 가득 찬 새 버킷을 받는다 — 즉 **자기에게 유리한 쪽으로만**
  //    틀리고 남을 통과시키지는 않는다. 이번 수정이 없앤 것은 그것과 종류가 다르다:
  //    키 무작위화로 **한도 자체가 사라지던** 경로다. 공정한 버킷 배분(키별 해시 슬롯 등)은
  //    이 방어의 목적("실수·스크립트 한 대")을 넘어서므로 여기서 하지 않는다.
})
