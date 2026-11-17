// apps/web/src/components/flashcard/__tests__/card-back-example-listen.test.tsx
//
// 예문 듣기 — **눌러도 안 되는 버튼을 두지 않는다**. 예전 「듣기」는 onClick 없는 span 이었고
// 재생 표시는 항상 false 였다. 지원·예문이 있을 때만 실제 버튼을, 재생 표시는 넘겨받은 실제 상태만.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CardBack } from '../CardBack'
import type { FlashcardWord } from '@/types/flashcard'
import { createInitialSRS } from '@/lib/srs/sm2'

const base: FlashcardWord = {
  id: 'w1',
  text: 'bank',
  meaning: '은행',
  pronunciation: '/bæŋk/',
  pos: 'noun',
  exampleSentence: 'She opened a savings account at the bank downtown.',
  exampleSentenceWithBlank: 'She opened a savings account at the ____ downtown.',
  textId: 't1',
  textTitle: '내 단어장',
  textChapter: '',
  srs: createInitialSRS(),
}
const noop = () => {}

describe('CardBack — 예문 듣기', () => {
  it('지원하고 예문이 있으면 실제 버튼(type=button · 44px)을 그린다', () => {
    const html = renderToString(<CardBack word={base} isExampleAudioPlaying={false} canPlayExample onPlayExample={noop} />)
    expect(html).toMatch(/<button[^>]*data-example-audio/)
    expect(html).toContain('aria-label="예문 듣기"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('min-h-[44px]')
  })

  it('재생 표시는 넘겨받은 실제 상태를 따른다', () => {
    const html = renderToString(<CardBack word={base} isExampleAudioPlaying canPlayExample onPlayExample={noop} />)
    expect(html).toContain('aria-label="예문 읽는 중"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('브라우저가 지원하지 않으면 듣기 표시를 아예 그리지 않는다', () => {
    const html = renderToString(<CardBack word={base} isExampleAudioPlaying={false} canPlayExample={false} onPlayExample={noop} />)
    expect(html).not.toContain('data-example-audio')
    expect(html).toContain('She opened a savings account')
  })

  it('예문이 비면 듣기 표시를 그리지 않는다', () => {
    const html = renderToString(<CardBack word={{ ...base, exampleSentence: '   ' }} isExampleAudioPlaying={false} canPlayExample onPlayExample={noop} />)
    expect(html).not.toContain('data-example-audio')
  })

  it('재생 함수가 없으면(기존 호출부) 그리지 않는다', () => {
    const html = renderToString(<CardBack word={base} isExampleAudioPlaying={false} />)
    expect(html).not.toContain('data-example-audio')
  })
})
