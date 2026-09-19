// packages/library-pipeline/src/ingest-article/source-key-contract.test.ts
//
// **목록기와 적재기가 다른 열쇠를 만들면 여기서 깨진다.**
//
// ── 왜 이 테스트가 이 작업의 산출물인가 (실측 2026-09-07) ────────────────
// 열쇠 불일치는 **오류를 내지 않는다.** 중복 검사가 그냥 0건을 돌려주고, 화면에는
// "새 것 N" 이 정상적으로 찍힌다. 그래서 Wikipedia 는 92행이 쌓이는 동안, VOA 는
// 249행이 쌓이는 동안 아무도 몰랐다. 사람이 볼 수 있는 신호가 없으므로 **기계가 봐야 한다.**
//
// 잠그는 것 셋:
//   ① 목록기 출력 열쇠 === 적재기 출력 열쇠 (같은 글에 대해)
//   ② 열쇠가 규약 모양이다 (제목 슬러그·해시가 아니다)
//   ③ 유도 못 하면 **던진다** (조용히 해시로 물러서지 않는다)
//
// 네트워크 없이 돈다 — `fetch` 를 세워 두고 소스가 주는 응답만 흉내 낸다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestVoaArticle } from './voa'
import { ingestWikipediaArticle } from './wikipedia'
import { buildWikipediaFeedUrl, listWikipediaFeedPage } from './wikipedia'
import { ingestFrymArticle, listFrymFeedPage, buildFrymListUrl } from './frontiers-young-minds'
import {
  GOVERNED_SOURCES,
  SOURCE_KEY_SHAPE,
  baseSourceKey,
  isCanonicalSourceKey,
  sourceKey,
  stableId,
} from './source-key'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
}
function htmlResponse(html: string) {
  return { ok: true, status: 200, text: async () => html, json: async () => ({}) }
}

// ── ① 목록기 ↔ 적재기 ────────────────────────────────────────────────

