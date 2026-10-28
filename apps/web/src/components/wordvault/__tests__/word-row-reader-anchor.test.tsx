// apps/web/src/components/wordvault/__tests__/word-row-reader-anchor.test.tsx
// T-0214 — 단어 행 「선택한 기사에서 쓰인 문장」 아래 「글에서 이 문장 보기」: 앵커가 있을 때만 · 숨김 중 없음 · URL 에 해시 · 번호 없음.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WordRowFull } from '../WordRow'
import type { WordItem } from '../types'

const SRC = 'The drought ruined the harvest in many villages.'
const ANCHOR = { textId: 'text-a', hash: '0a1b2c3d', sentenceIndex: 1 }
const W = { id: 1, word: 'drought', pos: 'n.', meaning: '가뭄', exampleEn: 'A dictionary example.', level: 'B1', levelClass: 'b1', mastery: 1, lastDays: 0, nextDays: 0 } as unknown as WordItem
const SHOWN = { word: false, meaning: false }
const full = (hide = SHOWN, anchor: typeof ANCHOR | null = ANCHOR) =>
  renderToString(<WordRowFull id="p1" word={W} hideStates={hide} sourceSentence={SRC} sourceAnchor={anchor} />)
const linkOf = (html: string) => /<a[^>]*data-testid="word-row-reader-anchor"[^>]*>([^<]*)<\/a>/.exec(html)

describe('WordRowFull 글에서 이 문장 보기', () => {
  it('앵커가 있으면 같은 탭 /text/<id> 링크 · 44px · focus-visible', () => {
    const a = linkOf(full())
    expect(a?.[1]).toBe('글에서 이 문장 보기')
    expect(a?.[0]).toContain('href="/text/text-a"')
    expect(a?.[0]).toContain('min-h-[44px]')
    expect(a?.[0]).toContain('focus-visible:ring-2')
    expect(a?.[0]).not.toContain('target=')
  })
  it('앵커 없으면 링크 없음 · 문장은 그대로', () => {
    const html = full(SHOWN, null)
    expect(html).not.toContain('word-row-reader-anchor')
    expect(html).toContain(SRC)
  })
  it('단어 · 뜻 숨김 중에는 링크도 없다', () => {
    expect(full({ word: true, meaning: false })).not.toContain('word-row-reader-anchor')
    expect(full({ word: false, meaning: true })).not.toContain('word-row-reader-anchor')
  })
  it('링크 주소에 해시 · 문장 번호 · 낱말이 실리지 않는다', () => {
    const a = linkOf(full())?.[0] ?? ''
    expect(a).not.toContain('0a1b2c3d')
    expect(a).not.toMatch(/sentence|drought|anchor=/)
  })
})
