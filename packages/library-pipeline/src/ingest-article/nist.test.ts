// packages/library-pipeline/src/ingest-article/nist.test.ts
//
// **NIST 수확기가 조용히 0건이 되거나 조용히 쓰레기를 담는 자리를 잠근다.**
//
// 이 소스가 특별히 위험한 이유 둘:
//  ① **열쇠가 URL 경로다.** 규약(`source-key.ts`)이 원칙적으로 금지하는 꼴을 근거를 적고
//     예외로 쓰는 것이라, 그 근거가 유지되는지(목록기 = 적재기, 추적 파라미터 무시,
//     남의 호스트 거절)를 기계가 봐야 한다.
//  ② **본문 컨테이너를 못 찾았을 때 문서 전체로 물러서면** 메뉴·머리말이 지문이 되고,
//     그것은 오류 없이 게이트를 통과한다. 물러서지 **않는** 것을 못 박는다.
//
// 네트워크 없이 돈다 — fetch 를 세워 두고 NIST 가 주는 응답만 흉내 낸다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  NIST_FEEDS,
  fetchNistArticle,
  fetchNistSitemapPage,
  ingestNistArticle,
  listNistFeed,
  nistBodyHtml,
  nistCleanTitle,
  nistExtractBody,
  nistPath,
} from './nist'
import { isCanonicalSourceKey, sourceKey, stableId } from './source-key'

afterEach(() => {
  vi.unstubAllGlobals()
})

function xmlResponse(xml: string) {
  return { ok: true, status: 200, text: async () => xml, json: async () => ({}) }
}
function htmlResponse(html: string) {
  return { ok: true, status: 200, text: async () => html, json: async () => ({}) }
}

const ARTICLE_PATH = 'news-events/news/2015/09/hands-nist-helps-bring-contactless-fingerprint-technology-market'
const ARTICLE_URL = `https://www.nist.gov/${ARTICLE_PATH}`

/** 실측 구조를 줄인 것 — 컨테이너 · og:title · published_time · figure 캡션 · 후미 상용구. */
function articleHtml(opts: { container?: boolean; tail?: boolean; body?: string } = {}): string {
  const body =
    opts.body ??
    'Contactless fingerprint scanners promise faster security checks, but they have to agree with the ' +
      'inked records that agencies already hold. Therefore NIST built a way to compare the two, because ' +
      'the industry could not otherwise show that its devices measure the same thing. '.repeat(12)
  const inner =
    `<figure class="nist-image"><img src="/x.jpg" alt="hand"><figcaption>Credit: NIST</figcaption></figure>` +
    `<p>${body}</p>` +
    (opts.tail === false ? '' : `<p>Media Contact: Someone at NIST, 301-555-0100.</p><p>Follow us on social media.</p>`)
  const container = opts.container === false ? `<div class="something-else">${inner}</div>` : `<div class="text-with-summary">${inner}</div>`
  return (
    `<html><head>` +
    `<title>Hands Off! NIST Helps Bring Contactless Fingerprint Technology to Market | NIST</title>` +
    `<link rel="canonical" href="${ARTICLE_URL}" />` +
    `<link rel="shortlink" href="https://www.nist.gov/node/391921" />` +
    `<meta property="og:title" content="Hands Off! NIST Helps Bring Contactless Fingerprint Technology to Market" />` +
    `<meta property="article:published_time" content="2015-09-03T08:00-04:00" />` +
    `<meta name="dcterms.creator" content="Mark Esser" />` +
    `</head><body><div class="nist-page__content">${container}</div></body></html>`
  )
}

// ── ① 열쇠 ───────────────────────────────────────────────────────────

