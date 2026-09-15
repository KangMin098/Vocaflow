// packages/library-pipeline/src/ingest-article/list-pagination.test.ts
//
// **HTML 목록 소스(USGS·NOAA)도 첫 페이지에서 멈추지 않는다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-08-30) ─────────────────────────
// 위키미디어의 첫-페이지 상한을 고치고 나서, 정작 **수능 적합도가 가장 높은 소스**가
// 같은 병에 걸려 있는 걸 발견했다. 주제 분류기로 잰 적합률은 이랬다:
//
//   noaa/features 75.0%  ·  noaa/understanding-climate 71.4%  ·  usgs/featured 33.3%
//   wikipedia/featured 11.1%  ·  wikipedia/good 5.0%
//
// 물량이 큰 쪽(위키백과 6,993편)은 적합률이 5~11% 고, 적합률이 높은 쪽은 목록 첫 페이지
// ~13~16편이 상한이었다. 그래서 "적합한 지문"의 공급 천장을 실제로 정하고 있던 것은
// 이쪽 상한이다.
//
// Drupal 뷰라 `?page=N`(0-index)으로 넘어간다 — base·page=1·page=2 의 HTML 해시가
// 전부 달랐다. 다만 토큰이 없어서 **끝을 스스로 말해 주지 않는다.** 범위를 넘긴 page 에
// 마지막 페이지를 200 으로 되돌려주는 사이트가 있어, 끝 판정은 "항목 0" 과
// 호출부의 "새 항목 0" 두 겹으로 한다. 그 배선을 네트워크 없이 고정한다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildNoaaListUrl, listNoaaFeedPage } from './noaa'
import { buildUsgsListUrl, listUsgsFeedPage } from './usgs'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('목록 URL — 쪽번호', () => {
  it('0쪽은 쿼리를 붙이지 않는다 (기존 동작 그대로)', () => {
    expect(buildUsgsListUrl('featured', 0)).toBe('https://www.usgs.gov/news/featured-stories')
    expect(buildNoaaListUrl('features', 0)).toBe('https://www.climate.gov/news-features/features')
  })

  it('1쪽부터 ?page=N 을 붙인다 — 이게 없어서 최신 ~16편이 상한이었다', () => {
    expect(buildUsgsListUrl('featured', 2)).toBe('https://www.usgs.gov/news/featured-stories?page=2')
    expect(buildNoaaListUrl('understanding-climate', 3)).toBe(
      'https://www.climate.gov/news-features/understanding-climate?page=3',
    )
  })

  it('모르는 feedId 는 첫 피드로 떨어진다 — 조용한 빈 목록을 만들지 않는다', () => {
    expect(buildUsgsListUrl('does-not-exist', 1)).toContain('/news/featured-stories?page=1')
    expect(buildNoaaListUrl('does-not-exist', 1)).toContain('/news-features/understanding-climate?page=1')
  })
})

/** USGS teaser 카드 HTML 최소 재현 — 파서가 요구하는 것만 담는다. */
function usgsHtml(slugs: string[]): string {
  return slugs
    .map(
      (s) =>
        `<div class="c-usgs-teaser"><a href="/news/featured-story/${s}">x</a>` +
        `<h3 class="title">Story about ${s}</h3>` +
        `<div class="d-teaser-body">A teaser long enough to pass the description gate for ${s}.</div></div>`,
    )
    .join('')
}

/** NOAA 는 anchor 텍스트가 곧 제목이다. */
function noaaHtml(slugs: string[]): string {
  return slugs
    .map((s) => `<a href="/news-features/features/${s}">Feature about ${s}</a>`)
    .join('')
}

function stubHtml(body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => body })),
  )
}

describe('페이지 반환값 — 끝을 어떻게 아는가', () => {
  it('USGS: 항목이 있으면 다음 쪽 번호를 준다', async () => {
    stubHtml(usgsHtml(['alpha', 'beta']))
    const { items, cont } = await listUsgsFeedPage('featured', 24, 0)
    expect(items.length).toBeGreaterThan(0)
    expect(cont).toBe(1)
  })

  it('USGS: 항목이 하나도 없으면 cont 는 null — 그때가 끝이다', async () => {
    stubHtml('<html><body>no teasers here</body></html>')
    const { items, cont } = await listUsgsFeedPage('featured', 24, 7)
    expect(items).toEqual([])
    expect(cont).toBeNull()
  })

  it('NOAA: 항목이 있으면 다음 쪽, 없으면 null', async () => {
    stubHtml(noaaHtml(['warming-oceans', 'polar-vortex-explained']))
    expect((await listNoaaFeedPage('features', 24, 4)).cont).toBe(5)

    stubHtml('<html><body></body></html>')
    expect((await listNoaaFeedPage('features', 24, 4)).cont).toBeNull()
  })

  it('요청 URL 에 쪽번호가 실제로 실린다', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        seen.push(String(input))
        return { ok: true, status: 200, text: async () => usgsHtml(['gamma']) }
      }),
    )
    await listUsgsFeedPage('featured', 24, 3)
    expect(seen[0]).toContain('?page=3')
  })
})
