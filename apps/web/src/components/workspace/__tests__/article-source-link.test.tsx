// apps/web/src/components/workspace/__tests__/article-source-link.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ReadingUniverse } from '../ReadingUniverse'

const noop = () => {}
const textParas = [{ id: 0, sentences: [{ id: 0, parts: [{ text: 'A calm sentence.' }] }] }]

function render(props: { articleSourceHref?: string | null; withChapter?: boolean }) {
  const paragraphs = props.withChapter
    ? [
        {
          id: 0,
          sentences: [],
          chapterMarker: { number: '1', title: 'One', sourceHref: 'https://www.gutenberg.org/ebooks/46' },
        },
        { ...textParas[0]!, id: 1 },
      ]
    : textParas
  return renderToString(
    <ReadingUniverse
      paragraphs={paragraphs}
      isFocusMode={false}
      onWordHover={noop}
      onSentencePlay={noop}
      playingSentenceId={null}
      articleSourceHref={props.articleSourceHref}
    />,
  )
}

describe('ReadingUniverse 기사 원문 출처', () => {
  it('보이스 없는 기사 글에도 원문 출처 링크(새 탭·noopener)', () => {
    const html = render({ articleSourceHref: 'https://www.bbc.com/news/a-1' })
    expect(html).toContain('href="https://www.bbc.com/news/a-1"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('원문 출처 · <!-- -->bbc.com')
    expect(html).toContain('min-h-11')
    expect(html).toContain('focus-visible:outline')
    expect(html).toContain('break-keep')
  })
  it('개인 글(주소 없음)·부적합 주소는 링크 없음', () => {
    expect(render({})).not.toContain('원문 출처')
    expect(render({ articleSourceHref: 'javascript:alert(1)' })).not.toContain('원문 출처')
    expect(render({ articleSourceHref: 'article:123e4567-e89b-12d3-a456-426614174000' })).not.toContain('원문 출처')
  })
  it('장 표식 출처가 있으면 하나만 보인다', () => {
    const html = render({ withChapter: true, articleSourceHref: 'https://www.bbc.com/news/a-1' })
    expect(html.match(/원문 출처 ·/g)?.length).toBe(1)
    expect(html).toContain('gutenberg.org')
    expect(html).not.toContain('bbc.com')
  })
})
