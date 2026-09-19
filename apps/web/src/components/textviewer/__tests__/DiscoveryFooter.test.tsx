// apps/web/src/components/textviewer/__tests__/DiscoveryFooter.test.tsx
//
// My Library 푸터가 **보고 있는 면과 짝이 맞는가**.
//
// 사용자 신고(2026-08-17): "`/text?view=vocab` Decks 에 스크립트가 왜 게시되었나?"
// 원인은 이 푸터가 면과 무관하게 **무조건** 렌더되면서 항상 스크립트를 판 것이었다.
// 같은 화면의 상단 카드는 이미 면마다 다르게 그려지고 주석까지 달려 있었는데
// ("Decks 면에 '새 스크립트 추가하기' 를 두면 이 면이 무엇을 모으는 곳인지 잘못 가르친다")
// 푸터만 그 규칙 밖에 있었다. 한 화면에서 위아래가 다른 규칙을 쓰면 반드시 이렇게 갈린다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DiscoveryFooter } from '../DiscoveryFooter'

const decks = renderToString(<DiscoveryFooter view="vocab" />)
const texts = renderToString(<DiscoveryFooter view="scripts" />)
const books = renderToString(<DiscoveryFooter view="books" />)

describe('면과 짝이 맞는 곳으로만 보낸다', () => {
  it('Decks 면에는 아무것도 그리지 않는다 — 상단에 이미 "단어장 더 둘러보기" 가 있다', () => {
    expect(decks).toBe('')
  })

  it('Texts 면은 공개 짧은 글(Dispatches) 서가로 보낸다', () => {
    expect(texts).toContain('/library/scripts')
    expect(texts).toContain('Dispatches')
  })

  it('Books 면은 도서 서가로 보낸다', () => {
    expect(books).toContain('/library/books')
  })

  it('어느 면도 `/library` 루트로 보내지 않는다 — 그 주소엔 짝이 되는 면이 없다', () => {
    for (const html of [texts, books]) {
      expect(html).not.toMatch(/href="\/library"/)
    }
  })
})

describe('이름은 레지스트리에서 — 은퇴한 이름을 쓰지 않는다', () => {
  it('"스크립트" 를 쓰지 않는다 (Script 는 활동명 ScriptQuiz 안에만 남는다)', () => {
    for (const html of [decks, texts, books]) {
      expect(html).not.toContain('스크립트')
    }
  })
})

describe('조사를 손으로 붙이지 않는다', () => {
  it('옛 문구의 조사 오류가 되살아나지 않는다', () => {
    // 원문: "새로운 스크립트**이** 필요하신가요?" · "큐레이션된 스크립트**을** 찾아보세요"
    for (const html of [texts, books]) {
      expect(html).not.toContain('스크립트이')
      expect(html).not.toContain('스크립트을')
    }
  })
})
