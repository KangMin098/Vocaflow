// apps/web/src/lib/supabase/__tests__/keyset-select.test.ts

import { describe, expect, it } from 'vitest'

import { KEYSET_PAGE_SIZE, keysetSelect } from '../keyset-select'

describe('keysetSelect', () => {
  it('마지막 키 뒤에서 이어 읽고 빈 끝 페이지까지 합친다', async () => {
    const source = Array.from({ length: KEYSET_PAGE_SIZE * 2 }, (_, id) => ({ id }))
    const cursors: Array<number | null> = []

    const rows = await keysetSelect<{ id: number }, number>(
      async (cursor, limit) => {
        cursors.push(cursor)
        return { data: source.filter((row) => cursor == null || row.id > cursor).slice(0, limit), error: null }
      },
      (row) => row.id,
      'probe',
    )

    expect(rows).toEqual(source)
    expect(cursors).toEqual([null, KEYSET_PAGE_SIZE - 1, KEYSET_PAGE_SIZE * 2 - 1])
  })

  it('오류에 조회 이름을 붙여 던진다', async () => {
    await expect(
      keysetSelect(async () => ({ data: null, error: { message: 'boom' } }), () => '', '문항'),
    ).rejects.toThrow('문항 조회 실패: boom')
  })
})
