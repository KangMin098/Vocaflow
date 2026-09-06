// apps/web/src/lib/admin/db-health/derive.ts
//
// DB 헬스 화면의 **순수 계산**. DB 도 React 도 모른다 — 그래서 테스트가 붙는다.
//
// 화면이 하지 않는 일을 여기서도 하지 않는다: **판정하지 않는다.**
// "이 값이 위험한가" 는 /db-health-audit 이 db_health_findings 에 적어 둔 것을 읽어서 보여 줄 뿐,
// 화면이 임계값을 다시 정하지 않는다. 같은 숫자를 두 곳에서 판정하면 두 곳이 갈린다.

import type {
  ActionKey,
  CheckpointPair,
  CheckpointRow,
  FindingRow,
  FindingSeverity,
  HealthAxis,
  HealthMetricRow,
  LiveSnapshot,
  MetricSeries,
  SignalLevel,
  TableGrowth,
} from './types'
import { HEALTH_AXES, LIVE_THRESHOLDS } from './types'

/** 추세선을 그리기 시작하는 최소 점 수. 2점을 이은 선은 추세가 아니라 장식이다. */
export const TREND_MIN_POINTS = 4

/** Supabase numeric 은 문자열로 온다. 숫자가 아니면 NaN 대신 null 을 돌려 호출부가 분기하게 한다. */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** dims 에서 문자열 하나를 안전하게 꺼낸다. */
export function dimString(dims: Record<string, unknown> | null, key: string): string | null {
  const v = dims?.[key]
  return typeof v === 'string' && v !== '' ? v : null
}

/** dims 에서 숫자 하나를 안전하게 꺼낸다. */
export function dimNumber(dims: Record<string, unknown> | null, key: string): number | null {
  return toNumber(dims?.[key])
}

/**
 * 행 → 지표별 시계열.
 *
 * `table_size_mb` 처럼 한 스냅샷에 여러 행이 오는 지표는 `dims.table` 로 계열을 가른다.
 * 가르지 않으면 25개 테이블이 한 선에 섞여 아무 뜻도 없는 톱니가 된다.
 */
export function toSeries(rows: HealthMetricRow[]): MetricSeries[] {
  const map = new Map<string, MetricSeries>()
  // 입력은 measured_at DESC — 시계열은 오름차순이어야 하므로 뒤집는다.
  for (const row of [...rows].reverse()) {
    const value = toNumber(row.value)
    if (value === null) continue
    const subject = dimString(row.dims, 'table')
    const key = subject ? `${row.metric}@${subject}` : row.metric
    let series = map.get(key)
    if (!series) {
      series = { key, axis: row.axis, metric: row.metric, subject, points: [] }
      map.set(key, series)
    }
    series.points.push({ at: row.measured_at, value, dims: row.dims })
  }
  return [...map.values()]
}

/** 이 축에서 화면 상단에 세울 계열 — 대상이 여럿인 지표(table_size_mb)는 따로 다룬다. */
export function headlineSeries(series: MetricSeries[], axis: HealthAxis): MetricSeries[] {
  return series
    .filter((s) => s.axis === axis && s.subject === null)
    .sort((a, b) => a.metric.localeCompare(b.metric))
}

/** 마지막 점과 직전 점의 차이. 점이 하나뿐이면 null(변동 없음이 아니라 **모른다**). */
export function delta(series: MetricSeries): number | null {
  if (series.points.length < 2) return null
  const last = series.points[series.points.length - 1].value
  const prev = series.points[series.points.length - 2].value
  return last - prev
}

/** 서로 다른 수집 시각의 수. 축마다 주기가 달라 축별로 센다(일 1회 5축 · 주 1회 integrity). */
export function snapshotCount(rows: HealthMetricRow[], axis?: HealthAxis): number {
  const scoped = axis ? rows.filter((r) => r.axis === axis) : rows
  return new Set(scoped.map((r) => r.measured_at)).size
}

/** 가장 최근 수집 시각. 없으면 null. */
export function latestAt(rows: HealthMetricRow[], axis?: HealthAxis): string | null {
  const scoped = axis ? rows.filter((r) => r.axis === axis) : rows
  let max: string | null = null
  for (const r of scoped) if (max === null || r.measured_at > max) max = r.measured_at
  return max
}

