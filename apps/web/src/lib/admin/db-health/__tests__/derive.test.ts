// apps/web/src/lib/admin/db-health/__tests__/derive.test.ts
//
// DB 헬스 화면의 순수 계산 회귀.
//
// 여기서 잠그는 것은 "숫자를 잘 그리는가" 가 아니라 **모르는 것을 0 으로 말하지 않는가** 다.
// 이 화면의 실패 모드는 틀린 값을 보여 주는 것보다 **없는 값을 괜찮은 값으로 보여 주는 것**이다
// (관리자 대시보드에서 `count ?? 0` 으로 이미 한 번 겪었다 — 없는 표도 head 요청엔 204 를 준다).

import { describe, expect, it } from 'vitest'

import {
  TREND_MIN_POINTS,
  countBySeverity,
  delta,
  formatAge,
  formatValue,
  headlineSeries,
  hoursSince,
  isCollectionStale,
  latestAt,
  openByAxis,
  snapshotCount,
  sortFindings,
  tableGrowth,
  toNumber,
  toSeries,
} from '../derive'
import type { FindingRow, HealthMetricRow } from '../types'

/** collect_db_health_metrics 실측 스키마 기반 — value 는 numeric 이라 **문자열**로 온다. */
const T1 = '2026-09-04T18:40:00+00:00'
const T2 = '2026-09-05T18:40:00+00:00'
const T3 = '2026-09-06T18:40:00+00:00'

function row(
  measured_at: string,
  axis: HealthMetricRow['axis'],
  metric: string,
  value: number | string,
  dims: Record<string, unknown> | null = null,
): HealthMetricRow {
  return { measured_at, axis, metric, value, dims }
}

// 쿼리는 measured_at DESC 로 준다 — 픽스처도 그 순서를 지킨다.
const ROWS: HealthMetricRow[] = [
  row(T3, 'capacity', 'db_size_mb', '6255.2', { heap_mb: 3684.1, index_mb: 1622 }),
  row(T3, 'capacity', 'table_size_mb', '1974.0', { table: 'library_article_vocabularies', index_mb: 531, rows_est: 11343728 }),
  row(T3, 'capacity', 'table_size_mb', '1120.0', { table: 'library_book_vocabularies', index_mb: 556, rows_est: 1680356 }),
  row(T3, 'cron', 'cron_fail_24h', '25', { runs: 2909, by_job: { 'library-pipeline-worker': { fails: 20 } } }),
  row(T2, 'capacity', 'db_size_mb', '6240.0', { heap_mb: 3670 }),
  row(T2, 'capacity', 'table_size_mb', '1960.0', { table: 'library_article_vocabularies', index_mb: 528, rows_est: 11000000 }),
  row(T1, 'capacity', 'db_size_mb', '6100.0', null),
  row(T1, 'integrity', 'function_errors', '4', { checked: 128, suppressed: 21 }),
]

describe('toNumber — numeric 은 문자열로 온다', () => {
  it('숫자 문자열을 숫자로 바꾼다', () => {
    expect(toNumber('6255.2')).toBe(6255.2)
    expect(toNumber(12)).toBe(12)
  })

  it('숫자가 아니면 0 이 아니라 null 이다', () => {
    // 0 으로 채우면 "값이 없다" 가 "값이 0 이다" 로 둔갑한다 — 이 화면에서 가장 비싼 거짓말이다.
    expect(toNumber('')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(Number.NaN)).toBeNull()
  })
})

describe('toSeries', () => {
  it('대상이 여럿인 지표는 dims.table 로 계열을 가른다', () => {
    const series = toSeries(ROWS)
    const tables = series.filter((s) => s.metric === 'table_size_mb')
    expect(tables).toHaveLength(2)
    expect(tables.map((s) => s.subject).sort()).toEqual([
      'library_article_vocabularies',
      'library_book_vocabularies',
    ])
  })

  it('입력이 DESC 여도 시계열은 오름차순이다', () => {
    const db = toSeries(ROWS).find((s) => s.metric === 'db_size_mb')
    expect(db?.points.map((p) => p.value)).toEqual([6100, 6240, 6255.2])
  })

  it('값을 읽을 수 없는 행은 계열에 넣지 않는다', () => {
    const series = toSeries([...ROWS, row(T3, 'capacity', 'db_size_mb', '', null)])
    const db = series.find((s) => s.metric === 'db_size_mb')
    expect(db?.points).toHaveLength(3)
  })
})

describe('delta — 비교할 것이 없으면 "변동 없음" 이 아니라 모른다', () => {
  it('점이 둘 이상이면 마지막 - 직전', () => {
    const db = toSeries(ROWS).find((s) => s.metric === 'db_size_mb')!
    expect(delta(db)).toBeCloseTo(15.2, 5)
  })

  it('점이 하나면 null', () => {
    const only = toSeries([row(T3, 'cron', 'cron_fail_24h', '25')])[0]
    expect(delta(only)).toBeNull()
  })
})

