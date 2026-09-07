// packages/library-pipeline/src/ingest-article/voa-sitemap.test.ts
//
// **VOA 사이트맵 경로의 회귀** — 여기서 잠그는 것은 셋이다.
//
//   ① 메타 정규식 2개가 실제 HTML 과 안 맞던 것 (조용히 폴백으로 흘렀다)
//   ② 사이트맵 열쇠가 적재기와 **같은 함수**로 만들어지는 것
//   ③ `feed_id` 가 절대 비지 않는 것 (NULL 이면 register 가 소스 기본값으로 떨어진다)
//
// ⚠️ 아래 픽스처의 **속성 순서와 엔티티는 실제 VOA HTML 그대로다**(2026-09-07 실측,
//   `/a/methane-mystery-on-mars-could-it-mean-life-/4976623.html`). 보기 좋게 고치면
//   이 테스트가 지키던 것이 사라진다 — 틀렸던 정규식은 **순서** 때문에 안 맞았고,
//   NULL 236행은 **엔티티**(`&#x2B;`) 때문에 났다.

import { describe, expect, it } from 'vitest'

import { sourceKey } from './source-key'
import {
  isVoaReferencePiece,
  parseVoaArticle,
  parseVoaSitemapXml,
  voaFeedIdForSection,
  voaFeedIdFor,
  voaJsonLd,
  VOA_ARTICLE_SITEMAPS,
} from './voa'

const URL_REAL = 'https://learningenglish.voanews.com/a/methane-mystery-on-mars-could-it-mean-life-/4976623.html'

/** 실제 판형: `content` 가 `property` 보다 **앞에** 온다. `article:published_time` 은 **없다.** */
const META_BLOCK = `
<meta content="Methane Mystery on Mars: Could It Mean Life?" property="og:title">
<meta content="https://www.facebook.com/voalearningenglish" property="article:publisher">
<title>Methane Mystery on Mars: Could It Mean Life?</title>
<time pubdate="pubdate" datetime="2019-06-30T22:02:29&#x2B;00:00">
`

const LD_BLOCK = `<script type="application/ld+json">{"articleSection":"Science \\u0026amp; Technology","headline":"Methane Mystery on Mars: Could It Mean Life?","author":{"@type":"Person","name":"VOA Learning English"},"datePublished":"2019-06-30 22:02:29Z","@type":"NewsArticle"}</script>`

/** 200어를 넘겨야 적재기가 통과시킨다 — 본문 길이 게이트는 이 테스트의 대상이 아니다. */
const BODY = Array.from({ length: 14 }, (_, i) =>
  `<p>NASA said its Mars exploration vehicle recorded a high level of methane gas on the planet number ${i}. The discovery was exciting because the presence of methane could support the case for life on Mars.</p>`,
).join('')

const html = (opts: { ld?: boolean } = {}) =>
  `<html><head>${META_BLOCK}${opts.ld === false ? '' : LD_BLOCK}</head>` +
  `<body><div class="wsw"><div class="player">no media source currently available.</div>${BODY}</div></body></html>`

