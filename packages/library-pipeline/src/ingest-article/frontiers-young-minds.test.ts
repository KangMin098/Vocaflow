// packages/library-pipeline/src/ingest-article/frontiers-young-minds.test.ts
//
// **중3 칸을 메우는 유일한 후보.** 재고를 재면 그 칸만 4축 통과 13편이었다
// (초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**).
//
// 그래서 여기서 지키는 것은 셋이다:
//   1. 초록에서 **JATS 태그가 지문에 새지 않는가**
//   2. 라이선스를 **글마다** 확인하는가 (학술지 단위로 뭉뚱그리지 않는가)
//   3. 모르는 피드 이름에 조용히 다른 것을 주지 않는가
//
// 망을 타지 않는다 — 순수 함수만 검사한다.

import { describe, expect, it } from 'vitest'

import {
  FRYM_FEEDS,
  frymAbstractText,
  frymLicenseCode,
  frymLicenseUrl,
  frymPublishedAt,
  listFrymFeed,
} from './frontiers-young-minds'
import { SOURCE_POLICIES, SOURCE_REGISTER_DEFAULT, SOURCE_SPECS, resolveArticleRegister } from './_curation-spec'

/** 실측 형태 — Crossref 는 초록을 JATS 조각으로 준다. */
const jats =
  '<jats:p>Have you ever followed a recipe to make your favorite cake? ' +
  'Sometimes it turns out perfect, and sometimes it does not.</jats:p>'

describe('FrYM 초록', () => {
  it('JATS 태그를 지문에 남기지 않는다', () => {
    const t = frymAbstractText(jats)
    expect(t).not.toMatch(/<|jats:/)
    expect(t).toContain('Have you ever followed a recipe')
  })

  it('엔티티를 사람이 읽는 글자로 되돌린다', () => {
    // 안 되돌리면 낱말 경계가 깨져 어수와 FK 가 함께 틀어진다.
    expect(frymAbstractText('<jats:p>Brain&#8217;s messenger</jats:p>')).toBe('Brain’s messenger')
  })

  it('없으면 빈 문자열이다 — null 을 흘리지 않는다', () => {
    expect(frymAbstractText(null)).toBe('')
    expect(frymAbstractText(undefined)).toBe('')
  })
})

describe('FrYM 라이선스 — 글마다 확인한다', () => {
  it('Crossref 의 license 배열에서 CC 주소만 고른다', () => {
    expect(
      frymLicenseUrl([
        { URL: 'https://www.frontiersin.org/terms' },
        { URL: 'https://creativecommons.org/licenses/by/4.0/' },
      ]),
    ).toBe('https://creativecommons.org/licenses/by/4.0/')
  })

  it('CC 주소가 없으면 null 이다 — 짐작해서 붙이지 않는다', () => {
    expect(frymLicenseUrl([{ URL: 'https://www.frontiersin.org/terms' }])).toBeNull()
    expect(frymLicenseUrl(undefined)).toBeNull()
  })

  it('주소를 우리 표기로 옮긴다 — 등급이 다르면 발행 가능 여부가 다르다', () => {
    expect(frymLicenseCode('https://creativecommons.org/licenses/by/4.0/')).toBe('CC-BY-4.0')
    expect(frymLicenseCode('https://creativecommons.org/licenses/by-nc/4.0/')).toBe('CC-BY-NC-4.0')
  })

  it('모르는 꼴이면 null 이다', () => {
    expect(frymLicenseCode('https://creativecommons.org/publicdomain/zero/1.0/')).toBeNull()
    expect(frymLicenseCode(null)).toBeNull()
  })
})

describe('FrYM 발행일', () => {
  it('Crossref 의 date-parts 를 읽는다', () => {
    expect(frymPublishedAt({ 'date-parts': [[2026, 9, 3]] })).toBe('2026-09-03T00:00:00.000Z')
  })

  it('연도만 있어도 받는다 — 있는 만큼 쓴다', () => {
    expect(frymPublishedAt({ 'date-parts': [[2019]] })).toBe('2019-01-01T00:00:00.000Z')
  })

  it('없으면 null 이다 — 지어내지 않는다', () => {
    expect(frymPublishedAt(undefined)).toBeNull()
    expect(frymPublishedAt({ 'date-parts': [[]] })).toBeNull()
  })
})

describe('FrYM 배선', () => {
  it('모르는 피드 이름에 조용히 다른 것을 주지 않는다', async () => {
    await expect(listFrymFeed('nope', 1)).rejects.toThrow(/nope/)
  })

  it('정렬 축이 둘이다 — 최신만 보면 같은 주제가 몰린다', () => {
    expect(FRYM_FEEDS.map((f) => f.id)).toEqual(['recent', 'cited'])
  })

  it('register 기본값이 expository 이고 처리 경로도 같은 답을 낸다', () => {
    expect(SOURCE_REGISTER_DEFAULT.frym).toBe('expository')
    expect(resolveArticleRegister('frym', null)).toBe('expository')
  })

  it('중등~고등 밴드를 겨냥한다 — 실측 FK 중앙 10.55(중3)', () => {
    expect(SOURCE_SPECS.frym.targetLevels).toContain('intermediate')
    expect(SOURCE_SPECS.frym.targetCefr).toEqual({ min: 'B1', max: 'B2' })
  })

  it('정책 표가 CC BY 로 분류한다 — 발행·변형이 막히면 안 된다', () => {
    expect(SOURCE_POLICIES.frym.licenseClass).toBe('cc_by')
  })
})
