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
  'queue',
] as const

export type HealthAxis = (typeof HEALTH_AXES)[number]

/**
 * 일 1회 수집기가 채우는 축. **integrity(주 1회)·queue(별도 잡)는 여기 없다.**
 *
 * ⚠️ 이 구분이 없으면 "가장 최근 스냅샷" 이 별도 주기 잡의 실행을 가리킨다 —
 *    화면 헤더의 「최근 수집」과 5축 완전성 검사가 둘 다 엉뚱한 시각을 보게 된다.
 *    실 DB 통합 테스트가 이 결함을 잡았다(픽스처로는 못 잡는다).
 */
export const DAILY_AXES = ['capacity', 'cron', 'latency', 'connections', 'advisor'] as const

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
  queue: '큐 적체',
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
  queue_oldest_age_hours: '큐에서 가장 오래 묵은 것',
  queue_read_failed: '큐 조회 실패',
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
  queue_oldest_age_hours: '시간',
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

// ── 라이브 계기판 (마이그레이션 20260906190000) ────────────────────────────

/** 지금 도는 세션 한 줄. `admin_db_health_live()` 의 `sessions[]`. */
export interface LiveSession {
  pid: number
  state: string
  /** `IO:DataFileRead` 처럼 `유형:이벤트`. 대기 중이 아니면 빈 문자열. */
  wait: string
  dur_s: number
  app: string
  usename: string
  query: string
}

/** 잠금 대기 한 줄 — 누가 누구에게 막혀 있는가. */
export interface LiveBlocker {
  blocked_pid: number
  blocking_pid: number
  dur_s: number
  query: string
}

/** 최근 24시간 안에 성공하지 못한 cron 실행. */
export interface LiveCronRun {
  job: string
  status: string
  at: string
  dur_s: number
  msg: string
  /** 잡이 지금 켜져 있는가. 꺼진 잡의 실패는 과거의 것이다. */
  active: boolean | null
}

export interface LiveSnapshot {
  at: string
  /** 재시작 이후 경과 시간. 누적 통계가 워밍업인지 구조 문제인지 가르는 근거. */
  uptime_h: number
  /** 캐시 적중 원시 카운터 — 화면이 **폴링 사이 증분**으로 순간 적중률을 낸다. */
  blks_hit: number
  blks_read: number
  /** 판정 창. 24시간 누적치(cron_fail_24h)는 맥락으로만 쓴다. */
  cron_fail_1h: number
  conn: {
    max: number
    total: number
    active: number
    idle: number
    idle_in_tx: number
    waiting: number
    used_pct: number
  }
  cache_hit_pct: number | null
  db_size_mb: number
  blocked_locks: number
  longest_query_s: number
  longest_xact_s: number
  oldest_idle_in_tx_s: number
  deadlocks: number
  rollbacks: number
  cron_fail_24h: number
  cron_running: number
  sessions: LiveSession[]
  blockers: LiveBlocker[]
  cron_recent: LiveCronRun[]
}

/** 신호 하나의 판정. `unknown` 은 "못 읽었다" 이지 "정상" 이 아니다. */
export type SignalLevel = 'ok' | 'warn' | 'crit' | 'unknown'

/**
 * 라이브 신호의 임계값. **전부 이 DB 에서 실측한 설정에 걸려 있다** — 어림수를 쓰면
 * 화면이 남의 DB 를 감시하는 셈이 된다 (2026-09-06 실측: `pg_settings`).
 *
 * `null` 은 임계값을 두지 않는 신호다. 근거 없는 선을 그으면 그 선이 곧 무시된다.
 */
export const LIVE_THRESHOLDS: Record<
  string,
  { warn: number; crit: number; dir: 'high' | 'low'; why: string } | null
