// packages/library-pipeline/src/analyze/analyze-article.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import type { NormalizedArticle } from '../types-article'
const mocks = vi.hoisted(() => ({ from: vi.fn(), lookup: vi.fn(), cefr: vi.fn() }))
vi.mock('../client', () => ({ getServiceClient: () => ({ from: mocks.from }) }))
vi.mock('./lookup-enrich', () => ({ lookupAndEnrich: mocks.lookup }))
vi.mock('./cefr-detect', () => ({ detectBookCefr: mocks.cefr }))
import { analyzeArticle } from './analyze-article'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lookup.mockResolvedValue({ entries: new Map(), llmCost: 0 })
  mocks.cefr.mockResolvedValue({ level: 'A2', confidence: 0.8, llmCost: 0 })
})
const norm = { body: 'People learn when they read stories.', raw: {}, body_hash: 'hash' } as NormalizedArticle

it('preview computes output without vocabulary writes or dictionary enrichment', async () => {
  mocks.from.mockImplementation(() => { throw new Error('unexpected write') })
  const result = await analyzeArticle('article', norm, { preview: true, skipLlm: true })
  expect(result.word_count).toBe(6)
  expect(result.cefr_level).toBe('A2')
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.lookup.mock.calls[0][2]).toEqual({ skipLlm: true })
  expect(mocks.cefr.mock.calls[0][3]).toEqual({ skipLlm: true })
})

it('ordinary preview preserves optional dictionary enrichment without article writes', async () => {
  await analyzeArticle('article', norm, { preview: true, skipLlm: false })
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.lookup.mock.calls[0][2]).toEqual({ skipLlm: false })
  expect(mocks.cefr.mock.calls[0][3]).toEqual({ skipLlm: false })
})

it('legacy write path stops when vocabulary deletion fails', async () => {
  mocks.from.mockReturnValue({ delete: () => ({ eq: async () => ({ error: { message: 'denied' } }) }) })
  await expect(analyzeArticle('article', norm, { skipLlm: true })).rejects.toThrow('delete failed: denied')
  expect(mocks.from).toHaveBeenCalledTimes(1)
})
