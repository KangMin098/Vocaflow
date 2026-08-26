// apps/web/src/lib/seo/structured-data.ts
//
// 콘텐츠 상세의 **구조화 데이터** — 검색 결과에서 제목 한 줄이 아니라 작품으로 보이게 한다.
//
// 왜 지금인가 (2026-08-26):
//   같은 날 sitemap 에 콘텐츠 상세 **123개**(발행 도서 13 + 발행 만화 110)를 올렸다.
//   그런데 그 페이지들은 `<title>` 말고는 검색엔진에 아무것도 말하지 않는다.
//   저자·언어·무료 여부·퍼블릭 도메인 같은 건 본문에 한국어로 적혀 있을 뿐이라
//   기계가 읽지 못한다. 롱테일 유입이 이 제품의 CAC 0 경로 중 하나라 그 표면의 품질이 곧 유입이다.
//
// ── 무엇을 넣고 무엇을 넣지 않는가 ──────────────────────────────────
// **DB 에 있는 사실만** 넣는다. 평점(`aggregateRating`)·리뷰 수는 넣지 않는다 —
// 구조화 데이터의 허위 표기는 검색엔진 페널티 사유이고, 애초에 이 저장소는 공개 화면에
// 지어낸 지표를 걸었다가 걷어낸 이력이 있다(`/pricing` "평점 4.8", 실측 0).
// 값이 없으면 **키를 넣지 않는다** — `null` 이나 `0` 을 넣는 것보다 없는 편이 정확하다.
//
// `/fit` 의 `WebApplication`+`FAQPage` 는 그 화면 안에 남아 있다(화면 고유의 서술이라
// 여기로 옮기면 오히려 멀어진다). 이 파일은 **카탈로그 콘텐츠**만 다룬다.

import { absoluteUrl } from './site'

/** `<script type="application/ld+json">` 에 그대로 넣을 문자열. */
export type JsonLdString = string

type Json = Record<string, unknown>

/** 값이 있는 키만 남긴다 — 빈 값을 구조화 데이터에 넣지 않는다. */
function compact(o: Json): Json {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

/**
 * `<script>` 안에 넣어도 안전한 JSON 문자열.
 *
 * ⚠️ **`JSON.stringify` 만으로는 안전하지 않다.** `<` 를 이스케이프하지 않으므로 제목에
 *    `</script>` 가 들어 있으면 브라우저가 거기서 스크립트를 끊고 나머지를 마크업으로 읽는다.
 *    `/fit` 의 구조화 데이터는 "코드가 만든 문자열" 이라 이 문제가 없었지만, 여기는 다르다 —
 *    **도서·만화 제목은 외부 아카이브(IA·Standard Ebooks)에서 온 값**이라 통제되지 않는다.
 *
 *    `<` 는 JSON 문자열 안에서 유효하고 파서가 `<` 로 되돌린다. 즉 구조화 데이터의
 *    의미는 그대로이고 HTML 파서만 속지 않는다.
 */
export function serialize(value: unknown): JsonLdString {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export interface BookFacts {
  id: string
  title: string
  author?: string | null
  /** 낱말 수 — 있으면 분량 신호가 된다. */
  wordCount?: number | null
  /** 챕터 수. */
  chapterCount?: number | null
}

/**
 * 발행 도서 상세 — `Book`.
 *
 * `isAccessibleForFree` 와 퍼블릭 도메인 라이선스를 명시한다. 이 카탈로그의 성질이자
 * 검색하는 사람이 실제로 알고 싶어 하는 것이다("무료로 읽을 수 있나").
 * 도서는 전부 `copyright_safe_in_kr` 를 통과한 것만 발행되므로(같은 조건을 sitemap 도 쓴다)
 * 이 표기는 추정이 아니라 파이프라인이 보장하는 사실이다.
 */
export function bookJsonLd(b: BookFacts): JsonLdString {
  return serialize(
    compact({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: b.title,
      url: absoluteUrl(`/library/books/${b.id}`),
      inLanguage: 'en',
      bookFormat: 'https://schema.org/EBook',
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      author: b.author ? { '@type': 'Person', name: b.author } : undefined,
      numberOfPages: undefined, // 쪽 수는 DB 에 없다 — 낱말 수로 대신하지 않는다(다른 단위다)
      // 학습용 서술 — 이 카탈로그가 원문 그대로가 아니라 **어휘와 함께** 읽히는 곳임을 말한다.
      isPartOf: {
        '@type': 'Collection',
        name: 'Vocaflow Library',
        url: absoluteUrl('/library/books'),
      },
      ...(typeof b.wordCount === 'number' && b.wordCount > 0
        ? { wordCount: b.wordCount }
        : {}),
      ...(typeof b.chapterCount === 'number' && b.chapterCount > 0
        ? { numberOfChapters: b.chapterCount }
        : {}),
    }),
  )
}

export interface ComicFacts {
  slug: string
  title: string
  seriesTitle?: string | null
  issueNo?: number | null
  publishedYear?: number | null
  sourceArchive?: string | null
  sourceUrl?: string | null
}

/**
 * 복원 만화 상세 — `ComicIssue`.
 *
 * schema.org 에 실재하는 타입이고 `ComicSeries` 와 짝을 이룬다. 시리즈가 있으면
 * `isPartOf` 로 묶어 준다 — 같은 시리즈의 다른 호가 함께 발견되는 것이 이 카탈로그의 값이다.
 *
 * 출처 아카이브를 `citation` 으로 남긴다. "1945년 원본을 복원했다" 는 사실 자체가
 * 이 콘텐츠의 매력이고, 출처를 밝히는 것은 PD 라도 신뢰의 문제다(리더 화면과 같은 원칙).
 */
export function comicIssueJsonLd(c: ComicFacts): JsonLdString {
  return serialize(
    compact({
      '@context': 'https://schema.org',
      '@type': 'ComicIssue',
      name: c.title,
      url: absoluteUrl(`/comics/restored/${c.slug}`),
      inLanguage: 'en',
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      ...(typeof c.issueNo === 'number' ? { issueNumber: c.issueNo } : {}),
      ...(typeof c.publishedYear === 'number'
        ? { datePublished: String(c.publishedYear) }
        : {}),
      // 시리즈명이 호 제목과 같으면 넣지 않는다 — "이 작품은 이 작품에 속한다" 는
      // 아무 정보도 아니고, 실제로 카탈로그에 그런 행이 있다(예: Super Mystery Comics).
      ...(c.seriesTitle && c.seriesTitle !== c.title
        ? { isPartOf: { '@type': 'ComicSeries', name: c.seriesTitle } }
        : {}),
      ...(c.sourceUrl
        ? {
            citation: compact({
              '@type': 'CreativeWork',
              name: c.sourceArchive ?? undefined,
              url: c.sourceUrl,
            }),
          }
        : {}),
    }),
  )
}
