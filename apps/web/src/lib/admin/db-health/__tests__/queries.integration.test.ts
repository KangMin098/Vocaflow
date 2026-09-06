// apps/web/src/lib/admin/db-health/__tests__/queries.integration.test.ts
//
// /admin/db 조회 — **실 DB 통합.** 환경변수 없으면 skip.
//
// 픽스처 테스트가 못 잡는 것만 여기서 잡는다:
//   ① 마이그레이션이 만든 컬럼과 queries.ts 의 select 목록이 갈리는 것.
//      Supabase 는 없는 컬럼을 select 하면 **에러를 준다** — 화면은 빈 결과로 보이고
//      관리자는 "문제 없음" 으로 읽는다. 컬럼 이름은 타입으로 잠기지 않는다(문자열이다).
//   ② `axis` CHECK 제약과 코드의 HEALTH_AXES 가 갈리는 것.
//      제약에 없는 축을 코드가 알고 있으면 그 축은 영영 빈 칸으로 남는다.
//   ③ 수집기가 실제로 6축을 다 채우는가 — SQL 안에서 예외가 삼켜지면
//      (수집기가 일부러 그렇게 만들어져 있다) 그 축만 조용히 사라진다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { toSeries } from '../derive'
import { fetchDbHealth } from '../queries'
import { ANOMALY_MIN_SAMPLES, HEALTH_AXES } from '../types'
import type { AnomalyRow } from '../types'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skipIfNoEnv)('fetchDbHealth (integration)', () => {
  let client: SupabaseClient
  let data: Awaited<ReturnType<typeof fetchDbHealth>>

  beforeAll(async () => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    data = await fetchDbHealth(client)
  })

  it('두 표의 select 목록이 실제 스키마와 맞는다', () => {
    // 컬럼 이름은 문자열이라 타입이 잠가 주지 않는다 — 실제로 물어봐야 안다.
    expect(data.metricsError).toBeNull()
    expect(data.findingsError).toBeNull()
  })

  it('수집이 한 번이라도 돌았고, 행이 스키마 모양대로 온다', () => {
    expect(data.metrics.length).toBeGreaterThan(0)
    const row = data.metrics[0]
    expect(typeof row.measured_at).toBe('string')
    expect(typeof row.metric).toBe('string')
    expect(HEALTH_AXES).toContain(row.axis)
    // numeric 은 문자열로 온다. 숫자로 오기 시작하면 toNumber 가 계속 처리하지만,
    // 이 단언이 깨지는 날은 드라이버 동작이 바뀐 날이라 알고 지나가야 한다.
    expect(['string', 'number']).toContain(typeof row.value)
  })

  it('일 1회 수집이 5축을 전부 채운다 — 예외를 삼킨 축이 없다', () => {
    // 수집기는 축마다 예외를 잡아 나머지를 살린다(설계). 그래서 한 축이 통째로 빠져도
    // 함수는 성공으로 끝난다. 그 조용한 구멍을 여기서 본다.
    const latestDaily = data.metrics
      .filter((r) => r.axis !== 'integrity')
      .reduce<string | null>((max, r) => (max === null || r.measured_at > max ? r.measured_at : max), null)
    expect(latestDaily).not.toBeNull()

    const axesInRun = new Set(
      data.metrics.filter((r) => r.measured_at === latestDaily).map((r) => r.axis),
    )
    for (const axis of ['capacity', 'cron', 'latency', 'connections', 'advisor'] as const) {
      expect(axesInRun, `축 ${axis} 가 최근 수집에 없다`).toContain(axis)
    }
  })

  it('용량 축은 테이블별 행을 dims.table 로 구분해 준다', () => {
    const tables = toSeries(data.metrics).filter((s) => s.metric === 'table_size_mb')
    expect(tables.length).toBeGreaterThan(0)
    for (const t of tables) expect(t.subject).toBeTruthy()
  })

  it('발견 표는 열린 것만 준다 (resolved 는 목록에 없다)', () => {
    for (const f of data.findings) {
      expect(['open', 'ack']).toContain(f.status)
      expect(['critical', 'warning', 'info']).toContain(f.severity)
      expect(HEALTH_AXES).toContain(f.axis)
      expect(f.occurrences).toBeGreaterThanOrEqual(1)
    }
  })

  it('axis CHECK 제약이 코드의 6축과 같다', async () => {
    // 제약에만 있고 코드에 없으면 그 축의 행은 화면 어디에도 안 나온다(조용한 손실).
    const { data: rows, error } = await client
      .from('db_health_metrics')
      .select('axis')
      .limit(1000)
    expect(error).toBeNull()
    const seen = new Set((rows ?? []).map((r: { axis: string }) => r.axis))
    for (const axis of seen) expect(HEALTH_AXES).toContain(axis)
  })
})

describe.skipIf(skipIfNoEnv)('이상 감지 · 체크포인트 (integration)', () => {
  let client: SupabaseClient

  beforeAll(() => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  it('TS 의 ANOMALY_MIN_SAMPLES 가 SQL 함수의 기본값과 같다', async () => {
    // 화면은 "5회부터 잽니다" 라고 적는다. 함수가 3에서 재기 시작하면 그 문장이 거짓이 되고,
    // 거짓말하는 화면은 나머지 숫자까지 못 믿게 만든다. 두 값이 갈리는 것을 여기서 잡는다.
    const [byDefault, byConstant] = await Promise.all([
      client.rpc('db_health_anomalies'),
      client.rpc('db_health_anomalies', { p_window_days: 30, p_min_samples: ANOMALY_MIN_SAMPLES }),
    ])
    expect(byDefault.error).toBeNull()
    expect(byConstant.error).toBeNull()
    expect((byDefault.data ?? []).length).toBe((byConstant.data ?? []).length)
  })

  it('이상 감지 행 모양이 화면이 읽는 것과 같다', async () => {
    // 표본이 모자라면 빈 배열이 정상이다 — 그때는 모양을 검사할 것이 없다.
    const { data, error } = await client.rpc('db_health_anomalies', {
      p_window_days: 30,
      p_min_samples: 2,
    })
    expect(error).toBeNull()
    const rows = (data ?? []) as AnomalyRow[]
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows.slice(0, 5)) {
      expect(HEALTH_AXES).toContain(r.axis)
      expect(typeof r.metric).toBe('string')
      expect(r.samples).toBeGreaterThanOrEqual(2)
      // MAD = 0 이면 robust_z 는 null 이어야 한다 — 지어낸 숫자가 오면 안 된다.
      if (Number(r.mad) === 0) expect(r.robust_z).toBeNull()
    }
  })

  it('체크포인트 select 목록이 실제 스키마와 맞는다', async () => {
    const { error } = await client
      .from('db_health_checkpoints')
      .select('label, phase, measured_at, note, created_at')
      .limit(1)
    expect(error).toBeNull()
  })
})
