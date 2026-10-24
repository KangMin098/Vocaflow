// apps/web/src/lib/csat/k-regression/__tests__/fake-db.ts
// loadExposureLedger 용 최소 Supabase 흉내 — 어떤 표를 읽었는지 기록하고, 표별로 준 행을 돌려준다(exact count = 행 수).
import type { SupabaseClient } from '@supabase/supabase-js'

export function fakeDb(rows: Record<string, unknown[]>) {
  const read: string[] = []
  const from = (table: string) => {
    read.push(table)
    const data = rows[table] ?? []
    const result = { data, error: null, count: data.length }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'in', 'limit', 'order', 'gte', 'lte']) b[m] = () => b
    b.then = (ok: (v: typeof result) => unknown) => Promise.resolve(result).then(ok)
    return b
  }
  return { db: { from } as unknown as SupabaseClient, read }
}
