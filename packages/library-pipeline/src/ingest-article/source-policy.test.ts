// packages/library-pipeline/src/ingest-article/source-policy.test.ts
// ACP §18 — SourcePolicy 파생 drift-lock.
// 정책 4축(supply/media/derivation/attribution)이 기존 SSoT(SOURCE_SPECS·frozen·license)
// 에서 의도대로 파생되는지 고정. spec 변경이 정책을 깨면 이 테스트가 먼저 잡는다.

import { describe, expect, it } from 'vitest'

import {
  SOURCE_POLICIES,
  getSourcePolicy,
  resolveSourcePolicy,
  isSourceKey,
  licenseClassOf,
  resolveArticleRegister,
  type SourceKey,
} from './_curation-spec'

describe('licenseClassOf', () => {
  it.each([
    ['PD-Government', 'public_domain'],
    ['CC-BY-2.5', 'cc_by'],
    ['CC-BY-SA-4.0', 'cc_by_sa'],
    ['CC-BY-ND-4.0', 'cc_by_nd'],
    ['CC0-1.0', 'cc0'],
    ['All rights reserved', 'restricted'],
  ] as const)('%s → %s', (license, expected) => {
    expect(licenseClassOf(license)).toBe(expected)
  })
})

describe('SOURCE_POLICIES — 4축 파생 표 고정', () => {
  // [source, supply, media, derivation, attribution]
  const TABLE: Array<[SourceKey, string, string, string, string]> = [
    ['voa', 'static', 'audio', 'full', 'none'],
    ['nasa', 'live', 'text', 'full', 'none'],
    ['nih', 'live', 'text', 'full', 'none'],
    ['wikinews', 'live', 'text', 'full', 'required'],
    ['the_conversation', 'live', 'text', 'display_only', 'required'],
    ['simple_wikipedia', 'live', 'text', 'full', 'required'],
    ['owid', 'live', 'text', 'full', 'required'], // T-2 — CC-BY → full(발행 허용), argumentative gap 보강
    ['factbook', 'live', 'text', 'full', 'none'], // PD US Gov → full(발행 허용) · 인용 자유, reference gap 보강
  ]

  it.each(TABLE)('%s → %s/%s/%s/%s', (source, supply, media, derivation, attribution) => {
    const p = SOURCE_POLICIES[source]
    expect(p.supply).toBe(supply)
    expect(p.media).toBe(media)
    expect(p.derivation).toBe(derivation)
    expect(p.attribution).toBe(attribution)
  })

  it('SOURCE_POLICIES 와 getSourcePolicy 가 일치', () => {
    for (const source of Object.keys(SOURCE_POLICIES) as SourceKey[]) {
      expect(SOURCE_POLICIES[source]).toEqual(getSourcePolicy(source))
    }
  })
})

describe('핵심 분기 불변식', () => {
  it('VOA 만 audio 게이트', () => {
    const audio = (Object.keys(SOURCE_POLICIES) as SourceKey[]).filter(
      (s) => SOURCE_POLICIES[s].media === 'audio',
    )
    expect(audio).toEqual(['voa'])
  })

  it('display_only 는 ND 라이선스에서만', () => {
    for (const source of Object.keys(SOURCE_POLICIES) as SourceKey[]) {
      const p = SOURCE_POLICIES[source]
      expect(p.derivation === 'display_only').toBe(p.licenseClass === 'cc_by_nd')
    }
  })

  it('static 공급은 VOA(frozen archive) 만', () => {
    const stat = (Object.keys(SOURCE_POLICIES) as SourceKey[]).filter(
      (s) => SOURCE_POLICIES[s].supply === 'static',
    )
    expect(stat).toEqual(['voa'])
  })
})

describe('resolveArticleRegister — feed-level 우선 (VOA 오분류 교정)', () => {
  it('VOA american-stories/lets-learn-english → narrative (서사 register 보강)', () => {
    expect(resolveArticleRegister('voa', 'american-stories')).toBe('narrative')
    expect(resolveArticleRegister('voa', 'lets-learn-english')).toBe('narrative')
  })
  it('VOA science-technology/health-lifestyle → expository (source 기본 news 교정)', () => {
    expect(resolveArticleRegister('voa', 'science-technology')).toBe('expository')
    expect(resolveArticleRegister('voa', 'health-lifestyle')).toBe('expository')
  })
  it('VOA as-it-is / feed 없음 → source 기본값 news', () => {
    expect(resolveArticleRegister('voa', 'as-it-is')).toBe('news')
    expect(resolveArticleRegister('voa', null)).toBe('news')
  })
  it('feed override 없는 소스는 source 기본값', () => {
    expect(resolveArticleRegister('owid', null)).toBe('argumentative')
    expect(resolveArticleRegister('factbook', undefined)).toBe('reference')
    expect(resolveArticleRegister('nasa', 'news')).toBe('expository')
  })
})

describe('resolveSourcePolicy — 미상 소스 보수적 기본값', () => {
  it('활성 소스는 getSourcePolicy 와 동일', () => {
    expect(resolveSourcePolicy('voa')).toEqual(getSourcePolicy('voa'))
  })

  it('legacy/미상 소스는 display_only + attribution required 로 차단', () => {
    const p = resolveSourcePolicy('manual')
    expect(isSourceKey('manual')).toBe(false)
    expect(p.derivation).toBe('display_only')
    expect(p.attribution).toBe('required')
    expect(p.licenseClass).toBe('restricted')
  })
})