describe('VOA 메타 — JSON-LD 가 정본, 메타는 폴백', () => {
  it('예전 정규식 2개는 이 HTML 과 실제로 안 맞는다 (그게 결함이었다)', () => {
    // 이 단정이 깨지면 "고쳤다" 의 전제가 사라진 것이다 — 픽스처가 실제 판형이 아니게 됐다.
    expect(/<meta\s+property="og:title"\s+content="([^"]+)"/i.test(META_BLOCK)).toBe(false)
    expect(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i.test(META_BLOCK)).toBe(false)
  })

  it('JSON-LD 에서 제목·발행일·섹션을 읽는다', () => {
    const { article, articleSection } = parseVoaArticle(html(), URL_REAL)
    expect(article.title).toBe('Methane Mystery on Mars: Could It Mean Life?')
    expect(article.published_at?.toISOString()).toBe('2019-06-30T22:02:29.000Z')
    // `&amp;` → JSON.parse → `&amp;` → decodeEntities → `&`
    expect(articleSection).toBe('Science & Technology')
    expect(article.author).toBe('VOA Learning English')
  })

  it('JSON-LD 가 없어도 발행일이 NULL 이 되지 않는다 — 236행이 그렇게 비었다', () => {
    // `<time datetime>` 값은 엔티티가 살아 있다(`&#x2B;`). 디코드 없이 new Date() 하면 Invalid Date 다.
    const { article } = parseVoaArticle(html({ ld: false }), URL_REAL)
    expect(article.published_at).not.toBeNull()
    expect(article.published_at?.toISOString()).toBe('2019-06-30T22:02:29.000Z')
  })

  it('JSON-LD 가 없으면 og:title 을 속성 순서와 무관하게 읽는다', () => {
    const { article } = parseVoaArticle(html({ ld: false }), URL_REAL)
    expect(article.title).toBe('Methane Mystery on Mars: Could It Mean Life?')
    expect(article.title).not.toBe('(제목 미상)')
  })

  it('열쇠는 적재기와 목록기가 같다', () => {
    const { article } = parseVoaArticle(html(), URL_REAL)
    expect(article.source_id).toBe(sourceKey('voa', { url: URL_REAL }))
    expect(article.source_id).toBe('voa:4976623')
  })

  it('wsw 컨테이너가 없으면 던진다 — chrome 을 본문으로 긁지 않는다', () => {
    expect(() => parseVoaArticle('<html><body><nav>menu</nav></body></html>', URL_REAL)).toThrow(
      /no transcript body/,
    )
  })

  it('voaJsonLd 는 깨진 JSON-LD 블록을 만나도 다음 블록을 본다', () => {
    const broken = `<script type="application/ld+json">{ not json }</script>${LD_BLOCK}`
    expect(voaJsonLd(broken)?.headline).toBe('Methane Mystery on Mars: Could It Mean Life?')
  })
})