describe('NIST 열쇠 — 목록기와 적재기가 같은 것을 만든다', () => {
  it('사이트맵 열거 열쇠 === 본문 적재 열쇠', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url)
      if (u.endsWith('/sitemap.xml')) {
        return xmlResponse(`<sitemapindex><sitemap><loc>https://www.nist.gov/sitemap.xml?page=1</loc></sitemap></sitemapindex>`)
      }
      if (u.includes('sitemap.xml?page=')) {
        return xmlResponse(
          `<urlset><url><loc>${ARTICLE_URL}</loc><lastmod>2018-06-20T10:00:00-04:00</lastmod></url>` +
            `<url><loc>https://www.nist.gov/publications/some-paper</loc></url></urlset>`,
        )
      }
      return htmlResponse(articleHtml())
    })

    const items = await listNistFeed('news', { gapMs: 0 })
    const ingested = await ingestNistArticle(ARTICLE_URL)

    expect(items).toHaveLength(1) // publications 는 접두어로 걸러진다
    expect(items[0]!.source_id).toBe(ingested.source_id)
    expect(ingested.source_id).toBe(`nist:${ARTICLE_PATH}`)
    expect(isCanonicalSourceKey('nist', ingested.source_id)).toBe(true)
  })

  it('추적 파라미터·앵커·끝 슬래시·대문자는 같은 열쇠로 접힌다', () => {
    const base = stableId('nist', { url: ARTICLE_URL })
    expect(stableId('nist', { url: `${ARTICLE_URL}?utm_source=x` })).toBe(base)
    expect(stableId('nist', { url: `${ARTICLE_URL}#top` })).toBe(base)
    expect(stableId('nist', { url: `${ARTICLE_URL}/` })).toBe(base)
    expect(stableId('nist', { url: ARTICLE_URL.toUpperCase().replace('HTTPS://WWW.NIST.GOV', 'https://www.nist.gov') })).toBe(base)
  })

  it('남의 호스트·지문이 아닌 경로는 던진다 — 해시로 물러서지 않는다', () => {
    // 비슷한 이름의 남의 도메인이 nist 열쇠를 받으면 안 된다.
    expect(() => stableId('nist', { url: 'https://www.nist.gov.example.com/blogs/x' })).toThrow(
      /안정 식별자를 유도하지 못했다/,
    )
    // publications(74,515) · people(6,706) 은 지문 소스가 아니다.
    expect(() => stableId('nist', { url: 'https://www.nist.gov/publications/some-paper' })).toThrow()
    expect(() => stableId('nist', { url: 'https://www.nist.gov/' })).toThrow()
  })

  it('열쇠 모양 검사가 옛 꼴·해시 꼴을 거절한다', () => {
    expect(isCanonicalSourceKey('nist', `nist:${ARTICLE_PATH}`)).toBe(true)
    expect(isCanonicalSourceKey('nist', 'nist:ewolkz')).toBe(false)
    expect(isCanonicalSourceKey('nist', 'nist:publications/some-paper')).toBe(false)
    expect(sourceKey('nist', { url: ARTICLE_URL }, { start: 2, end: 6 })).toBe(`nist:${ARTICLE_PATH}#p3-6`)
  })

  it('nistPath 는 nist.gov 가 아니면 null', () => {
    expect(nistPath('https://example.com/blogs/x')).toBeNull()
    expect(nistPath('not a url')).toBeNull()
    expect(nistPath(null)).toBeNull()
    expect(nistPath('https://www.nist.gov/BLOGS/Taking-Measure/X/')).toBe('blogs/taking-measure/x')
  })
})

// ── ② 목록 — 전수 열거 ───────────────────────────────────────────────

describe('NIST 목록 — 사이트맵 전수 열거', () => {
  it('색인이 말하는 쪽을 전부 읽는다 — 쪽 번호로 범위를 좁히지 않는다', async () => {
    // 실측 2026-09-08: 뉴스 1편이 **13쪽**에 있었다. 「1~5쪽만」으로 줄였다면 그 1편은
    //   오류 없이 영영 안 보인다. 여기서는 마지막 쪽에 한 편을 숨겨 두고 그것이 오는지 본다.
    const pages = 6
    const asked: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url)
      if (u.endsWith('/sitemap.xml')) {
        return xmlResponse(
          `<sitemapindex>${Array.from({ length: pages }, (_, i) => `<sitemap><loc>https://www.nist.gov/sitemap.xml?page=${i + 1}</loc></sitemap>`).join('')}</sitemapindex>`,
        )
      }
      asked.push(u)
      const p = Number(u.match(/page=(\d+)/)?.[1])
      if (p === 1) return xmlResponse(`<urlset><url><loc>https://www.nist.gov/blogs/taking-measure/a</loc></url></urlset>`)
      if (p === pages) return xmlResponse(`<urlset><url><loc>https://www.nist.gov/blogs/taking-measure/late</loc></url></urlset>`)
      return xmlResponse(`<urlset><url><loc>https://www.nist.gov/publications/x${p}</loc></url></urlset>`)
    })

    const items = await listNistFeed('blogs', { gapMs: 0 })
    expect(asked).toHaveLength(pages)
    expect(items.map((i) => i.path)).toEqual(['blogs/taking-measure/a', 'blogs/taking-measure/late'])
  })

  it('lastmod 를 순서로 짝짓지 않는다 — 없는 항목 하나가 뒤를 밀지 않는다', async () => {
    vi.stubGlobal('fetch', async () =>
      xmlResponse(
        `<urlset>` +
          `<url><loc>https://www.nist.gov/blogs/a</loc></url>` +
          `<url><loc>https://www.nist.gov/blogs/b</loc><lastmod>2020-01-01</lastmod></url>` +
          `</urlset>`,
      ),
    )
    const rows = await fetchNistSitemapPage('https://www.nist.gov/sitemap.xml?page=1')
    expect(rows).toEqual([
      { path: 'blogs/a', url: 'https://www.nist.gov/blogs/a', lastmod: null },
      { path: 'blogs/b', url: 'https://www.nist.gov/blogs/b', lastmod: '2020-01-01' },
    ])
  })

  it('모르는 피드는 던진다 — 조용히 빈 목록을 주지 않는다', async () => {
    await expect(listNistFeed('publications', { gapMs: 0 })).rejects.toThrow(/피드 'publications' 를 모른다/)
    expect(NIST_FEEDS.map((f) => f.id)).toEqual(['news', 'blogs'])
  })
})

