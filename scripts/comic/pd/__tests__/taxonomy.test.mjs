// scripts/comic/pd/__tests__/taxonomy.test.mjs
//
// 분류(taxonomy) 회귀 — **이 분류가 학습자 서가의 묶음 그 자체다.**
//
// 여기서 조용히 갈라지면 화면에는 아무 에러도 안 뜬다. 그냥 같은 시리즈가 두 칸으로
// 나뉘거나(Slam-Bang / Slam Bang), 파생 간행물이 본편을 삼킨다(Captain Marvel Jr →
// Captain Marvel). 둘 다 "동작하는 오답" 이라 사람이 목록을 세어보기 전엔 모른다.
// 그래서 실측 제목 표기 변형을 고정해 둔다.

import { describe, expect, it } from 'vitest'

import {
  classify,
  extractIssueNo,
  KIND_KEYS,
  KINDS,
  normalizeTitle,
  SERIES_RULES,
  separatorsToSpace,
  seriesCatalog,
} from '../taxonomy.mjs'

describe('규칙표 무결성', () => {
  it('모든 규칙의 kind 가 KINDS 에 있다 (DB FK 보다 먼저 터지게)', () => {
    for (const r of SERIES_RULES) expect(KIND_KEYS.has(r.kind)).toBe(true)
  })

  it('시리즈 키가 중복되지 않는다 — 중복되면 마스터 테이블 upsert 가 서로를 덮는다', () => {
    const keys = SERIES_RULES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('유형 key 와 정렬값이 중복되지 않는다', () => {
    expect(new Set(KINDS.map((k) => k.key)).size).toBe(KINDS.length)
    expect(new Set(KINDS.map((k) => k.sort)).size).toBe(KINDS.length)
  })

  it('seriesCatalog 는 규칙표 전량을 시딩 형태로 낸다', () => {
    expect(seriesCatalog()).toHaveLength(SERIES_RULES.length)
    expect(seriesCatalog()[0]).toHaveProperty('kind')
  })
})

describe('구분자 정규화', () => {
  // 실측: 이 두 건이 미분류로 떨어져 Slam-Bang·Spy Smasher 시리즈가 갈라져 있었다.
  it('하이픈·언더스코어를 공백으로 통일한다', () => {
    expect(separatorsToSpace('Slam-Bang_Comics.003')).toBe('Slam Bang Comics 003')
  })

  it('아포스트로피는 남긴다 — 규칙이 실제로 쓰는 문자다', () => {
    expect(separatorsToSpace("America's Greatest")).toBe("America's Greatest")
  })
})

describe('판본 꼬리표 제거', () => {
  it.each([
    ['Fawcett Comics: Whiz Comics 022 (b and w) (coverless) (24p)', 'Whiz Comics 022'],
    ['Fawcett Comics: Wow Comics 010 (alt scan)', 'Wow Comics 010'],
    ['Bulletman Comics (Fawcett Comics) Issue #8', 'Bulletman Comics Issue #8'],
  ])('%s → %s', (raw, want) => {
    expect(normalizeTitle(raw).replace(/\s*\(\s*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()).toBe(want)
  })
})

describe('호수 추출 — 연도·페이지수를 호수로 착각하지 않는다', () => {
  it.each([
    ['Whiz Comics 002 (1940-02) (24p)', 2],
    ['Master Comics 100', 100],
    ['Dennis the Menace 031', 31],
    ['Fawcett Comics: Mary Marvel 007 (1946)', 7],
    // 호수가 없는 특별판은 null 이어야 한다 — 0 이나 1940 으로 채우면 정렬이 거짓말을 한다.
    ['Fawcett Comics: Captain Marvel Fun Book (1944)', null],
  ])('%s → %s', (raw, want) => {
    expect(extractIssueNo(normalizeTitle(raw))).toBe(want)
  })
})

describe('시리즈 판정 — 순서가 만드는 함정', () => {
  it('Captain Marvel Jr 가 본편 Captain Marvel 로 흡수되지 않는다', () => {
    expect(classify({ title: 'Fawcett Comics: Captain Marvel Jr 015' }).seriesKey).toBe(
      'captain-marvel-jr',
    )
    expect(classify({ title: 'Fawcett Comics: Captain Marvel Adventures 022' }).seriesKey).toBe(
      'captain-marvel',
    )
  })

  it('Mighty Midget 은 수록 캐릭터가 아니라 판형 시리즈로 잡힌다', () => {
    expect(classify({ title: 'Fawcett Comics: Mighty Midget Comics  Bulletman (' }).seriesKey).toBe(
      'mighty-midget-comics',
    )
  })

  it('Dennis the Menace Giant/Bonus 는 본편과 분리된다', () => {
    expect(classify({ title: 'Fawcett Comics: Dennis the Menace Giant 012' }).seriesKey).toBe(
      'dennis-the-menace-giant',
    )
    expect(classify({ title: 'Fawcett Comics: Dennis the Menace 031' }).seriesKey).toBe(
      'dennis-the-menace',
    )
  })

  it('Sweetheart Diary 가 Sweethearts 로 먹히지 않는다', () => {
    expect(classify({ title: 'Fawcett Comics: Sweetheart Diary 013 (1952-11)' }).seriesKey).toBe(
      'sweetheart-diary',
    )
  })

  it('Hoppy 는 Marvel 계열 이름을 달고도 명랑 동물로 간다 (어휘 도메인이 다르다)', () => {
    expect(classify({ title: 'Fawcett Comics: Hoppy the Marvel Bunny 007' }).kind).toBe(
      'funny-animal',
    )
  })

  it('표기 변형이 같은 시리즈로 모인다', () => {
    const keys = [
      'Fawcett Comics: Slam-Bang Comics 003 (1940-05) (68p)',
      'Fawcett Comics: Slam Bang Comics 001',
      'Spy_Smasher_6',
    ].map((t) => classify({ title: t }).seriesKey)
    expect(keys[0]).toBe('slam-bang-comics')
    expect(keys[1]).toBe('slam-bang-comics')
    expect(keys[2]).toBe('spy-smasher')
  })

  it('업로더 오타 Bafflng 을 흡수한다 (원본 제목이라 고칠 수 없다)', () => {
    expect(classify({ title: 'Bafflng Mysteries (Ace Comics) Issue #17' }).seriesKey).toBe(
      'baffling-mysteries',
    )
    expect(classify({ title: 'Baffling Mysteries Issue #20' }).seriesKey).toBe('baffling-mysteries')
  })

  it('제목이 부실하면 identifier 로도 판정한다', () => {
    expect(classify({ title: '', identifier: 'ClassicsIllustrated027TheSpy' }).kind).toBe(
      'classic-adaptation',
    )
  })
})

describe('미분류 처리 — 추정 시리즈를 만들어내지 않는다', () => {
  it('규칙에 없으면 other + matched:false 로 남아 검수에 걸린다', () => {
    const c = classify({ title: 'Some Completely Unknown Title 1952' })
    expect(c.kind).toBe('other')
    expect(c.matched).toBe(false)
    expect(c.seriesKey).toMatch(/^unclassified-/)
  })
})
