// packages/library-pipeline/src/ingest-article/wikipedia-continuation.test.ts
//
// **카테고리의 첫 페이지만 읽고 "소진" 이라고 믿는 실패를 막는다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-08-30) ─────────────────────────
// 수능 지문용 원문을 대량 확보하려고 재고를 처음 전수로 쟀을 때 이런 모양이었다:
//
//   Featured Articles 상류 총량   6,993편
//   확보한 것                        12편
//   그런데 수집기를 다시 돌리면 "새 것"이 곧 0 이 된다
//
// 원인은 고장이 아니라 **누락**이었다 — continuation 토큰이 저장소 전체에 **0회** 등장했다.
// 그래서 손에 닿는 것은 항상 카테고리 상단 한 페이지뿐이고, 그걸 다 담으면 화면에는
// "밀린 새 글 0" 이 뜬다. **소진과 구분되지 않는 상한**이다.
//
// ⚠️ 고치는 과정에서 한 번 더 틀렸다. `gcmcontinue` 만 읽도록 짰더니 단위 테스트는 통과하는데
//   실제 API 는 계속 null 을 줬다. 원 응답을 찍어 보고서야 알았다 —
//
//     continue: {"excontinue":20,"continue":"||info"}   ← gcmcontinue 가 아니다
//     pages: 60 · extract 있는 page: 20
//
//   TextExtracts 가 **요청당 20건**만 채운다. gcmlimit=60 으로 받으면 40편은 extract 없이
//   와서 버려지고, API 는 "같은 묶음의 남은 extract 를 받아라"만 돌려준다 — 카테고리는
//   1보도 안 나간다. 그래서 (a) 배치를 20 으로 맞추고 (b) 토큰은 키를 고르지 않고
//   `continue` **객체 통째로** 되돌려준다. 실측: 3왕복 → 이전 18편(전부 중복) → 지금 56편(중복 0).
//
// 이런 실패는 어떤 지표도 깨뜨리지 않는다("수집 성공"도 참, "새 것 0"도 참). 그래서
// 수량이 아니라 **배선**을 잰다 — 토큰이 실제로 URL 에 실리는가, 응답의 토큰을 돌려주는가,
// 없을 때 null 로 끝나는가. 네트워크를 타지 않는다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildWikipediaFeedUrl, listWikipediaFeedPage } from './wikipedia'

const CATEGORY = 'Category:Featured articles'

/** MediaWiki 응답 1페이지분을 흉내 낸다. extract 는 60자 게이트를 넘겨야 살아남는다. */
function fakeResponse(titles: string[], cont: Record<string, string | number> | null) {
  const pages: Record<string, unknown> = {}
  titles.forEach((title, i) => {
    pages[String(i + 1)] = {
      pageid: i + 1,
      title,
      extract: `${title} is a subject with an introduction long enough to clear the sixty character gate.`,
      fullurl: `https://en.wikipedia.org/wiki/${title.replace(/\s+/g, '_')}`,
      touched: '2026-08-30T00:00:00Z',
    }
  })
  return {
    ok: true,
    status: 200,
    json: async () => ({
      query: { pages },
      ...(cont ? { continue: cont } : {}),
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Wikipedia categorymembers — continuation 배선', () => {
  it('토큰이 없으면 gcmcontinue 를 붙이지 않는다 (첫 페이지)', () => {
    const url = new URL(buildWikipediaFeedUrl(CATEGORY, 30, null))
    expect(url.searchParams.get('gcmcontinue')).toBeNull()
    // 첫 페이지 조건도 같이 고정한다 — 정렬이 바뀌면 페이지네이션이 항목을 건너뛴다.
    expect(url.searchParams.get('gcmsort')).toBe('timestamp')
    expect(url.searchParams.get('gcmdir')).toBe('desc')
    expect(url.searchParams.get('gcmnamespace')).toBe('0')
  })

  it('토큰이 있으면 gcmcontinue 로 실어 보낸다 — 이게 없어서 6,993편 중 100편만 닿았다', () => {
    const url = new URL(buildWikipediaFeedUrl(CATEGORY, 30, { gcmcontinue: 'page|ABC|12345', continue: 'gcmcontinue||' }))
    expect(url.searchParams.get('gcmcontinue')).toBe('page|ABC|12345')
    // 키를 골라 싣지 않는다 — 준 것을 전부 되돌려준다.
    expect(url.searchParams.get('continue')).toBe('gcmcontinue||')
  })

  it('응답의 continuation 토큰을 그대로 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(['Alpha Centauri', 'Beta Decay'], { gcmcontinue: 'page|NEXT|999' })))
    const { items, cont } = await listWikipediaFeedPage(CATEGORY, 'featured', 30, null)
    expect(cont).toEqual({ gcmcontinue: 'page|NEXT|999' })
    expect(items.length).toBeGreaterThan(0)
  })

  it('토큰이 없는 응답이면 cont 는 null — 그때가 진짜 소진이다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(['Gamma Ray'], null)))
    const { cont } = await listWikipediaFeedPage(CATEGORY, 'featured', 30, null)
    expect(cont).toBeNull()
  })

  it('받은 토큰을 다음 요청 URL 에 싣는다 — 왕복이 실제로 이어진다', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const u = String(input)
        seen.push(u)
        return u.includes('gcmcontinue')
          ? fakeResponse(['Second Page Topic'], null)
          : fakeResponse(['First Page Topic'], { gcmcontinue: 'page|SECOND|2' })
      }),
    )

    const first = await listWikipediaFeedPage(CATEGORY, 'featured', 30, null)
    const second = await listWikipediaFeedPage(CATEGORY, 'featured', 30, first.cont)

    expect(seen).toHaveLength(2)
    expect(seen[0]).not.toContain('gcmcontinue')
    expect(seen[1]).toContain('gcmcontinue=page%7CSECOND%7C2')
    expect(second.cont).toBeNull()
  })
})
