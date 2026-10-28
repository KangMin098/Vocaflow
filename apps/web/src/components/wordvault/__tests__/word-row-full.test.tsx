// apps/web/src/components/wordvault/__tests__/word-row-full.test.tsx
// T-0208 — 잘린 뜻 · 예문 「전체 보기」: 이름 · 열림 상태 · 44px, 숨김은 펼쳐도 가림, 빈 값은 만들지 않음.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { WordRow, WordRowFull } from '../WordRow'
import type { WordItem } from '../types'

const LONG_KO = '땅, 지면; (특정 용도의) 장소·구역; 근거, 이유; (전기) 접지 — 문맥에 따라 뜻이 넓게 갈리는 낱말이라 한 줄에 다 들어가지 않는다'
const LONG_EN = 'The old gardener knelt on the cold ground beside the hedge and explained, slowly and patiently, why the roses had failed again this spring.'
const W = (o: Partial<WordItem> = {}): WordItem =>
  ({ id: 1, word: 'ground', pos: 'n.', meaning: LONG_KO, exampleEn: LONG_EN, level: 'B1', levelClass: 'b1', mastery: 2, lastDays: 1, nextDays: 2, ...o }) as WordItem
const SHOWN = { word: false, meaning: false }
const row = (w: WordItem, hide = SHOWN) => {
  const onPlay = vi.fn(), onSel = vi.fn()
  const html = renderToString(<WordRow word={w} isSelected={false} isPlaying={false} hideStates={hide} onToggleSelect={onSel} onPlayWord={onPlay} />)
  return { html, onPlay, onSel }
}

describe('WordRow 전체 보기 버튼', () => {
  it('뜻 · 예문이 있으면 이름 · aria-expanded=false · aria-controls · 44px, 처음엔 닫힘', () => {
    const { html, onPlay, onSel } = row(W())
    const btn = /<button[^>]*data-testid="word-row-expand"[^>]*>/.exec(html)?.[0] ?? ''
    expect(btn).toContain('aria-expanded="false"')
    expect(btn).toContain('aria-label="ground 뜻 · 예문 전체 보기"')
    expect(btn).toMatch(/aria-controls="[^"]+"/)
    expect(btn).toContain('h-11 w-11')
    expect(html).not.toContain('data-testid="word-row-full"')
    expect(onPlay).not.toHaveBeenCalled()
    expect(onSel).not.toHaveBeenCalled()
  })
  it('뜻 · 예문 둘 다 비면 버튼 없음', () => {
    expect(row(W({ meaning: ' ', exampleEn: '' })).html).not.toContain('word-row-expand')
  })
  it('짧은 값도 버튼은 있다(잘림 여부와 무관하게 같은 자리)', () => {
    expect(row(W({ meaning: '땅', exampleEn: 'On the ground.' })).html).toContain('word-row-expand')
  })
})

describe('WordRowFull', () => {
  const full = (w: WordItem, hide = SHOWN) => renderToString(<WordRowFull id="p1" word={w} hideStates={hide} />)
  it('긴 한글 뜻 · 긴 영어 예문을 자르지 않고 그대로(줄바꿈 클래스, truncate 없음)', () => {
    const html = full(W())
    expect(html).toContain(LONG_KO.replace(/·/g, '·'))
    expect(html).toContain(LONG_EN)
    expect(html).toContain('id="p1"')
    expect(html).not.toContain('truncate')
    expect(html).toContain('break-keep')
  })
  it('예문이 없으면 예문 줄을 만들지 않는다', () => {
    const html = full(W({ exampleEn: '' }))
    expect(html).not.toContain('word-row-full-example')
    expect(html).toContain('word-row-full-meaning')
  })
  it('뜻 숨김이면 뜻 전체를 내보내지 않는다', () => {
    const html = full(W(), { word: false, meaning: true })
    expect(html).not.toContain(LONG_KO)
    expect(html).toContain('뜻 숨김 중이에요')
    expect(html).toContain(LONG_EN)
  })
  it('단어 숨김이면 낱말이 든 예문 전체를 내보내지 않는다', () => {
    const html = full(W(), { word: true, meaning: false })
    expect(html).not.toContain(LONG_EN)
    expect(html).toContain('단어 숨김 중에는 예문 전체를 가려요')
  })
  it('다른 행의 값이 섞이지 않는다', () => {
    const a = full(W({ id: 1, meaning: '첫째 뜻' })), b = full(W({ id: 2, word: 'stone', meaning: '둘째 뜻', exampleEn: 'A stone.' }))
    expect(a).toContain('첫째 뜻'); expect(a).not.toContain('둘째 뜻')
    expect(b).toContain('둘째 뜻'); expect(b).not.toContain('첫째 뜻')
  })
})

describe('전체 보기 이름 — 단어 숨김 중 낱말 미노출(Codex F01)', () => {
  const label = (hide: { word: boolean; meaning: boolean }) =>
    /<button[^>]*data-testid="word-row-expand"[^>]*>/.exec(row(W(), hide).html)?.[0].match(/aria-label="([^"]*)"/)?.[1]
  it('보일 때는 낱말 포함', () => {
    expect(label({ word: false, meaning: false })).toBe('ground 뜻 · 예문 전체 보기')
    expect(label({ word: false, meaning: true })).toBe('ground 뜻 · 예문 전체 보기')
  })
  it('단어 숨김이면 낱말 없는 이름 — 숨김으로 바꾸면 이름이 바뀐다', () => {
    const shown = label({ word: false, meaning: false }), hidden = label({ word: true, meaning: false })
    expect(hidden).toBe('뜻 · 예문 전체 보기')
    expect(hidden).not.toContain('ground')
    expect(hidden).not.toBe(shown)
  })
})
