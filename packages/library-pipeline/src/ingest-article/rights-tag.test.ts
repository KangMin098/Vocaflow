// packages/library-pipeline/src/ingest-article/rights-tag.test.ts
import { describe, expect, it } from 'vitest'
import { rightsClassOf, rightsTag } from './rights-tag'

describe('rightsClassOf — 자유 표기를 등급으로', () => {
  it.each([
    ['CC-BY-4.0', 'BY'],
    ['CC BY 4.0', 'BY'],
    ['cc by', 'BY'],
    ['Creative Commons Attribution 4.0 International', 'BY'],
    ['https://creativecommons.org/licenses/by/4.0/', 'BY'],
    ['CC-BY-SA-4.0', 'BY-SA'],
    ['cc by-nc', 'BY-NC'],
    ['https://creativecommons.org/licenses/by-nc-sa/4.0/', 'BY-NC-SA'],
    ['CC-BY-ND-4.0', 'BY-ND'],
    ['cc by-nc-nd', 'BY-NC-ND'],
    ['CC0-1.0', 'CC0'],
    ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0'],
    ['Public Domain', 'PD'],
    ['© 2021 Elsevier. All rights reserved.', 'copyrighted'],
    ['© 저자, CC BY 4.0', 'BY'],
    ['https://www.frontiersin.org/terms', 'unknown'],
    ['published by someone', 'unknown'],
    ['', 'unknown'],
  ] as const)('%s → %s', (lic, cls) => {
    expect(rightsClassOf(lic)).toBe(cls)
  })
  it('null · unknown 은 unknown', () => {
    expect(rightsClassOf(null)).toBe('unknown')
    expect(rightsClassOf('unknown')).toBe('unknown')
  })
})

describe('rightsTag — 원문 한 편의 표지', () => {
  it('원문에서 읽은 CC BY 는 해소가 필요 없다', () => {
    const t = rightsTag({
      license: 'CC BY 4.0',
      licenseEvidence: 'jats',
      author: ' Kim ',
      publishedAt: '2019-03-01',
      sourceUrl: 'https://x.org/a',
    })
    expect(t).toEqual({
      class: 'BY',
      license: 'CC BY 4.0',
      evidence: 'jats',
      attribution: { author: 'Kim', year: 2019, url: 'https://x.org/a' },
      needsResolution: false,
      v: 1,
    })
  })
  it('컬렉션 기본값은 CC BY 여도 해소가 필요하다', () => {
    const t = rightsTag({ license: 'CC BY 4.0', licenseEvidence: 'collection-default' })
    expect(t.class).toBe('BY')
    expect(t.needsResolution).toBe(true)
  })
  it('표기가 없으면 unknown · evidence none', () => {
    const t = rightsTag({ license: null, licenseEvidence: 'api' })
    expect(t.license).toBe('unknown')
    expect(t.class).toBe('unknown')
    expect(t.evidence).toBe('none')
    expect(t.needsResolution).toBe(true)
    expect(rightsTag({ license: 'unknown', licenseEvidence: 'api' }).evidence).toBe('none')
  })
  it('NC · ND 는 원문 단위로 읽었어도 해소가 필요하다', () => {
    expect(rightsTag({ license: 'cc by-nc', licenseEvidence: 'api' }).needsResolution).toBe(true)
    expect(rightsTag({ license: 'CC-BY-ND-4.0', licenseEvidence: 'page' }).needsResolution).toBe(true)
  })
  it('evidence 를 안 주면 feed', () => {
    expect(rightsTag({ license: 'CC0-1.0' }).evidence).toBe('feed')
  })
  it('Date 에서 연도를 뽑는다', () => {
    expect(rightsTag({ license: 'x', publishedAt: new Date(Date.UTC(2020, 5, 1)) }).attribution.year).toBe(2020)
    expect(rightsTag({ license: 'x', publishedAt: 'n/a' }).attribution.year).toBeNull()
  })
})
