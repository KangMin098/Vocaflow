// apps/web/src/lib/csat/__tests__/with-timeout.test.ts
//
// **느린 의존이 화면을 붙잡지 못하게 하는 장치.**
//
// 왜 이 테스트가 DB 를 안 쓰나: 이 장치가 필요한 이유가 바로 「DB 가 느릴 때」인데, 그 상황을
// 실 DB 로 재현하면 테스트 자체가 느려지고 환경에 따라 결과가 흔들린다. 시간은 여기서 가짜로
// 만들고, 실제 조회와의 연결은 통합 테스트가 본다.
//
// 실측 2026-09-05 에 이 장치 없이 조회 하나가 57초를 잡아먹어 현황판이 114초(두 번 걸림) 멈췄다.
// 그때 관리자는 새로고침을 누르고, 그 요청이 커넥션 풀을 더 조여 다음 요청을 더 느리게 만든다.

import { describe, expect, it } from 'vitest'

import { QUERY_TIMEOUT_MS, withDeadline, withTimeout } from '../factory-bench'

const later = <T>(v: T, ms: number) => new Promise<T>((r) => setTimeout(() => r(v), ms))

/** 조회 결과 모양 — count 는 못 셌을 때 null 이 된다. */
type Counted = { count: number | null }
const MISS: Counted = { count: null }

describe('withTimeout', () => {
  it('제때 오면 그 값을 그대로 준다', async () => {
    await expect(withTimeout(later<Counted>({ count: 7 }, 5), 200, MISS)).resolves.toEqual({
      count: 7,
    })
  })

  it('상한을 넘기면 대체값을 준다 — 기다리지 않는다', async () => {
    const t0 = Date.now()
    const got = await withTimeout(later<Counted>({ count: 7 }, 5_000), 50, MISS)
    expect(got).toEqual(MISS)
    // 상한 근처에서 끝나야 한다. 원래 조회(5초)를 기다렸으면 이 검사가 깨진다.
    expect(Date.now() - t0).toBeLessThan(1_000)
  })

  it('조회가 던져도 대체값으로 받는다 — 화면이 통째로 죽지 않는다', async () => {
    const boom = Promise.reject(new Error('connection reset'))
    await expect(withTimeout(boom, 200, MISS)).resolves.toEqual(MISS)
  })

  it('늦게 온 값이 대체값을 덮지 않는다 — 이미 그린 화면을 뒤바꾸면 안 된다', async () => {
    const got = await withTimeout(later<Counted>({ count: 7 }, 80), 20, MISS)
    expect(got).toEqual(MISS)
    // 원래 조회가 끝날 시간을 준 뒤에도 결과는 그대로다(값은 이미 확정됐다).
    await later(null, 120)
    expect(got).toEqual(MISS)
  })

  it('상한이 0 이어도 무한정 기다리지 않는다', async () => {
    await expect(withTimeout(later<Counted>({ count: 7 }, 1_000), 0, MISS)).resolves.toEqual({
      count: null,
    })
  })

  it('기본 상한은 사람이 기다릴 만한 값이다', () => {
    // 근거: 관리자 화면 하나가 여러 칸을 세므로, 칸 하나가 이보다 오래 걸리면 화면이 못 선다.
    // 너무 짧으면 멀쩡한 조회를 「못 잼」으로 버린다.
    expect(QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(2_000)
    expect(QUERY_TIMEOUT_MS).toBeLessThanOrEqual(10_000)
  })
})

describe('withDeadline — 기다리기만 멈추는 게 아니라 요청을 끊는다', () => {
  it('상한 안에 오면 그 값을 준다', async () => {
    const got = await withDeadline<Counted>(() => later<Counted>({ count: 3 }, 5), 200, MISS)
    expect(got).toEqual({ count: 3 })
  })

  it('상한을 넘기면 **취소 신호를 보낸다** — 버려진 요청이 커넥션을 쥐면 다음 요청이 느려진다', async () => {
    let aborted = false
    const got = await withDeadline<Counted>(
      (signal) =>
        new Promise<Counted>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true
            resolve(MISS)
          })
          setTimeout(() => resolve({ count: 3 }), 5_000)
        }),
      40,
      MISS,
    )
    expect(got).toEqual(MISS)
    expect(aborted, '취소 신호가 안 갔다 — 요청이 계속 살아 있다').toBe(true)
  })

  it('신호를 무시하는 조회여도 화면은 안 기다린다 — 시계와도 경주한다', async () => {
    const t0 = Date.now()
    const got = await withDeadline<Counted>(() => later<Counted>({ count: 3 }, 5_000), 40, MISS)
    expect(got).toEqual(MISS)
    expect(Date.now() - t0).toBeLessThan(1_000)
  })

  it('조회가 던져도 대체값으로 받는다', async () => {
    const got = await withDeadline<Counted>(() => Promise.reject(new Error('ECONNRESET')), 200, MISS)
    expect(got).toEqual(MISS)
  })

  it('성공한 뒤에도 신호를 보내 둔다 — 남은 재시도가 있으면 같이 끊긴다', async () => {
    let signalRef: AbortSignal | null = null
    await withDeadline<Counted>(
      (signal) => {
        signalRef = signal
        return later<Counted>({ count: 3 }, 5)
      },
      500,
      MISS,
    )
    expect(signalRef!.aborted).toBe(true)
  })
})
