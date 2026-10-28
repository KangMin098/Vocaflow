// apps/web/src/lib/learner/__tests__/reader-article-practice.test.ts
// T-0204 — Reader 연습 조회 세 상태: 조회 실패 ≠ 연습 0. 다시 시도는 같은 단일 RPC 1회, payload 를 넘기지 않는다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))

import { classifyPracticeLookup } from '../reader-article-practice'
import { recheckReaderArticlePractice } from '../reader-article-practice-actions'

const ID = '267ef969-2a3a-4dc9-b6b7-a85246df543f'

describe('classifyPracticeLookup', () => {
  it('행이 있으면 available + 연습 주소', () => {
    expect(classifyPracticeLookup(ID, { data: [{ id: 'x' }], error: null })).toEqual({ state: 'available', href: `/practice/article/${ID}` })
  })
  it('빈 배열이면 none', () => {
    expect(classifyPracticeLookup(ID, { data: [], error: null })).toEqual({ state: 'none' })
  })
  it('error 나 배열 아닌 data 는 failed — none 으로 뭉개지 않는다', () => {
    expect(classifyPracticeLookup(ID, { data: null, error: { code: '57014' } })).toEqual({ state: 'failed', articleId: ID })
    expect(classifyPracticeLookup(ID, { data: null, error: null })).toEqual({ state: 'failed', articleId: ID })
  })
})

describe('recheckReaderArticlePractice', () => {
  beforeEach(() => rpc.mockReset())
  it('같은 RPC 를 1회 부르고 상태만 돌려준다(payload 없음)', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'x', payload: { passage: 'p', choices: ['a'] } }], error: null })
    const r = await recheckReaderArticlePractice(ID)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('article_practice_items', { p_article_id: ID })
    expect(r).toEqual({ state: 'available', href: `/practice/article/${ID}` })
    expect(JSON.stringify(r)).not.toContain('passage')
  })
  it('다시 실패하면 failed, 예외도 failed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'x' } })
    expect(await recheckReaderArticlePractice(ID)).toEqual({ state: 'failed', articleId: ID })
    rpc.mockRejectedValueOnce(new Error('net'))
    expect(await recheckReaderArticlePractice(ID)).toEqual({ state: 'failed', articleId: ID })
  })
  it('id 가 uuid 가 아니면 호출하지 않는다', async () => {
    expect(await recheckReaderArticlePractice('../x')).toEqual({ state: 'none' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
