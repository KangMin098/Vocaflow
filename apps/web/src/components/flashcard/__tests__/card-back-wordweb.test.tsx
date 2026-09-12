// apps/web/src/components/flashcard/__tests__/card-back-wordweb.test.tsx
//
// 정답면의 **낱말 그물**(파생어·유의어·반의어)이 학습자에게 실제로 그려지는가.
//
// ── 왜 이 스펙이 필요한가 (실측 2026-08-30) ─────────────────────────
// 이 셋은 사전에 **이미 있었는데**(카탈로그 58.8% · 71.1% · 51.5%) 어느 학습자 화면도
// 읽지 않고 있었다. 우위지수는 그 재고를 우위로 세고 있었지만, 학습자에게 닿지 않는
// 것은 재고이지 제품이 아니다.
//
// 그 오해가 다시 생기지 않게 **렌더 단언으로** 못 박는다 — 컬럼이 채워져 있다는 사실은
// 이 스펙을 통과시키지 못한다. 화면에 나와야 통과한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CardBack } from '../CardBack'
import type { FlashcardWord } from '@/types/flashcard'
import { createInitialSRS } from '@/lib/srs/sm2'

const base: FlashcardWord = {
  id: 'w1',
  text: 'develop',
  meaning: '발전하다',
  pronunciation: '/dɪˈvɛləp/',
  pos: 'verb',
  exampleSentence: 'The company is developing a new software product.',
  exampleSentenceWithBlank: 'The company is ____ a new software product.',
  textId: 't1',
  textTitle: '내 단어장',
  textChapter: '',
  srs: createInitialSRS(),
}

const render = (w: Partial<FlashcardWord>) =>
  renderToString(<CardBack word={{ ...base, ...w }} isExampleAudioPlaying={false} />)
    .replace(/<!-- -->/g, '')

describe('CardBack — 낱말 그물', () => {
  it('파생어를 그린다', () => {
    const html = render({ derived: ['development', 'developer'] })
    expect(html).toContain('파생어')
    expect(html).toContain('development')
    expect(html).toContain('developer')
  })

  it('유의어와 반의어를 각각 이름표를 달아 그린다', () => {
    const html = render({ synonyms: ['grow'], antonyms: ['shrink'] })
    expect(html).toContain('비슷한 말')
    expect(html).toContain('grow')
    expect(html).toContain('반대말')
    expect(html).toContain('shrink')
  })

  it('색이 아니라 이름표로 갈린다 — 색맹 학습자도 유의/반의를 구별할 수 있어야 한다', () => {
    const html = render({ synonyms: ['grow'], antonyms: ['shrink'] })
    // 두 이름표가 **글자로** 나와 있어야 한다. 칩 배경색만 다르면 안 된다.
    expect(html.indexOf('비슷한 말')).toBeGreaterThan(-1)
    expect(html.indexOf('반대말')).toBeGreaterThan(-1)
  })

  it('셋 중 있는 것만 그린다 — 없는 줄은 빼서 카드가 흔들리지 않게', () => {
    const html = render({ derived: ['development'] })
    expect(html).toContain('파생어')
    expect(html).not.toContain('비슷한 말')
    expect(html).not.toContain('반대말')
  })

  it('셋 다 없으면 블록 자체를 그리지 않는다', () => {
    const html = render({})
    expect(html).not.toContain('파생어')
    expect(html).not.toContain('비슷한 말')
    expect(html).not.toContain('반대말')
  })

  it('빈 배열은 없는 것과 같이 다룬다', () => {
    const html = render({ derived: [], synonyms: [], antonyms: [] })
    expect(html).not.toContain('파생어')
  })

  it('각 줄은 3개까지만 — 연어 블록과 같은 절제 기준(Cognitive Load)', () => {
    const html = render({ derived: ['a1', 'b2', 'c3', 'd4', 'e5'] })
    expect(html).toContain('a1')
    expect(html).toContain('c3')
    expect(html).not.toContain('d4')
    expect(html).not.toContain('e5')
  })
})
