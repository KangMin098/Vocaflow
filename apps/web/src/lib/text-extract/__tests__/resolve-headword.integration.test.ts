// apps/web/src/lib/text-extract/__tests__/resolve-headword.integration.test.ts
//
// resolve_dict_headword 의미 보존 원칙 회귀 (실 DB).
// 환경변수 없으면 skip (CI 는 순수 함수 테스트만 게이트).
//
// 이 파일이 지키는 계약 하나:
//   **틀린 뜻을 주느니 미해결로 남긴다.**
// 해석 실패는 pending_words 로 쌓여 사전 확장의 근거가 되지만,
// 뒤집히거나 엉뚱한 해석은 학습자에게 되돌릴 수 없는 오학습이 된다.

import { beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

interface MinimalDb {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

describe.skipIf(skipIfNoEnv)('resolve_dict_headword — 의미 보존 원칙', () => {
  let client: MinimalDb

  beforeAll(() => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false },
    }) as unknown as MinimalDb
  })

  async function resolve(surface: string): Promise<string | null> {
    const { data, error } = await client.rpc('resolve_dict_headword', { p_surface: surface })
    expect(error).toBeNull()
    return (data as string | null) ?? null
  }

  describe('극성 반전 파생은 해석하지 않는다', () => {
    // 실측 결함(2026-08-13): sugarless→sugar("설탕") · carbonless→carbon("탄소")
    // -less 는 뜻을 뒤집으므로 어기로 해석하면 정반대를 가르친다.
    it.each(['sugarless', 'carbonless', 'leaderless'])(
      '%s 는 어기로 해석되지 않는다',
      async (w) => {
        expect(await resolve(w)).toBeNull()
      },
    )

    it.each(['unglamorous', 'mislabeled', 'nonlinear'])(
      '부정 접두사 %s 는 해석되지 않는다',
      async (w) => {
        expect(await resolve(w)).toBeNull()
      },
    )

    it('사전에 표제어로 있는 -less 단어는 정상 해석된다 (L1)', async () => {
      expect(await resolve('harmless')).toBe('harmless')
      expect(await resolve('priceless')).toBe('priceless')
    })
  })

  describe('어기 다의성에 취약한 접두사는 해석하지 않는다', () => {
    // geochemist→chemist 는 형태론적으로 부분집합이지만, 사전의 chemist 주 뜻이
    // "약사" 라 지구화학자가 약사가 된다. 어떤 어기가 다의어인지 미리 알 수 없다.
    it('geochemist 는 chemist 로 해석되지 않는다', async () => {
      expect(await resolve('geochemist')).toBeNull()
    })
  })

  describe('영/미 철자 변이는 해석한다 (같은 단어 · 의미 위험 0)', () => {
    it('optimize → optimise', async () => {
      expect(await resolve('optimize')).toBe('optimise')
    })

    it('굴절형에도 적용된다 — optimizes / optimized', async () => {
      expect(await resolve('optimizes')).toBe('optimise')
      expect(await resolve('optimized')).toBe('optimise')
    })

    it('optimization → optimisation', async () => {
      expect(await resolve('optimization')).toBe('optimisation')
    })

    // 9섹터 실측(2026-08-13)에서 드러난 결함: L5 가 미국식→영국식 **단방향**이었다.
    // 사전은 두 철자가 섞여 있어(cannibalize 는 미국식이 표제어) 방향을 고정할 수 없다.
    it('영국식 입력도 해석한다 — cannibalised → cannibalize', async () => {
      expect(await resolve('cannibalised')).toBe('cannibalize')
    })
  })

  describe('계층 순서 — 최후 수단이 앞 계층을 가로채지 않는다', () => {
    it.each([
      ['understand', 'understand'],
      ['doctor', 'doctor'],
      ['water', 'water'],
      ['dense', 'dense'],
      ['major', 'major'],
      ['better', 'better'],
    ])('%s 는 자기 자신으로 해석된다 (L1)', async (surface, expected) => {
      expect(await resolve(surface)).toBe(expected)
    })

    it('정상 굴절·파생은 계속 해석된다', async () => {
      expect(await resolve('quickly')).toBe('quickly')
      expect(await resolve('darkness')).toBe('darkness')
    })
  })
})

describe.skipIf(skipIfNoEnv)('unresolved_dict_words — 사전 갭만 돌려준다', () => {
  let client: MinimalDb

  beforeAll(() => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false },
    }) as unknown as MinimalDb
  })

  it('해석되는 단어는 제외하고 갭만 반환한다', async () => {
    const { data, error } = await client.rpc('unresolved_dict_words', {
      p_words: ['water', 'doctor', 'optimize', 'sorbents', 'sugarless', 'quickly'],
    })
    expect(error).toBeNull()
    const got = new Set((data as string[]) ?? [])
    // 사전 갭 / 극성 반전(의도적 미해석) 만 남아야 한다
    expect(got.has('sorbents')).toBe(true)
    expect(got.has('sugarless')).toBe(true)
    // 해석되는 단어는 백로그를 오염시키면 안 된다
    expect(got.has('water')).toBe(false)
    expect(got.has('doctor')).toBe(false)
    expect(got.has('optimize')).toBe(false)
    expect(got.has('quickly')).toBe(false)
  })

  it('빈 입력에 안전하다', async () => {
    const { data, error } = await client.rpc('unresolved_dict_words', { p_words: [] })
    expect(error).toBeNull()
    expect((data as string[]) ?? []).toEqual([])
  })
})
