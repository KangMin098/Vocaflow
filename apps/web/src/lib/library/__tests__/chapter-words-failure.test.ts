// apps/web/src/lib/library/__tests__/chapter-words-failure.test.ts
//
// 챕터 단어 조회의 **실패는 빈 결과가 아니다.**
// 이 패널의 빈 상태 문구는 "이 챕터에는 새로 익힐 단어가 없어요. 이미 다 아는 단어들이네요" 다.
// 조회가 깨졌을 때 빈 결과를 돌려주면 학습자는 그 칭찬을 그대로 받는다 — 오류 배지도,
// 다시 시도할 방법도 없이. 그래서 실패는 반드시 예외로 나와야 한다.

import { describe, expect, it, vi } from 'vitest'

import { ChapterWordsError, deliverChapterVocab, getChapterWordsForUser } from '../chapter-words-queries'

vi.mock('server-only', () => ({}))

const BOOK = '11111111-1111-1111-1111-111111111111'

/** `.range()` 를 존중하는 테이블 조회 + rpc 를 가진 최소 클라이언트. */
function client(opts: {
  lbvRows?: unknown[]
  lbvError?: string
  rpcRows?: unknown[]
  rpcError?: string
}) {
  const table = {} as Record<string, unknown>
  for (const m of ['select', 'eq', 'not']) table[m] = () => table
  table.range = (from: number, to: number) =>
    Promise.resolve(
      opts.lbvError
        ? { data: null, error: { message: opts.lbvError } }
        : { data: (opts.lbvRows ?? []).slice(from, to + 1), error: null },
    )
  return {
    from: () => table,
    rpc: () =>
      Promise.resolve(
        opts.rpcError
          ? { data: null, error: { message: opts.rpcError } }
          : { data: opts.rpcRows ?? [], error: null },
      ),
  } as never
}

describe('챕터 단어 조회 — 실패와 빈 결과의 구별', () => {
  it('deliver RPC 가 실패하면 예외를 던진다 (빈 결과 아님)', async () => {
    await expect(deliverChapterVocab(client({ rpcError: 'boom' }), BOOK, 3)).rejects.toBeInstanceOf(
      ChapterWordsError,
    )
  })

  it('deliver 가 0행이면 빈 결과다 — 그건 정상이다', async () => {
    const r = await deliverChapterVocab(client({ rpcRows: [] }), BOOK, 3)
    expect(r.words).toHaveLength(0)
    expect(r.meta).toBeNull()
  })

  it('lemma 조회가 실패하면 예외를 던진다', async () => {
    await expect(
      getChapterWordsForUser(client({ lbvError: 'boom' }), BOOK, 3, 'u1'),
    ).rejects.toBeInstanceOf(ChapterWordsError)
  })

  it('추출 RPC 가 실패하면 예외를 던진다', async () => {
    await expect(
      getChapterWordsForUser(
        client({ lbvRows: [{ word: 'seaworthy', lemma: 'seaworthy' }], rpcError: 'boom' }),
        BOOK,
        3,
        'u1',
      ),
    ).rejects.toBeInstanceOf(ChapterWordsError)
  })

  it('바인딩된 lemma 가 없으면 빈 결과다 — 그건 정상이다', async () => {
    const r = await getChapterWordsForUser(client({ lbvRows: [] }), BOOK, 3, 'u1')
    expect(r.words).toHaveLength(0)
  })
})
