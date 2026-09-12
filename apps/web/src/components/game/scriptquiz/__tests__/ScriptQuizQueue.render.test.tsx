// apps/web/src/components/game/scriptquiz/__tests__/ScriptQuizQueue.render.test.tsx
//
// 진입면이 **실제로 무엇을 화면에 내놓는지**를 단언한다.
// 순수 함수(`buildQuizQueue`)가 맞아도 렌더가 안 읽은 챕터를 그리면 스포일러는 그대로다 —
// 실제로 이전 버전은 데이터가 아니라 **렌더가** 카탈로그 전체를 그려서 그렇게 됐다.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ScriptQuizQueue } from '../ScriptQuizQueue'
import type { QuizQueue } from '@/lib/scriptquiz/queue'

const BOOK = 'book-1'

/** 읽은 3챕터(2·3은 미확인) + 안 읽은 58챕터가 숨겨진 상태 */
const QUEUE: QuizQueue = {
  books: [
    {
      bookId: BOOK,
      bookTitle: 'Pride and Prejudice',
      bookVLevel: 8,
      readChapters: [
        {
          chapterIdx: 1,
          chapterTitle: 'Chapter 1',
          questionCount: 8,
          readAt: '2026-07-01T00:00:00Z',
          attemptedAt: '2026-08-01T00:00:00Z',
          lastAccuracy: 75,
        },
        {
          chapterIdx: 2,
          chapterTitle: 'Chapter 2',
          questionCount: 8,
          readAt: '2026-07-05T00:00:00Z',
          attemptedAt: null,
          lastAccuracy: null,
        },
        {
          chapterIdx: 3,
          chapterTitle: 'Chapter 3',
          questionCount: 8,
          readAt: '2026-07-09T00:00:00Z',
          attemptedAt: null,
          lastAccuracy: null,
        },
      ],
      confirmed: 1,
      nextToRead: { chapterIdx: 4, chapterTitle: 'Chapter 4' },
      unreadHidden: 58,
    },
  ],
  next: {
    bookId: BOOK,
    bookTitle: 'Pride and Prejudice',
    chapter: {
      chapterIdx: 2,
      chapterTitle: 'Chapter 2',
      questionCount: 8,
      readAt: '2026-07-05T00:00:00Z',
      attemptedAt: null,
      lastAccuracy: null,
    },
  },
  unconfirmed: 2,
  readTotal: 3,
}

describe('ScriptQuiz 진입면 렌더', () => {
  it('안 읽은 챕터로 가는 링크를 하나도 그리지 않는다', () => {
    const html = renderToStaticMarkup(<ScriptQuizQueue queue={QUEUE} hasCatalog />)
    // HTML 에서 `&` 는 `&amp;` 로 이스케이프된다 — 둘 다 받는다.
    const chapters = [
      ...html.matchAll(/\/scriptquiz\/play\?book=book-1&(?:amp;)?ch=(\d+)/g),
    ].map((m) => Number(m[1]))
    expect(chapters.length, 'play 링크가 하나도 없다').toBeGreaterThan(0)
    // 읽은 최대 챕터가 3 이므로 4 이상이 하나라도 있으면 스포일러다.
    expect(Math.max(...chapters), '읽지 않은 챕터 링크가 그려졌다 — 스포일러').toBeLessThanOrEqual(
      3,
    )
    // 책 카드는 기본 접힘이라 초기 HTML 에는 '다음 한 걸음' 링크만 있다(그 자체가 계약이다 —
    // 19챕터 칩을 펼친 채로 두면 다시 나열식이 된다).
    expect(chapters).toEqual([2])
  })

  it('다음 한 걸음을 하나만 크게 내놓는다 (§4④ 한 번에 한 걸음)', () => {
    const html = renderToStaticMarkup(<ScriptQuizQueue queue={QUEUE} hasCatalog />)
    expect(html).toContain('확인 시작')
    expect(html.match(/확인 시작/g)).toHaveLength(1)
    expect(html).toContain('Pride and Prejudice')
  })

  it('숨긴 챕터 수를 밝힌다 (조용한 절단 금지)', () => {
    const html = renderToStaticMarkup(<ScriptQuizQueue queue={QUEUE} hasCatalog />)
    expect(html).toContain('58')
  })

  it('잠금 어휘를 쓰지 않는다 (§4① 막지 않고 권한다)', () => {
    const html = renderToStaticMarkup(<ScriptQuizQueue queue={QUEUE} hasCatalog />)
    expect(/잠김|잠금|불가|금지|차단|먼저 풀어야/.test(html)).toBe(false)
  })

  it('읽은 챕터가 없으면 "읽으러 가기" 로 보낸다 (퀴즈를 팔지 않는다)', () => {
    const empty: QuizQueue = { books: [], next: null, unconfirmed: 0, readTotal: 0 }
    const html = renderToStaticMarkup(<ScriptQuizQueue queue={empty} hasCatalog />)
    expect(html).toContain('아직 읽은 챕터가 없어요')
    expect(html).toContain('/library/books')
    expect(html).not.toContain('/scriptquiz/play?book=')
  })

  it('퀴즈 자체가 없을 때와 내가 안 읽었을 때를 다르게 말한다', () => {
    const empty: QuizQueue = { books: [], next: null, unconfirmed: 0, readTotal: 0 }
    const noCatalog = renderToStaticMarkup(
      <ScriptQuizQueue queue={empty} hasCatalog={false} />,
    )
    expect(noCatalog).toContain('준비된 챕터 퀴즈가 없어요')
    // 할 일이 정반대다 — 이쪽은 읽으러 보내는 게 아니라 샘플로 흐름만 보여 준다
    expect(noCatalog).toContain('/scriptquiz/play')
  })
})
