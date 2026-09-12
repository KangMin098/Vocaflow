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
    // NC — SA/BY 를 포함해도 restricted. 순서가 뒤집히면 cc_by_sa 로 승격되므로 고정.
    ['CC-BY-NC-SA-4.0', 'restricted'], // CommonLit 자체 제작물 · OpenStax 현행 표준
    ['CC-BY-NC-4.0', 'restricted'],
    ['CC BY-NC-ND 4.0', 'restricted'],
    ['Creative Commons NonCommercial', 'restricted'],
  ] as const)('%s → %s', (license, expected) => {
    expect(licenseClassOf(license)).toBe(expected)
  })
})

describe('활성 소스 라이선스 게이트', () => {
  // 활성 소스는 전부 "발행 가능 등급" 이어야 한다. NC/미상 라이선스 소스를 SOURCE_SPECS 에
  // 추가하면 여기서 먼저 실패한다 — DB(acp_classify_license)가 copyright_safe_in_kr=false 로
  // 차단하므로, 화면만 "발행 가능"이라 말하는 상태로 배포되는 것을 막는다.
  it('SOURCE_SPECS 에 restricted 등급 소스가 없다', () => {
    const restricted = (Object.keys(SOURCE_POLICIES) as SourceKey[]).filter(
      (s) => SOURCE_POLICIES[s].licenseClass === 'restricted',
    )
    expect(restricted).toEqual([])
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
    ['elife', 'live', 'text', 'full', 'required'], // CC-BY → full(발행 허용) · 인용 필수, 과학 expository
    ['wikipedia', 'live', 'text', 'full', 'required'], // CC-BY-SA → full · 인용 필수, 정규 백과 expository
    ['plos', 'live', 'text', 'full', 'required'], // CC-BY → full · 인용 필수, 오픈 학술 논문 C1-C2
    ['wikivoyage', 'live', 'text', 'full', 'required'], // CC-BY-SA → full · 인용 필수, 여행 가이드 reference
    ['usgs', 'live', 'text', 'full', 'none'], // PD US Gov → full(발행 허용) · 인용 자유, 지구과학 expository
    ['noaa', 'live', 'text', 'full', 'none'], // PD US Gov → full(발행 허용) · 인용 자유, 기후과학 expository
    // ACP §20 — 재저작. CC0 자체 저작이므로 full + 출처표기 면제.
    //   (사실 출처 목록은 화면에 남기지만 그건 라이선스 의무가 아니라 학습자 검증 수단이다.)
    ['original', 'live', 'text', 'full', 'none'],
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
  it('VOA american-stories → narrative (고전 단편 각색)', () => {
    expect(resolveArticleRegister('voa', 'american-stories')).toBe('narrative')
  })

  it('VOA lets-learn-english(z/952) → expository — 서사가 아니다', () => {
    // 2026-08-20 정정. 이 테스트는 원래 'narrative' 를 못 박고 있었는데, 그 믿음이 틀렸다.
    //   z/952 는 Anna 연속 드라마가 아니라 그날의 학습 자료 모음("Lessons of the Day")이고
    //   실제 내용은 일반 피처다 — Ice Ages · Goodyear Blimp · Golden Gate Bridge ·
    //   Methods for Protecting Earth against an Asteroid Strike (실측 13편).
    //   서사로 두면 학습자에게 이야기글로 안내되는데 설명문이 나온다.
    //
    //   ⚠️ 이 오류를 찾아낸 것은 `crossCheckDeclaredLevel` 이다 — "선언 Level 1 인데 추정
    //     B2" 로 5편을 잡았고, 확인하니 틀린 쪽은 추정이 아니라 **우리 라벨**이었다.
    expect(resolveArticleRegister('voa', 'lets-learn-english')).toBe('expository')
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
