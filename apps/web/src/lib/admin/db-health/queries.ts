// apps/web/src/lib/admin/db-health/queries.ts
//
// /admin/db 의 서버 조회. 두 표 모두 RLS read=admin 이라 admin 세션이 아니면 빈 배열이 온다
// (레이아웃 가드가 선차단하므로 화면까지 오지 않는 것이 정상 경로).
//
// ⚠️ 조회 실패와 "행이 없다" 를 섞지 않는다. 실패는 `error` 로 돌려 화면이 "—" 를 그리게 한다 —
//    없는 것을 0 으로 그리면 관리자가 "괜찮구나" 로 읽는다(대시보드에서 이미 겪은 함정).

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type {
  ActionLogRow,
  AnomalyRow,
  CheckpointRow,
  FindingRow,
  HealthMetricRow,
  LiveSnapshot,
} from './types'

/**
 * 가져올 스냅샷 행 수.
 * 일 1회 수집이 38행(테이블 25 + 지표 13), 주 1회가 4행이므로 700행이면 두 주기 모두
 * 최근 2주 이상을 덮는다. 추세 계산은 이 창 안에서만 한다 — 창 밖은 화면이 말하지 않는다.
 */
export const METRIC_ROW_LIMIT = 700

/** 이 시간을 넘겨 수집이 없으면 화면이 "수집이 멈췄다"고 말한다. 일 1회 주기 + 2시간 여유. */
export const STALE_AFTER_HOURS = 26

/** 체크포인트는 최근 것만 본다 — 라벨당 최대 2행이므로 60이면 30개 작업분. */
export const CHECKPOINT_ROW_LIMIT = 60

/** 조치 감사 기록은 최근 것만 화면에 둔다. 전체는 db_health_action_log 를 직접 본다. */
export const ACTION_LOG_ROW_LIMIT = 30

export interface DbHealthData {
  metrics: HealthMetricRow[]
  findings: FindingRow[]
  /**
   * 면제된 발견 — 저장소가 이미 "이건 이대로 둔다" 고 결정한 것.
   * **숨기지 않고 접어 둔다.** 안 보이는 면제 목록은 커버리지가 아니라 구멍이다.
   */
  excepted: FindingRow[]
  /** 조회 자체가 실패했는가 — 빈 결과와 구별해야 한다. */
  metricsError: string | null
  findingsError: string | null
  /** 최근 닫힌 발견 수(7일). "고쳐지고 있다" 를 보여 주는 유일한 신호. */
  recentlyResolved: number
  /**
   * 자기 이력 대비 편차 상위. 표본이 모자라면 **빈 배열**이 온다 —
   * 화면은 그것을 "이상 없음" 으로 그리면 안 되고 몇 회부터 재는지 말해야 한다.
   */
  anomalies: AnomalyRow[]
  /** 위험 작업 체크포인트(최근분). `after` 없는 라벨 = 끝나지 않은 작업. */
  checkpoints: CheckpointRow[]
  anomaliesError: string | null
  checkpointsError: string | null
  /**
   * **지금** 시점 계기판. 서버에서 한 번 읽어 첫 페인트에 실값이 칠해져 있게 한다 —
   * 클라이언트 폴링만 두면 진입 직후 몇 초간 빈 계기판이 뜨고, 빈 계기판은 "정상" 으로 읽힌다.
   */
  live: LiveSnapshot | null
  liveError: string | null
  /** 조치 감사 기록(최근분). 실패한 조치도 들어 있다. */
  actionLog: ActionLogRow[]
  actionLogError: string | null
}

/**
 * @param injected 테스트에서 service-role 클라이언트를 넣기 위한 구멍.
 *   비워 두면 쿠키 세션(= 실제 화면 경로)을 쓴다. 실 DB 통합 테스트가 이 구멍으로 들어와
 *   **마이그레이션의 컬럼과 아래 select 목록이 갈리는 것**을 잡는다 — 픽스처로는 못 잡는 종류다.
 */
export async function fetchDbHealth(injected?: SupabaseClient): Promise<DbHealthData> {
  // db_health_metrics · db_health_findings 는 생성 타입 미반영 — 언타입 클라이언트 경유
  const supabase = injected ?? ((await createClient()) as unknown as SupabaseClient)

  const [
    metricsRes,
    findingsRes,
    resolvedRes,
    anomaliesRes,
    checkpointsRes,
    liveRes,
    actionLogRes,
  ] = await Promise.all([
    supabase
      .from('db_health_metrics')
      .select('measured_at, axis, metric, value, dims')
      .order('measured_at', { ascending: false })
      .limit(METRIC_ROW_LIMIT),
    supabase
      .from('db_health_findings')
      .select(
        'id, fingerprint, axis, severity, title, detail, evidence, suggested_sql, status, first_seen_at, last_seen_at, occurrences, note',
      )
      .in('status', ['open', 'ack', 'excepted'])
      .order('last_seen_at', { ascending: false }),
    supabase
      .from('db_health_findings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('resolved_at', new Date(Date.now() - 7 * 24 * 3600_000).toISOString()),
    // ⚠️ RPC 이름은 **리터럴**로 둔다. 권한 감사(lib/auth/__tests__/rpc-call-sites.test.ts)가
    //    호출 이름을 정적으로 모으므로 변수로 넘기면 "안 쓰는 RPC" 로 오해된다.
    supabase.rpc('db_health_anomalies'),
    supabase
      .from('db_health_checkpoints')
      .select('label, phase, measured_at, note, created_at')
      .order('created_at', { ascending: false })
      .limit(CHECKPOINT_ROW_LIMIT),
    supabase.rpc('admin_db_health_live'),
    supabase
      .from('db_health_action_log')
      .select('id, action, tier, target, reason, started_at, finished_at, ok, result, error')
      .order('started_at', { ascending: false })
      .limit(ACTION_LOG_ROW_LIMIT),
  ])

  if (metricsRes.error) {
    console.warn('[admin/db] db_health_metrics fetch failed:', metricsRes.error.message)
  }
  if (findingsRes.error) {
    console.warn('[admin/db] db_health_findings fetch failed:', findingsRes.error.message)
  }

  const allFindings = (findingsRes.data ?? []) as FindingRow[]

  return {
    metrics: (metricsRes.data ?? []) as HealthMetricRow[],
    findings: allFindings.filter((f) => f.status !== 'excepted'),
    excepted: allFindings.filter((f) => f.status === 'excepted'),
    metricsError: metricsRes.error?.message ?? null,
    findingsError: findingsRes.error?.message ?? null,
    // head 요청은 없는 표에도 204/count=null 을 돌려준다 — 0 으로 채우지 않고 그대로 0 표기하되
    // 표가 없는 경우는 findingsError 가 먼저 말해 준다.
    recentlyResolved: resolvedRes.count ?? 0,
    anomalies: (anomaliesRes.data ?? []) as AnomalyRow[],
    checkpoints: (checkpointsRes.data ?? []) as CheckpointRow[],
    anomaliesError: anomaliesRes.error?.message ?? null,
    checkpointsError: checkpointsRes.error?.message ?? null,
    live: (liveRes.data as LiveSnapshot | null) ?? null,
    liveError: liveRes.error?.message ?? null,
    actionLog: (actionLogRes.data ?? []) as ActionLogRow[],
    actionLogError: actionLogRes.error?.message ?? null,
  }
}
