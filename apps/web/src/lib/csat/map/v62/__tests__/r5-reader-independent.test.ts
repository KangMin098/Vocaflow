// apps/web/src/lib/csat/map/v62/__tests__/r5-reader-independent.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { loadExposureLedger, loadFqReader, normalizedPassageKey } from '../exposure-ledger'
import { reservedFromPractice } from '../assessment-exposure'

type Row = Record<string, unknown>
function reader(opts: { table?: string; rows?: Row[]; count?: number | null; error?: unknown } = {}) {
  const filters: [string, unknown][] = []
  const db = { from(table: string) {
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return q },
      not: () => q, in: () => q, limit: () => q,
      then(resolve: (v: unknown) => unknown) {
        const data = table === 'csat_items' ? [{ exam_id: '2022', no: 20, passage: 'candidate' }] : table === opts.table ? opts.rows ?? [] : []
        return Promise.resolve({ data, count: table === opts.table && 'count' in opts ? opts.count : data.length, error: table === opts.table ? opts.error ?? null : null }).then(resolve)
      },
    }
    return q
  } }
  return { db: db as unknown as SupabaseClient, filters }
}

describe('R5 independent reader boundaries — no network or writes', () => {
  it('normalizes source whitespace before JSON escaping and rejects blank strings', () => {
    expect(normalizedPassageKey('A\n B')).toBe(normalizedPassageKey('a b'))
    expect(normalizedPassageKey('A\tB')).toBe(normalizedPassageKey('a b'))
    expect(normalizedPassageKey({ paragraphs: ['A\nB'] })).toBe(normalizedPassageKey({ paragraphs: ['a b'] }))
    expect(normalizedPassageKey(' \n\t ')).toBeNull()
  })
  it.each(['learning_task_attempts', 'learning_sessions', 'csat_trap_attempts', 'csat_session_attempts', 'csat_review_queue', 'csat_dx_response'])('partial failure of %s reserves the candidate', async (table) => {
    const { db } = reader({ table, error: { code: 'XX000' } })
    const ledger = await loadExposureLedger(db, 'user-a', ['2022#20'])
    expect(ledger.status).toBe('error')
    expect([...reservedFromPractice(['2022#20'], ledger)]).toEqual(['2022#20'])
  })
  it.each([1000, 1999, 2000])('server truncation below requested LIMIT (%i returned) is never unseen', async (returned) => {
    const { db } = reader({ table: 'csat_trap_attempts', rows: Array.from({ length: returned }, () => ({ item_id: 'other#1' })), count: 2001 })
    expect((await loadExposureLedger(db, 'user-a', ['2022#20'])).status).toBe('error')
  })
  it('unknown exact count cannot establish completeness', async () => {
    const { db } = reader({ table: 'csat_trap_attempts', count: null })
    expect((await loadExposureLedger(db, 'user-a', ['2022#20'])).status).toBe('error')
  })
  it('all six ledgers scope their query to the learner, including diagnosis join', async () => {
    const { db, filters } = reader()
    expect((await loadExposureLedger(db, 'user-b', ['2022#20'])).status).toBe('ok')
    expect(filters.filter(([key]) => key === 'user_id')).toEqual(Array.from({ length: 5 }, () => ['user_id', 'user-b']))
    expect(filters).toContainEqual(['csat_dx_session.user_id', 'user-b'])
  })
  it.each([['42P01', 'not_installed'], ['PGRST205', 'not_installed'], ['42501', 'error'], ['XX000', 'error']])('FQ %s is %s', async (code, status) => {
    expect(await loadFqReader(reader({ table: 'content_qualification', error: { code } }).db)).toEqual({ status })
  })
  it('installed FQ has no trusted role/TASK/hash qualifier and returns eligible zero', async () => {
    expect(await loadFqReader(reader({ table: 'content_qualification', count: 17 }).db)).toEqual({ status: 'installed', eligible: [] })
  })
})
