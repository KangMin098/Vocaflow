// apps/web/src/lib/supabase/__tests__/paged-select.test.ts
//
// 행 상한을 넘기는 두 헬퍼의 회귀.
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// PostgREST 는 한 응답에 **1,000행까지만** 준다 — 테이블 조회도, **RPC 도** 그렇다.
// 오류가 아니라 조용히 잘리므로, 잘못 쓰면 아무도 모르는 채 수만 틀린다:
//
//     vocabularies 1,945행 계정  →  단일 select 1,000 / 페이지네이션 1,945
//     표면형 1,500개 → RPC 1회   →  1,000행 / 500개씩 쪼개면 1,499행
//
// 그래서 두 헬퍼가 지켜야 할 성질을 못 박는다:
//   ① 마지막 페이지가 덜 찼을 때 **멈춘다** (무한 루프가 아니다)
//   ② 딱 맞아떨어질 때도 **한 번 더 확인하고** 멈춘다 (마지막 행을 잃지 않는다)
//   ③ 실패는 **삼키지 않는다** — 반쯤 받은 결과를 정상이라고 부르면 그게 더 나쁘다

import { describe, expect, it } from 'vitest'

import { PAGE_SIZE, chunkedRpc, pagedSelect } from '@/lib/supabase/paged-select'

/** `total` 행을 가진 가짜 테이블. 요청 범위만큼 잘라 준다(PostgREST 처럼 상한도 건다). */
function fakeTable(total: number) {
  const calls: Array<[number, number]> = []
  const run = (from: number, to: number) => {
    calls.push([from, to])
    const width = Math.min(to - from + 1, PAGE_SIZE)
    const rows = Array.from({ length: Math.max(0, Math.min(width, total - from)) }, (_, i) => ({
      id: from + i,
    }))
    return Promise.resolve({ data: rows, error: null })
  }
  return { run, calls }
}

describe('pagedSelect', () => {
  it('상한보다 적으면 한 번만 부른다', async () => {
    const t = fakeTable(3)
    const rows = await pagedSelect<{ id: number }>(t.run, '테스트')
    expect(rows).toHaveLength(3)
    expect(t.calls).toHaveLength(1)
  })

  it('상한을 넘으면 끝까지 받는다 — 이게 이 헬퍼의 존재 이유다', async () => {
    const t = fakeTable(1945) // 실제로 존재하는 계정의 행 수
    const rows = await pagedSelect<{ id: number }>(t.run, '테스트')
    expect(rows).toHaveLength(1945)
    expect(rows[0]!.id).toBe(0)
    expect(rows[1944]!.id).toBe(1944)
  })

  it('딱 맞아떨어져도 마지막 행을 잃지 않는다', async () => {
    // 2,000행이면 두 번째 페이지가 가득 찬다 — 거기서 멈추면 "더 없음" 을 확인하지 않은 것이다.
    const t = fakeTable(PAGE_SIZE * 2)
    const rows = await pagedSelect<{ id: number }>(t.run, '테스트')
    expect(rows).toHaveLength(PAGE_SIZE * 2)
    expect(t.calls).toHaveLength(3) // 마지막 빈 페이지까지 확인한다
  })

  it('빈 테이블은 한 번 부르고 끝난다', async () => {
    const t = fakeTable(0)
    expect(await pagedSelect(t.run, '테스트')).toEqual([])
    expect(t.calls).toHaveLength(1)
  })

  it('실패를 삼키지 않는다', async () => {
    await expect(
      pagedSelect(() => Promise.resolve({ data: null, error: { message: '권한 없음' } }), '테스트'),
    ).rejects.toThrow(/테스트 조회 실패: 권한 없음/)
  })
})

describe('chunkedRpc', () => {
  it('인자를 쪼개 부르고 결과를 합친다', async () => {
    const seen: number[] = []
    const rows = await chunkedRpc<{ w: string }>(
      Array.from({ length: 1500 }, (_, i) => `w${i}`),
      (chunk) => {
        seen.push(chunk.length)
        return Promise.resolve({ data: chunk.map((w) => ({ w })), error: null })
      },
      '테스트',
    )
    // 한 번에 보냈으면 1,000에서 잘렸을 입력이 전부 돌아온다.
    expect(rows).toHaveLength(1500)
    expect(seen).toEqual([500, 500, 500])
  })

  it('빈 입력은 부르지 않는다 — 빈 배열로 RPC 를 때리지 않는다', async () => {
    let called = 0
    const rows = await chunkedRpc([], () => {
      called += 1
      return Promise.resolve({ data: [], error: null })
    }, '테스트')
    expect(rows).toEqual([])
    expect(called).toBe(0)
  })

  it('조각 하나가 실패하면 전체를 실패로 돌린다', async () => {
    // 반쯤 푼 결과를 정상이라고 부르면, 호출부는 "해석 못 한 단어" 로 세어
    // 아는 비율을 낮게 계산한다 — 조용히 틀리는 쪽이다.
    let n = 0
    await expect(
      chunkedRpc(
        Array.from({ length: 1200 }, (_, i) => i),
        () => {
          n += 1
          return Promise.resolve(
            n === 2 ? { data: null, error: { message: '타임아웃' } } : { data: [], error: null },
          )
        },
        '테스트',
      ),
    ).rejects.toThrow(/테스트 RPC 실패: 타임아웃/)
  })
})
