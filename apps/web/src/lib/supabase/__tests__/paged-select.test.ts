// apps/web/src/lib/supabase/__tests__/paged-select.test.ts
//
// 회귀 고정: **1,000행 상한을 넘겨서 끝까지 받는다.**
//
// 이 헬퍼가 생긴 이유는 파일 상단 주석에 있다 — 2026-08-30 하루에 같은 결함을 세 곳에서
// 만났고 전부 오류 없이 화면 숫자만 틀렸다. 그래서 "한 번 더 요청하는가" 를 못 박는다.

import { describe, it, expect } from 'vitest'

import { PAGE_SIZE, pagedSelect, pagedSelectIn } from '../paged-select'

/** from/to 를 받아 그 구간만큼 잘라 주는 가짜 조회. 실제 PostgREST 처럼 상한도 지킨다. */
function fakeTable(total: number, calls: Array<[number, number]> = []) {
  return (from: number, to: number) => {
    calls.push([from, to])
    const size = Math.min(to - from + 1, PAGE_SIZE)
    const rows = []
    for (let i = from; i < Math.min(from + size, total); i++) rows.push({ i })
    return Promise.resolve({ data: rows, error: null })
  }
}

describe('pagedSelect', () => {
  it('1,000행 이하면 한 번만 요청한다', async () => {
    const calls: Array<[number, number]> = []
    const rows = await pagedSelect<{ i: number }>(fakeTable(300, calls), 'x')
    expect(rows).toHaveLength(300)
    expect(calls).toHaveLength(1)
  })

  it('정확히 1,000행이면 한 번 더 요청해 끝을 확인한다', async () => {
    // 여기가 핵심 — 마지막 페이지가 가득 차면 더 있는지 알 수 없다.
    const calls: Array<[number, number]> = []
    const rows = await pagedSelect<{ i: number }>(fakeTable(PAGE_SIZE, calls), 'x')
    expect(rows).toHaveLength(PAGE_SIZE)
    expect(calls).toHaveLength(2)
  })

  it('상한을 넘는 모집단을 빠짐없이 받는다', async () => {
    const rows = await pagedSelect<{ i: number }>(fakeTable(2345), 'x')
    expect(rows).toHaveLength(2345)
    expect(rows[0]).toEqual({ i: 0 })
    expect(rows[2344]).toEqual({ i: 2344 })
  })

  it('오류를 삼키지 않는다 — 0행과 실패는 구별돼야 한다', async () => {
    await expect(
      pagedSelect(() => Promise.resolve({ data: null, error: { message: '권한 없음' } }), '내 단어'),
    ).rejects.toThrow('내 단어 조회 실패: 권한 없음')
  })
})

describe('pagedSelectIn', () => {
  it('id 를 조각내 보내고 결과를 합친다', async () => {
    const seen: string[][] = []
    const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`)
    const rows = await pagedSelectIn<{ id: string }>(
      ids,
      (chunk) => {
        seen.push(chunk)
        return Promise.resolve({ data: chunk.map((id) => ({ id })), error: null })
      },
      'x',
      50,
    )
    expect(seen.map((c) => c.length)).toEqual([50, 50, 20])
    expect(rows).toHaveLength(120)
  })

  it('id 가 없으면 조회하지 않는다', async () => {
    let called = false
    const rows = await pagedSelectIn<unknown>(
      [],
      () => {
        called = true
        return Promise.resolve({ data: [], error: null })
      },
      'x',
    )
    expect(rows).toEqual([])
    expect(called).toBe(false)
  })

  it('조각 안에서도 1,000행 상한을 넘겨 받는다', async () => {
    // 조각당 행이 상한을 넘는 경우 — 챕터 보유 세트 판정이 실제로 이 모양이었다.
    const rows = await pagedSelectIn<{ i: number }>(
      ['a'],
      (_chunk, from, to) => fakeTable(1500)(from, to),
      'x',
      50,
    )
    expect(rows).toHaveLength(1500)
  })
})
