// packages/library-pipeline/src/ingest-article/nasa-dates.test.ts
//
// **NASA 이미지 쪽의 발행일이 조용히 비어 있었다.**
//
// 실측 근거 (2026-09-02): 초·중 창(42~173어)에 드는 NASA 지문 110편 중 **92편이
// `published_at` 없음**이었다. 어댑터는 `article:published_time` 과 `<time datetime>` 만
// 봤는데 `image-article`·`image-detail` 쪽에는 둘 다 없다 — 날짜를 안 싣는 게 아니라
// `parsely-pub-date` · `og:updated_time` 이라는 다른 이름으로 싣는다.
//
// ⚠️ 이 결함은 **아무 오류도 내지 않는다.** 글은 정상으로 들어오고 본문도 멀쩡하고
//   `published_at` 만 null 이다. 원문 축(B5 발행일 명시율)을 만들고 나서야 보였다.
//   그래서 축이 아니라 **테스트로** 못을 박는다 — 다음에 이 목록을 줄이면 여기서 걸린다.

import { describe, expect, it } from 'vitest'

import { NASA_DATE_PATTERNS } from './nasa'
import { extractFirst } from './_helpers'

/** nasa.gov/image-article/… 실측 형태. */
const imageArticle = `
<html><head>
<meta property="og:updated_time" content="2026-06-11T12:55:14-04:00" />
<meta name="parsely-pub-date" content="2026-06-11T16:55:12Z" />
</head><body>Soccer Meets Space Science</body></html>`

/** nasa.gov/image-detail/… 실측 형태 — 고친 시각 하나뿐이다. */
const imageDetail = `
<html><head>
<meta property="og:updated_time" content="2026-07-21T16:10:13-04:00" />
</head><body>A New Look for Messier 94</body></html>`

/** 일반 기사 쪽 — 원래 보던 자리. */
const articlePage = `
<html><head>
<meta property="article:published_time" content="2026-05-02T10:00:00Z" />
<meta property="og:updated_time" content="2026-08-30T10:00:00Z" />
</head><body>본문</body></html>`

describe('NASA 발행일 추출', () => {
  it('image-article 쪽에서 parsely-pub-date 를 읽는다', () => {
    expect(extractFirst(imageArticle, NASA_DATE_PATTERNS)).toBe('2026-06-11T16:55:12Z')
  })

  it('image-detail 쪽은 og:updated_time 밖에 없어도 날짜를 얻는다', () => {
    expect(extractFirst(imageDetail, NASA_DATE_PATTERNS)).toBe('2026-07-21T16:10:13-04:00')
  })

  it('발행 시각이 있으면 고친 시각보다 **앞선다**', () => {
    // 순서가 뒤집히면 2026-05-02 대신 2026-08-30 이 들어가 넉 달을 잘못 적게 된다.
    expect(extractFirst(articlePage, NASA_DATE_PATTERNS)).toBe('2026-05-02T10:00:00Z')
  })

  it('예전 두 패턴만으로는 이미지 쪽에서 아무것도 못 찾는다 — 이 결함의 재현', () => {
    const OLD = [
      /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
      /<time[^>]*datetime="([^"]+)"/i,
    ]
    expect(extractFirst(imageArticle, OLD)).toBeUndefined()
    expect(extractFirst(imageDetail, OLD)).toBeUndefined()
  })

  it('날짜가 정말 없으면 undefined 다 — 아무 값이나 지어내지 않는다', () => {
    expect(extractFirst('<html><head></head><body>글</body></html>', NASA_DATE_PATTERNS)).toBeUndefined()
  })
})
