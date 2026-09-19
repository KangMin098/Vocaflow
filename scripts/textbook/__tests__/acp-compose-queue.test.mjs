// scripts/textbook/__tests__/acp-compose-queue.test.mjs
import { describe, expect, it, vi } from 'vitest'
import {
  analysisOptionsFor, claimQueuedArticle, isCsatComposeDrain, ownsQueuedArticle,
  parsePilotIds, QUEUE_OWNERSHIP_FILTER, assertAtomicAnalysisAvailable,
  commitClaimedAnalysis, failClaimedAnalysis,
} from '../../acp/process-queue.mjs'

const id = '11111111-1111-4111-8111-111111111111'
const row = {
  id, status: 'queued', source: 'original', feed_id: 'compose-drain', compose_batch_id: 'batch',
  composed_spec: { kind: 'csat-slot-fill' }, content: 'A complete original passage.',
  updated_at: '2026-09-19T08:00:00.123456+00:00',
}

describe('ACP ownership of original composition queues', () => {
  it('accepts stored CSAT slot-fill text and legacy non-compose article queues', () => {
    expect(ownsQueuedArticle(row)).toBe(true)
    expect(ownsQueuedArticle({ ...row, source: 'nasa', feed_id: 'news', compose_batch_id: null })).toBe(true)
    expect(QUEUE_OWNERSHIP_FILTER).toBe('compose_batch_id.is.null,and(source.eq.original,feed_id.eq.compose-drain,composed_spec->>kind.eq.csat-slot-fill)')
  })
  it.each([
    { source: 'nasa' }, { feed_id: null }, { feed_id: 'adapted' },
    { composed_spec: { track: 'csat', target_v_level: 5 } }, { composed_spec: null },
    { status: 'analyzing' }, { status: 'normalizing' }, { status: 'ready' },
    { status: 'published' }, { status: 'failed' }, { content: null }, { content: '  \n ' },
  ])('leaves separate compose jobs, active jobs, and missing text untouched: %j', patch => {
    expect(ownsQueuedArticle({ ...row, ...patch })).toBe(false)
  })
  it('forces skipLlm on CSAT compositions while preserving optional ordinary ACP behavior', () => {
    expect(isCsatComposeDrain(row)).toBe(true)
    expect(analysisOptionsFor(row)).toEqual({ skipLlm: true, preview: true })
    const ordinary = { ...row, source: 'nasa', feed_id: 'news', compose_batch_id: null }
    expect(analysisOptionsFor(ordinary)).toEqual({ skipLlm: false, preview: true })
    expect(analysisOptionsFor(ordinary, true)).toEqual({ skipLlm: true, preview: true })
  })
})

function claimDb(initial = row) {
  let current = structuredClone(initial)
  const writes = []
  const calls = []
  return {
    current: () => current,
    replace: next => { current = structuredClone(next) },
    writes, calls,
    from: vi.fn(table => {
      const conditions = []; let patch
      const q = {
        update(value) { patch = value; return q },
        eq(key, value) { conditions.push([key, value]); return q },
        or(value) { calls.push(value); return q },
        select() { return q },
        async maybeSingle() {
          expect(table).toBe('library_articles')
          if (conditions.some(([key, value]) => current[key] !== value)) return { data: null, error: null }
          writes.push(patch)
          current = { ...current, ...patch, updated_at: '2026-09-19T08:00:01.123456+00:00' }
          return { data: { id: current.id, updated_at: current.updated_at }, error: null }
        },
      }
      return q
    }),
  }
}

