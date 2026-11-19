// apps/web/src/lib/csat/k-regression/__tests__/migrations.ts
// 저장소 마이그레이션에서 함수의 마지막 정의를 읽는다 — 기준 스냅샷에 그 마이그레이션이 없으면 null(NOT_IN_BASELINE).
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../../../../../../../supabase/migrations/', import.meta.url))

export function latestFunctionDef(name: string): { file: string; sql: string } | null {
  const head = new RegExp(`create (or replace )?function public\\.${name}\\(`, 'i')
  let hit: { file: string; sql: string } | null = null
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(DIR + file, 'utf8').replace(/\r\n/g, '\n')
    const at = text.search(head)
    if (at < 0) continue
    const end = text.indexOf('$$;', at)
    hit = { file, sql: text.slice(at, end < 0 ? undefined : end) }
  }
  return hit
}
