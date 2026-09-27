// packages/library-pipeline/src/ingest-article/plos-figure-swallow.test.ts
//
// **그림을 지우다 본문 절을 삼키지 않는다.**
//
// 예전 figure 제거는 정규식 `<div class="…figure…">[\s\S]*?</div>\s*</div>` 였다 — figure 를 지나
// **처음 만나는 `</div></div>`** 까지 지운다. 실제 PLOS HTML 은 figure 의 닫는 태그 사이에
// `<a class="link-target">` 이 끼어 있어 그 자리에서 멈추지 못하고, 다음 절 제목과 본문을 지나
// 다음 그림 안쪽의 `</div></div>` 에서야 멈췄다.
// 실측 2026-09-25 · pone.0356261: 결과 3.2절 4,309자가 통째로 사라져 본문이 「3.1 → 3.3」이 됐다.
// 원문 점검(보관 판정) 청크 두 개에서 20편 중 8~9편이 「예고한 절 없음」으로 보류된 원인이다.
//
// 아래 구조는 그 원본 HTML 에서 줄여 옮겼다(클래스·태그 순서 그대로).

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestPlosArticle } from './plos'

const URL_ = 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0356261'

const HEAD =
  '<meta name="citation_title" content="Successional shifts in soil stoichiometry" />' +
  '<meta name="citation_publication_date" content="2026/08/01" />' +
  '<meta name="citation_author" content="Li X" />'

/** 200단어 게이트를 넘기려는 채움 산문 — 이 검사의 대상이 아니다. */
const FILLER = '<p>' + 'Soil samples were collected from twelve plots across three forest types in the county. '.repeat(24) + '</p>'

/**
 * 원본 그대로의 figure. 캡션 div 뒤에 **캡션 문단(`<p class="caption_target">…<p>…</p>`)** 이 와서
 * figcaption 의 `</div>` 와 figure 의 `</div>` 가 붙어 있지 않다 — 예전 정규식이 여기서 멈추지 못했다.
 */
const FIGURE = (n: number) =>
  `<a class="link-target" id="g00${n}" name="g00${n}"></a>` +
  `<div class="figure" data-doi="10.1371/journal.pone.0356261.g00${n}">` +
  `<div class="img-box"><a title="Click for larger image" href="#"><img src="x" alt="thumbnail" class="thumbnail"></a>` +
  `<div class="expand"></div></div>` +
  `<div class="figure-inline-download"> Download: <ul><li><a href="#"><div class="definition-label">PNG</div>` +
  `<div class="definition-description">larger image</div></a></li></ul></div>` +
  `<div class="figcaption"><span>Fig ${n}. </span> Correlation analysis of soil properties.</div>` +
  `<p class="caption_target"><a id="c${n}" name="c${n}" class="link-target"></a><p>Red squares mark positive correlations.</p></p>` +
  `</div><a id="p${n}" name="p${n}" class="link-target"></a>`

function page(): string {
  return (
    `${HEAD}<div class="article-text" id="artText">` +
    `<div class="abstract abstract-type-toc"><h2>Abstract</h2>` +
    `<div class="abstract-content"><p>Soil stoichiometry shifts as forests recover.</p></div></div>` +
    `<div class="section toc-section"><h2>Results</h2>` +
    `<div class="section toc-section"><h3>3.1. Correlation patterns between soil properties</h3>` +
    `<p>Carbon and nitrogen rose together in every stand.</p>${FIGURE(2)}</div> ` +
    `<div class="section toc-section"><h3>3.2. Successional shifts in regulatory mechanisms</h3>` +
    `<p>Regulatory drivers moved from climate to vegetation as succession advanced.</p>${FIGURE(3)}</div>` +
    `<div class="section toc-section"><h3>3.3. Interactive controls of forest type</h3>` +
    `<p>Forest type and soil depth interacted strongly.</p></div>` +
    `${FILLER}</div></div>`
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PLOS 그림 제거 — 본문 절을 삼키지 않는다', () => {
  it('그림 사이의 절 제목과 본문이 남는다', async () => {
    const html = page()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => html })))
    const { content } = await ingestPlosArticle(URL_)
    expect(content).toContain('3.2. Successional shifts in regulatory mechanisms')
    expect(content).toContain('Regulatory drivers moved from climate to vegetation')
    expect(content).toContain('3.1. Correlation patterns')
    expect(content).toContain('3.3. Interactive controls')
  })

  it('그림 자체(캡션·내려받기 단추)는 여전히 지운다', async () => {
    const html = page()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => html })))
    const { content } = await ingestPlosArticle(URL_)
    expect(content).not.toContain('larger image')
    expect(content).not.toContain('Fig 2.')
    expect(content).not.toContain('Fig 3.')
    expect(content).not.toContain('Red squares mark positive correlations')
  })
})
