// apps/web/src/components/workspace/__tests__/reading-universe-anchor.test.tsx
// T-0209 — ReadingUniverse anchorSentenceId(opt-in): 주지 않으면 예전과 같은 마크업, 주면 그 문장 하나만 표지 · 강조 · 초점 대상.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ReadingUniverse } from '../ReadingUniverse'

const noop = () => {}
const paragraphs = [
  { id: 0, sentences: [{ id: 0, parts: [{ text: 'The boy walked to the old mill. ' }] }, { id: 1, parts: [{ text: 'He found a small key. ' }] }] },
  { id: 1, sentences: [{ id: 2, parts: [{ text: 'Then he ran home.' }] }] },
]
const render = (extra: Record<string, unknown> = {}) =>
  renderToString(
    <ReadingUniverse paragraphs={paragraphs} isFocusMode={false} onWordHover={noop} onSentencePlay={noop} playingSentenceId={null} {...extra} />,
  )

describe('ReadingUniverse 근거 문장 표지', () => {
  it('prop 을 주지 않은 호출자 = null 을 준 호출자 — 마크업 동일, 표지 없음', () => {
    const a = render()
    expect(render({ anchorSentenceId: null })).toBe(a)
    expect(a).not.toContain('data-evidence-anchor')
  })
  it('id 를 주면 그 문장 하나만 data-evidence-anchor · tabindex=-1 · 강조', () => {
    const html = render({ anchorSentenceId: 1 })
    expect(html.match(/data-evidence-anchor/g)).toHaveLength(1)
    expect(html).toMatch(/tabindex="-1"[^>]*data-evidence-anchor=""|data-evidence-anchor=""[^>]*tabindex="-1"/)
    expect(html).toContain('background-color:var(--p-light)')
    // 듣기 단추 · 문장 수는 그대로
    expect(html.match(/aria-label="문장 \d+ 듣기"/g)).toHaveLength(3)
  })
  it('anchorAutoMove=false(이미 옮김)여도 강조 · 표지는 남는다 — 이동만 막는다', () => {
    const html = render({ anchorSentenceId: 1, anchorAutoMove: false })
    expect(html.match(/data-evidence-anchor/g)).toHaveLength(1)
    expect(html).toContain('background-color:var(--p-light)')
  })
  it('없는 id 면 표지 없음', () => {
    expect(render({ anchorSentenceId: 9 })).not.toContain('data-evidence-anchor')
  })
  it('재생 중 강조가 근거 강조보다 앞선다(TTS 그대로)', () => {
    const html = render({ anchorSentenceId: 1, playingSentenceId: 1 })
    expect(html).toContain('rgba(99,102,241,0.14)')
  })
})