/**
 * 수집이 멈췄는가.
 *
 * **화면이 스스로 판정하는 유일한 항목이다.** 수집이 멈추면 나머지 숫자가 전부 과거의 것인데,
 * 화면은 그것을 최신처럼 그린다 — 이 한 가지는 화면이 말하지 않으면 아무도 모른다.
 * (판정층은 DB 밖에 있어서, 판정층 자신이 안 돌면 이것도 못 적는다.)
 */
export function isCollectionStale(
  latestIso: string | null,
  now: Date,
  maxAgeHours: number,
): boolean {
  if (!latestIso) return true
  const ageMs = now.getTime() - new Date(latestIso).getTime()
  if (!Number.isFinite(ageMs)) return true
  return ageMs > maxAgeHours * 3600_000
}

/** 마지막 수집 이후 경과 시간(시간 단위). 기록이 없으면 null. */
export function hoursSince(latestIso: string | null, now: Date): number | null {
  if (!latestIso) return null
  const ms = now.getTime() - new Date(latestIso).getTime()
  return Number.isFinite(ms) ? ms / 3600_000 : null
}

/**
 * 테이블 용량 상위 + 창 안 증가분.
 *
 * 이 저장소는 30일에 마이그레이션 184건이고 콘텐츠 파이프라인이 매일 적재한다 —
 * "DB 가 커졌다" 로는 아무 조치도 못 하지만 "어느 표가 얼마나" 는 조치로 이어진다.
 */
export function tableGrowth(series: MetricSeries[], limit: number): TableGrowth[] {
  return series
    .filter((s) => s.metric === 'table_size_mb' && s.subject !== null)
    .map((s) => {
      const last = s.points[s.points.length - 1]
      const values = s.points.map((p) => p.value)
      return {
        table: s.subject as string,
        latestMb: last.value,
        deltaMb: values.length >= 2 ? last.value - Math.min(...values) : null,
        indexMb: dimNumber(last.dims, 'index_mb'),
        rowsEst: dimNumber(last.dims, 'rows_est'),
      }
    })
    .sort((a, b) => b.latestMb - a.latestMb)
    .slice(0, limit)
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { critical: 0, warning: 1, info: 2 }

/**
 * 발견 정렬 — 심각도 먼저, 같으면 **오래 방치된 것 먼저**.
 * 최신순으로 두면 오래된 미해결이 아래로 밀려 영영 안 보인다(이 화면이 막으려는 실패 모드다).
 */
export function sortFindings(findings: FindingRow[]): FindingRow[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (s !== 0) return s
    return a.first_seen_at.localeCompare(b.first_seen_at)
  })
}

/** 심각도별 건수 — 0 인 등급도 자리를 지킨다(사라지면 "없다" 와 "안 쟀다" 가 구분되지 않는다). */
export function countBySeverity(findings: FindingRow[]): Record<FindingSeverity, number> {
  const out: Record<FindingSeverity, number> = { critical: 0, warning: 0, info: 0 }
  for (const f of findings) out[f.severity] += 1
  return out
}

/** 축별 열린 발견 수 — 축 카드에 배지로 얹는다. */
export function openByAxis(findings: FindingRow[]): Record<HealthAxis, number> {
  const out = Object.fromEntries(HEALTH_AXES.map((a) => [a, 0])) as Record<HealthAxis, number>
  for (const f of findings) if (f.axis in out) out[f.axis] += 1
  return out
}

/** 값 표시 — 단위를 붙이고, 큰 수는 천 단위로 끊는다. */
export function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100
  const text = rounded.toLocaleString('ko-KR')
  if (!unit) return text
  return unit === '%' ? `${text}%` : `${text} ${unit}`
}

