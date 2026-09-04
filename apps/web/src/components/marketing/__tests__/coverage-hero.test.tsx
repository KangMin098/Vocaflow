// apps/web/src/components/marketing/__tests__/coverage-hero.test.tsx
//
// 랜딩 히어로 증명의 **규칙 회귀** — `docs/DESIGN_SYSTEM.md §🎯 첫인상` I1~I6 과 §모션 예산.
//
// 왜 규칙을 테스트하나: 이 규칙들은 "지키자" 로 적으면 다음 리팩터에서 조용히 사라진다.
// 특히 I6(서버 렌더에 남는다)과 I2(클릭 0)는 **깨져도 화면이 멀쩡해 보인다** — 크롤러와
// 첫 방문자만 잃는다. 사람 눈으로는 못 잡는 종류라 기계가 지켜야 한다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HERO_PASSAGE, splitSurface, type HeroDemo } from '@/lib/marketing/hero-demo'
import { PROFILE_LEVELS } from '@/lib/textfit/profile'

import { CoverageHero } from '../CoverageHero'

const SRC = join(process.cwd(), 'src')
const HERO_SRC = readFileSync(join(SRC, 'components', 'marketing', 'CoverageHero.tsx'), 'utf8')
const PAGE_SRC = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf8')

/**
 * 고정 픽스처 — DB 를 치지 않는다.
 *
 * 레벨을 4·7·9 로 흩어 놓아 기본 레벨(6)에서 **아는 낱말과 모르는 낱말이 둘 다** 나오게 한다.
 * 한쪽만 나오면 "칠해진다" 는 것을 증명하지 못한다.
 */
const DEMO: HeroDemo = {
  tokens: [
    { t: 'Every' },
    { t: ' ' },
    { t: 'reader', v: 4 },
    { t: ' ' },
    { t: 'meets', v: 4 },
    { t: ' the ' },
    { t: 'intrinsic', v: 9 },
    { t: ' ' },
    { t: 'proportion', v: 7 },
    { t: ' of ' },
    { t: 'Prague', v: null },
    { t: '.' },
  ],
  readings: PROFILE_LEVELS.map((level, i) => ({
    level,
    label: String(level),
    coverage: 0.6 + i * 0.05,
    coverageLow: 0.55 + i * 0.05,
    coverageHigh: 0.65 + i * 0.05,
    band: 'study' as const,
    unknownWords: 8 - i,
  })),
  fitLevel: 8,
  totalTokens: 12,
}

describe('히어로 증명 — I1·I2·I6 (서버 렌더에 결과가 남는다)', () => {
  const html = renderToString(<CoverageHero demo={DEMO} />)

  it('지문이 초기 HTML 에 그대로 있다 — 크롤러가 읽을 것이 있다', () => {
    expect(html).toContain('reader')
    expect(html).toContain('intrinsic')
  })

  it('클릭 0 으로 커버리지 숫자가 이미 보인다', () => {
    // 기본 레벨 6 = PROFILE_LEVELS 의 4번째(3,4,5,6) → coverage 0.6+3*0.05 = 0.75
    expect(html).toContain('75%')
  })

  it('기본 레벨에서 미지어가 실제로 칠해져 있다 — 색만이 아니라 밑줄도 함께', () => {
    // intrinsic(9) · proportion(7) 은 레벨 6 에서 미지어다.
    expect(html).toMatch(/memory-risk-ink/)
    expect(html).toMatch(/decoration-wavy/)
  })

  it('레벨 미상은 미지어와 다른 표시를 쓴다 — 모른다고 단정하지 않는다', () => {
    expect(html).toMatch(/decoration-dotted/)
  })
})

describe('히어로 증명 — I3 (조작 가능)', () => {
  const html = renderToString(<CoverageHero demo={DEMO} />)

  it('조작 컨트롤이 있고 레벨축 전체를 덮는다', () => {
    expect(html).toContain('type="range"')
    expect(html).toContain(`min="${PROFILE_LEVELS[0]}"`)
    expect(html).toContain(`max="${PROFILE_LEVELS[PROFILE_LEVELS.length - 1]}"`)
  })

  it('레벨 변경은 네트워크를 타지 않는다 — 8레벨이 미리 계산돼 내려온다', () => {
    expect(HERO_SRC).not.toMatch(/\bfetch\(/)
    expect(DEMO.readings).toHaveLength(PROFILE_LEVELS.length)
  })

  it('44px 터치 타깃을 지킨다', () => {
    expect(HERO_SRC).toContain('h-[44px]')
  })
})

describe('히어로 증명 — I4·I5 (짧은 부제 · 상수 수치 금지)', () => {
  it('히어로 부제가 90자 이하다', () => {
    const sub = /계산해 드려요\./.test(PAGE_SRC)
    expect(sub, '히어로 부제 문장을 찾지 못했다 — 바뀌었으면 이 회귀도 같이 고친다').toBe(true)

    // `<p>` 부제 블록의 한국어 본문만 뽑아 센다(클래스명·태그 제외).
    const block = /같은 글도[\s\S]*?계산해 드려요\./.exec(PAGE_SRC)?.[0] ?? ''
    const text = block.replace(/\s+/g, ' ').trim()
    expect(text.length, `부제 ${text.length}자 — 90자 상한`).toBeLessThanOrEqual(90)
  })

  it('커버리지 수치를 소스에 박아 두지 않는다', () => {
    // 화면에 나가는 퍼센트 리터럴이 있으면 실측과 갈라진다.
    expect(HERO_SRC).not.toMatch(/>\s*\d{1,3}%/)
  })
})

describe('히어로 증명 — 모션 예산 (§🎯 3)', () => {
  it('지속시간은 토큰 경유이고 하드코딩 ms 가 없다', () => {
    expect(HERO_SRC).toContain('duration-[var(--dur-normal)]')
    expect(HERO_SRC).not.toMatch(/duration-\[\d+ms\]/)
  })

  it('이동·스케일 애니메이션이 없다 — reduced-motion 에서도 뜻이 그대로 남는다', () => {
    expect(HERO_SRC).not.toMatch(/animate-|translate-|\bscale-\d/)
  })
})

describe('히어로 지문 — 조각을 이어 붙이면 원문이다', () => {
  it('splitSurface 는 글자를 잃지 않는다', () => {
    expect(splitSurface(HERO_PASSAGE).join('')).toBe(HERO_PASSAGE)
  })

  it('낱말 조각과 비낱말 조각이 모두 나온다', () => {
    const parts = splitSurface(HERO_PASSAGE)
    expect(parts.some((p) => /^[A-Za-z]+$/.test(p))).toBe(true)
    expect(parts.some((p) => !/^[A-Za-z]/.test(p))).toBe(true)
  })
})
