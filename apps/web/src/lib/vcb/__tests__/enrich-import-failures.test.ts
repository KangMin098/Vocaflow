// apps/web/src/lib/vcb/__tests__/enrich-import-failures.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { importEnrichmentResult } from '@vocaflow/vcb-curate-core'
import { beforeEach, expect, it, vi } from 'vitest'
const files = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('node:fs', () => ({ default: { existsSync: () => true, readFileSync: files.read } }))
beforeEach(() => { files.read.mockReset() })
function db(error: { message: string } | null) {
  const eq = vi.fn().mockResolvedValue({ data: null, error })
  return { client: { from: () => ({ update: () => ({ eq }) }) } as unknown as SupabaseClient, eq }
}
function fixture() {
  files.read.mockImplementation((name: string) => name.endsWith('.validation.json') ? JSON.stringify({ ok: true }) : JSON.stringify({ queue_id: 1, lemma: 'apple', definitions_ko: [{ sense: '사과' }] }) + '\n')
}
it('does not report success when a validated enrichment cannot be persisted', async () => {
  fixture()
  const { client } = db({ message: 'write denied' })
  expect(await importEnrichmentResult(client, 'owned.jsonl')).toMatchObject({ ok: false, imported: 0, failed: 1, total: 1, error: expect.stringContaining('1 enrichment queue updates failed') })
})
it('reports success and persisted counts after retrying the same validated file', async () => {
  fixture()
  const { client, eq } = db(null)
  expect(await importEnrichmentResult(client, 'owned.jsonl')).toMatchObject({ ok: true, imported: 1, failed: 0, skipped: 0 })
  expect(eq).toHaveBeenCalledWith('id', 1)
})
