// apps/web/src/lib/admin/db-health/derive.ts
//
// DB 헬스 화면의 **순수 계산**. DB 도 React 도 모른다 — 그래서 테스트가 붙는다.
//
// 화면이 하지 않는 일을 여기서도 하지 않는다: **판정하지 않는다.**
// "이 값이 위험한가" 는 /db-health-audit 이 db_health_findings 에 적어 둔 것을 읽어서 보여 줄 뿐,
// 화면이 임계값을 다시 정하지 않는다. 같은 숫자를 두 곳에서 판정하면 두 곳이 갈린다.

import type {
  FindingRow,
  FindingSeverity,
  HealthAxis,
  HealthMetricRow,
  MetricSeries,
  TableGrowth,
} from './types'
import { HEALTH_AXES } from './types'

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
