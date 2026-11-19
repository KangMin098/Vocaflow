// apps/web/src/lib/learner/__tests__/article-practice-availability.test.ts
// T-0215 — 서가 「연습 있음」 loader: 로그인 확인 → RPC 1회. 대역은 실제 RPC 이름 · 실제 반환 열(article_id · item_count)만 받는다
// (다른 이름 · 인자를 부르면 오류로 돌려 실패 경로로 간다). 실패 ≠ 없음 · 로그아웃은 부르지 않는다. 실제 Auth/DB 는 NOT_RUN.
import { describe, expect, it } from 'vitest'

import { classifyPracticeAvailability, loadArticlePracticeAvailability, practiceCountFor } from '../article-practice-availability'

const A = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const B = '9c168596-028f-4517-a2f1-e97c942590a9'

function fakeClient(opts: { user?: string | null; rows?: unknown; error?: unknown; throws?: boolean }) {
  const calls: Array<{ fn: string; args: unknown }> = []
  const client = {
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1' } : opts.user ? { id: opts.user } : null } }) },
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args })
      if (opts.throws) throw new Error('network')
      // 실제 함수와 같은 이름 · 무인자만 받는다
      if (fn !== 'article_practice_availability' || args !== undefined) return { data: null, error: { code: 'PGRST202', message: 'not found' } }
      return { data: opts.error ? null : opts.rows ?? [], error: opts.error ?? null }
    },
    from: () => {
      throw new Error('카드별 테이블 조회를 하면 안 된다')
    },
  }
  return { client: client as never, calls }
}

describe('loadArticlePracticeAvailability — 요청당 RPC 1회', () => {
  it('로그인: 실제 이름 · 무인자로 정확히 1회 → 글별 문항 수', async () => {
    const { client, calls } = fakeClient({ rows: [{ article_id: A, item_count: 2 }, { article_id: B, item_count: 2 }] })
    expect(await loadArticlePracticeAvailability(client)).toEqual({ state: 'ok', counts: { [A]: 2, [B]: 2 } })
    expect(calls).toEqual([{ fn: 'article_practice_availability', args: undefined }])
  })
  it('로그아웃: RPC 를 부르지 않는다(signed_out)', async () => {
    const { client, calls } = fakeClient({ user: null })
    expect(await loadArticlePracticeAvailability(client)).toEqual({ state: 'signed_out' })
    expect(calls).toHaveLength(0)
  })
  it('빈 결과는 「없음」(ok · 빈 표), 오류 · 예외는 「실패」 — 섞지 않는다', async () => {
    expect(await loadArticlePracticeAvailability(fakeClient({ rows: [] }).client)).toEqual({ state: 'ok', counts: {} })
    expect(await loadArticlePracticeAvailability(fakeClient({ error: { message: 'x' } }).client)).toEqual({ state: 'failed' })
    expect(await loadArticlePracticeAvailability(fakeClient({ throws: true }).client)).toEqual({ state: 'failed' })
  })
})

describe('classifyPracticeAvailability — classifyPracticeLookup 과 같은 규칙', () => {
  it('error · 배열 아님 → 실패', () => {
    expect(classifyPracticeAvailability({ data: null, error: { message: 'x' } })).toEqual({ state: 'failed' })
    expect(classifyPracticeAvailability({ data: { article_id: A }, error: null })).toEqual({ state: 'failed' })
  })
  it('행 모양이 하나라도 틀리면 전체 실패(uuid 아님 · 0 · 소수 · 열 이름 다름)', () => {
    expect(classifyPracticeAvailability({ data: [{ article_id: 'x', item_count: 2 }], error: null }).state).toBe('failed')
    expect(classifyPracticeAvailability({ data: [{ article_id: A, item_count: 0 }], error: null }).state).toBe('failed')
    expect(classifyPracticeAvailability({ data: [{ article_id: A, item_count: 1.5 }], error: null }).state).toBe('failed')
    expect(classifyPracticeAvailability({ data: [{ id: A, count: 2 }], error: null }).state).toBe('failed')
  })
})

describe('practiceCountFor — 카드 한 장', () => {
  const ok = { state: 'ok' as const, counts: { [A]: 2 } }
  it('있는 글만 수, 다른 글 · 로그아웃 · 실패 · 없음은 null', () => {
    expect(practiceCountFor(ok, A)).toBe(2)
    expect(practiceCountFor(ok, A.toUpperCase())).toBe(2)
    expect(practiceCountFor(ok, B)).toBeNull()
    expect(practiceCountFor({ state: 'signed_out' }, A)).toBeNull()
    expect(practiceCountFor({ state: 'failed' }, A)).toBeNull()
    expect(practiceCountFor(null, A)).toBeNull()
  })
})
