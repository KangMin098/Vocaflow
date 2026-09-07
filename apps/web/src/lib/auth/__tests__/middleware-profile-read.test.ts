// apps/web/src/lib/auth/__tests__/middleware-profile-read.test.ts
//
// **미들웨어가 프로필을 캐시를 거쳐 읽는가** — 배선 회귀.
//
// `profile-cache.test.ts` 는 캐시가 옳게 도는지를 잰다. 그런데 캐시가 아무리 옳아도
// 미들웨어가 그것을 안 거치면 조회는 그대로 나간다 — 그리고 그 사실은 **아무 테스트도
// 실패시키지 않는다.** 2026-09-06 장애의 단일 최대 기여자가 이 한 줄이었으므로
// (36분에 프로필 조회 3,482건 · 발견 #43), 되돌아가는 것을 여기서 막는다.
//
// 이 저장소가 `colophon-spec` · `promise-guard` 에서 쓰는 것과 같은 방식이다 —
// 실행할 수 없는 자리(미들웨어는 Edge 런타임이라 단위 테스트로 못 돌린다)는 **본문을 읽어**
// 지킨다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/** 이 파일 위치 기준으로 잡는다 — `process.cwd()` 에 기대면 어디서 돌리느냐에 따라 조용히 빗나간다. */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.resolve(HERE, '../../../middleware.ts'), 'utf8')

describe('미들웨어 프로필 조회', () => {
  it('캐시를 거친다', () => {
    expect(src).toContain("from '@/lib/auth/profile-cache'")
    expect(src).toContain('loadAccountProfile(user!.id')
  })

  it('`user_profiles` 를 직접 읽는 자리가 **캐시 안에만** 있다', () => {
    // 조회는 한 곳뿐이어야 한다. 두 번째가 생기면 캐시 밖으로 새는 길이 열린 것이다.
    const reads = src.match(/\.from\('user_profiles'\)/g) ?? []
    expect(reads).toHaveLength(1)

    // 그 한 곳이 `loadAccountProfile(` 뒤에 온다 = 콜백 안이다.
    const cacheAt = src.indexOf('loadAccountProfile(')
    const readAt = src.indexOf(".from('user_profiles')")
    expect(cacheAt).toBeGreaterThan(-1)
    expect(readAt).toBeGreaterThan(cacheAt)
  })

  it('조회 실패와 **행 없음**을 구별해 넘긴다 — 뭉개면 오류가 캐시에 굳는다', () => {
    // error 를 실제로 받아 보고 `{ ok: false }` 로 알린다.
    expect(src).toMatch(/const \{ data, error \} = await supabase/)
    expect(src).toContain('if (error) return { ok: false as const }')
  })

  it('못 읽었을 때 **정지로 오인해 내쫓지 않는다**', () => {
    // 정지 판정은 조회가 성공했을 때만 내린다. `result.ok` 가 빠지면 DB 가 흔들릴 때
    // 멀쩡한 사용자가 "정지" 사유로 로그아웃된다.
    expect(src).toContain('if (result.ok && !isUsableAccount(profileStatus))')
  })

  it('인증(`getUser`)은 그대로 남는다 — 이건 줄이면 안 되는 보안 경계다', () => {
    expect(src).toContain('await supabase.auth.getUser()')
  })
})