describe('conditional claim before any analysis', () => {
  it('two simultaneous runners can claim a queued row only once', async () => {
    const db = claimDb()
    expect(await Promise.all([claimQueuedArticle(db, row), claimQueuedArticle(db, row)])).toEqual([
      { id, updated_at: '2026-09-19T08:00:01.123456+00:00' }, false,
    ])
    expect(db.writes).toHaveLength(1)
    expect(db.current().status).toBe('analyzing')
    expect(db.calls).toEqual([QUEUE_OWNERSHIP_FILTER, QUEUE_OWNERSHIP_FILTER])
  })
  it('a source changed since selection cannot be analyzed from old text', async () => {
    const db = claimDb({ ...row, updated_at: '2026-09-19T08:00:00.123457+00:00' })
    expect(await claimQueuedArticle(db, row)).toBe(false)
    expect(db.writes).toHaveLength(0)
  })
  it('a separate compose job is never touched, even through the direct helper', async () => {
    const db = claimDb()
    expect(await claimQueuedArticle(db, { ...row, feed_id: 'adapted' })).toBe(false)
    expect(db.from).not.toHaveBeenCalled()
  })
  it('missing revision fails closed before a write', async () => {
    const db = claimDb()
    await expect(claimQueuedArticle(db, { ...row, updated_at: null })).rejects.toThrow('Missing source revision')
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('exact pilot scope', () => {
  it('accepts CRLF, deduplicates repeated IDs, and preserves selected IDs', () => {
    expect(parsePilotIds(`\r\n${id}\r\n${id}\n`)).toEqual([id])
  })
  it.each(['', '   ', `${id}\ninvalid`, `${id}\n--commit`])('rejects malformed scope without widening it: %j', text => {
    expect(() => parsePilotIds(text)).toThrow('1..100 valid UUIDs')
  })
  it('limits a pilot to 100 IDs', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`)
    expect(() => parsePilotIds(ids.join('\n'))).toThrow('1..100 valid UUIDs')
  })
})

describe('atomic analysis boundary', () => {
  it('missing SQL fails before any claim or vocabulary mutation', async () => {
    const db = { rpc: vi.fn(async () => ({ error: { message: 'function missing' } })), from: vi.fn() }
    await expect(assertAtomicAnalysisAvailable(db)).rejects.toThrow('migration required')
    expect(db.from).not.toHaveBeenCalled()
  })
  it('checks the deployed version with an all-null read-only probe', async () => {
    const db = { rpc: vi.fn(async () => ({ data: { version: 1 }, error: null })) }
    await assertAtomicAnalysisAvailable(db)
    expect(db.rpc).toHaveBeenCalledWith('commit_article_analysis', {
      p_article_id: null, p_claimed_revision: null, p_source_content: null, p_analysis: null,
    })
  })
  it('passes the exact claimed revision and original body through one commit boundary', async () => {
    const db = { rpc: vi.fn(async () => ({ data: { committed: true }, error: null })) }
    const claim = { updated_at: '2026-09-19T08:00:01.123456+00:00' }
    const analysis = { words: [{ word: 'learn' }] }
    await commitClaimedAnalysis(db, row, claim, analysis)
    expect(db.rpc).toHaveBeenCalledOnce()
    expect(db.rpc.mock.calls[0][1]).toEqual({
      p_article_id: id, p_claimed_revision: claim.updated_at, p_source_content: row.content, p_analysis: analysis,
    })
  })
  it('rejects a lost revision rather than reporting successful processing', async () => {
    const db = { rpc: vi.fn(async () => ({ error: { message: 'source revision changed' } })) }
    await expect(commitClaimedAnalysis(db, row, row, {})).rejects.toThrow('source revision changed')
  })
  it.each([{ status: 'archived' }, { content: 'Body B', updated_at: 'new-revision' },
    { status: 'analyzing', updated_at: 'new-worker-claim' }])('error recovery cannot overwrite concurrent changes: %j', patch => {
    const predicates = []
    const current = { ...row, status: 'analyzing', ...patch }
    const q = {
      update: () => q,
      eq(key, value) { predicates.push([key, value]); return q },
      then(resolve) {
        if (predicates.every(([key, value]) => current[key] === value)) current.status = 'failed'
        resolve({ error: null })
      },
    }
    return failClaimedAnalysis({ from: () => q }, row, row, 'analysis failed').then(() => {
      expect(current).toEqual({ ...row, status: 'analyzing', ...patch })
    })
  })
})
