// apps/web/src/lib/admin/db-health/__tests__/silent-noop.integration.test.ts
//
// **조용한 실패**를 금지하는 회귀 — 실 DB 통합. 환경변수 없으면 skip.
//
// 2026-09-08 에 두 가지가 같은 모양으로 실패하고 있었다. 둘 다 "빨간불이 안 켜져서"
// 오래 살아남았지 코드가 어려워서가 아니었다.
//
//   ① 수집기가 크래시에 리셋되는 활동 카운터(last_analyze · n_live_tup)로
//      "통계가 없다" 를 판정했다. 8MB 넘는 표 16개 중 16개를 stale 로 보고했는데
//      16개 전부 pg_statistic 에 통계가 실재했다 — 100% 오탐. 크래시 때마다
//      가짜 치명 경보 16건이 나왔고, 그 소음이 진짜 경보를 가렸다.
//
//   ② LCP 워커가 Vault 설정이 없을 때 RAISE NOTICE 뒤 RETURN 0 했다. cron 은
//      "1 row" 를 받아 succeeded 로 기록했다. 24시간에 1,439회 전부 초록불인 채
//      큐 6건이 read_ct=0 으로 12.7일을 늙었다. cron 축만 보면 완벽히 건강했다.
//
// 두 결함의 공통 형태는 **"성공을 보고하면서 일이 안 줄어드는 것"** 이다.
// 아래 단언은 그 형태 자체를 금지한다 — 구현이 어떻게 바뀌든.
//
// ⚠️ 부작용 없음: 지표를 읽기만 한다. 워커 RPC 는 부르지 않는다
//    (설정이 살아 있으면 실제 http_post 가 나가 큐를 건드린다).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** 활동 카운터가 믿을 만해지는 나이(분). autovacuum/autoanalyze 가 하루 안에 한 바퀴 돈다. */
const COUNTER_TRUSTWORTHY_MIN = 1440

type MetricRow = { measured_at: string; value: string | number; dims: Record<string, unknown> }

async function latest(client: SupabaseClient, metric: string): Promise<MetricRow | null> {
  const { data, error } = await client
    .from('db_health_metrics')
    .select('measured_at, value, dims')
    .eq('metric', metric)
    .order('measured_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`${metric}: ${error.message}`)
  return (data?.[0] as MetricRow | undefined) ?? null
}

describe.skipIf(skipIfNoEnv)('조용한 실패 금지 (integration)', () => {
  let client: SupabaseClient
  let stale: MetricRow | null
  let queue: MetricRow | null
  let cron: MetricRow | null

  beforeAll(async () => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ;[stale, queue, cron] = await Promise.all([
      latest(client, 'stats_stale_tables'),
      latest(client, 'queue_oldest_age_hours'),
      latest(client, 'cron_stale_max_hours'),
    ])
  })

  it('stats_stale_tables 는 pg_statistic 으로 판정한다 — 활동 카운터가 아니다', () => {
    expect(stale).not.toBeNull()
    // 근거 이름을 지표에 박아 둔다. 활동 카운터로 되돌아가면 이 칸이 비거나 바뀐다.
    expect(stale!.dims['criterion']).toBe('pg_statistic')
  })

  it('stale 로 센 표는 실제로 통계가 없다 — 자기 근거를 만족한다', () => {
    const tables = (stale!.dims['tables'] ?? []) as Array<Record<string, unknown>>
    expect(Number(stale!.value)).toBe(tables.length)
    // 하나라도 stat_cols > 0 이면 그 행은 오탐이다. 판정이 자기 기준을 어긴 것.
    for (const t of tables) {
      expect(t['stat_cols'], `${String(t['table'])} 은 통계가 있는데 stale 로 셌다`).toBe(0)
    }
  })

  it('카운터가 어리면 드리프트 절을 보류한다 — 재시작 직후 표 전체가 걸리지 않게', () => {
    const age = Number(stale!.dims['counter_age_min'])
    expect(Number.isFinite(age)).toBe(true)
    expect(stale!.dims['drift_check_applied']).toBe(age >= COUNTER_TRUSTWORTHY_MIN)
  })

  it('성공을 보고하면서 일이 안 줄어드는 잡이 없다', () => {
    expect(queue).not.toBeNull()
    expect(cron).not.toBeNull()

    const neverRead = Number(queue!.dims['never_read'] ?? 0)
    const jobs = (cron!.dims['jobs'] ?? {}) as Record<
      string,
      { active?: boolean; hours_since_ok?: number | null }
    >
    const worker = jobs['library-pipeline-worker']
    expect(worker, 'library-pipeline-worker 잡이 지표에서 사라졌다').toBeDefined()

    // 한 번도 안 읽힌 메시지가 남아 있는데 잡이 활성이고 방금 성공까지 했다면,
    // 그것이 2026-09-08 에 12.7일을 잡아먹은 바로 그 조합이다.
    const reportingSuccess =
      worker!.hours_since_ok !== null &&
      worker!.hours_since_ok !== undefined &&
      worker!.hours_since_ok < 2

    const forbidden = neverRead > 0 && worker!.active === true && reportingSuccess
    expect(
      forbidden,
      `never_read=${neverRead} · active=${String(worker!.active)} · hours_since_ok=${String(worker!.hours_since_ok)} — ` +
        '큐가 안 줄어드는데 잡이 성공을 보고하고 있다. Vault 설정을 넣거나 잡을 끌 것.',
    ).toBe(false)
  })
})
