// apps/web/src/lib/csat/__tests__/synthetic-production.test.ts
import { describe, expect, it } from 'vitest'
import { runAdminSyntheticProduction } from '../synthetic-production'

describe('server synthetic factory loader', () => {
  it('executes the real shared local runner and returns a marked, key-free download', async () => {
    const result = await runAdminSyntheticProduction('m1')
    expect(result.html).toMatch(/^<!-- synthetic_fixture=true non_production=true;/)
    expect(result.manifest.reference_order).toBe('m1')
    expect(result.manifest.production_verified).toBe(false)
    expect(result.manifest.injected_evidence).toContain('benchmark_snapshot')
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE KEY|goldKey|seedKey/)
  })
})
