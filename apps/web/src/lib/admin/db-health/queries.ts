// apps/web/src/lib/admin/db-health/queries.ts
//
// /admin/db 의 서버 조회. 두 표 모두 RLS read=admin 이라 admin 세션이 아니면 빈 배열이 온다
// (레이아웃 가드가 선차단하므로 화면까지 오지 않는 것이 정상 경로).
//
// ⚠️ 조회 실패와 "행이 없다" 를 섞지 않는다. 실패는 `error` 로 돌려 화면이 "—" 를 그리게 한다 —
//    없는 것을 0 으로 그리면 관리자가 "괜찮구나" 로 읽는다(대시보드에서 이미 겪은 함정).

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type { FindingRow, HealthMetricRow } from './types'

/**
 * 가져올 스냅샷 행 수.
 * 일 1회 수집이 38행(테이블 25 + 지표 13), 주 1회가 4행이므로 700행이면 두 주기 모두
 * 최근 2주 이상을 덮는다. 추세 계산은 이 창 안에서만 한다 — 창 밖은 화면이 말하지 않는다.
 */
export const METRIC_ROW_LIMIT = 700

/** 이 시간을 넘겨 수집이 없으면 화면이 "수집이 멈췄다"고 말한다. 일 1회 주기 + 2시간 여유. */
export const STALE_AFTER_HOURS = 26

export interface DbHealthData {
  metrics: HealthMetricRow[]
  findings: FindingRow[]
  /** 조회 자체가 실패했는가 — 빈 결과와 구별해야 한다. */
  metricsError: string | null
  findingsError: string | null
  /** 최근 닫힌 발견 수(7일). "고쳐지고 있다" 를 보여 주는 유일한 신호. */
  recentlyResolved: number
}

export async function fetchDbHealth(): Promise<DbHealthData> {
  // db_health_metrics · db_health_findings 는 생성 타입 미반영 — 언타입 클라이언트 경유
  const supabase = (await createClient()) as unknown as SupabaseClient

  const [metricsRes, findingsRes, resolvedRes] = await Promise.all([
    supabase
      .from('db_health_metrics')
      .select('measured_at, axis, metric, value, dims')
      .order('measured_at', { ascending: false })
      .limit(METRIC_ROW_LIMIT),
    supabase
      .from('db_health_findings')
      .select(
        'id, fingerprint, axis, severity, title, detail, evidence, suggested_sql, status, first_seen_at, last_seen_at, occurrences',
      )
      .in('status', ['open', 'ack'])
      .order('last_seen_at', { ascending: false }),
    supabase
      .from('db_health_findings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('resolved_at', new Date(Date.now() - 7 * 24 * 3600_000).toISOString()),
  ])

  if (metricsRes.error) {
    console.warn('[admin/db] db_health_metrics fetch failed:', metricsRes.error.message)
  }
  if (findingsRes.error) {
    console.warn('[admin/db] db_health_findings fetch failed:', findingsRes.error.message)
  }

  return {
    metrics: (metricsRes.data ?? []) as HealthMetricRow[],
    findings: (findingsRes.data ?? []) as FindingRow[],
    metricsError: metricsRes.error?.message ?? null,
    findingsError: findingsRes.error?.message ?? null,
    // head 요청은 없는 표에도 204/count=null 을 돌려준다 — 0 으로 채우지 않고 그대로 0 표기하되
    // 표가 없는 경우는 findingsError 가 먼저 말해 준다.
    recentlyResolved: resolvedRes.count ?? 0,
  }
}