describe('사이트맵 열거', () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>${URL_REAL}</loc><lastmod>2019-06-30T22:02:29+00:00</lastmod></url>
    <url><loc>https://learningenglish.voanews.com/a/3657588.html</loc><lastmod>2017-01-02T00:00:00Z</lastmod></url>
    <url><loc>https://learningenglish.voanews.com/p/6861.html</loc></url>
    <url><loc>https://learningenglish.voanews.com/z/1579</loc></url>
  </urlset>`

  it('두 URL 판형(슬러그형 · 숫자형) 모두에서 article id 를 뽑는다', () => {
    const { entries } = parseVoaSitemapXml(xml)
    expect(entries.map((e) => e.source_id)).toContain('voa:4976623')
    expect(entries.map((e) => e.source_id)).toContain('voa:3657588')
  })

  it('열쇠를 못 뽑는 URL 은 해시로 채우지 않고 버리고 센다', () => {
    const { entries, skipped } = parseVoaSitemapXml(xml)
    // `/z/1579` 는 코너 쪽이라 id 가 없다. `/p/6861.html` 은 숫자가 4자리라 열쇠 모양을 만족한다
    //   (그건 걸러 낼 자리가 아니라 GET 후 `wsw` 없음으로 떨어질 자리다).
    expect(skipped).toBe(1)
    expect(entries).toHaveLength(3)
    expect(entries.every((e) => /^voa:[0-9]{4,}$/.test(e.source_id))).toBe(true)
  })

  it('lastmod 를 보존한다 — 균등 간격 표본이 이 값을 쓴다', () => {
    const { entries } = parseVoaSitemapXml(xml)
    expect(entries[0]!.lastmod).toBe('2019-06-30T22:02:29+00:00')
  })

  it('기사 사이트맵은 4개이고 videos/sections 를 포함하지 않는다', () => {
    expect(VOA_ARTICLE_SITEMAPS).toHaveLength(4)
    expect(VOA_ARTICLE_SITEMAPS.some((u) => /videos|sections/.test(u))).toBe(false)
  })
})

describe('feed_id — 비지 않고, 기존 RSS 피드와 갈리지 않는다', () => {
  it('이미 배선된 코너는 RSS 와 같은 id 로 모인다', () => {
    expect(voaFeedIdForSection('Science & Technology')).toBe('science-technology')
    expect(voaFeedIdForSection('As It Is')).toBe('as-it-is')
    expect(voaFeedIdForSection('U.S. History')).toBe('us-history')
    expect(voaFeedIdForSection('Health & Lifestyle')).toBe('health-lifestyle')
  })

  it('표에 없는 코너는 슬러그가 된다 (& 는 and 로)', () => {
    expect(voaFeedIdForSection('Environment & Science')).toBe('environment-and-science')
    expect(voaFeedIdForSection('Explorations')).toBe('explorations')
  })

  it('섹션이 비어도 절대 NULL·빈 문자열이 아니다', () => {
    // NULL 이면 `resolveArticleRegister` 가 소스 기본값('news')으로 떨어진다 — 2026-08-20 37편.
    for (const s of [null, undefined, '', '   ', '!!!']) {
      expect(voaFeedIdForSection(s)).toBeTruthy()
    }
    expect(voaFeedIdForSection(null)).toBe('voa-unsectioned')
    expect(voaFeedIdForSection('!!!')).toBe('voa-unsectioned')
  })
})

describe('옛 아카이브 — 코너가 섹션이 아니라 제목에 있다', () => {
  it('제목 앞머리의 대문자 코너를 읽는다 (실측 제목 그대로)', () => {
    expect(voaFeedIdFor(null, "THIS IS AMERICA - February 11, 2002: VOA's 60th Anniversary")).toBe(
      'this-is-america',
    )
    expect(voaFeedIdFor('', 'PEOPLE IN AMERICA - March 17, 2002: Langston Hughes, Part Two')).toBe(
      'people-in-america',
    )
    expect(voaFeedIdFor(null, 'IN THE NEWS - August 4, 2001: New FBI Director - 2001-08-03')).toBe(
      'in-the-news',
    )
    expect(voaFeedIdFor(null, 'EXPLORATIONS  - Space Digest - 2004-06-22')).toBe('explorations')
  })

  it('섹션이 있으면 섹션이 이긴다 — 제목은 폴백일 뿐이다', () => {
    expect(voaFeedIdFor('Science & Technology', 'IN THE NEWS - 아무개')).toBe('science-technology')
  })

  it('코너가 없는 옛 제목은 여전히 voa-unsectioned 다 (없는 코너를 지어내지 않는다)', () => {
    expect(voaFeedIdFor(null, 'August 27, 1998 - Train Lingo')).toBe('voa-unsectioned')
    expect(voaFeedIdFor(null, 'US-South Korea Exercise May Be Part of Nuclear Deal')).toBe(
      'voa-unsectioned',
    )
  })

  it('제목 가운데 오는 사전형 코너도 잡는다', () => {
    // 실측: `November 4, 2001 - Slangman: Old Slang ('Little Red Riding Hood')` — 속어 뜻풀이 나열.
    expect(isVoaReferencePiece('voa-unsectioned', "November 4, 2001 - Slangman: Old Slang")).toBe(true)
  })
})

describe('reference 코너 배제 — 섹션이 뭉뚱그려 와도 잡는다', () => {
  it('섹션으로 잡는다', () => {
    expect(isVoaReferencePiece('words-and-their-stories', '아무 제목')).toBe(true)
    expect(isVoaReferencePiece('ask-a-teacher', '아무 제목')).toBe(true)
  })

  it('옛 아카이브는 섹션이 learningenglish 라 제목 앞머리로 잡는다', () => {
    // 실측 id 608067 — articleSection 이 코너가 아니라 `learningenglish` 였다.
    expect(isVoaReferencePiece('learningenglish', 'Words and Their Stories: In the Red')).toBe(true)
  })

  it('지문으로 쓸 코너는 배제하지 않는다', () => {
    expect(isVoaReferencePiece('as-it-is', 'A Desert Turns Green')).toBe(false)
    expect(isVoaReferencePiece('education', 'Study Shows How Poverty Could Limit Learning')).toBe(false)
    // Lessons of the Day 는 이름만 강좌다 — 실제 내용은 일반 피처(실측 CEFR B1 7 · B2 5).
    expect(isVoaReferencePiece('lets-learn-english', 'The Goodyear Blimp')).toBe(false)
  })
})
