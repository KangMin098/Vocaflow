// apps/web/src/lib/admin/db-health/types.ts
//
// DB 헬스 3층(수집·판정·조치) 중 **조치 화면**이 읽는 타입.
// 수집: db_health_metrics (마이그레이션 20260906010000 · 010500)
// 판정: db_health_findings (20260906020000)
//
// 두 표 모두 생성 타입에 아직 반영되지 않아 언타입 클라이언트를 거친다
// (/admin/quality 의 quality_metrics 와 같은 사정).

export const HEALTH_AXES = [
  'capacity',
  'cron',
  'latency',
  'connections',
  'advisor',
  'integrity',
] as const

export type HealthAxis = (typeof HEALTH_AXES)[number]

export type FindingSeverity = 'critical' | 'warning' | 'info'
export type FindingStatus = 'open' | 'ack' | 'resolved' | 'excepted'

export interface HealthMetricRow {
  measured_at: string
  axis: HealthAxis
  metric: string
  /** Supabase numeric 은 문자열로 온다 — 반드시 Number() 를 거쳐 쓴다. */
  value: number | string
  dims: Record<string, unknown> | null
}

export interface FindingRow {
  id: number
  fingerprint: string
  axis: HealthAxis
  severity: FindingSeverity
  title: string
  detail: string
  evidence: Record<string, unknown> | null
  suggested_sql: string | null
  status: FindingStatus
  first_seen_at: string
  last_seen_at: string
  occurrences: number
  /** 면제 사유·근거, 또는 사람이 남긴 메모. 면제 항목은 여기에 **왜 안 뜨는지**가 적혀 있다. */
  note?: string | null
}

/** 한 지표의 시계열 — 같은 metric 이라도 dims.table 이 다르면 다른 계열이다. */
export interface MetricSeries {
  key: string
  axis: HealthAxis
  metric: string
  /** table_size_mb 처럼 대상이 여럿인 지표의 대상 이름. 없으면 null. */
  subject: string | null
  /** measured_at 오름차순 */
  points: { at: string; value: number; dims: Record<string, unknown> | null }[]
}

export interface TableGrowth {
  table: string
  latestMb: number
  /** 창 안 최솟값 대비 증가분. 이력이 1점뿐이면 null(0 이 아니다 — 모르는 것이다). */
  deltaMb: number | null
  indexMb: number | null
  rowsEst: number | null
}

export const AXIS_LABEL: Record<HealthAxis, string> = {
  capacity: '용량 · 블로트',
  cron: '예약 작업',
  latency: '느린 쿼리',
  connections: '연결',
  advisor: '접근 안전',
  integrity: '스키마 무결성',
}

/**
 * 지표 라벨. 등록되지 않은 지표는 원문 그대로 보여 준다 —
 * 수집기에 지표가 추가돼도 화면이 조용히 그것을 감추지 않게 한다.
 */
export const METRIC_LABEL: Record<string, string> = {
  db_size_mb: 'DB 총 용량',
  table_size_mb: '테이블 용량',
  stats_stale_tables: '통계가 낡은 테이블',
  unused_index_mb: '한 번도 안 쓰인 인덱스',
  bloat_sampled_pct: '죽은 튜플 비율(표본)',
  bloat_sample_failed: '블로트 표본 실패',
  cron_fail_24h: '24시간 실패',
  cron_stale_max_hours: '최장 미성공 시간',
  cron_read_failed: 'cron 조회 실패',
  slow_stmt_count: '5초 넘는 구문',
  latency_read_failed: '느린 쿼리 조회 실패',
  conn_used_pct: '연결 점유율',
  anon_exposed_tables: 'anon 이 읽을 수 있는 표',
  anon_exposed_without_rls: 'anon 노출 · RLS 없음',
  rls_missing_tables: 'RLS 없거나 정책 0',
  exposed_secdef_funcs: '노출된 SECURITY DEFINER',
  mutable_search_path_funcs: 'search_path 미고정 함수',
  advisor_read_failed: '접근 안전 조회 실패',
  function_errors: '함수 정적 분석 오류',
  function_check_unavailable: '정적 분석 불가',
  cron_broken_commands: '없는 함수를 부르는 잡',
  cron_command_check_failed: 'cron 명령 검사 실패',
  unindexed_fk: '인덱스 없는 FK',
  invalid_objects: 'INVALID 인덱스 · 제약',
}

/** 단위. 없으면 정수/소수 그대로. */
export const METRIC_UNIT: Record<string, string> = {
  db_size_mb: 'MB',
  table_size_mb: 'MB',
  unused_index_mb: 'MB',
  bloat_sampled_pct: '%',
  cron_stale_max_hours: '시간',
  conn_used_pct: '%',
}

export const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: '치명',
  warning: '주의',
  info: '참고',
}

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: '열림',
  ack: '확인함',
  resolved: '해결',
  excepted: '면제',
}

// ── 이상 감지 · 체크포인트 (마이그레이션 20260906040000) ──────────────────

/**
 * `db_health_anomalies()` 의 `p_min_samples` 기본값.
 *
 * ⚠️ **SQL 함수의 기본값과 같아야 한다.** 화면이 "5회부터 잽니다" 라고 적어 놓고 함수가 3에서
 *    재기 시작하면 관리자는 화면을 못 믿는다. 두 값이 갈리는 것을 실 DB 통합 테스트가 잠근다
 *    (`queries.integration.test.ts` — 인자 없는 호출과 이 값을 넘긴 호출의 결과가 같아야 한다).
 *
 * 왜 하필 5인가: 실측으로 **n=2 면 robust z 가 수학적으로 항상 0.67** 이다
 * (MAD = |x−median| 이므로 |x−median|/(1.4826·MAD) = 1/1.4826). 표본이 적으면 편차가
 * 편차가 아니라 상수가 된다 — 그 숫자를 이상 징후로 인쇄하면 화면이 곧 꺼진다.
 */
export const ANOMALY_MIN_SAMPLES = 5

export interface AnomalyRow {
  axis: HealthAxis
  metric: string
  /** table_size_mb 처럼 대상이 여럿인 지표의 대상. 없으면 null. */
  subject: string | null
  latest: number | string
  prev: number | string | null
  median_value: number | string
  mad: number | string
  /** MAD 가 0(이력이 전부 같은 값)이면 null — 숫자를 지어내지 않는다. */
  robust_z: number | string | null
  /** 직전 값이 0 이거나 없으면 null. */
  pct_change: number | string | null
  samples: number
  latest_at: string
}

export type CheckpointPhase = 'before' | 'after'

export interface CheckpointRow {
  label: string
  phase: CheckpointPhase
  measured_at: string
  note: string | null
  created_at: string
}

/** 라벨 하나의 앞뒤 짝. `after` 가 없으면 **끝나지 않은 작업**이다. */
export interface CheckpointPair {
  label: string
  before: CheckpointRow | null
  after: CheckpointRow | null
  /** 가장 최근에 손댄 시각 — 목록 정렬용. */
  touchedAt: string
}
