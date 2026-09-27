// packages/library-pipeline/src/ingest-article/the-conversation-body.test.ts
//
// **본문 경계를 정규식으로 찾던 것을 div 계수로 바꾼 회귀.**
//
// 실측 2026-09-23(기사 6편): 옛 구현의 1순위 정규식은 6/6 맞았지만, 그것이 빗나간
// 기사에서 나머지 둘이 **오류 없이 틀린 값**을 냈다 —
//   `<article>` fallback : 956어 본문을 **1,125어**로(사이드바 포함, +18%)
//   `</div>` 최소 매치   : 956어 본문을 **256어**로(첫 닫힘에서 절단, 27%)
// 둘 다 그럴듯해서 아무도 모른다. 그게 이 테스트가 있는 이유다.

import { describe, expect, it } from 'vitest'

import { extractArticleBody } from './the-conversation'

const wrap = (inner: string): string =>
  `<html><body><header>nav</header><div itemprop="articleBody">${inner}</div>` +
  `<aside class="sidebar"><p>SIDEBAR TEXT</p></aside><footer>f</footer></body></html>`

describe('articleBody 경계 — div 를 센다', () => {
  it('중첩 div 를 지나 본문 끝까지 잡는다 (옛 최소 매치가 여기서 끊겼다)', () => {
    const body = extractArticleBody(
      wrap('<p>one</p><div class="pullout"><p>two</p></div><p>three</p>')
    )
    expect(body).toContain('one')
    // ★ 이 둘이 핵심 — 첫 `</div>` 에서 끊으면 없다.
    expect(body).toContain('two')
    expect(body).toContain('three')
  })

  it('본문 뒤 사이드바를 먹지 않는다 (옛 <article> fallback 이 여기서 부풀었다)', () => {
    const body = extractArticleBody(wrap('<p>one</p><div><p>two</p></div>'))
    expect(body).not.toContain('SIDEBAR TEXT')
  })

  it('중첩이 여러 겹이어도 균형을 맞춘다', () => {
    const body = extractArticleBody(
      wrap('<div><div><div><p>deep</p></div></div></div><p>after</p>')
    )
    expect(body).toContain('deep')
    expect(body).toContain('after')
    expect(body).not.toContain('SIDEBAR')
  })

  it('itemprop 이 없으면 null — 조용히 틀린 본문을 내놓지 않는다', () => {
    // 호출부가 전체 HTML 로 물러서고 길이 검사에서 시끄럽게 실패한다.
    expect(extractArticleBody('<html><body><p>no marker</p></body></html>')).toBeNull()
  })

  it('닫히지 않은 채 끝나면 끝까지 준다 — 잘린 HTML 을 빈 본문으로 만들지 않는다', () => {
    const body = extractArticleBody('<div itemprop="articleBody"><p>truncated</p>')
    expect(body).toContain('truncated')
  })

  it('속성이 붙은 여는 태그와 공백 있는 닫는 태그를 모두 센다', () => {
    const body = extractArticleBody(
      wrap('<div data-x="1" class="a b"><p>attr</p></div ><p>tail</p>')
    )
    expect(body).toContain('attr')
    expect(body).toContain('tail')
    expect(body).not.toContain('SIDEBAR')
  })

  it('작은따옴표 itemprop 도 잡는다', () => {
    const body = extractArticleBody(`<div itemprop='articleBody'><p>quoted</p></div><aside>S</aside>`)
    expect(body).toContain('quoted')
    expect(body).not.toContain('S</aside>')
  })
})
