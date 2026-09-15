// apps/web/src/lib/marketing/__tests__/hero-demo.integration.test.ts
//
// 히어로 증명이 **실제 사전으로 참말을 하는가** (실 DB).
//
// 렌더 회귀(`components/marketing/__tests__/coverage-hero.test.tsx`)는 픽스처를 그린다 —
// "화면이 뜬다" 는 알아도 **숫자가 맞는지**는 모른다. 랜딩 첫 화면에 나가는 수치라
// 틀리면 그건 디자인 결함이 아니라 **거짓 표시**다. 그래서 실 사전으로 한 번 잰다.
//
// 환경변수(NEXT_PUBLIC_SUPABASE_*) 없으면 skip — CI 정상.

import { describe, expect, it } from 'vitest'

import { HERO_PASSAGE, buildHeroDemo } from '../hero-demo'

const skipIfNoEnv =
  !process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

describe.skipIf(skipIfNoEnv)('히어로 데모 (실 사전)', () => {
  it('레벨축 8칸이 모두 계산된다', async () => {
    const demo = await buildHeroDemo()
    expect(demo, 'null 이면 랜딩에서 증명이 통째로 빠진다').not.toBeNull()
    expect(demo!.readings).toHaveLength(8)
  })

  it('커버리지가 레벨을 따라 단조 증가한다 — 이 곡선이 곧 주장이다', async () => {
    const demo = await buildHeroDemo()
    const cov = demo!.readings.map((r) => r.coverage)
    for (let i = 1; i < cov.length; i += 1) {
      expect(
        cov[i],
        `레벨 ${demo!.readings[i].level} 에서 커버리지가 내려갔다`,
      ).toBeGreaterThanOrEqual(cov[i - 1])
    }
  })

  it('낮은 레벨과 높은 레벨의 숫자가 실제로 다르다 — 같으면 증명이 아니다', async () => {
    const demo = await buildHeroDemo()
    const first = demo!.readings[0].coverage
    const last = demo!.readings[demo!.readings.length - 1].coverage
    expect(
      last - first,
      '레벨을 끝까지 옮겨도 숫자가 안 변하면 슬라이더는 장식이다',
    ).toBeGreaterThan(0.02)
  })

  it('기본 레벨(고1)에서 미지어와 기지어가 둘 다 있다', async () => {
    const demo = await buildHeroDemo()
    const leveled = demo!.tokens.filter((t) => typeof t.v === 'number')
    expect(
      leveled.some((t) => (t.v as number) > 6),
      '고1 기준 미지어가 하나도 없다 — 슬라이더를 내려야 변화가 보인다',
    ).toBe(true)
    expect(
      leveled.some((t) => (t.v as number) <= 6),
      '고1 기준 기지어가 하나도 없다',
    ).toBe(true)
  })

  it('조각을 이어 붙이면 원문 그대로다 — 지문을 조용히 자르지 않는다', async () => {
    const demo = await buildHeroDemo()
    expect(demo!.tokens.map((t) => t.t).join('')).toBe(HERO_PASSAGE)
  })
})
