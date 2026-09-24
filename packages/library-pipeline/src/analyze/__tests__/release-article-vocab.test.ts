// packages/library-pipeline/src/analyze/__tests__/release-article-vocab.test.ts
//
// 배치 분석 뒤 어휘 행을 남길지 — 남겨야 할 것을 지우면 발행이 막히고(가공 글),
// 재발행이 공개 단어장을 읽을 원천을 잃는다(발행 글). 그 두 칸과 손잡이를 잠근다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { releaseArticleVocab, shouldKeepArticleVocab } from '../release-article-vocab'

describe('shouldKeepArticleVocab', () => {
  it('발행 글은 남긴다', () => {
    expect(shouldKeepArticleVocab({ status: 'published', source: 'plos' })).toBe(true)
  })
  it('가공 글은 ready 여도 남긴다', () => {
    expect(shouldKeepArticleVocab({ status: 'ready', source: 'original' })).toBe(true)
  })
  it('발행 대기 외부 글은 걷는다', () => {
    expect(shouldKeepArticleVocab({ status: 'ready', source: 'plos' })).toBe(false)
  })
  it('keepAll 이면 전부 남긴다', () => {
    expect(shouldKeepArticleVocab({ status: 'ready', source: 'plos', keepAll: true })).toBe(true)
  })
})

function fakeClient(error: { message: string } | null = null) {
  const eq = vi.fn(async () => ({ error }))
  const del = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ delete: del }))
  return { client: { from } as unknown as SupabaseClient, from, eq }
}

describe('releaseArticleVocab', () => {
  it('남길 글이면 DB 를 건드리지 않는다', async () => {
    const f = fakeClient()
    expect(await releaseArticleVocab(f.client, 'x', { status: 'published', source: 'voa' })).toBe(false)
    expect(f.from).not.toHaveBeenCalled()
  })
  it('걷을 글이면 그 글의 행만 지운다', async () => {
    const f = fakeClient()
    expect(await releaseArticleVocab(f.client, 'x', { status: 'ready', source: 'voa' })).toBe(true)
    expect(f.from).toHaveBeenCalledWith('library_article_vocabularies')
    expect(f.eq).toHaveBeenCalledWith('library_article_id', 'x')
  })
  it('삭제 실패는 던진다', async () => {
    const f = fakeClient({ message: 'boom' })
    await expect(releaseArticleVocab(f.client, 'x', { status: 'ready', source: 'voa' })).rejects.toThrow(/boom/)
  })
})
