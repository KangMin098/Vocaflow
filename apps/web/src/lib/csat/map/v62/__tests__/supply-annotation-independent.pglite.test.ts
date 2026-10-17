// apps/web/src/lib/csat/map/v62/__tests__/supply-annotation-independent.pglite.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { annotationCases } from '../../../../../../../../scripts/research/factory-i2-r5-qualification/independent-cases'
import { STUB, C_SQL, B_SQL } from './supply-sql-harness'

it('independent annotation adversarial cases on C/B/I1-S/P/binding', async () => {
  const db = new PGlite()
  try {
    await db.exec(STUB)
    await db.exec(fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8'))
    await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated')
    const mig = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
    for (const sql of [C_SQL, B_SQL, ...['_pending_workspace_supply_i1_safety.sql', '_pending_workspace_supply_i1_partial.sql', '_pending_workspace_supply_c_annotation_binding.sql'].map(f => fs.readFileSync(path.join(mig, f), 'utf8'))]) await db.exec(sql)
    const { results } = await annotationCases(db)
    expect(results.filter(r => !r.ok)).toEqual([])
    expect(results.length).toBeGreaterThan(35)
  } finally { await db.close() }
}, 60000)
