// apps/web/src/lib/seo/__tests__/structured-data.test.ts
//
// 구조화 데이터가 지키는 두 가지: **지어내지 않는다** · **빈 값을 넣지 않는다.**
//
// 왜 테스트로 못 박나:
//   구조화 데이터는 화면에 안 보인다. 평점이나 리뷰 수를 하나 끼워 넣어도 아무도 눈치채지
//   못하는데, 그건 검색엔진 페널티 사유다. 이 저장소는 이미 공개 화면에 지어낸 지표를
//   걸었다가 걷어낸 이력이 있다(`/pricing` "평점 4.8 / 학교 34곳", 실측 0 / 0).
//   보이지 않는 자리일수록 규칙을 코드로 옮겨야 한다.
//
//   빈 값도 같은 문제다. `author: null` 이나 `wordCount: 0` 은 "저자가 없다"·"낱말이 0" 이라고
//   **말하는** 것이다 — 모른다는 뜻이 아니다. 모르면 키를 빼는 게 정확하다.

import { describe, expect, it } from 'vitest'

import { bookJsonLd, comicIssueJsonLd } from '../structured-data'

/** 어떤 콘텐츠에도 들어가선 안 되는 키 — 전부 실측 불가능한 것들이다. */
const FORBIDDEN = ['aggregateRating', 'ratingValue', 'reviewCount', 'review']

describe('Book 구조화 데이터', () => {
  const full = bookJsonLd({
    id: 'abc',
    title: 'Alice in Wonderland',
    author: 'Lewis Carroll',
    wordCount: 26_000,
    chapterCount: 12,
  })

  it('필수 필드를 담는다', () => {
    const o = JSON.parse(full)
    expect(o['@type']).toBe('Book')
    expect(o.name).toBe('Alice in Wonderland')
    expect(o.url).toMatch(/\/library\/books\/abc$/)
    expect(o.author).toEqual({ '@type': 'Person', name: 'Lewis Carroll' })
  })

  it('무료·퍼블릭 도메인을 명시한다 — 검색하는 사람이 알고 싶어 하는 것', () => {
    const o = JSON.parse(full)
    expect(o.isAccessibleForFree).toBe(true)
    expect(o.license).toContain('publicdomain')
  })

  it('평점·리뷰를 지어내지 않는다', () => {
    for (const key of FORBIDDEN) {
      expect(full, `${key} 가 들어 있다 — 실측할 수 없는 값이다`).not.toContain(key)
    }
  })

  it('모르는 값은 키를 뺀다 — null 을 넣는 것은 "없다" 고 말하는 것이다', () => {
    const bare = JSON.parse(bookJsonLd({ id: 'x', title: 'T' }))
    expect('author' in bare).toBe(false)
    expect('wordCount' in bare).toBe(false)
    expect('numberOfChapters' in bare).toBe(false)
    expect(bare.name).toBe('T')
  })

  it('0 은 값이 아니다 — 낱말 0 개인 책을 광고하지 않는다', () => {
    const zero = JSON.parse(bookJsonLd({ id: 'x', title: 'T', wordCount: 0, chapterCount: 0 }))
    expect('wordCount' in zero).toBe(false)
    expect('numberOfChapters' in zero).toBe(false)
  })
})

describe('ComicIssue 구조화 데이터', () => {
  const full = comicIssueJsonLd({
    slug: 'whiz-comics-2',
    title: 'Whiz Comics v01n02',
    seriesTitle: 'Whiz Comics',
    issueNo: 2,
    publishedYear: 1940,
    sourceArchive: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/x',
  })

  it('호·연도·시리즈를 담는다', () => {
    const o = JSON.parse(full)
    expect(o['@type']).toBe('ComicIssue')
    expect(o.issueNumber).toBe(2)
    expect(o.datePublished).toBe('1940')
    expect(o.isPartOf).toEqual({ '@type': 'ComicSeries', name: 'Whiz Comics' })
  })

  it('출처 아카이브를 citation 으로 남긴다 — PD 여도 출처는 밝힌다', () => {
    const o = JSON.parse(full)
    expect(o.citation.url).toBe('https://archive.org/details/x')
    expect(o.citation.name).toBe('Internet Archive')
  })

  it('평점·리뷰를 지어내지 않는다', () => {
    for (const key of FORBIDDEN) {
      expect(full).not.toContain(key)
    }
  })

  it('시리즈명이 호 제목과 같으면 넣지 않는다 — 자기 자신에 속한다는 말은 정보가 아니다', () => {
    // 실제로 카탈로그에 그런 행이 있다(Super Mystery Comics — 시리즈명 = 호 제목).
    const same = JSON.parse(comicIssueJsonLd({ slug: 's', title: 'X', seriesTitle: 'X' }))
    expect('isPartOf' in same).toBe(false)
  })

  it('시리즈·출처를 모르면 그 키가 없다', () => {
    const bare = JSON.parse(comicIssueJsonLd({ slug: 's', title: 'T' }))
    expect('isPartOf' in bare).toBe(false)
    expect('citation' in bare).toBe(false)
    expect('issueNumber' in bare).toBe(false)
    expect('datePublished' in bare).toBe(false)
  })

  it('두 타입 모두 유효한 JSON 이다', () => {
    expect(() => JSON.parse(full)).not.toThrow()
  })

  /**
   * **`</script>` 로 태그를 끊을 수 없어야 한다.**
   *
   * 도서·만화 제목은 외부 아카이브(IA · Standard Ebooks)에서 온 값이라 통제되지 않는다.
   * `JSON.stringify` 는 `<` 를 그대로 두므로, 그것만 믿고 `dangerouslySetInnerHTML` 에
   * 넣으면 제목 하나로 스크립트가 끊기고 뒤가 마크업으로 읽힌다.
   *
   * "JSON.parse 가 안 터진다" 로는 못 잡는다 — 그건 통과하면서도 HTML 은 깨진다.
   * 그래서 **출력 문자열에 `<` 가 하나도 없는지**를 본다.
   */
  it.each([
    ['만화', () => comicIssueJsonLd({ slug: 's', title: 'A </script><img> B' })],
    ['도서', () => bookJsonLd({ id: 'x', title: 'A </script><img> B', author: '</script>' })],
  ])('%s — 제목의 </script> 가 태그를 끊지 못한다', (_label, build) => {
    const out = build()
    expect(out, 'HTML 파서가 태그로 읽을 수 있는 < 가 남았다').not.toContain('<')
    // 의미는 보존된다 — 파서는 원래 문자열로 되돌린다.
    expect(JSON.parse(out).name).toBe('A </script><img> B')
  })
})
