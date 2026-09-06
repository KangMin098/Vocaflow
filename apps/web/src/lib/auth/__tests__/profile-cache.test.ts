// apps/web/src/lib/auth/__tests__/profile-cache.test.ts
//
// 미들웨어 프로필 캐시 회귀.
//
// 이 캐시는 **인증 게이트 위에 앉는다.** 잘못 만들면 줄어드는 조회보다 잃는 것이 크다:
// 남의 권한을 쓰거나, 순간적 오류가 TTL 동안 굳거나, 정지가 영영 안 걸린다.
// 그래서 "몇 번 줄었나" 보다 **무엇을 절대 하지 않는가**를 먼저 잠근다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PROFILE_CACHE_MAX_ENTRIES,
  PROFILE_CACHE_TTL_MS,
  __profileCacheSize,
  __resetProfileCacheForTest,
  invalidateAccountProfile,
  loadAccountProfile,
  type ProfileRead,
} from '../profile-cache'

/** 테스트가 손으로 돌리는 시계. 실제 시간에 기대면 TTL 검사가 느리고 흔들린다. */
let clock = 0
const tick = (ms: number) => {
  clock += ms
}

const ok = (role: string | null, status: string | null): ProfileRead => ({
  ok: true,
  profile: { role, status },
})

beforeEach(() => {
  clock = 1_000_000
  __resetProfileCacheForTest(() => clock)
})

describe('프로필 캐시 — 절대 하지 않아야 하는 것', () => {
  it('사용자를 섞지 않는다 — 열쇠는 언제나 user id 다', async () => {
    const read = vi
      .fn<[], Promise<ProfileRead>>()
      .mockResolvedValueOnce(ok('admin', 'active'))
      .mockResolvedValueOnce(ok(null, 'active'))

    const a = await loadAccountProfile('user-a', read)
    const b = await loadAccountProfile('user-b', read)

    expect(a).toEqual(ok('admin', 'active'))
    expect(b).toEqual(ok(null, 'active'))
    expect(read).toHaveBeenCalledTimes(2)

    // 다시 물어도 각자의 값이다.
    expect(await loadAccountProfile('user-b', read)).toEqual(ok(null, 'active'))
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('**실패한 조회를 캐시하지 않는다** — 순간적 오류가 TTL 동안 굳으면 안 된다', async () => {
    const read = vi
      .fn<[], Promise<ProfileRead>>()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(ok('admin', 'active'))

    expect(await loadAccountProfile('u', read)).toEqual({ ok: false })
    // 바로 다음 요청이 **다시 읽는다** — 실패를 물려주지 않는다.
    expect(await loadAccountProfile('u', read)).toEqual(ok('admin', 'active'))
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('던지는 조회도 실패로 본다 — 미들웨어를 여기서 죽이지 않는다', async () => {
    const read = vi
      .fn<[], Promise<ProfileRead>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(ok('curator', 'active'))

    expect(await loadAccountProfile('u', read)).toEqual({ ok: false })
    expect(await loadAccountProfile('u', read)).toEqual(ok('curator', 'active'))
  })

  it('행이 없는 것과 못 읽은 것을 **구별**한다', async () => {
    const read = vi.fn<[], Promise<ProfileRead>>().mockResolvedValue({ ok: true, profile: null })
    const first = await loadAccountProfile('u', read)
    expect(first).toEqual({ ok: true, profile: null })
    // 「행 없음」은 정상 결과라 캐시된다 — 신규 가입 직후가 이 상태다.
    await loadAccountProfile('u', read)
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('프로필 캐시 — 무엇을 줄이는가', () => {
  it('겹치는 요청 여럿이 조회 **한 번**을 나눠 쓴다 (낡음 0)', async () => {
    let resolve!: (v: ProfileRead) => void
    const read = vi.fn(() => new Promise<ProfileRead>((r) => (resolve = r)))

    const calls = [
      loadAccountProfile('u', read),
      loadAccountProfile('u', read),
      loadAccountProfile('u', read),
      loadAccountProfile('u', read),
    ]
    expect(read).toHaveBeenCalledTimes(1)

    resolve(ok('admin', 'active'))
    for (const r of await Promise.all(calls)) expect(r).toEqual(ok('admin', 'active'))
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('TTL 안에서는 다시 쓰고, 지나면 다시 읽는다', async () => {
    const read = vi.fn<[], Promise<ProfileRead>>().mockResolvedValue(ok('admin', 'active'))

    await loadAccountProfile('u', read)
    tick(PROFILE_CACHE_TTL_MS - 1)
    await loadAccountProfile('u', read)
    expect(read).toHaveBeenCalledTimes(1)

    tick(2)
    await loadAccountProfile('u', read)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('사용자당 조회가 **TTL 하나에 한 번**으로 묶인다 — 이것이 줄이는 양이다', async () => {
    const read = vi.fn<[], Promise<ProfileRead>>().mockResolvedValue(ok(null, 'active'))

    // 실측 부하와 같은 모양: 1분 동안 초당 두 번 들어온다.
    for (let i = 0; i < 120; i += 1) {
      await loadAccountProfile('u', read)
      tick(500)
    }

    // 60초 / TTL 30초 = 2회. 조회 120건이 2건이 된다.
    expect(read).toHaveBeenCalledTimes(60_000 / PROFILE_CACHE_TTL_MS)
  })
})

describe('프로필 캐시 — 되돌릴 수 있는가', () => {
  it('버리면 즉시 다시 읽는다 — 판정이 바뀐 것을 아는 자리에서 쓴다', async () => {
    const read = vi
      .fn<[], Promise<ProfileRead>>()
      .mockResolvedValueOnce(ok('admin', 'active'))
      .mockResolvedValueOnce(ok(null, 'suspended'))

    await loadAccountProfile('u', read)
    invalidateAccountProfile('u')
    expect(await loadAccountProfile('u', read)).toEqual(ok(null, 'suspended'))
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('무한히 자라지 않는다 — 넘치면 오래된 것부터 버린다', async () => {
    const read = vi.fn<[], Promise<ProfileRead>>().mockResolvedValue(ok(null, 'active'))
    for (let i = 0; i < PROFILE_CACHE_MAX_ENTRIES + 50; i += 1) {
      await loadAccountProfile(`u-${i}`, read)
    }
    expect(__profileCacheSize()).toBe(PROFILE_CACHE_MAX_ENTRIES)
  })

  it('자주 쓰는 사용자가 먼저 버려지지 않는다', async () => {
    const read = vi.fn<[], Promise<ProfileRead>>().mockResolvedValue(ok(null, 'active'))
    await loadAccountProfile('hot', read)

    // 사이사이 계속 쓰면서 상한을 넘긴다.
    for (let i = 0; i < PROFILE_CACHE_MAX_ENTRIES; i += 1) {
      await loadAccountProfile(`cold-${i}`, read)
      tick(1)
      await loadAccountProfile('hot', read)
    }

    const before = read.mock.calls.length
    await loadAccountProfile('hot', read)
    // 아직 TTL 안이고 밀려나지도 않았다 — 다시 읽지 않는다.
    expect(read.mock.calls.length).toBe(before)
  })
})
