// apps/web/src/components/flashcard/__tests__/card-back-examples.test.tsx
//
// D0830 예문·해석 노출 계약 — **데이터가 화면에 닿는지**를 잠근다.
//
// 왜 필요한가: 이 저장소가 반복해서 겪은 실패 모드는 "DB 에는 들어갔는데 학습자에게 안 보인다" 다.
// 뜻마다 예문(`meanings_ko[].example`)과 해석(`.example_ko`)을 3만 건 단위로 채우는 배치를 돌려 놓고
// 카드가 그것을 그리지 않으면, 그 배치는 **없었던 것과 같다.** 그리고 그런 결함은 조용하다 —
// 렌더는 성공하고 칸만 비어 있으므로 아무도 모른다. 여기서 실패하게 만든다.
//
// 세 가지를 잠근다:
//   ① 뜻이 2개 이상이면 뜻마다 예문과 해석이 나온다
//   ② 대표 예문 아래 해석 줄이 나온다
//   ③ **해석이 없으면 아무것도 그리지 않는다** — 빈 줄이 카드를 흔들면 Calm UI 위반이다

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

const render = (w: FlashcardWord) => renderToString(<CardBack word={w} isExampleAudioPlaying={false} />)

describe('CardBack — 예문과 해석', () => {
  it('뜻이 2개 이상이면 뜻마다 예문과 해석을 그린다', () => {
    const html = render({
      ...base,
      senses: [
        {
          pos: 'noun',
          meaning: '은행',
          example: 'She opened a savings account at the bank downtown.',
          exampleKo: '그녀는 시내 은행에서 저축 계좌를 개설했다.',
        },
        {
          pos: 'noun',
          meaning: '둑, 제방',
          example: 'We sat on the grassy bank and watched the river.',
          exampleKo: '우리는 풀이 자란 강둑에 앉아 강을 바라보았다.',
        },
      ],
    })
    expect(html).toContain('둑, 제방')
    expect(html).toContain('We sat on the grassy bank and watched the river.')
    expect(html).toContain('우리는 풀이 자란 강둑에 앉아 강을 바라보았다.')
  })

  it('뜻별 예문이 없으면 뜻만 그린다 (빈 자리를 만들지 않는다)', () => {
    const html = render({
      ...base,
      senses: [
        { pos: 'noun', meaning: '은행' },
        { pos: 'noun', meaning: '둑, 제방' },
      ],
    })
    expect(html).toContain('둑, 제방')
    // 예문 블록의 좌측 경계선 스타일이 뜻 영역에 등장하지 않아야 한다
    expect(html).not.toContain('border-l border-[var(--bd)] pl-3')
  })

  it('대표 예문 아래에 해석 줄을 그린다', () => {
    const html = render({ ...base, exampleTranslation: '그녀는 시내 은행에서 저축 계좌를 개설했다.' })
    expect(html).toContain('그녀는 시내 은행에서 저축 계좌를 개설했다.')
  })

  it('해석이 없으면 해석 줄 자체를 그리지 않는다', () => {
    const html = render(base)
    expect(html).not.toContain('그녀는 시내 은행에서')
    // 출처 줄은 그대로 남는다 — 해석만 빠진다
    expect(html).toContain('내 단어장')
  })
})