> = {
  // max_connections = 60 (실측). 초과하면 앱이 연결을 못 얻어 즉시 장애다.
  conn_used_pct: { warn: 70, crit: 85, dir: 'high', why: 'max_connections 60' },
  // 캐시 적중률은 99% 위가 정상 — 그 아래는 읽기가 디스크로 간다는 뜻이다.
  // ⚠️ 이 선은 **폴링 증분으로 낸 순간 적중률**에만 댄다. pg_stat_database 의 누적값에 대면
  //    재시작 직후엔 반드시 걸린다(캐시가 빈 채로 시작하므로) — 실측 2026-09-06: 재시작
  //    2.3시간 뒤 92.9%, 2.6시간 뒤 93.1% 로 **오르는 중**이었는데 화면은 「장애」라고 했다.
  cache_hit_pct: { warn: 99, crit: 95, dir: 'low', why: 'shared_buffers 256MB' },
  // statement_timeout = 120초 (실측). 절반을 넘기면 타임아웃 사정권이다.
  longest_query_s: { warn: 60, crit: 110, dir: 'high', why: 'statement_timeout 120초' },
  // idle_in_transaction_session_timeout = 0 — DB 가 스스로 끊지 않는다. 그래서 사람이 본다.
  // 5분은 조치 `terminate_idle_in_tx` 가 쓰는 기준과 같은 값이다(두 곳이 갈리면 못 믿는다).
  oldest_idle_in_tx_s: { warn: 300, crit: 900, dir: 'high', why: 'DB 자동 종료 없음(=0)' },
  blocked_locks: { warn: 1, crit: 5, dir: 'high', why: '대기 = 이미 멈춘 요청' },
  // 판정은 **최근 1시간**에서 한다. 24시간 누적은 아홉 시간 전에 끝난 사건을 오늘 내내
  // 빨간 불로 남긴다(실측: 재시작 전 60건 + 재시작 후 1건 = 61 이 하루 종일 「초과」였다).
  // crit 5 의 근거: 사건 시각(02시 UTC)에는 한 시간에 30건이었고, 정상 시각은 0~1건이다.
  cron_fail_1h: { warn: 1, crit: 5, dir: 'high', why: '매시 62회 실행 · 실패 0 이 정상' },
  // 24시간 누적치는 맥락이지 판정 대상이 아니다 — 그래서 임계값을 두지 않는다.
  cron_fail_24h: null,
  // 디스크 상한을 모르는 채로 선을 그으면 그 선은 짐작이다 — 값과 증가분만 보여 준다.
  db_size_mb: null,
}

// ── 조치 (마이그레이션 20260906190500) ────────────────────────────────────

export type ActionTier = 'safe' | 'guarded'

export type ActionKey =
  | 'analyze_table'
  | 'analyze_stale_tables'
  | 'cancel_query'
  | 'cron_enable_job'
  | 'terminate_backend'
  | 'terminate_idle_in_tx'
  | 'cron_disable_job'

/**
 * 화면이 실행할 수 있는 조치. **DB 함수의 허용 목록과 같아야 한다** —
 * 여기에만 있는 항목은 눌러도 `허용 목록에 없는 조치` 로 거절당하고, 그건 거짓말하는 버튼이다.
 * (`db-health-actions.test.ts` 가 두 목록이 갈리는 것을 잡는다.)
 */
export const ACTION_CATALOG: Record<
  ActionKey,
  { label: string; tier: ActionTier; effect: string; needsTarget: boolean }
> = {
  analyze_table: {
    label: '통계 갱신',
    tier: 'safe',
    effect: '이 표의 실행계획 통계를 다시 뜬다. 락 없음, 되돌릴 것 없음.',
    needsTarget: true,
  },
  analyze_stale_tables: {
    label: '낡은 통계 일괄 갱신',
    tier: 'safe',
    effect: '7일 넘게 안 뜬 표를 최대 20개까지 ANALYZE 한다.',
    needsTarget: false,
  },
  cancel_query: {
    label: '쿼리 취소',
    tier: 'safe',
    effect: '그 세션의 지금 쿼리만 중단한다. 연결은 살아 있다.',
    needsTarget: true,
  },
  cron_enable_job: {
    label: '잡 재개',
    tier: 'safe',
    effect: '멈춰 둔 예약 작업을 다시 켠다.',
    needsTarget: true,
  },
  terminate_backend: {
    label: '세션 종료',
    tier: 'guarded',
    effect: '연결을 끊는다. 열려 있던 트랜잭션은 롤백된다.',
    needsTarget: true,
  },
  terminate_idle_in_tx: {
    label: 'idle-in-tx 일괄 종료',
    tier: 'guarded',
    effect: '5분 넘게 트랜잭션을 열어 둔 채 노는 세션을 전부 끊는다.',
    needsTarget: false,
  },
  cron_disable_job: {
    label: '잡 정지',
    tier: 'guarded',
    effect: '예약 작업을 끈다. 다시 켜기 전까지 돌지 않는다.',
    needsTarget: true,
  },
}

export interface ActionLogRow {
  id: number
  action: string
  tier: ActionTier
  target: string | null
  reason: string | null
  started_at: string
  finished_at: string | null
  ok: boolean | null
  result: string | null
  error: string | null
}

export interface ActionResult {
  ok: boolean
  log_id: number | null
  tier?: ActionTier
  result?: string
  error?: string
}
