// packages/library-pipeline/src/ingest-article/license-text.test.ts
//
// **`license`(원문 표기)와 `license_class`(파생 등급)를 섞어 쓰는 사고의 회귀.**
//
// 실측 2026-09-23: 각색 경로 두 곳이 `license` 칸에 등급 슬러그를 써서 재고 **80편**이
// `restricted` 로 떨어졌다. DB 트리거 `acp_classify_license` 가 `license` **문자열을
// 다시 파싱해** 등급을 덮어쓰기 때문이다. 부모가 전부 PD/CC-BY 라 오탐은 0이었지만,
// 그 80편은 「법적으로 막힌 것」으로 집계돼 **처방 없음**으로 분류됐다.
//
// 발견이 늦은 이유가 이 파일의 존재 이유다 — **슬러그 6개 중 하나만 깨진다.**
// `CC_BY`→`BY` · `CC_BY_SA`→`SA` · `CC0`→`CC0` 는 우연히 맞아서 조용했고,
// `PUBLIC_DOMAIN` 만 공백이 없어 `'PUBLIC DOMAIN'` 검사를 빗나갔다. 표본을 하나만
// 보면 통과한다.

import { describe, expect, it } from 'vitest'

import {
  LICENSE_TEXT_BY_CLASS,
  isLicenseClassSlug,
  licenseClassOf,
  licenseTextOf,
  type LicenseClass,
} from './_curation-spec'

const CLASSES = Object.keys(LICENSE_TEXT_BY_CLASS) as LicenseClass[]

describe('license 표기 ↔ 등급 왕복', () => {
  it('모든 등급이 정본 표기를 갖는다', () => {
    // `Record<LicenseClass, string>` 이라 TS 가 누락을 잡지만, 값이 빈 문자열이면
    // 통과한다 — 그래서 값도 본다.
    for (const c of CLASSES) expect(LICENSE_TEXT_BY_CLASS[c].trim().length).toBeGreaterThan(0)
  })

  it('정본 표기를 다시 분류하면 같은 등급이 나온다 (왕복)', () => {
    for (const c of CLASSES) {
      expect(licenseClassOf(LICENSE_TEXT_BY_CLASS[c]), `${c} 왕복`).toBe(c)
    }
  })

  it('★슬러그를 그대로 `license` 에 쓰면 등급이 어긋난다 — 사고의 재현', () => {
    // 이 단언이 깨지면 `licenseClassOf` 가 슬러그도 받게 바뀐 것이다. 그때는
    // 이 테스트가 아니라 **DB `acp_classify_license` 와의 대칭**을 먼저 확인할 것
    // (정책층만 고치면 화면과 DB 가 갈린다 — `licenseClassOf` 주석의 NC 사고와 같은 모양).
    expect(licenseClassOf('public_domain')).toBe('restricted')
    // 나머지가 우연히 맞는 것도 고정해 둔다 — "슬러그를 써도 되더라" 는 오해를 막는다.
    expect(licenseClassOf('cc_by')).toBe('cc_by')
    expect(licenseClassOf('cc0')).toBe('cc0')
  })

  it('licenseTextOf 는 슬러그를 정본 표기로 바꾸고 원문 표기는 그대로 둔다', () => {
    for (const c of CLASSES) expect(licenseTextOf(c)).toBe(LICENSE_TEXT_BY_CLASS[c])
    expect(licenseTextOf('CC BY 4.0')).toBe('CC BY 4.0')
    expect(licenseTextOf('Public Domain (US Gov)')).toBe('Public Domain (US Gov)')
    expect(licenseTextOf('  cc_by_sa  ')).toBe(LICENSE_TEXT_BY_CLASS.cc_by_sa)
  })

  it('licenseTextOf 를 거친 값은 등급을 보존한다 — 각색 경로가 쓰는 성질', () => {
    for (const c of CLASSES) {
      expect(licenseClassOf(licenseTextOf(c)), `${c} 각색 왕복`).toBe(c)
    }
  })

  it('빈 값은 조용히 restricted 가 되지 않는다', () => {
    // `?? 'public_domain'` 폴백이 사라져도 빈 문자열이 restricted 로 떨어지지 않게.
    expect(licenseClassOf(licenseTextOf(null))).toBe('public_domain')
    expect(licenseClassOf(licenseTextOf(''))).toBe('public_domain')
  })

  it('isLicenseClassSlug 가 표기와 슬러그를 가른다', () => {
    for (const c of CLASSES) expect(isLicenseClassSlug(c)).toBe(true)
    for (const c of CLASSES) expect(isLicenseClassSlug(LICENSE_TEXT_BY_CLASS[c])).toBe(false)
  })
})
