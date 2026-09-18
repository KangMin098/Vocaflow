// apps/web/src/lib/textbook/__tests__/source-workspace.test.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_STATE,
  filterSources,
  parseSourceWorkspace,
  sourceArticlesHref,
  sourceClues,
  sourceWorkspaceHref,
} from '../source-workspace'
import { buildSourceInventoryPanel, type SourceInventoryRow } from '../source-inventory-view'

const row = (source: string, patch: Partial<SourceInventoryRow> = {}): SourceInventoryRow => ({
  source,
  label: source,
  total: 10,
  ready: 10,
  published: 0,
  other: 0,
  byStatus: [{ status: 'ready', count: 10 }],
  judged: 10,
  judgedPct: 100,
  levelled: 10,
  levelledPct: 100,
  legalBlocked: 0,
  rawPurpose: 0,
  topBlocked: [],
  lastGet: null,
  staleDays: null,
  ...patch,
})
describe('source workspace decisions', () => {
  it('keeps overlapping clues separate and never infers eligibility from ready', () => {
    const clues = sourceClues(row('overlap', { legalBlocked: 8, rawPurpose: 8, judged: 0 }))
    expect(clues.map((c) => [c.issue, c.count])).toEqual([
      ['legal', 8],
      ['raw', 8],
      ['unjudged', 10],
    ])
    expect(sourceClues(row('ready'))).toEqual([])
    expect(clues.some((c) => c.label.includes('통과'))).toBe(false)
  })
  it('prioritizes failed, legal and raw before judgement with stable tie breaks', () => {
    const rows = [
      row('unjudged', { judged: 0 }),
      row('raw', { rawPurpose: 1 }),
      row('legal', { legalBlocked: 1 }),
      row('failed', { byStatus: [{ status: 'failed', count: 1 }] }),
      row('clean'),
    ]
    expect(filterSources(rows, DEFAULT_SOURCE_STATE).map((r) => r.source)).toEqual([
      'failed',
      'legal',
      'raw',
      'unjudged',
      'clean',
    ])
    expect(rows[0].source).toBe('unjudged')
  })
  it('combines Korean or ID search with issue filters and handles empty results', () => {
    const rows = [row('plos', { label: '과학 논문', legalBlocked: 1 }), row('voa', { judged: 0 })]
    expect(
      filterSources(rows, { ...DEFAULT_SOURCE_STATE, q: ' 과학 ', issue: 'legal' }).map(
        (r) => r.source
      )
    ).toEqual(['plos'])
    expect(filterSources(rows, { ...DEFAULT_SOURCE_STATE, q: 'PLOS', issue: 'unjudged' })).toEqual(
      []
    )
  })
  it('sorts actual counts and registration timestamps, keeping missing dates last', () => {
    const rows = [
      row('a'),
      row('b', { total: 30, lastGet: '2026-09-01' }),
      row('c', { total: 20, lastGet: '2026-09-02' }),
    ]
    expect(
      filterSources(rows, { ...DEFAULT_SOURCE_STATE, sort: 'total' }).map((r) => r.source)
    ).toEqual(['b', 'c', 'a'])
    expect(
      filterSources(rows, { ...DEFAULT_SOURCE_STATE, sort: 'recent' }).map((r) => r.source)
    ).toEqual(['c', 'b', 'a'])
  })
  it('round trips URL state and normalizes invalid enum values without prototype keys', () => {
    const state = {
      ...DEFAULT_SOURCE_STATE,
      view: 'operations' as const,
      q: '과학 & 글',
      source: 'plos',
      issue: 'legal' as const,
      sort: 'name' as const,
    }
    expect(
      parseSourceWorkspace(new URL(sourceWorkspaceHref(state), 'http://localhost').searchParams)
    ).toEqual(state)
    expect(
      parseSourceWorkspace({
        view: '__proto__',
        sort: 'constructor',
        issue: 'wrong',
        q: [' abc ', 'ignored'],
      })
    ).toEqual({ ...DEFAULT_SOURCE_STATE, q: 'abc' })
    expect(sourceWorkspaceHref(DEFAULT_SOURCE_STATE)).toBe('/admin/csat/sources')
  })
  it('links to the canonical ACP review query including every state and escaped source', () => {
    const params = new URL(sourceArticlesHref('test & source'), 'http://localhost').searchParams
    expect(params.get('stage')).toBe('review')
    expect(params.get('status')).toBe('all')
    expect(params.get('src')).toBe('test & source')
    expect(
      new URL(sourceArticlesHref('plos', 'failed'), 'http://localhost').searchParams.get('status')
    ).toBe('failed')
  })
  it('does not prescribe a source-specific command from aggregate counts', () => {
    for (const entry of buildSourceInventoryPanel().rows) {
      expect(entry).not.toHaveProperty('nextCommand')
      expect(entry).not.toHaveProperty('nextWhy')
    }
  })
})
