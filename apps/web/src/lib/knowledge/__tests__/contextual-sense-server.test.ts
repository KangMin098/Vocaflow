// apps/web/src/lib/knowledge/__tests__/contextual-sense-server.test.ts
// Isolated current source / release graph / writer fixtures. Never writes a DB.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { contextualSenseHash, gradeContextualSense, parseContextualSense } from '../contextual-sense'
import { passageRevision } from '../anchor-source'
import type { AttemptWrite, AttemptWriter } from '../practice-writer'

const state = vi.hoisted(() => ({ selected: null as unknown, db: null as unknown }))
vi.mock('../item-tasks', () => ({ currentItemTask: () => state.selected, ITEM_TASKS: [] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
import { anchorGate, recordItemTaskAttempt } from '../product-server'

const passage = 'Synthetic context decreases. Another synthetic sentence.'
const ann = () => ({ version: 'test.v1', itemId: 'T#30', skeletonSig: 'sig', sentenceCount: 2, targets: [0, 0, 0, 1, 1], misfit: 3,
  sourceRevision: passageRevision(passage), officialAnswer: 4, markerStyle: 'circled' as const, construct: 'lexical_sense' as const,
  sense: { options: ['decrease', 'increase'], correct: 0, rejectWhy: { 1: 'decreasing context' } },
  cue: { sentences: [0], accepted: [], reviewed: true },
  review: { status: 'accepted' as const, annotator: 'A', independentReviewer: 'B', reviewerBlind: true, agreement: 'BD agreed', reviewedAt: '2026-10-17' } })
const now = Date.parse('2026-10-17T00:00:00Z')
const body = () => ({ response: { misfit: 3, cue: [0] }, clientMutationId: '00000000-0000-4000-8000-000000000001', clientSessionId: '00000000-0000-4000-8000-000000000002', answeredAt: new Date(now).toISOString(), helpLevel: 'independent' })
function database(source: unknown = { passage, answer: 4, type_id: 'R-VOCAB' }, live = true, error: unknown = null) {
  return { from(table: string) {
    const values: Record<string, unknown> = { csat_items: source,
      knowledge_applications: live ? [{ id: 'app', item_id: 'p', audience: {}, version: 1 }] : [],
      knowledge_items: ['practice', 'method', 'principle'].map((layer, i) => ({ id: ['p', 'm', 'r'][i], slug: layer, layer, status: 'adopted' })),
      knowledge_links: [{ from_id: 'p', to_id: 'm', kind: 'implements' }, { from_id: 'm', to_id: 'r', kind: 'implements' }] }
    const q = { select() { return q }, eq() { return q }, order() { return q }, limit() { return q }, maybeSingle() { return Promise.resolve({ data: values[table], error }) }, then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: values[table] ?? [], count: 1, error }).then(resolve) } }
    return q
  } } as unknown as SupabaseClient
}
beforeEach(() => {
  const a = ann()
  state.selected = { ann: a, def: { key: 'contextual-sense', hash: contextualSenseHash, grade: (_: unknown, raw: unknown) => {
    const r = parseContextualSense(raw, a)
    return r ? { response: r, grade: gradeContextualSense(a, r), summary: {} } : null
  } } }
  state.db = database()
})
describe('V2 server adapter with no actual content', () => {
  it('current source and official answer gate; equal-length edits and missing/unknown source fail closed', async () => {
    expect(await anchorGate('T#30', database())).toBe(true)
    for (const data of [null, { passage, answer: 4, type_id: 'R-TITLE' }, { passage: passage.replace('decreases', 'increases'), answer: 4, type_id: 'R-VOCAB' }, { passage, answer: 1, type_id: 'R-VOCAB' }, { passage, answer: null }]) expect(await anchorGate('T#30', database(data))).toBe(false)
    expect(await anchorGate('T#30', database(undefined, true, { message: 'unavailable' }))).toBe(false)
  })
  it('same existing API writes exact V2 key and hash; duplicate safe and no answer key in result', async () => {
    const rows: AttemptWrite[] = []
    const writer: AttemptWriter = { kind: 'g2', reveal: async () => 'session', record: async w => { rows.push(w); return rows.length === 1 ? 'inserted' : 'duplicate' }, noteExplanationView: async () => true }
    for (const outcome of ['inserted', 'duplicate']) {
      const r = await recordItemTaskAttempt(database(), { id: 'u', email: 'synthetic@example.com' }, 'T#30', body(), now, writer)
      expect(r.outcome).toBe(outcome)
      expect(JSON.stringify(r)).not.toMatch(/rejectWhy|"correct"|sourceRevision|officialAnswer/)
    }
    expect(rows[0]).toMatchObject({ userId: 'u', itemRef: 'T#30', taskKey: 'contextual-sense', contentHash: contextualSenseHash(ann()), isCorrect: true })
    expect(rows[1]).toEqual(rows[0])
  })
  it('bad input, inactive release and writer throw/conflict never return a grade', async () => {
    const writer: AttemptWriter = { kind: 'g2', reveal: async () => 's', record: vi.fn(async () => 'inserted'), noteExplanationView: async () => true }
    await expect(recordItemTaskAttempt(database(), { id: 'u', email: null }, 'T#30', { ...body(), response: { misfit: 5 } }, now, writer)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(recordItemTaskAttempt(database(undefined, false), { id: 'u', email: null }, 'T#30', body(), now, writer)).rejects.toMatchObject({ code: 'not_live' })
    expect(writer.record).not.toHaveBeenCalled()
    await expect(recordItemTaskAttempt(database(), { id: 'u', email: null }, 'T#30', body(), now, { ...writer, record: async () => { throw Error('save failed') } })).rejects.toThrow('save failed')
    await expect(recordItemTaskAttempt(database(), { id: 'u', email: null }, 'T#30', body(), now, { ...writer, record: async () => 'conflict' })).rejects.toMatchObject({ code: 'invalid_input' })
  })
})