describe('열쇠 — 목록기와 적재기가 같은 것을 만든다', () => {
  it('Wikipedia: 같은 문서면 목록 열쇠 === 적재 열쇠 (제목이 아니라 pageid)', async () => {
    const PAGEID = 3295060
    const TITLE = 'Christian ethics'
    const FULLURL = 'https://en.wikipedia.org/wiki/Christian_ethics'

    vi.stubGlobal('fetch', async (url: string) => {
      // 목록(generator=categorymembers) 과 단건(titles=) 이 같은 pageid 를 준다.
      if (String(url).includes('generator=categorymembers')) {
        return jsonResponse({
          query: {
            pages: {
              [PAGEID]: {
                pageid: PAGEID,
                title: TITLE,
                fullurl: FULLURL,
                touched: '2026-08-01T00:00:00Z',
                extract: 'Christian ethics is a branch of theology that defines virtuous behaviour and wrong behaviour from a Christian perspective.',
              },
            },
          },
        })
      }
      return jsonResponse({
        query: {
          pages: {
            [PAGEID]: {
              pageid: PAGEID,
              title: TITLE,
              fullurl: FULLURL,
              extract: 'Christian ethics is a branch of theology. '.repeat(20),
            },
          },
        },
      })
    })

    const { items } = await listWikipediaFeedPage('Category:Good articles', 'good', 20, null)
    const listed = items.find((i) => i.title === TITLE)
    const ingested = await ingestWikipediaArticle(FULLURL)

    expect(listed, '목록에 그 문서가 없다 — 큐레이션 spec 이 걸렀다면 표본을 바꿀 것').toBeTruthy()
    expect(listed!.source_id).toBe(ingested.source_id)
    expect(ingested.source_id).toBe(`wikipedia:${PAGEID}`)
  })

  it('VOA: RSS 목록 열쇠 === 본문 적재 열쇠 (URL 끝 숫자 id)', async () => {
    const URL = 'https://learningenglish.voanews.com/a/what-is-the-best-kind-of-yoga-for-beginners-/7953499.html'
    // 목록기(RSS)와 적재기(본문 HTML)는 **같은 함수**로 열쇠를 만든다.
    //   이 두 값이 갈렸을 때 DB 249행이 base36 해시가 됐다.
    const fromList = sourceKey('voa', { url: URL })

    vi.stubGlobal('fetch', async () =>
      htmlResponse(
        `<html><head><title>Yoga</title></head><body><div class="wsw">` +
          `<p>${'Yoga is a practice that many people enjoy for its health benefits. '.repeat(12)}</p>` +
          `</div></body></html>`,
      ),
    )
    const ingested = await ingestVoaArticle(URL)

    expect(ingested.source_id).toBe(fromList)
    expect(ingested.source_id).toBe('voa:7953499')
  })

  it('FrYM: Crossref 목록 열쇠 === 적재 열쇠 (소문자 DOI)', async () => {
    const DOI = '10.3389/frym.2023.1055909'
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url)
      if (u.includes('/journals/2296-6846/works')) {
        return jsonResponse({
          message: {
            'next-cursor': 'AoJw+CURSOR',
            items: [
              {
                DOI,
                title: ['How Do Vampire Bats Run?'],
                URL: `https://doi.org/${DOI}`,
                abstract: '<jats:p>Vampire bats can run on a treadmill, and scientists wanted to know how they fuel that sprint.</jats:p>',
                license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/', 'content-version': 'vor' }],
                published: { 'date-parts': [[2023, 5, 1]] },
              },
            ],
          },
        })
      }
      if (u.includes('api.crossref.org/works/')) {
        return jsonResponse({
          message: {
            DOI,
            title: ['How Do Vampire Bats Run?'],
            URL: `https://doi.org/${DOI}`,
            license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/', 'content-version': 'vor' }],
            published: { 'date-parts': [[2023, 5, 1]] },
          },
        })
      }
      return htmlResponse(
        `<html><body><div class="fulltext-content">` +
          `<p>${'Vampire bats are the only mammals that feed entirely on blood and they can run. '.repeat(90)}</p>` +
          `</div></body></html>`,
      )
    })

    const { items } = await listFrymFeedPage('recent', 100, null)
    const ingested = await ingestFrymArticle(`https://doi.org/${DOI}`)

    expect(items[0]!.source_id).toBe(ingested.source_id)
    expect(ingested.source_id).toBe(`frym:${DOI}`)
  })
})

// ── ② 규약 모양 ──────────────────────────────────────────────────────

describe('열쇠 — 규약 모양을 지킨다', () => {
  it('규약 소스 전부에 모양 정규식이 있다', () => {
    // 분모부터 본다 — 목록이 비면 아래 검사가 0건 비교로 통과한다.
    expect(GOVERNED_SOURCES.length).toBeGreaterThan(0)
    for (const s of GOVERNED_SOURCES) expect(SOURCE_KEY_SHAPE[s]).toBeInstanceOf(RegExp)
  })

  it('제목 슬러그·해시 꼴은 규약이 아니다 (2026-09-07 이전 DB 값)', () => {
    expect(isCanonicalSourceKey('wikipedia', 'wikipedia:Christian_ethics')).toBe(false)
    expect(isCanonicalSourceKey('wikipedia', 'wikipedia:3295060')).toBe(true)
    expect(isCanonicalSourceKey('voa', 'voa:ewolkz')).toBe(false) // DB 249행이 이 꼴이었다
    expect(isCanonicalSourceKey('voa', 'voa:7953499')).toBe(true)
    expect(isCanonicalSourceKey('frym', 'frym:10.3389/frym.2023.1055909')).toBe(true)
  })

  it('발췌 열쇠는 원본과 다른 행이 되고, 원본 열쇠로 되돌릴 수 있다', () => {
    const k = sourceKey('frym', { doi: '10.3389/frym.2023.1055909' }, { start: 2, end: 6 })
    expect(k).toBe('frym:10.3389/frym.2023.1055909#p3-6')
    expect(isCanonicalSourceKey('frym', k)).toBe(true)
    expect(baseSourceKey(k)).toBe('frym:10.3389/frym.2023.1055909')
  })

  it('DOI 는 대소문자로 갈리지 않는다', () => {
    expect(stableId('frym', { doi: '10.3389/FRYM.2023.1055909' })).toBe('10.3389/frym.2023.1055909')
  })

  it('VOA id 는 추적 파라미터·앵커가 붙어도 같다', () => {
    const base = 'https://learningenglish.voanews.com/a/some-title/7953499.html'
    expect(stableId('voa', { url: base })).toBe('7953499')
    expect(stableId('voa', { url: `${base}?utm_source=x` })).toBe('7953499')
    expect(stableId('voa', { url: `${base}#top` })).toBe('7953499')
  })
})

