// apps/web/src/lib/csat/map/v62/__tests__/r5-reader-independent.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { loadExposureLedger, loadFqReader, normalizedPassageKey } from '../exposure-ledger'
import { exposureOf, reservedFromPractice } from '../assessment-exposure'

type Row = Record<string, unknown>
function reader(opts: { table?: string; rows?: Row[]; count?: number | null; error?: unknown; items?: Row[] } = {}) {
  const filters: [string, unknown][] = []
  const db = { from(table: string) {
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return q },
      not: () => q, in: () => q, limit: () => q,
      then(resolve: (v: unknown) => unknown) {
        const data = table === 'csat_items' ? opts.items ?? [{ exam_id: '2022', no: 20, passage: 'candidate' }] : table === opts.table ? opts.rows ?? [] : []
        return Promise.resolve({ data, count: table === opts.table && 'count' in opts ? opts.count : data.length, error: table === opts.table ? opts.error ?? null : null }).then(resolve)
      },
    }
    return q
  } }
  return { db: db as unknown as SupabaseClient, filters }
}

describe('R5 independent reader boundaries — no network or writes', () => {
  it.each([
    ['learning_task_attempts', { item_ref: '2022#20', answered_at: '2026-09-08T00:00:00Z' }, 'exposed'],
    ['learning_sessions', { item_ref: '2022#20', started_at: '2026-09-08T00:00:00Z', deleted_at: '2026-09-09T00:00:00Z' }, 'exposed'],
    ['csat_trap_attempts', { item_id: '2022#20', answered_at: '2026-09-12T00:00:00Z' }, 'unseen'],
    ['csat_session_attempts', { item_id: '2022#20', answered_at: '2026-09-10T00:00:00Z' }, 'unknown'],
    ['csat_review_queue', { item_id: '2022#20' }, 'unknown'],
    ['csat_dx_session', { id: 'self', exam_id: '2022', taken_at: '2026-09-10' }, 'unseen'],
    ['csat_dx_session', { id: 'old', exam_id: '2022', taken_at: '2026-09-08' }, 'exposed'],
    ['csat_dx_response', { item_id: '2022#20', session_id: 'self', csat_dx_session: { user_id: 'u', taken_at: '2026-09-10' } }, 'unseen'],
    // K6-b — P6 정답 노출(서버 수신 시각): 시험일 전 → 노출 · 당일 → 순서 불명 · 뒤 → 영향 없음
    ['learning_exposures', { item_ref: '2022#20', received_at: '2026-09-08T00:00:00Z' }, 'exposed'],
    ['learning_exposures', { item_ref: '2022#20', received_at: '2026-09-10T03:00:00Z' }, 'unknown'],
    ['learning_exposures', { item_ref: '2022#20', received_at: '2026-09-12T00:00:00Z' }, 'unseen'],
  ])('temporal outcome audit: %s %j → %s', async (table, row, expected) => {
    const ledger = await loadExposureLedger(reader({ table: table as string, rows: [row as Row] }).db, 'u', ['2022#20'], { sessionId: 'self', takenAt: '2026-09-10' })
    expect(exposureOf('2022#20', ledger).state).toBe(expected)
  })
  it('historical exposure still covers the same normalized passage in another paper', async () => {
    const ledger = await loadExposureLedger(reader({ table: 'csat_trap_attempts', rows: [{ item_id: 'other#1', answered_at: '2026-09-08T00:00:00Z' }], items: [{ exam_id: '2022', no: 20, passage: 'candidate' }, { exam_id: 'other', no: 1, passage: ' CANDIDATE ' }] }).db, 'u', ['2022#20'], { sessionId: 'self', takenAt: '2026-09-10' })
    expect(exposureOf('2022#20', ledger)).toMatchObject({ state: 'exposed', samePassage: true })
  })
  it('K6-b — P6 정답 노출은 그 문항과 같은 지문 다른 문항을 노출로 만든다(현재 · 이력 없는 모드)', async () => {
    const items = [{ exam_id: '2022', no: 20, passage: 'candidate' }, { exam_id: 'other', no: 1, passage: ' CANDIDATE ' }]
    expect(exposureOf('2022#20', await loadExposureLedger(reader({ table: 'learning_exposures', rows: [{ item_ref: '2022#20' }] }).db, 'u', ['2022#20']))).toMatchObject({ state: 'exposed', sameItem: true, via: ['p6'] })
    expect(exposureOf('2022#20', await loadExposureLedger(reader({ table: 'learning_exposures', rows: [{ item_ref: 'other#1' }], items }).db, 'u', ['2022#20']))).toMatchObject({ state: 'exposed', samePassage: true, via: ['p6'] })
  })
  it.each([['42P01'], ['PGRST205'], ['42501']])('K6-b — learning_exposures %s(표 없음 · 권한 없음 포함)는 정상 0건이 아니라 error', async (code) => {
    const ledger = await loadExposureLedger(reader({ table: 'learning_exposures', error: { code } }).db, 'u', ['2022#20'])
    expect(ledger).toEqual({ status: 'error', failed: ['p6'] })
    expect(exposureOf('2022#20', ledger)).toEqual({ state: 'unknown', reason: 'ledger_error' })
  })
  it('K6-b — learning_exposures 잘림(count 불일치)은 error', async () => {
    expect((await loadExposureLedger(reader({ table: 'learning_exposures', rows: [{ item_ref: 'x#1' }], count: 5 }).db, 'u', ['2022#20'])).status).toBe('error')
  })
  it('normalizes source whitespace before JSON escaping and rejects blank strings', () => {
    expect(normalizedPassageKey('A\n B')).toBe(normalizedPassageKey('a b'))
    expect(normalizedPassageKey('A\tB')).toBe(normalizedPassageKey('a b'))
    expect(normalizedPassageKey({ paragraphs: ['A\nB'] })).toBe(normalizedPassageKey({ paragraphs: ['a b'] }))
    expect(normalizedPassageKey(' \n\t ')).toBeNull()
  })
  it.each(['learning_task_attempts', 'learning_sessions', 'csat_trap_attempts', 'csat_session_attempts', 'csat_review_queue', 'csat_dx_response', 'learning_exposures'])('partial failure of %s reserves the candidate', async (table) => {
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
  it('all ledgers (incl. diagnosis sessions taken) scope their query to the learner, including diagnosis join', async () => {
    const { db, filters } = reader()
    expect((await loadExposureLedger(db, 'user-b', ['2022#20'])).status).toBe('ok')
    expect(filters.filter(([key]) => key === 'user_id')).toEqual(Array.from({ length: 7 }, () => ['user_id', 'user-b']))
    expect(filters).toContainEqual(['csat_dx_session.user_id', 'user-b'])
  })
  it.each([['42P01', 'not_installed'], ['PGRST205', 'not_installed'], ['42501', 'error'], ['XX000', 'error']])('FQ %s is %s', async (code, status) => {
    expect(await loadFqReader(reader({ table: 'content_qualification', error: { code } }).db)).toEqual({ status })
  })
  it('installed FQ has no trusted role/TASK/hash qualifier and returns eligible zero', async () => {
    expect(await loadFqReader(reader({ table: 'content_qualification', count: 17 }).db)).toEqual({ status: 'installed', eligible: [] })
  })
  it('ambiguous FQ success without an exact count is an error, not installed zero', async () => {
    expect(await loadFqReader(reader({ table: 'content_qualification', count: null }).db)).toEqual({ status: 'error' })
  })
})
