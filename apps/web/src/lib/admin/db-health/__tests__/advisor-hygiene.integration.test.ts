// apps/web/src/lib/admin/db-health/__tests__/advisor-hygiene.integration.test.ts
//
// **새 함수가 search_path 를 안 걸고 들어오는 것**을 막는 회귀 — 실 DB 통합. 환경변수 없으면 skip.
//
// 2026-09-08 에 public 함수 58개가 search_path 미고정이었다(`20260908042344`).
// 전부 SECURITY INVOKER 라 권한 상승은 아니었지만, 고정하지 않은 함수는 호출자의
// search_path 를 그대로 쓴다 — 같은 이름의 객체가 앞선 스키마에 있으면 조용히 그쪽을 부른다.
// 한 번 0 으로 만들어 두면 **다시 늘어나는 순간**을 잡는 것이 값싸다.
//
// ⚠️ 이 단언은 수집기 스냅샷을 읽으므로 최대 하루 늦다(db-health-daily 는 18:40 UTC).
//    즉시 확인하려면 /admin/db 의 「지금 수집」을 누르거나 collect_db_health_metrics() 를 부른다.
//    늦더라도 "영영 아무도 안 본다" 보다 낫다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

type MetricRow = { measured_at: string; value: string | number; dims: Record<string, unknown> }

describe.skipIf(skipIfNoEnv)('advisor 위생 (integration)', () => {
  let row: MetricRow | null

  beforeAll(async () => {
    const client: SupabaseClient = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client
      .from('db_health_metrics')
      .select('measured_at, value, dims')
      .eq('metric', 'mutable_search_path_funcs')
      .order('measured_at', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    row = (data?.[0] as MetricRow | undefined) ?? null
  })

  it('search_path 미고정 public 함수가 0 이다', () => {
    expect(row, 'mutable_search_path_funcs 지표가 없다 — 수집기가 안 돌았거나 지표가 사라졌다').not.toBeNull()
    const n = Number(row!.value)
    const funcs = (row!.dims['funcs'] ?? []) as string[]
    expect(
      n,
      `측정 ${row!.measured_at} 기준 ${n}개. API 로 노출된 것: ${funcs.join(', ') || '(없음)'} — ` +
        '새 함수에 `set search_path = public, extensions, pg_temp` 를 걸 것 (pg_temp 는 맨 뒤).',
    ).toBe(0)
  })

  it('모수가 확장 소유 함수를 빼고 세어진다 — 우리가 고칠 수 있는 것만', () => {
    // 모수를 확장까지 포함해 세면 138개가 섞여 영영 0 이 안 되고, 그러면 이 단언이 꺼진다.
    expect(Number(row!.dims['extension_owned_excluded'])).toBeGreaterThan(0)
  })
})
