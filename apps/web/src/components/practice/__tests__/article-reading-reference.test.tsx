// apps/web/src/components/practice/__tests__/article-reading-reference.test.tsx
// T-0207 「읽은 글 참고」 — 접힌 채 시작 · 펼치면 일반 텍스트 문단 · 채점 전 DcpPlayer 에는 없음 · 넣지 않은 호출자는 그대로.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))

import { ArticleReadingReference } from '../ArticleReadingReference'
import { DcpPlayer } from '../DcpPlayer'

const TEXT = 'First paragraph about <b>Lincoln</b>.\n\nSecond paragraph.\n'

describe('ArticleReadingReference', () => {
  it('처음엔 접혀 본문이 없다 · 토글은 aria-expanded=false', () => {
    h.seed = []
    const html = renderToString(<ArticleReadingReference text={TEXT} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('reading-reference-body')
    expect(html).toContain('min-h-[44px]')
  })
  it('펼치면 줄바꿈 기준 문단을 일반 텍스트로(HTML 해석 없음) · 발췌와 다를 수 있다는 안내', () => {
    h.seed = [true]
    const html = renderToString(<ArticleReadingReference text={TEXT} />)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('&lt;b&gt;Lincoln&lt;/b&gt;')
    expect(html).not.toContain('<b>Lincoln</b>')
    expect(html.match(/<p class="mb-2 font-english/g)).toHaveLength(2)
    expect(html).toContain('발췌와 표현이 다를 수 있어요')
  })
  it('빈 본문이면 아무것도 그리지 않는다', () => {
    h.seed = []
    expect(renderToString(<ArticleReadingReference text={'  \n \n'} />)).toBe('')
  })
})

describe('DcpPlayer afterFeedback(opt-in)', () => {
  const items = [{ id: 'i1', type: 'title', paragraphIdx: 0, payload: { passage: 'P.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: 'S', underline: null, summarySentence: null } }] as unknown as Parameters<typeof DcpPlayer>[0]['items']
  it('채점 전(문항 화면)에는 참고가 없다', () => {
    h.seed = []
    const html = renderToString(<DcpPlayer items={items} afterFeedback={<ArticleReadingReference text={TEXT} />} />)
    expect(html).not.toContain('reading-reference')
  })
  it('넣지 않은 호출자는 예전 그대로(같은 마크업)', () => {
    h.seed = []
    const a = renderToString(<DcpPlayer items={items} />)
    h.seed = []
    const b = renderToString(<DcpPlayer items={items} afterFeedback={undefined} />)
    expect(a).toBe(b)
  })
})