// ── ③ 본문 ───────────────────────────────────────────────────────────

describe('NIST 본문 — 물러서지 않는다', () => {
  it('컨테이너를 못 찾으면 문서 전체로 물러서지 않고 던진다', async () => {
    vi.stubGlobal('fetch', async () => htmlResponse(articleHtml({ container: false })))
    expect(nistBodyHtml(articleHtml({ container: false }))).toBeNull()
    await expect(fetchNistArticle(ARTICLE_URL)).rejects.toThrow(/본문 컨테이너/)
  })

  it('후미 상용구를 문단 단위로 잘라 낸다 — 캡션·크레딧도 안 남는다', () => {
    const body = nistExtractBody(nistBodyHtml(articleHtml())!)
    expect(body.text).not.toMatch(/Media Contact/)
    expect(body.text).not.toMatch(/Follow us/)
    expect(body.text).not.toMatch(/Credit: NIST/) // figcaption 은 통째로 지운다
    expect(body.droppedTail).toBe(2)
    expect(body.paragraphs).toBe(1)
  })

  it('위치가 아니라 표식으로 자른다 — 짧은 글의 본문이 잘리지 않는다', () => {
    const html = `<div class="text-with-summary"><p>One sentence of real body text.</p><p>A second sentence, still body.</p></div>`
    const body = nistExtractBody(html)
    expect(body.paragraphs).toBe(2)
    expect(body.droppedTail).toBe(0)
  })

  it('제목의 사이트명 꼬리를 자른다 — 분류기가 창마다 3번 읽는 그 문자열', () => {
    // 자르지 않으면 `lib-topic.mjs` 의 TITLE_REPEAT 가 "NIST" 를 창마다 3번 먹인다
    //   (정찰이 IPR 에서 명중률 51.1% → 43.4% 로 갈린 함정과 같은 것).
    expect(nistCleanTitle('Going Nuts over NIST Peanut Butter | NIST')).toBe('Going Nuts over NIST Peanut Butter')
    expect(nistCleanTitle('A Title – NIST')).toBe('A Title')
    expect(nistCleanTitle('NIST Releases SHA-3')).toBe('NIST Releases SHA-3') // 꼬리가 아니면 안 건드린다
  })

  it('메타에서 제목·발행일·저자를 읽고 canonical 로 열쇠를 만든다', async () => {
    vi.stubGlobal('fetch', async () => htmlResponse(articleHtml()))
    // 요청은 추적 파라미터가 붙은 주소로 하지만 열쇠는 canonical 에서 나온다.
    const a = await fetchNistArticle(`${ARTICLE_URL}?utm_campaign=x`)
    expect(a.source_id).toBe(`nist:${ARTICLE_PATH}`)
    expect(a.title).toBe('Hands Off! NIST Helps Bring Contactless Fingerprint Technology to Market')
    expect(a.author).toBe('Mark Esser')
    expect(a.published_at).toBe('2015-09-03T08:00-04:00')
    expect(a.words).toBeGreaterThan(150)
    expect(a.body.nonAsciiRatio).toBe(0)
  })

  it('적재 행은 PD 표기를 지어내지 않는다 — usgs·noaa 와 같은 문자열', async () => {
    vi.stubGlobal('fetch', async () => htmlResponse(articleHtml()))
    const raw = await ingestNistArticle(ARTICLE_URL)
    expect(raw.source).toBe('nist')
    expect(raw.license).toBe('Public Domain (US Government)')
    expect(raw.language).toBe('en')
    expect(raw.published_at?.toISOString().slice(0, 10)).toBe('2015-09-03')
  })
})
