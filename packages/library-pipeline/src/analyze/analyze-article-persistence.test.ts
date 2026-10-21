// packages/library-pipeline/src/analyze/analyze-article-persistence.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: new Map<string, unknown>(), words: [] as Array<{ word: string; frequency_in_book: number; first_sentence: string; base_learning_value: number; context_pos: string }>,
  fail: '' as '' | 'select' | 'upsert' | 'delete',
}))
vi.mock('../client', () => ({ getServiceClient: () => ({ from: () => {
  let operation = 'select'
  let pending: Array<{ word: string }> = []
  let stale: string[] = []
  const query = {
    select() { operation = 'select'; return query },
    upsert(rows: Array<{ word: string }>) { operation = 'upsert'; pending = rows; return query },
    delete() { operation = 'delete'; return query },
    eq() { return query },
    in(_column: string, words: string[]) { stale = words; return query },
    then(resolve: (result: unknown) => unknown) {
      if (state.fail === operation) return Promise.resolve(resolve({ data: null, error: { message: `injected ${operation} failure` } }))
      if (operation === 'upsert') for (const row of pending) state.rows.set(row.word, row)
      if (operation === 'delete') for (const word of stale) state.rows.delete(word)
      return Promise.resolve(resolve({ data: operation === 'select' ? [...state.rows.keys()].map(word => ({ word })) : null, error: null }))
    },
  }
  return query
} }) }))
vi.mock('./extract-lemmas', () => ({ extractBookLemmas: () => ({ bookFrequency: new Map() }) }))
vi.mock('./lookup-enrich', () => ({ lookupAndEnrich: async () => ({ entries: [], llmCost: 0 }) }))
vi.mock('./learning-value', () => ({ computeLearningValue: () => state.words }))
vi.mock('./cefr-detect', () => ({ detectBookCefr: async () => ({ level: 'A1', confidence: 0.5, llmCost: 0 }) }))

import { analyzeArticle } from './analyze-article'
import type { NormalizedArticle } from '../types-article'

const input = { body: 'An original test passage.' } as NormalizedArticle
const run = () => analyzeArticle('owned-article', input, { skipLlm: true })
describe('article vocabulary failure and replay', () => {
  beforeEach(() => {
    state.rows.clear(); state.rows.set('old', { word: 'old' }); state.fail = ''
    state.words = [{ word: 'new', frequency_in_book: 1, first_sentence: 'A new sentence.', base_learning_value: 1, context_pos: 'noun' }]
  })
  it('retains existing vocabulary when new persistence fails, then recovers on replay', async () => {
    state.fail = 'upsert'
    await expect(run()).rejects.toThrow('upsert failed')
    expect([...state.rows.keys()]).toEqual(['old'])
    state.fail = ''; await run(); await run()
    expect([...state.rows.keys()]).toEqual(['new'])
  })
  it('does not mutate when the previous vocabulary cannot be read', async () => {
    state.fail = 'select'
    await expect(run()).rejects.toThrow('read failed')
    expect([...state.rows.keys()]).toEqual(['old'])
  })
  it('reports failed cleanup and safely retries the remaining stale rows', async () => {
    state.fail = 'delete'
    await expect(run()).rejects.toThrow('cleanup failed')
    expect([...state.rows.keys()]).toEqual(['old', 'new'])
    state.fail = ''; await run()
    expect([...state.rows.keys()]).toEqual(['new'])
  })
  it('reports failed cleanup for an empty replacement without reporting success', async () => {
    state.words = []; state.fail = 'delete'
    await expect(run()).rejects.toThrow('cleanup failed')
    expect([...state.rows.keys()]).toEqual(['old'])
  })
})
