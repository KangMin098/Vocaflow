// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/approved-activation.pglite.test.ts
// Binds the immutable deployed SQL and proves its target-state guard refuses an empty database.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../../../..')
const NAME = '20261021175340_learning_outcomes_ai_factory_activation_approved_20261022.sql'
const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations', NAME), 'utf8')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const APPROVED_SHA = 'e84a960723766efc6c798ae09307d8a9e776e46b4d3e7d6f937966a54b312d8d'

describe('approved target-bound deployment history', () => {
  it('matches the exact approved and actually applied payload', () => {
    expect(sha(sql)).toBe(APPROVED_SHA)
    expect(sql).toBe(fs.readFileSync(path.join(ROOT, 'supabase/deploy/learning-outcomes-20261021/learning-outcomes-review.sql'), 'utf8'))
  })

  it('refuses an empty database atomically; it cannot invent the approved source or rows', async () => {
    const db = new PGlite()
    try {
      await db.exec('begin')
      await expect(db.exec(sql)).rejects.toThrow('approval baseline changed')
      await db.exec('rollback')
      const result = await db.query<{ authored: string | null; admission: string | null; reflection: string | null }>(
        "select to_regclass('public.authored_item')::text authored,to_regclass('public.factory_dcp_admission')::text admission,to_regclass('public.source_lesson_reflection')::text reflection",
      )
      expect(result.rows).toEqual([{ authored: null, admission: null, reflection: null }])
    } finally { await db.close() }
  })

  it('declares the target-dependent empty-DB failure in the existing CI ledger', () => {
    const entries = fs.readFileSync(path.join(ROOT, 'supabase/ci/known-migration-failures.txt'), 'utf8').split(/\r?\n/).filter(s => s && !s.startsWith('#'))
    expect(entries.filter(s => s === NAME)).toHaveLength(1)
  })
})
