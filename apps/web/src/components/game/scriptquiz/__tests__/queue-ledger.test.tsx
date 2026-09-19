// apps/web/src/components/game/scriptquiz/__tests__/queue-ledger.test.tsx
//
// `/scriptquiz` 「읽은 챕터 장부」(2026-09-19 · DD-37) 의 계약.
//   ① 아직 읽은 챕터가 없으면 — 반짝이 빈 상자 대신 문장 + 1차 행동 + **퀴즈가 준비된 책의 실제 목록**
//   ② 다음 한 걸음이 있으면 그 챕터와 주묵 1차 행동 하나

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { QuizQueue } from '@/lib/scriptquiz/queue'

import { ScriptQuizQueue } from '../ScriptQuizQueue'

const EMPTY: QuizQueue = { books: [], next: null, unconfirmed: 0, readTotal: 0 }

describe('ScriptQuizQueue — 읽은 챕터 장부', () => {
  it('읽은 챕터가 없으면 퀴즈가 준비된 책을 실제 목록으로', () => {
    const html = renderToString(
      <ScriptQuizQueue
        queue={EMPTY}
        hasCatalog
        catalogSample={[{ bookId: 'b1', bookTitle: 'Anne of Green Gables', chapters: 3, questions: 24 }]}
      />,
    ).replace(/<!-- -->/g, '')
    expect(html).toContain('아직 읽은 챕터가 없어요')
    expect(html).toContain('Anne of Green Gables')
    expect(html).toContain('3챕터 · 24문항')
    expect(html).toContain('href="/library/books/b1"')
  })

  it('다음 한 걸음 — 그 챕터 + 확인 시작(주묵)', () => {
    const html = renderToString(
      <ScriptQuizQueue
        queue={{
          ...EMPTY,
          readTotal: 1,
          unconfirmed: 1,
          next: {
            bookId: 'b1',
            bookTitle: 'Anne of Green Gables',
            chapter: { chapterIdx: 2, chapterTitle: 'Chapter 2', questionCount: 8, readAt: new Date().toISOString(), attemptedAt: null },
          },
        } as unknown as QuizQueue}
        hasCatalog
      />,
    )
    expect(html).toContain('확인 시작')
    expect(html).toContain('bg-[var(--ju)]')
  })
})
