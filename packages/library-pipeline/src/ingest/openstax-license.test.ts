// packages/library-pipeline/src/ingest/openstax-license.test.ts
//
// **"모든 OpenStax 교과서는 CC BY 4.0" 은 거짓이다** — 실측 2026-09-24, CMS 상세 129권 전수:
//   live 영어 73권 중 **70권(95.9%)이 CC BY-NC-SA 4.0** · CC BY 는 3권뿐.
//
// 옛 코드에는 두 자리가 있었다:
//   ① 폴백이 `'CC-BY-4.0'` — 못 읽으면 **가장 관대한 쪽**으로 틀렸다
//   ② `attribution && !includes('non')` — NC 는 막지만 **BY-SA·BY-ND 는 못 막는다**
// 상업 이용을 한다는 결정(2026-09-24)이 있으므로 NC 를 CC-BY 로 적으면 그대로 사고다.
//
// 이 검사는 네트워크를 타지 않는다 — 문자열 정규화 규칙만 고정한다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(__dirname, 'openstax.ts'), 'utf8')

/** 어댑터의 `formatLicense` 를 소스에서 떼어 그대로 평가한다(내보내지 않는 함수라서). */
function loadFormatLicense(): (name: string, version?: string) => string {
  const at = SRC.indexOf('function formatLicense(')
  expect(at, 'formatLicense 를 못 찾았다').toBeGreaterThan(-1)
  const body = SRC.slice(at, SRC.indexOf('\n}', at) + 2)
  const js = body
    .replace(/:\s*string\s*\|\s*undefined/g, '')
    .replace(/:\s*string(?=[,)])/g, '')
    .replace(/\)\s*:\s*string\s*\{/g, ') {')
    .replace(/\.\.\.parts\s*:\s*string\[\]/g, '...parts')
    .replace(/\)\s*:\s*boolean\s*=>/g, ') =>')
  // eslint-disable-next-line no-new-func
  return new Function(`${js}; return formatLicense`)() as (n: string, v?: string) => string
}

const fmt = loadFormatLicense()

describe('OpenStax 라이선스 정규화', () => {
  it('실제로 대부분인 NC-SA 를 CC-BY 로 적지 않는다', () => {
    // live 영어 73권 중 70권이 이것이다.
    expect(fmt('Creative Commons Attribution-NonCommercial-ShareAlike License', '4.0'))
      .toBe('CC-BY-NC-SA-4.0')
  })

  it('SA 와 ND 를 CC-BY 로 떨어뜨리지 않는다 — 옛 규칙이 못 막던 자리', () => {
    // 둘 다 문자열에 'non' 이 없어 `!includes('non')` 을 통과했다.
    expect(fmt('Creative Commons Attribution-ShareAlike License', '4.0')).toBe('CC-BY-SA-4.0')
    expect(fmt('Creative Commons Attribution-NoDerivatives License', '4.0')).toBe('CC-BY-ND-4.0')
  })

  it('NC 단독·NC-ND 도 가른다', () => {
    expect(fmt('Creative Commons Attribution-NonCommercial License', '4.0')).toBe('CC-BY-NC-4.0')
    expect(fmt('Creative Commons Attribution-NonCommercial-NoDerivatives License', '4.0'))
      .toBe('CC-BY-NC-ND-4.0')
  })

  it('진짜 CC BY 는 CC BY 로 둔다 — live 영어 3권이 이것이다', () => {
    expect(fmt('Creative Commons Attribution License', '4.0')).toBe('CC-BY-4.0')
  })

  it('모르는 문자열은 지어내지 않고 원문 그대로 돌려준다', () => {
    expect(fmt('All Rights Reserved', '4.0')).toBe('All Rights Reserved')
  })
})

describe('OpenStax 라이선스 폴백', () => {
  it('license_name 이 없으면 CC-BY 로 떨어지지 않고 던진다', () => {
    // 못 읽은 것을 가장 관대한 쪽으로 적으면 95.9% 의 경우에 틀린다.
    expect(SRC).not.toMatch(/license_name[\s\S]{0,80}:\s*'CC-BY-4\.0'/)
    expect(SRC, '라이선스 결측에 throw 가 없다').toMatch(
      /if \(!detail\.license_name\)[\s\S]{0,300}throw new Error/,
    )
  })

  it('머리말이 "전부 CC BY" 라고 말하지 않는다', () => {
    expect(SRC).not.toContain('모든 OpenStax 교과서는 CC BY 4.0 —')
    expect(SRC, '실측 근거가 머리말에 없다').toContain('95.9%')
  })
})
