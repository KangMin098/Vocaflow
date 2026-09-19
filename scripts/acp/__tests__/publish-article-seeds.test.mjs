// scripts/acp/__tests__/publish-article-seeds.test.mjs
import { expect, it, vi } from 'vitest'
import { importSeedArticle } from '../publish-article-seeds.mjs'

const seed = { source: 'nasa', source_url: 'https://example.test/article', feed_id: 'science', feed_label: 'Science' }
const fetched = { source: 'nasa', source_id: 'article-1', source_url: seed.source_url, title: 'Title B',
  content: 'Recollected body B has different words.', license: 'public domain', published_at: null }
const stored = { id: 'article-id', source: 'nasa', source_id: 'article-1', title: 'Title A', content: 'Stored body A.',
  status: 'published', content_hash: 'hash-A', cefr_level: 'B1', word_count: 3, feed_id: 'old', feed_label: null }

function fakeDatabase(existing = stored) {
  const state = { article: existing ? structuredClone(existing) : null, seed: { ...seed, curation_status: 'pending' },
    errors: {}, queries: [], mutations: [] }
  const db = { from(table) {
    const call = { table, operation: 'read', predicates: [], value: null }
    state.queries.push(call)
    const q = {
      select() { return q },
      eq(key, value) { call.predicates.push([key, value]); return q },
      insert(value) { call.operation = 'insert'; call.value = value; return q },
      update(value) { call.operation = 'update'; call.value = value; return q },
      async maybeSingle() {
        return { data: state.errors.lookup ? null : state.article, error: state.errors.lookup ?? null }
      },
      async single() {
        if (table === 'library_articles' && call.operation === 'insert') {
          if (state.errors.insert) return { data: null, error: state.errors.insert }
          if (state.article) return { data: null, error: { code: '23505', message: 'duplicate source key' } }
          state.article = { id: 'new-id', ...call.value }
          state.mutations.push(call)
          return { data: { id: state.article.id }, error: null }
        }
        if (table === 'library_article_seed_catalog' && call.operation === 'update') {
          if (state.errors.link) return { data: null, error: state.errors.link }
          if (call.predicates.some(([key, value]) => state.seed[key] !== value)) {
            return { data: null, error: { code: 'PGRST116', message: 'seed no longer pending' } }
          }
          Object.assign(state.seed, call.value)
          state.mutations.push(call)
          return { data: { source_url: seed.source_url }, error: null }
        }
        throw new Error(`Unexpected mutation to ${table}`)
      },
    }
    return q
  } }
  return { db, state }
}

it.each(['queued', 'normalizing', 'ready', 'published', 'archived'])('rediscovered %s body A is never analyzed or published using body B', async status => {
  const before = { ...stored, status }
  const { db, state } = fakeDatabase(before)
  const analyzeAndPublish = vi.fn(async () => {
    state.article.content_hash = 'hash-B'
    state.article.word_count = 7
    state.article.status = 'published'
  })
  const result = await importSeedArticle({ db, article: fetched, seed }, analyzeAndPublish)
  expect(result).toMatchObject({ kind: 'existing', articleId: stored.id, status, bodyChanged: true })
  expect(analyzeAndPublish).not.toHaveBeenCalled()
  expect(state.article).toEqual(before)
  expect(state.mutations.map(call => call.table)).toEqual(['library_article_seed_catalog'])
  expect(state.seed).toMatchObject({ imported_to_articles: true, imported_article_id: stored.id, curation_status: 'enqueued' })
})

it('even identical rediscovery only links the seed and preserves the original metadata', async () => {
  const { db, state } = fakeDatabase()
  const processNew = vi.fn()
  expect(await importSeedArticle({ db, article: { ...fetched, content: stored.content }, seed }, processNew)).toMatchObject({ bodyChanged: false })
  expect(processNew).not.toHaveBeenCalled()
  expect(state.article).toEqual(stored)
})

it('new articles stay queued without an analysis/publication callback racing process-queue', async () => {
  const { db, state } = fakeDatabase(null)
  const processNew = vi.fn(async id => {
    expect(state.article).toMatchObject({ id, content: fetched.content, status: 'queued' })
    expect(state.seed.imported_article_id).toBe(id)
    return 'published'
  })
  expect(await importSeedArticle({ db, article: fetched, seed }, processNew)).toEqual({ kind: 'new', articleId: 'new-id', status: 'queued' })
  expect(processNew).not.toHaveBeenCalled()
  expect(state.article.status).toBe('queued')
})

it('lookup failure cannot masquerade as a new article', async () => {
  const { db, state } = fakeDatabase()
  state.errors.lookup = { message: 'read timeout' }
  const processNew = vi.fn()
  await expect(importSeedArticle({ db, article: fetched, seed }, processNew)).rejects.toThrow('Existing article lookup')
  expect(state.mutations).toHaveLength(0)
  expect(processNew).not.toHaveBeenCalled()
})

it('a concurrent insert collision stops before linking or analyzing the winning row', async () => {
  const { db, state } = fakeDatabase(null)
  state.errors.insert = { code: '23505', message: 'concurrent source key insert' }
  const processNew = vi.fn()
  await expect(importSeedArticle({ db, article: fetched, seed }, processNew)).rejects.toThrow('retry discovery')
  expect(state.seed.curation_status).toBe('pending')
  expect(state.mutations).toHaveLength(0)
  expect(processNew).not.toHaveBeenCalled()
})

it.each([true, false])('seed link error is propagated with existing=%s', async existing => {
  const { db, state } = fakeDatabase(existing ? stored : null)
  state.errors.link = { message: 'seed update failed' }
  const processNew = vi.fn()
  await expect(importSeedArticle({ db, article: fetched, seed }, processNew)).rejects.toThrow('Seed link failed')
  expect(processNew).not.toHaveBeenCalled()
  expect(state.seed.curation_status).toBe('pending')
  if (existing) expect(state.article).toEqual(stored)
})

it('retry after insert succeeded but seed linking failed leaves the new queued article to process-queue', async () => {
  const { db, state } = fakeDatabase(null)
  state.errors.link = { message: 'seed update failed' }
  const processNew = vi.fn()
  await expect(importSeedArticle({ db, article: fetched, seed }, processNew)).rejects.toThrow()
  delete state.errors.link
  expect(await importSeedArticle({ db, article: fetched, seed }, processNew)).toMatchObject({ kind: 'existing', status: 'queued', bodyChanged: false })
  expect(processNew).not.toHaveBeenCalled()
  expect(state.article.content).toBe(fetched.content)
  expect(state.mutations.filter(call => call.operation === 'insert')).toHaveLength(1)
})

it('missing pending seed is a failure rather than a successful connection', async () => {
  const { db, state } = fakeDatabase()
  state.seed.curation_status = 'enqueued'
  await expect(importSeedArticle({ db, article: fetched, seed }, vi.fn())).rejects.toThrow('Seed link failed')
  expect(state.article).toEqual(stored)
})

it('legacy callback cannot start an unclaimed analysis for a newly inserted article', async () => {
  const { db } = fakeDatabase(null)
  await expect(importSeedArticle({ db, article: fetched, seed }, async () => { throw new Error('unclaimed analysis') })).resolves.toMatchObject({ status: 'queued' })
})

it('a mismatched source fails before any database operation', async () => {
  const { db, state } = fakeDatabase()
  await expect(importSeedArticle({ db, article: { ...fetched, source: 'voa' }, seed }, vi.fn())).rejects.toThrow('does not match')
  expect(state.queries).toHaveLength(0)
})
