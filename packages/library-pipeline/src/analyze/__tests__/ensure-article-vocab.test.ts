// packages/library-pipeline/src/analyze/__tests__/ensure-article-vocab.test.ts
//
// 발행 직전 어휘 확인·재생성 — 지키는 성질 넷:
//   ① 행이 있으면 아무것도 쓰지 않는다(분석·V-Level 호출 0)
//   ② 행 수를 못 읽으면 「없음」으로 치지 않고 던진다(오류를 0 으로 삼키면 멀쩡한 글을 다시 쓴다)
//   ③ 없으면 배치 경로와 같은 설정으로 만든다 — joinHyphenLineBreaks:false · skipLlm:true
//   ④ 본문이 비면 빈 어휘를 만들지 않고 던진다

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { normalizePunctuation, reflowSoftHyphens } from '../../normalize'
import type { NormalizedArticle } from '../../types-article'
import type { AnalyzeArticleOptions } from '../analyze-article'
import { ensureArticleVocab } from '../ensure-article-vocab'

const FIXED_NOW = new Date('2026-09-24T00:00:00Z')
const ID = '00000000-0000-0000-0000-000000000001'

interface FakeOpts {
  count: number | null
  countError?: { message: string } | null
  article?: Record<string, unknown> | null
  vrlError?: { message: string } | null
}

function fakeClient(o: FakeOpts) {
  const rpc = vi.fn(async () => ({ error: o.vrlError ?? null }))
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              if (table === 'library_article_vocabularies') {
                return Promise.resolve({ count: o.count, error: o.countError ?? null })
              }
              return {
                maybeSingle: async () => ({ data: o.article ?? null, error: null }),
              }
            },
          }
        },
      }
    },
    rpc,
  }
  return { client: client as unknown as SupabaseClient, rpc }
}

const ARTICLE = {
  source: 'plos',
  source_id: 'x',
  source_url: 'https://example.org/x',
  title: 'T',
  author: null,
  language: 'en',
  license: 'CC-BY-4.0',
  // 줄 끝 하이픈 — 기본값(결합)이면 well-known 이 wellknown 으로 붙는다. 배치 경로는 붙이지 않는다
  content: 'The well-\nknown fencer lunged.',
  published_at: null,
}

describe('ensureArticleVocab', () => {
  it('① 행이 있으면 분석도 V-Level 도 부르지 않는다', async () => {
    const { client, rpc } = fakeClient({ count: 597 })
    const analyze = vi.fn()
    const r = await ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })
    expect(r).toEqual({ rebuilt: false, rows: 597, vrlWarning: null })
    expect(analyze).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('② 행 수 조회가 실패하면 다시 만들지 않고 던진다', async () => {
    const { client } = fakeClient({ count: null, countError: { message: 'timeout' } })
    const analyze = vi.fn()
    await expect(ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })).rejects.toThrow(
      /행 수를 읽지 못했다/,
    )
    expect(analyze).not.toHaveBeenCalled()
  })

  it('② count 가 null 이면 0 으로 간주하지 않는다', async () => {
    const { client } = fakeClient({ count: null })
    const analyze = vi.fn()
    await expect(ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })).rejects.toThrow(
      /null/,
    )
    expect(analyze).not.toHaveBeenCalled()
  })

  it('③ 행이 없으면 배치 경로 설정으로 다시 만들고 V-Level 을 다시 잰다', async () => {
    const { client, rpc } = fakeClient({ count: 0, article: ARTICLE })
    let seen: { norm: NormalizedArticle; options?: AnalyzeArticleOptions } | null = null
    const analyze = vi.fn(async (_id: string, norm: NormalizedArticle, options?: AnalyzeArticleOptions) => {
      seen = { norm, options }
      return { words: [{} as never, {} as never, {} as never] }
    })
    const r = await ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })

    expect(r).toEqual({ rebuilt: true, rows: 3, vrlWarning: null })
    expect(seen!.options).toEqual({ skipLlm: true })
    // 배치 경로(process-queue · reprocess)와 같은 호출의 결과여야 하고, 기본값(결합)과는 달라야 한다
    const batch = reflowSoftHyphens(normalizePunctuation(ARTICLE.content), { joinHyphenLineBreaks: false })
    expect(seen!.norm.body).toBe(batch)
    expect(seen!.norm.body).not.toBe(reflowSoftHyphens(normalizePunctuation(ARTICLE.content)))
    expect(seen!.norm.raw.fetched_at).toBe(FIXED_NOW)
    expect(seen!.norm.body_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpc).toHaveBeenCalledWith('compute_article_vrl', { p_article_id: ID })
  })

  it('③ V-Level 실패는 경고로 돌려준다(발행을 막지 않는다)', async () => {
    const { client } = fakeClient({ count: 0, article: ARTICLE, vrlError: { message: 'boom' } })
    const analyze = vi.fn(async () => ({ words: [] }))
    const r = await ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })
    expect(r.vrlWarning).toBe('boom')
  })

  it('④ 본문이 비면 던진다', async () => {
    const { client } = fakeClient({ count: 0, article: { ...ARTICLE, content: '   ' } })
    const analyze = vi.fn()
    await expect(ensureArticleVocab(ID, { client, analyze, now: () => FIXED_NOW })).rejects.toThrow(
      /본문이 비어/,
    )
    expect(analyze).not.toHaveBeenCalled()
  })
})
