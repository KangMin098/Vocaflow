// apps/web/src/lib/textfit/__tests__/sample-profile.integration.test.ts
//
// `/fit` 도착 화면의 예시 결과가 **실제 사전으로 참말을 하는가** (실 DB).
// 렌더 회귀는 픽스처를 그린다 — 여기서는 서버가 정말 결과를 만들어 내는지 본다.
// 캐시 래퍼(`getSampleProfile`)가 아니라 순수 계산(`computeSampleProfile`)을 부른다 —
// `unstable_cache` 는 Next 런타임 밖에서 의미가 없다.
//
// 환경변수(NEXT_PUBLIC_SUPABASE_*) 없으면 skip — CI 정상.

import { describe, expect, it } from 'vitest'

import { PROFILE_LEVELS } from '../profile'
import { computeSampleProfile } from '../sample-profile'

const skipIfNoEnv =
  !process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

describe.skipIf(skipIfNoEnv)('/fit 예시 결과 (실 사전)', () => {
  it('결과가 나오고 학년축 8칸이 전부 있다', async () => {
    const p = await computeSampleProfile()
    expect(p, 'null 이면 /fit 이 빈 입력칸으로 뜬다').not.toBeNull()
    expect(p!.readings).toHaveLength(PROFILE_LEVELS.length)
    expect(p!.uniqueContentWords).toBeGreaterThan(0)
  })

  it('적정 레벨이 판정된다 — 예시가 "아무에게도 안 맞는 글" 이면 도구가 고장난 것처럼 보인다', async () => {
    const p = await computeSampleProfile()
    expect(p!.fitLevel).not.toBeNull()
  })
})
