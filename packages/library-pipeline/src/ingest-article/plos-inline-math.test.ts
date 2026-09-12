// packages/library-pipeline/src/ingest-article/plos-inline-math.test.ts
//
// **인라인 수식이 사라지면 문장이 거짓말을 한다.**
//
// PLOS 는 문장 안의 기호를 `<img class="inline-graphic">` 로 렌더하고 **`alt` 를 안 준다**
// (실측 2026-09-07 · pone.0343412 원본 HTML 을 직접 받아 확인: `inline-graphic` 이 있고
// 그 어느 것에도 alt 가 없다). 태그를 벗기면 기호가 통째로 사라지고 **문장 껍데기만 남는다**:
//
//   "Let ⟨사라짐⟩ be a graph"          → "Let be a graph"
//   "the value of ⟨사라짐⟩ is updated"  → "the value of is updated"
//   "increases with the increase of ⟨사라짐⟩." → "increases with the increase of ."
//
// 겉보기엔 산문이라 어떤 자동 검사도 안 걸리는데 뜻이 서지 않는다. 실측: 발췌 2,000편
// 표본의 **5.9%**(11,601편이면 약 680편)가 이 자국을 갖고, PLOS 발췌 1,200편 판정에서
// 반려 사유의 절반 이상이 이것이었다.
//
// **복원할 문자가 HTML 에 없다** — alt 도 MathML 도 없다. 그러면 남는 선택은 「조용히
// 사라지게 두기」와 「사라졌다고 말하기」뿐이고 후자가 맞다. 표지가 있으면 판정자도
// 발췌기도 조판도 그 문장을 걸러낼 수 있다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestPlosArticle } from './plos'

const URL_ = 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0343412'

const HEAD =
  '<meta name="citation_title" content="A social network analysis of fraud prediction" />' +
  '<meta name="citation_publication_date" content="2026/03/01" />' +
  '<meta name="citation_author" content="Kim S" />'

/** 200단어 게이트를 넘기려는 채움 산문 — 이 검사의 대상이 아니다. */
const FILLER =
  '<p>' +
  'The crowdsourcing platform was observed for twelve months and each transaction was recorded by trained staff. '.repeat(
    24,
  ) +
  '</p>'

const INLINE_IMG = (id: string) =>
  `<img src="article/file?type=thumbnail&amp;id=10.1371/journal.pone.0343412.e${id}" loading="lazy" class="inline-graphic">`

function page(sectionBody: string): string {
  return (
    `${HEAD}<div class="article-text" id="artText">` +
    `<div class="abstract abstract-type-toc"><h2>Abstract</h2>` +
    `<div class="abstract-content"><p>Fraud spreads through social ties in crowdsourcing markets.</p></div></div>` +
    `<div class="section"><h2>Introduction</h2>${sectionBody}${FILLER}</div></div>`
  )
}

function stub(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const count = (s: string, needle: string) => s.split(needle).length - 1

describe('PLOS 인라인 수식 — 사라진 기호를 표지로 남긴다', () => {
  it('`inline-graphic` 자리에 표지가 남는다 — 문장이 조용히 무너지지 않게', async () => {
    stub(page(`<p>Let ${INLINE_IMG('001')} be a graph where vertices are instances.</p>`))
    const { content } = await ingestPlosArticle(URL_)
    expect(content).toContain('[수식]')
    // ⚠️ 표지가 없으면 "Let be a graph" 가 되어 **산문처럼 보인다** — 그것이 이 검사의 이유다.
    expect(content).not.toMatch(/\bLet\s+be\s+a\s+graph\b/)
  })

  it('한 문장에 여럿이면 각각 남는다 — 하나로 뭉치면 몇 개가 빠졌는지 모른다', async () => {
    stub(
      page(
        `<p>The value of ${INLINE_IMG('002')} increases with ${INLINE_IMG('003')} over time.</p>`,
      ),
    )
    const { content } = await ingestPlosArticle(URL_)
    expect(count(content, '[수식]')).toBe(2)
    expect(content).not.toMatch(/\bof\s+increases\b/)
  })

  // ⚠️ **넓히면 안 된다.** 삽화는 이미 블록째 지우고 있고 문단 사이에 있다. 이 규칙이
  //   거기까지 먹으면 문단마다 표지가 흩뿌려져 본문이 더 나빠진다.
  it('삽화 썸네일은 표지를 남기지 않는다 — 문장 안 기호만 대상이다', async () => {
    stub(
      page(
        `<p>Vertices are application instances.</p>` +
          `<p><img src="article/figure/image?id=g001" alt="thumbnail" class="thumbnail" loading="lazy"></p>`,
      ),
    )
    const { content } = await ingestPlosArticle(URL_)
    expect(content).not.toContain('[수식]')
    expect(content).toContain('Vertices are application instances')
  })

  it('수식이 없는 본문은 그대로다 — 표지가 끼어들지 않는다', async () => {
    stub(page('<p>Graph theory explains how networks connect people.</p>'))
    const { content } = await ingestPlosArticle(URL_)
    expect(content).not.toContain('[수식]')
    expect(content).toContain('Graph theory explains how networks connect people')
  })
})
