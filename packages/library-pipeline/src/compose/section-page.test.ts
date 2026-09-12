// packages/library-pipeline/src/compose/section-page.test.ts
//
// RSS 없는 섹션에서 기사 목록 얻기.
//
// 실측 근거(2026-08-19): 섹션 피드의 학습 적합률이 전체 피드의 1.76배(25.0% vs 14.2%)인데,
// 등록 경로가 RSS 로만 열려 있어 **RSS 를 안 주는 섹션은 아예 쓸 수 없었다.**

import { describe, expect, it } from 'vitest'

import { MAX_SECTION_ITEMS, inspectSectionPage, parseSectionPage } from './section-page'

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0)
const PAGE = 'https://news.example/opinion'

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`
const link = (href: string, text: string) => `<a href="${href}">${text}</a>`

describe('parseSectionPage — 목록에서 기사만 골라낸다', () => {
  it('날짜가 박힌 기사 링크를 가져온다', () => {
    const items = parseSectionPage(
      page(
        link('/opinion/20260817/why-cities-plant-more-trees', 'Why cities plant more trees') +
          link('/opinion/20260816/what-a-quiet-street-teaches-us', 'What a quiet street teaches us'),
      ),
      PAGE,
      NOW,
    )
    expect(items).toHaveLength(2)
    expect(items[0]!.title).toBe('Why cities plant more trees')
    expect(items[0]!.published_at).toBe('2026-08-17T23:59:59.999Z')
    expect(items[0]!.date_source).toBe('url')
  })

  it('상대 주소를 절대 주소로 편다', () => {
    const items = parseSectionPage(page(link('20260817/a-long-enough-headline-here', 'A long enough headline here')), PAGE, NOW)
    expect(items[0]!.url).toBe('https://news.example/20260817/a-long-enough-headline-here')
  })

  it('발행 시각을 못 채우면 버린다 — I15 를 검증할 수 없다', () => {
    // 주소에 날짜가 없는 기사. 통과시키면 48시간 보류를 검증할 방법이 없다.
    const items = parseSectionPage(page(link('/opinion/some-column-without-a-date', 'Some column without a date')), PAGE, NOW)
    expect(items).toEqual([])
  })

  it('네비게이션 링크를 기사로 세지 않는다', () => {
    const items = parseSectionPage(
      page(
        link('/tag/20260817/climate', 'Climate coverage from our desk') +
          link('/author/20260817/kim', 'Articles written by Kim Minji') +
          link('/opinion/page/20260817/2', 'Go to the next page please') +
          link('/subscribe/20260817/offer', 'Subscribe to our weekend edition'),
      ),
      PAGE,
      NOW,
    )
    expect(items).toEqual([])
  })

  it('짧은 링크 글자는 제목이 아니다', () => {
    const items = parseSectionPage(page(link('/opinion/20260817/x', 'More')), PAGE, NOW)
    expect(items).toEqual([])
  })

  it('다른 호스트 링크는 그 발행사의 기사가 아니다', () => {
    // 광고·제휴 링크를 그 발행사 기사로 세면 계통 판정이 통째로 틀어진다.
    const items = parseSectionPage(
      page(link('https://other.example/20260817/a-headline-that-is-long', 'A headline that is long enough')),
      PAGE,
      NOW,
    )
    expect(items).toEqual([])
  })

  it('같은 주소를 두 번 세지 않는다 — 목록에는 같은 기사가 여러 번 걸린다', () => {
    const one = link('/opinion/20260817/why-cities-plant-more-trees', 'Why cities plant more trees')
    const items = parseSectionPage(page(one + one), PAGE, NOW)
    expect(items).toHaveLength(1)
  })

  it('섹션 페이지 자신을 기사로 세지 않는다', () => {
    const items = parseSectionPage(page(link('/opinion', 'Back to the opinion section')), PAGE, NOW)
    expect(items).toEqual([])
  })

  it('미래 날짜 링크는 들어오지 않는다 — dateFromUrl 이 거절한다', () => {
    const items = parseSectionPage(page(link('/opinion/20270101/a-headline-that-is-long', 'A headline that is long enough')), PAGE, NOW)
    expect(items).toEqual([])
  })

  it('무한 스크롤 목록에서도 상한을 지킨다', () => {
    const many = Array.from({ length: MAX_SECTION_ITEMS + 20 }, (_, i) =>
      link(`/opinion/20260817/column-number-${i}`, `Column number ${i} about city life`),
    ).join('')
    expect(parseSectionPage(page(many), PAGE, NOW)).toHaveLength(MAX_SECTION_ITEMS)
  })

  it('주소가 잘못되면 조용히 빈 배열 — 던지지 않는다', () => {
    expect(parseSectionPage(page(link('/a/20260817/b-headline-long-enough', 'B headline long enough')), 'not a url', NOW)).toEqual([])
  })
})

describe('inspectSectionPage — 0건의 사유를 나눈다', () => {
  it('링크가 없으면 목록 페이지가 아니라고 말한다', () => {
    const r = inspectSectionPage('<html><body><p>hello</p></body></html>', PAGE, NOW)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('목록 페이지가 아니다')
  })

  it('링크는 있는데 날짜가 없으면 다른 사유를 말한다', () => {
    // 운영자가 할 일이 다르다 — 앞은 주소가 틀린 것, 뒤는 그 섹션을 못 쓰는 것.
    const r = inspectSectionPage(page(link('/opinion/some-column', 'Some column without a date')), PAGE, NOW)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('날짜가 없는')
  })

  it('쓸 수 있으면 항목 수를 돌려준다', () => {
    const r = inspectSectionPage(
      page(link('/opinion/20260817/why-cities-plant-more-trees', 'Why cities plant more trees')),
      PAGE,
      NOW,
    )
    expect(r.ok).toBe(true)
    expect(r.itemCount).toBe(1)
    expect(r.reason).toBeNull()
  })
})

describe('제목에 리드가 붙지 않는다', () => {
  it('제목 요소가 있으면 그것만 쓴다', () => {
    // 실측 2026-08-19 (코리아타임스 lifestyle): 태그를 그냥 벗기면
    //   "…prepares to wedThe Seoul city government said…" 처럼 리드가 붙는다.
    //   묶기가 제목으로 이뤄지므로 이러면 같은 사건이 안 묶인다.
    const html = `<a href="/lifestyle/20260817/seoul-matchmaking-returns">
      <h3>Seoul's matchmaking program returns as first couple prepares to wed</h3>
      <p>The Seoul city government said on Monday that the program would restart.</p>
    </a>`
    const items = parseSectionPage(`<html><body>${html}</body></html>`, PAGE, NOW)
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe(
      "Seoul's matchmaking program returns as first couple prepares to wed",
    )
  })

  it('제목 요소가 없으면 링크 글자 전체를 쓴다', () => {
    const items = parseSectionPage(
      `<html><body><a href="/opinion/20260817/why-cities-plant-trees">Why cities plant more trees</a></body></html>`,
      PAGE,
      NOW,
    )
    expect(items[0]!.title).toBe('Why cities plant more trees')
  })
})
