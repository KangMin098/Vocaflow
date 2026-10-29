// apps/web/src/components/wordvault/__tests__/word-row-main-example-hide.test.tsx
// T-0229 — 단어 숨김 중에는 본행 예문도 가린다(펼친 행과 같은 안내). 해제하면 원래 예문 · 빈 예문은 「—」 · 뜻만 숨김은 예문 그대로 · 펼침 전후 일관 · 선택/발음 호출 0.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { WordRow, WordRowFull } from '../WordRow'
import type { WordItem } from '../types'

const EX = 'The farmers gathered the harvest before the first autumn storm arrived.'
const W = (o: Partial<WordItem> = {}): WordItem =>
  ({ id: 1, word: 'harvest', pos: 'n.', meaning: '수확', exampleEn: EX, level: 'B1', levelClass: 'b1', mastery: 2, lastDays: 1, nextDays: 2, ...o }) as WordItem
const HIDE_WORD = { word: true, meaning: false }
const HIDE_MEANING = { word: false, meaning: true }
const SHOWN = { word: false, meaning: false }
const NOTE = '단어 숨김 중에는 예문 전체를 가려요'

function row(w: WordItem, hide: { word: boolean; meaning: boolean }) {
  const onPlay = vi.fn(), onSel = vi.fn()
  const html = renderToString(<WordRow word={w} isSelected={false} isPlaying={false} hideStates={hide} onToggleSelect={onSel} onPlayWord={onPlay} />)
  return { html, onPlay, onSel }
}

describe('WordRow 본행 예문 — 단어 숨김', () => {
  it('단어 숨김 중에는 본행에 예문 원문이 없고 펼친 행과 같은 안내가 있다', () => {
    const { html, onPlay, onSel } = row(W(), HIDE_WORD)
    expect(html).not.toContain(EX)
    expect(html).toContain('data-testid="word-row-example-hidden"')
    expect(html).toContain(NOTE)
    expect(onPlay).not.toHaveBeenCalled()
    expect(onSel).not.toHaveBeenCalled()
  })
  it('숨김 해제 — 원래 예문 그대로 · 안내 없음', () => {
    const { html } = row(W(), SHOWN)
    expect(html).toContain(EX)
    expect(html).not.toContain('word-row-example-hidden')
  })
  it('뜻만 숨김 — 예문은 그대로(뜻 숨김은 예문을 가리지 않는다)', () => {
    const { html } = row(W(), HIDE_MEANING)
    expect(html).toContain(EX)
    expect(html).not.toContain('word-row-example-hidden')
  })
  it('빈 예문 — 숨김 여부와 무관하게 「—」, 안내를 만들지 않는다', () => {
    for (const hide of [HIDE_WORD, SHOWN]) {
      const { html } = row(W({ exampleEn: '' }), hide)
      expect(html).not.toContain('word-row-example-hidden')
      expect(html).toContain('>—</span>')
    }
  })
  it('펼친 행과 같은 안내 — 펼침 전후 일관', () => {
    const full = renderToString(<WordRowFull id="f" word={W()} hideStates={HIDE_WORD} />)
    expect(full).toContain(NOTE)
    expect(full).not.toContain(EX)
    expect(row(W(), HIDE_WORD).html).toContain(NOTE)
  })
})