// ── ③ 물러서지 않는다 ────────────────────────────────────────────────

describe('열쇠 — 유도 못 하면 던진다 (조용한 대체 금지)', () => {
  it('VOA: 숫자 id 없는 URL 은 해시로 채우지 않는다', () => {
    // 이 물러섬이 249행을 만들었다. 이제는 예외다 — 못 넣는 편이 싸다.
    expect(() => stableId('voa', { url: 'https://learningenglish.voanews.com/a/some-title/' })).toThrow(
      /안정 식별자를 유도하지 못했다/,
    )
  })

  it('Wikipedia: pageid 없으면 제목으로 대체하지 않는다', () => {
    expect(() => stableId('wikipedia', { url: 'https://en.wikipedia.org/wiki/Christian_ethics' })).toThrow()
  })

  it('FrYM: DOI 가 아니면 던진다', () => {
    expect(() => stableId('frym', { url: 'https://kids.frontiersin.org/articles/whatever/full' })).toThrow()
  })
})

// ── 커서가 실제로 URL 에 실리는가 ─────────────────────────────────────

describe('딥페이징 — 커서가 요청에 실린다', () => {
  it('FrYM 은 offset 이 아니라 cursor 로 넘긴다', () => {
    const first = buildFrymListUrl('recent', 100, null)
    expect(first).toContain('cursor=*') // 첫 페이지
    expect(first).not.toContain('offset=')
    const next = buildFrymListUrl('recent', 100, 'AoJw+TOKEN/abc')
    expect(next).toContain(`cursor=${encodeURIComponent('AoJw+TOKEN/abc')}`)
  })

  it('날짜 정렬은 커서와 함께 보내지 않는다 — Crossref 가 400 으로 거절한다 (실측 2026-09-07)', () => {
    // `{"type":"sort-criteria-incompatible-with-cursor"}`. 이걸 다시 붙이면 딥페이징이
    //   **첫 요청부터** 죽고, `items.length && break` 같은 물러섬이 있으면 조용히 0건이 된다.
    expect(buildFrymListUrl('recent', 100, null)).not.toContain('sort=published')
    // 인용순은 커서와 함께 200 이다 — 쓸 수 있는 정렬은 버리지 않는다.
    expect(buildFrymListUrl('cited', 100, null)).toContain('sort=is-referenced-by-count')
    // 첫 화면(커서 없음)은 날짜 정렬을 그대로 쓴다.
    expect(buildFrymListUrl('recent', 100)).toContain('sort=published')
    expect(buildFrymListUrl('recent', 100)).not.toContain('cursor=')
  })

  it('FrYM 은 항목 0 을 끝으로 본다 — 토큰만 보고 돌면 안 끝난다', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ message: { items: [], 'next-cursor': 'STILL+HERE' } }))
    const { items, nextCursor } = await listFrymFeedPage('recent', 100, 'SOME')
    expect(items).toEqual([])
    expect(nextCursor).toBeNull()
  })

  it('Wikipedia continuation 은 토큰을 그대로 되돌려준다', () => {
    const url = buildWikipediaFeedUrl('Category:Good articles', 20, { gcmcontinue: '20260801024605|53668895' })
    expect(url).toContain(encodeURIComponent('20260801024605|53668895'))
  })
})