describe('isCollectionStale — 화면이 스스로 판정하는 유일한 항목', () => {
  const now = new Date('2026-09-06T20:00:00+00:00')

  it('기록이 아예 없으면 멈춘 것으로 본다', () => {
    expect(isCollectionStale(null, now, 26)).toBe(true)
  })

  it('창 안이면 정상', () => {
    expect(isCollectionStale('2026-09-06T18:40:00+00:00', now, 26)).toBe(false)
  })

  it('창을 넘기면 멈춘 것', () => {
    expect(isCollectionStale('2026-09-05T10:00:00+00:00', now, 26)).toBe(true)
  })

  it('날짜를 못 읽으면 멈춘 것으로 본다 (모르면 안전한 쪽)', () => {
    expect(isCollectionStale('언제였더라', now, 26)).toBe(true)
  })
})

describe('sortFindings — 오래 방치된 것이 위로 온다', () => {
  const mk = (
    id: number,
    severity: FindingRow['severity'],
    first_seen_at: string,
    axis: FindingRow['axis'] = 'cron',
  ): FindingRow => ({
    id,
    fingerprint: `f${id}`,
    axis,
    severity,
    title: `t${id}`,
    detail: 'd',
    evidence: null,
    suggested_sql: null,
    status: 'open',
    first_seen_at,
    last_seen_at: first_seen_at,
    occurrences: 1,
  })

  it('심각도 먼저, 같으면 처음 본 순', () => {
    const out = sortFindings([
      mk(1, 'info', '2026-09-01T00:00:00Z'),
      mk(2, 'critical', '2026-09-05T00:00:00Z'),
      mk(3, 'critical', '2026-09-02T00:00:00Z'),
      mk(4, 'warning', '2026-09-03T00:00:00Z'),
    ])
    // 최신순이면 3 이 2 뒤로 밀린다 — 오래된 미해결이 아래로 가면 영영 안 보인다.
    expect(out.map((f) => f.id)).toEqual([3, 2, 4, 1])
  })

  it('등급별 건수는 0 인 등급도 자리를 지킨다', () => {
    expect(countBySeverity([mk(1, 'critical', '2026-09-01T00:00:00Z')])).toEqual({
      critical: 1,
      warning: 0,
      info: 0,
    })
  })

  it('축별 열린 건수는 6축 전부를 돌려준다', () => {
    const byAxis = openByAxis([mk(1, 'critical', '2026-09-01T00:00:00Z', 'integrity')])
    expect(Object.keys(byAxis)).toHaveLength(6)
    expect(byAxis.integrity).toBe(1)
    expect(byAxis.capacity).toBe(0)
  })
})

describe('tableGrowth — 용량 관리의 실제 질문에 답한다', () => {
  it('큰 표 순으로 주고, 창 안 최솟값 대비 증가를 낸다', () => {
    const g = tableGrowth(toSeries(ROWS), 10)
    expect(g[0].table).toBe('library_article_vocabularies')
    expect(g[0].latestMb).toBe(1974)
    expect(g[0].deltaMb).toBe(14) // 1974 - 1960
    expect(g[0].indexMb).toBe(531)
    expect(g[0].rowsEst).toBe(11343728)
  })

  it('점이 하나뿐이면 증가분은 0 이 아니라 null 이다', () => {
    const g = tableGrowth(toSeries(ROWS), 10)
    const book = g.find((x) => x.table === 'library_book_vocabularies')!
    expect(book.deltaMb).toBeNull()
  })
})

describe('스냅샷 집계', () => {
  it('축을 주면 그 축의 수집 횟수만 센다 (주기가 축마다 다르다)', () => {
    expect(snapshotCount(ROWS)).toBe(3)
    expect(snapshotCount(ROWS, 'integrity')).toBe(1)
    expect(snapshotCount(ROWS, 'connections')).toBe(0)
  })

  it('가장 최근 수집 시각', () => {
    expect(latestAt(ROWS)).toBe(T3)
    expect(latestAt(ROWS, 'integrity')).toBe(T1)
    expect(latestAt(ROWS, 'connections')).toBeNull()
  })

  it('축 머리 지표에는 대상이 여럿인 지표를 섞지 않는다', () => {
    const head = headlineSeries(toSeries(ROWS), 'capacity')
    expect(head.map((s) => s.metric)).toEqual(['db_size_mb'])
  })
})

describe('표시 포맷', () => {
  it('단위를 붙이고 천 단위를 끊는다', () => {
    expect(formatValue(6255.2, 'MB')).toBe('6,255.2 MB')
    expect(formatValue(28.3, '%')).toBe('28.3%')
    expect(formatValue(110)).toBe('110')
  })

  it('경과 시간은 길이만 말하고 길다/짧다를 말하지 않는다', () => {
    expect(formatAge(0.5)).toBe('30분 전')
    expect(formatAge(30)).toBe('30시간 전')
    expect(formatAge(72)).toBe('3일 전')
  })

  it('hoursSince 는 기록이 없으면 null', () => {
    expect(hoursSince(null, new Date())).toBeNull()
  })
})

describe('추세 최소 점 수', () => {
  it('2점을 이은 선은 추세가 아니다 — 최소 4점', () => {
    expect(TREND_MIN_POINTS).toBeGreaterThanOrEqual(3)
  })
})
