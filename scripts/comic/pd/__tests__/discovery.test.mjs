// scripts/comic/pd/__tests__/discovery.test.mjs
//
// 발견(discovery) 단계 회귀.
//
// 이 층이 있는 이유가 곧 테스트해야 할 사실이다 — 초기 한 줄 질의(`q AND mediatype:texts`)는
// "classics illustrated" 검색에 **2017년 저작권 살아 있는 그림책**을 상위로 올렸다.
// PD 파이프라인에서 그건 단순한 검색 품질 문제가 아니라 법적 사고의 입구다.

import { describe, expect, it } from 'vitest'

import {
  assessPdRisk,
  buildQuery,
  PD_YEAR_CUTOFF,
  RENEWAL_ERA_END,
  rankByPdRisk,
  sortParam,
  yearFromTitle,
} from '../sources/discovery.mjs'

describe('buildQuery', () => {
  it('맨 질의는 제목 검색으로 감싼다 (전문 검색은 만화책 OCR 본문에 걸린다)', () => {
    expect(buildQuery('classics illustrated')).toBe(
      'title:(classics illustrated) AND mediatype:texts',
    )
  })

  it('사용자가 필드 문법을 쓰면 그대로 존중한다', () => {
    expect(buildQuery('creator:Fawcett')).toBe('(creator:Fawcett) AND mediatype:texts')
    expect(buildQuery('subject:comics AND year:1940')).toContain('(subject:comics AND year:1940)')
  })

  it('질의가 비어도 필터만으로 성립한다 (컬렉션 전체 훑기)', () => {
    expect(buildQuery('', { collection: 'fawcett-comics' })).toBe(
      'mediatype:texts AND collection:fawcett-comics',
    )
  })

  it('연도 상한만 줘도 범위 질의가 닫힌다', () => {
    expect(buildQuery('x', { yearTo: 1963 })).toContain('date:[1800-01-01 TO 1963-12-31]')
    expect(buildQuery('x', { yearFrom: 1938 })).toContain('date:[1938-01-01 TO 2100-12-31]')
  })
})

describe('sortParam', () => {
  it('관련도는 빈 문자열 — IA 기본값을 건드리지 않는다', () => {
    expect(sortParam('relevance')).toBe('')
    expect(sortParam(undefined)).toBe('')
  })
  it('나머지는 IA 문법으로 바뀐다', () => {
    expect(sortParam('downloads')).toBe('downloads desc')
    expect(sortParam('year-asc')).toBe('date asc')
    expect(sortParam('year-desc')).toBe('date desc')
  })
})

describe('yearFromTitle', () => {
  it('제목 안 연도를 건진다 (IA year 필드가 자주 비어 있다)', () => {
    expect(yearFromTitle('Fawcett Comics: Whiz Comics 002 (1940-02)')).toBe(1940)
    expect(yearFromTitle('Action Comics 1938')).toBe(1938)
  })

  it('호수를 연도로 오해하지 않는다', () => {
    expect(yearFromTitle('Beware Terror Tales Issue 002')).toBeUndefined()
    expect(yearFromTitle('Classics Illustrated -027- The Spy')).toBeUndefined()
    expect(yearFromTitle('Rocky Lane Comic Books')).toBeUndefined()
  })

  it('여러 연도가 있으면 가장 이른 것 — 재판 연도가 뒤에 붙는다', () => {
    expect(yearFromTitle('Reprint 1998 of 1943 issue')).toBe(1943)
  })

  it('미래 연도는 무시한다', () => {
    expect(yearFromTitle('Catalog 2099 edition')).toBeUndefined()
  })
})

describe('assessPdRisk', () => {
  const item = (publishedYear, collection) => ({ publishedYear, raw: { collection } })

  it(`${RENEWAL_ERA_END}년 초과는 무조건 high — 갱신 조사 여지가 없다`, () => {
    expect(assessPdRisk(item(2017, ['opensource'])).level).toBe('high')
    expect(assessPdRisk(item(1990, ['fawcett-comics'])).level).toBe('high')
  })

  it(`${PD_YEAR_CUTOFF}년 이하 + 큐레이션이면 ok`, () => {
    expect(assessPdRisk(item(1928, ['fawcett-comics'])).level).toBe('ok')
  })

  it('연도상 PD 여도 출처 미검증이면 ok 로 올리지 않는다', () => {
    expect(assessPdRisk(item(1928, ['opensource'])).level).toBe('caution')
  })

  it('갱신 구간(1931~1963)은 큐레이션 여부와 무관하게 caution — 사람이 확인해야 한다', () => {
    expect(assessPdRisk(item(1952, ['fawcett-comics'])).level).toBe('caution')
  })

  it('무검증 업로드 + 갱신 구간은 high 로 내린다', () => {
    // 실측: collection:comics 상위가 Batman·Spawn·Daredevil 이었다
    expect(assessPdRisk(item(1940, ['comics', 'community'])).level).toBe('high')
  })

  it('연도 불명 + 무검증 업로드도 high', () => {
    expect(assessPdRisk(item(undefined, ['opensource'])).level).toBe('high')
    expect(assessPdRisk(item(undefined, ['fawcett-comics'])).level).toBe('caution')
  })

  it('컬렉션 정보가 아예 없어도 터지지 않는다', () => {
    expect(assessPdRisk({}).level).toBe('caution')
    expect(assessPdRisk(null).level).toBe('caution')
  })
})

describe('rankByPdRisk', () => {
  it('쓸 수 있는 것이 위로, 위험한 것이 아래로', () => {
    const input = [
      { title: '위험', publishedYear: 2017, raw: { collection: ['opensource'] } },
      { title: '확정', publishedYear: 1925, raw: { collection: ['fawcett-comics'] } },
      { title: '확인필요', publishedYear: 1952, raw: { collection: ['fawcett-comics'] } },
    ]
    expect(rankByPdRisk(input).map((x) => x.title)).toEqual(['확정', '확인필요', '위험'])
  })

  it('같은 등급이면 큐레이션이 먼저', () => {
    const input = [
      { title: '무검증', publishedYear: 1952, raw: { collection: ['folkscanomy'] } },
      { title: '큐레이션', publishedYear: 1952, raw: { collection: ['fawcett-comics'] } },
    ]
    const out = rankByPdRisk(input)
    expect(out[0].title).toBe('큐레이션')
    expect(out[0].pdCurated).toBe(true)
  })

  it('같은 등급·같은 큐레이션 상태면 원래 관련도 순서를 지킨다', () => {
    const mk = (t) => ({ title: t, publishedYear: 1952, raw: { collection: ['fawcett-comics'] } })
    expect(rankByPdRisk([mk('a'), mk('b'), mk('c')]).map((x) => x.title)).toEqual(['a', 'b', 'c'])
  })

  it('판정 결과를 항목에 실어 보낸다 (UI 가 배지로 쓴다)', () => {
    const [x] = rankByPdRisk([{ publishedYear: 2017, raw: { collection: ['opensource'] } }])
    expect(x.pdRisk).toBe('high')
    expect(x.pdRiskReason).toContain('2017')
  })
})