/** 경과 시간을 사람 말로. 판정하지 않는다 — 길다/짧다를 말하지 않고 길이만 말한다. */
export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}분 전`
  if (hours < 48) return `${Math.round(hours)}시간 전`
  return `${Math.round(hours / 24)}일 전`
}

// ── 체크포인트 · 이상 감지 ────────────────────────────────────────────────

/**
 * 체크포인트 행을 라벨별 앞뒤 짝으로 접는다.
 *
 * `after` 가 없는 라벨은 **끝나지 않은 작업**이다 — 화면이 그것을 구별해야 한다.
 * 열린 채로 두면 다음 사람이 그 `before` 를 믿고 비교하는데, 그 사이 다른 세션의 변경이
 * 섞여 있으면 diff 는 인과가 아니라 그냥 시간차다.
 */
export function pairCheckpoints(rows: CheckpointRow[]): CheckpointPair[] {
  const map = new Map<string, CheckpointPair>()
  for (const r of rows) {
    let pair = map.get(r.label)
    if (!pair) {
      pair = { label: r.label, before: null, after: null, touchedAt: r.created_at }
      map.set(r.label, pair)
    }
    if (r.phase === 'before') pair.before = r
    else pair.after = r
    if (r.created_at > pair.touchedAt) pair.touchedAt = r.created_at
  }
  // 끝나지 않은 것 먼저(그게 조치 대상이다), 그다음 최근 순.
  return [...map.values()].sort((a, b) => {
    const openA = a.after === null ? 0 : 1
    const openB = b.after === null ? 0 : 1
    if (openA !== openB) return openA - openB
    return b.touchedAt.localeCompare(a.touchedAt)
  })
}

/**
 * 이상 감지를 그릴 수 있는가 — 못 그리면 **왜 못 그리는지**를 화면이 말해야 한다.
 *
 * 빈 상자를 그리면 "이상 없음" 으로 읽힌다. 표본이 모자라서 못 잰 것과 재 봤더니 없는 것은
 * 완전히 다른 말이고, 그 둘을 같은 화면으로 그리면 감시가 있다고 착각하게 된다.
 */
export function anomalyReadiness(
  snapshots: number,
  minSamples: number,
): { ready: boolean; need: number } {
  return { ready: snapshots >= minSamples, need: Math.max(0, minSamples - snapshots) }
}

// ── 라이브 신호 판정 ──────────────────────────────────────────────────────
//
// ⚠️ 이 파일 맨 위의 "화면은 판정하지 않는다" 에 대한 **명시적 예외**다.
//    스냅샷 지표는 뒤에 판정층(/db-health-audit)이 있지만 **라이브 신호에는 없다** —
//    판정층은 하루 한 번 DB 밖에서 돌고, 장애는 그 사이에 시작해 그 사이에 끝난다.
//    그래서 라이브만은 화면이 선을 긋는다. 대신 선은 `LIVE_THRESHOLDS` 한 곳에만 있고
//    전부 이 DB 의 실측 설정에 걸려 있다(임계값을 두 곳에 두면 두 곳이 갈린다).

/** 신호 하나를 임계값에 대고 판정한다. 임계값이 없는 신호와 값이 없는 신호 모두 `unknown`. */
export function signalLevel(key: string, value: number | null): SignalLevel {
  const t = LIVE_THRESHOLDS[key]
  if (!t || value === null || Number.isNaN(value)) return 'unknown'
  if (t.dir === 'high') {
    if (value >= t.crit) return 'crit'
    if (value >= t.warn) return 'warn'
    return 'ok'
  }
  if (value <= t.crit) return 'crit'
  if (value <= t.warn) return 'warn'
  return 'ok'
}

/**
 * 화면 맨 위 한 줄의 판정. **가장 나쁜 것 하나가 전체를 정한다** — 평균을 내면
 * 치명 하나가 정상 아홉에 묻히고, 그 순간 이 화면은 장애를 못 알리는 화면이 된다.
 *
 * 라이브를 못 읽은 것(`live === null`)은 정상이 아니라 `unknown` 이다. 스냅샷이 낡은 것도
 * 마찬가지 — 낡은 숫자로 "정상" 이라고 말하는 화면이 가장 위험하다.
 */
export function overallStatus(input: {
  live: LiveSnapshot | null
  liveError: string | null
  criticalCount: number
  warningCount: number
  stale: boolean
}): { level: SignalLevel; headline: string; reason: string } {
  const worstLive: SignalLevel[] = []
  if (input.live) {
    worstLive.push(signalLevel('conn_used_pct', input.live.conn.used_pct))
    worstLive.push(signalLevel('cache_hit_pct', input.live.cache_hit_pct))
    worstLive.push(signalLevel('longest_query_s', input.live.longest_query_s))
    worstLive.push(signalLevel('oldest_idle_in_tx_s', input.live.oldest_idle_in_tx_s))
    worstLive.push(signalLevel('blocked_locks', input.live.blocked_locks))
    worstLive.push(signalLevel('cron_fail_24h', input.live.cron_fail_24h))
  }
  const liveCrit = worstLive.filter((l) => l === 'crit').length
  const liveWarn = worstLive.filter((l) => l === 'warn').length

  if (input.liveError) {
    return {
      level: 'unknown',
      headline: '지금 상태를 읽지 못함',
      reason: '라이브 조회 실패 — 아래 값은 마지막으로 읽은 것이다',
    }
  }
  if (liveCrit > 0 || input.criticalCount > 0) {
    return {
      level: 'crit',
      headline: '장애',
      reason: `라이브 임계 초과 ${liveCrit} · 치명 발견 ${input.criticalCount}`,
    }
  }
  if (input.stale) {
    return {
      level: 'unknown',
      headline: '수집 멈춤',
      reason: '스냅샷이 낡았다 — 아래 추세는 지금이 아니다',
    }
  }
  if (liveWarn > 0 || input.warningCount > 0) {
    return {
      level: 'warn',
      headline: '주의',
      reason: `라이브 경계 ${liveWarn} · 주의 발견 ${input.warningCount}`,
    }
  }
  if (!input.live) {
    return { level: 'unknown', headline: '지금 상태 없음', reason: '라이브를 아직 읽지 않았다' }
  }
  return { level: 'ok', headline: '정상', reason: '임계를 넘은 신호 없음' }
}

/**
 * 발견 하나에 붙일 수 있는 **실행 가능한** 조치를 고른다.
 *
 * 추측하지 않는다 — 증거(`evidence`)에 대상이 적혀 있을 때만 붙인다. 대상 없는 조치 버튼은
 * 눌러도 `그런 표가 없다` 로 되돌아오고, 되돌아오는 버튼은 다음부터 아무도 안 누른다.
 *
 * 여기 없는 조치(VACUUM FULL · DROP INDEX)는 일부러 없다. 그것들은 `suggested_sql` 로만 간다.
 */
export function suggestActions(finding: FindingRow): { action: ActionKey; target: string | null }[] {
  const ev = finding.evidence ?? {}
  const out: { action: ActionKey; target: string | null }[] = []

  const table = typeof ev.table === 'string' ? ev.table : null
  const job = typeof ev.job === 'string' ? ev.job : typeof ev.jobname === 'string' ? ev.jobname : null

  if (table) out.push({ action: 'analyze_table', target: table })
  if (finding.fingerprint.includes('stats_stale') || finding.title.includes('통계')) {
    out.push({ action: 'analyze_stale_tables', target: null })
  }
  if (job) out.push({ action: 'cron_disable_job', target: job })
  // ⚠️ 축(connections)만 보고 붙이면 안 된다 — 실측(픽스처 16건)에서 연결 축 발견 전부에
  //    idle-in-tx 일괄 종료가 달려 한 줄에 버튼이 넷씩 생겼다. 버튼이 넷이면 아무도 안 읽는다.
  //    「idle」이 지문이나 제목에 실제로 있을 때만 붙인다.
  if (finding.fingerprint.includes('idle') || finding.title.toLowerCase().includes('idle')) {
    out.push({ action: 'terminate_idle_in_tx', target: null })
  }
  // 같은 조치가 두 조건에 걸릴 수 있다 — 버튼이 둘이면 관리자는 둘이 다른 줄 안다.
  return out.filter(
    (a, i) => out.findIndex((b) => b.action === a.action && b.target === a.target) === i,
  )
}

/** 초를 사람 말로. 판정하지 않는다 — 길이만 말한다. */
export function formatSeconds(s: number | null): string {
  if (s === null || Number.isNaN(s)) return '—'
  if (s < 1) return '0초'
  if (s < 60) return `${Math.round(s)}초`
  if (s < 3600) return `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`
  return `${Math.floor(s / 3600)}시간 ${Math.round((s % 3600) / 60)}분`
}

/**
 * 게이지 채움 비율(0~1). 임계값이 있는 신호만 채운다.
 * `dir: 'low'` 는 낮을수록 나쁘므로 값 자체를 그대로 쓰되 100 기준으로 정규화한다.
 */
export function gaugeFill(key: string, value: number | null): number | null {
  const t = LIVE_THRESHOLDS[key]
  if (!t || value === null || Number.isNaN(value)) return null
  if (t.dir === 'low') return Math.max(0, Math.min(1, value / 100))
  // 치명선을 가득 참으로 본다 — 그 위는 넘쳐도 1 이다(막대가 밖으로 나가지 않게).
  return Math.max(0, Math.min(1, value / (t.crit || 1)))
}
