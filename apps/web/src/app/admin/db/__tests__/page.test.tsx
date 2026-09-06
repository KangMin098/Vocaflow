// apps/web/src/app/admin/db/__tests__/page.test.tsx
//
// /admin/db 렌더 계약.
//
// 이 화면의 계약 중 **가장 비싼 것**은 "조치 SQL 을 보여 주되 실행하지 않는다" 이다.
// 실행 버튼이 하나라도 생기면 관리자가 VACUUM FULL 을 눌러 표를 통째로 잠글 수 있고,
// 그건 타입 에러도 런타임 에러도 아니라 아무도 못 잡는다. 그래서 테스트가 잠근다.
//
// 런타임은 admin RLS 세션이 필요해 dev-bypass 브라우징으론 빈 상태만 확인 가능하므로
// 데이터 분기는 픽스처로 renderToString 검증한다(/admin/quality 와 같은 방식).

import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DbHealthData } from '@/lib/admin/db-health/queries'
import type { FindingRow, HealthMetricRow } from '@/lib/admin/db-health/types'

// 클라이언트 컴포넌트의 useRouter 는 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}))

const fetchMock = vi.fn<[], Promise<DbHealthData>>()

vi.mock('@/lib/admin/db-health/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/db-health/queries')>(
    '@/lib/admin/db-health/queries',
  )
  return { ...actual, fetchDbHealth: () => fetchMock() }
})

import AdminDbPage from '../page'

const NOW = new Date()
const iso = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString()

function metric(
  hoursAgo: number,
  axis: HealthMetricRow['axis'],
  metric: string,
  value: string,
  dims: Record<string, unknown> | null = null,
): HealthMetricRow {
  return { measured_at: iso(hoursAgo), axis, metric, value, dims }
}

function finding(over: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 1,
    fingerprint: 'integrity:function:analyze_book_vrl',
    axis: 'integrity',
    severity: 'critical',
    title: 'analyze_book_vrl 은 호출하면 반드시 죽는다',
    detail: '실제 컬럼은 library_book_id 다.',
    evidence: { sqlstate: '42703', lines: [12, 19, 28] },
    suggested_sql: "select pg_get_functiondef('public.analyze_book_vrl(uuid)'::regprocedure);",
    status: 'open',
    first_seen_at: iso(50),
    last_seen_at: iso(2),
    occurrences: 3,
    ...over,
  }
}

const FRESH_METRICS: HealthMetricRow[] = [
  metric(2, 'capacity', 'db_size_mb', '6255.2', { heap_mb: 3684.1, index_mb: 1622 }),
  metric(2, 'capacity', 'table_size_mb', '1974.0', {
    table: 'library_article_vocabularies',
    index_mb: 531,
    rows_est: 11343728,
  }),
  metric(2, 'cron', 'cron_fail_24h', '25', { runs: 2909 }),
  // 이번 수집에 처음 들어온 표 — 점이 하나뿐이라 증가분을 '모른다'
  metric(2, 'capacity', 'table_size_mb', '899.0', {
    table: 'csat_dcp_items',
    index_mb: 127,
    rows_est: 655424,
  }),
  metric(26, 'capacity', 'db_size_mb', '6240.0', null),
  metric(26, 'capacity', 'table_size_mb', '1960.0', {
    table: 'library_article_vocabularies',
    index_mb: 528,
    rows_est: 11000000,
  }),
]

function data(over: Partial<DbHealthData> = {}): DbHealthData {
  return {
    metrics: FRESH_METRICS,
    findings: [finding()],
    excepted: [],
    metricsError: null,
    findingsError: null,
    recentlyResolved: 2,
    anomalies: [],
    checkpoints: [],
    anomaliesError: null,
    checkpointsError: null,
    ...over,
  }
}

async function render(over: Partial<DbHealthData> = {}): Promise<string> {
  fetchMock.mockResolvedValue(data(over))
  return renderToString(await AdminDbPage())
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('조치 SQL — 보여 주되 실행하지 않는다', () => {
  it('SQL 본문이 화면에 있다', async () => {
    const html = await render()
    expect(html).toContain('pg_get_functiondef')
    expect(html).toContain('SQL 복사')
  })

  it('실행을 뜻하는 버튼이 하나도 없다', async () => {
    const html = await render({
      findings: [
        finding({ suggested_sql: 'vacuum (full, analyze) public.shared_dictionary;' }),
      ],
    })
    // 되돌릴 수 없는 조작을 화면이 대신 눌러 주는 경로는 만들지 않는다.
    for (const forbidden of ['SQL 실행', '지금 실행', '적용하기', '바로 적용']) {
      expect(html).not.toContain(forbidden)
    }
    expect(html).toContain('이 화면은 실행하지 않는다')
  })
})

describe('발견 목록', () => {
  it('심각도를 색이 아니라 글자로도 말한다', async () => {
    const html = await render({
      findings: [
        finding({ id: 1, severity: 'critical' }),
        finding({ id: 2, severity: 'warning', fingerprint: 'b', suggested_sql: null }),
        finding({ id: 3, severity: 'info', fingerprint: 'c', suggested_sql: null }),
      ],
    })
    expect(html).toContain('치명')
    expect(html).toContain('주의')
    expect(html).toContain('참고')
  })

  it('축 라벨과 관측 횟수를 함께 보여 준다', async () => {
    const html = await render()
    expect(html).toContain('스키마 무결성')
    expect(html).toContain('관측')
  })

  it('발견이 없고 수집도 없으면 "지금 수집" 으로 이끈다', async () => {
    const html = await render({ findings: [], metrics: [] })
    expect(html).toContain('지금 수집')
    expect(html).toContain('먼저 누르세요')
  })

  it('발견이 없지만 수집은 있으면 판정을 돌리라고 말한다', async () => {
    const html = await render({ findings: [] })
    expect(html).toContain('/db-health-audit')
  })
})

describe('수집이 멈췄는가 — 화면이 스스로 판정하는 유일한 항목', () => {
  it('최근 수집이면 경고 띠가 없다', async () => {
    const html = await render()
    expect(html).not.toContain('수집 기록이 없어요')
    expect(html).not.toContain('넘게 없었어요')
  })

  it('창을 넘기면 아래 숫자가 과거의 것이라고 말한다', async () => {
    const html = await render({
      metrics: [metric(40, 'capacity', 'db_size_mb', '6255.2', null)],
    })
    expect(html).toContain('넘게 없었어요')
    expect(html).toContain('지금이 아니다')
  })

  it('수집이 아예 없으면 그렇다고 말한다', async () => {
    const html = await render({ metrics: [], findings: [] })
    expect(html).toContain('수집 기록이 없어요')
  })
})

describe('모르는 값을 0 으로 말하지 않는다', () => {
  it('조회가 실패하면 "—" 의 뜻을 밝힌다', async () => {
    const html = await render({
      metricsError: 'permission denied for table db_health_metrics',
      metrics: [],
      findings: [],
    })
    expect(html).toContain('조회가 실패했어요')
    expect(html).toContain('모른다')
  })

  it('점이 하나뿐인 계열은 "비교할 직전 값 없음"', async () => {
    const html = await render({
      metrics: [metric(2, 'cron', 'cron_fail_24h', '25', { runs: 2909 })],
      findings: [],
    })
    expect(html).toContain('비교할 직전 값 없음')
  })

  it('점이 하나뿐인 테이블은 증가분이 "비교 없음"', async () => {
    const html = await render()
    expect(html).toContain('비교 없음')
  })
})

describe('추세는 그릴 것이 있을 때만 그린다', () => {
  it('4회 미만이면 선 대신 몇 회 남았는지 말한다', async () => {
    const html = await render()
    expect(html).toContain('추세는 4회부터')
    expect(html).not.toContain('<polyline')
  })

  it('4회 이상이면 선을 그린다', async () => {
    const html = await render({
      metrics: [2, 26, 50, 74].map((h, i) =>
        metric(h, 'capacity', 'db_size_mb', String(6255 - i * 10), null),
      ),
      findings: [],
    })
    expect(html).toContain('<polyline')
  })
})

describe('용량 상위 테이블', () => {
  it('표와 창 안 증가분을 보여 준다', async () => {
    const html = await render()
    expect(html).toContain('library_article_vocabularies')
    expect(html).toContain('용량 상위 테이블')
    expect(html).toContain('+14 MB')
  })

  it('스냅샷이 없으면 다음 한 걸음을 준다', async () => {
    const html = await render({ metrics: [], findings: [] })
    expect(html).toContain('상위 25개가 기록됩니다')
  })
})

describe('두 수집 버튼은 비용이 다르므로 따로 있다', () => {
  it('저비용과 정밀이 각각 있고 소요를 밝힌다', async () => {
    const html = await render()
    expect(html).toContain('지금 수집')
    expect(html).toContain('정밀 점검')
    expect(html).toContain('5축 · 몇 초')
    expect(html).toContain('함수 128개 정적 분석')
  })
})

describe('면제 — 숨기지 않고 접어 둔다', () => {
  const excepted = finding({
    id: 99,
    fingerprint: 'advisor:security_definer_view:csat_items_public',
    axis: 'advisor',
    severity: 'critical',
    title: 'csat_items_public 뷰가 SECURITY DEFINER',
    status: 'excepted',
    suggested_sql: null,
    note: '의도된 저작권 경계다 (supabase/migrations/20260903121759 · 20260904084631)',
  })

  it('면제 항목은 열린 발견 수에 들어가지 않는다', async () => {
    const html = await render({ findings: [finding()], excepted: [excepted] })
    // KPI '치명' 은 열린 것만 센다 — 면제가 섞이면 고칠 것이 없는데 빨간 숫자가 남는다.
    expect(html).toContain('면제 1건')
  })

  it('왜 안 뜨는지(사유·근거)를 함께 보여 준다', async () => {
    const html = await render({ excepted: [excepted] })
    expect(html).toContain('의도된 저작권 경계다')
    expect(html).toContain('20260903121759')
    expect(html).toContain('은폐다')
  })

  it('면제 항목에는 상태 변경 버튼을 주지 않는다', async () => {
    // 눌러도 다음 판정이 다시 excepted 로 되돌린다 — 눌리는 버튼은 거짓말이다.
    const only = await render({ findings: [], excepted: [excepted] })
    expect(only).not.toContain('해결했음')
  })

  it('면제가 없으면 그 자리 자체가 없다', async () => {
    const html = await render()
    expect(html).not.toContain('이미 결정된 것')
  })
})

describe('이상 징후 — 못 잰 것과 없는 것을 구별한다', () => {
  /** 5축 수집 N회를 만든다 — 이상 감지는 스냅샷 수에 걸린다. */
  const snapshots = (n: number): HealthMetricRow[] =>
    Array.from({ length: n }, (_, i) => metric(2 + i * 24, 'capacity', 'db_size_mb', String(6255 - i)))

  it('표본이 모자라면 빈 상자가 아니라 **몇 회부터인지**를 말한다', async () => {
    // 빈 상자를 그리면 "이상 없음" 으로 읽힌다. 못 잰 것과 없는 것은 완전히 다른 말이다.
    const html = await render({ metrics: snapshots(3), findings: [], anomalies: [] })
    expect(html).toContain('아직 재지 않습니다')
    expect(html).toContain('5회부터')
    expect(html).not.toContain('벗어난 지표는 없어요')
  })

  it('표본이 충분한데 비어 있으면 "없다" 고 말한다', async () => {
    const html = await render({ metrics: snapshots(6), findings: [], anomalies: [] })
    expect(html).toContain('벗어난 지표는 없어요')
    expect(html).not.toContain('아직 재지 않습니다')
  })

  it('편차를 못 잰 행은 숫자를 지어내지 않는다', async () => {
    const html = await render({
      metrics: snapshots(6),
      findings: [],
      anomalies: [
        {
          axis: 'capacity',
          metric: 'db_size_mb',
          subject: null,
          latest: '6900.0',
          prev: '6255.0',
          median_value: '6255.0',
          mad: '0.000',
          robust_z: null, // MAD = 0 — 함수가 숫자를 주지 않는다
          pct_change: '10.31',
          samples: 6,
          latest_at: iso(2),
        },
      ],
    })
    expect(html).toContain('재지 못함')
    expect(html).toContain('DB 총 용량')
  })

  it('조회가 실패하면 그렇다고 말한다', async () => {
    const html = await render({
      findings: [],
      anomaliesError: 'permission denied for function db_health_anomalies',
    })
    expect(html).toContain('이상 징후를 읽지 못했어요')
  })
})

describe('위험 작업 체크포인트', () => {
  const cp = (label: string, phase: 'before' | 'after', hoursAgo: number) => ({
    label,
    phase,
    measured_at: iso(hoursAgo),
    note: `${phase} 메모`,
    created_at: iso(hoursAgo),
  })

  it('끝나지 않은 작업이 맨 위로 온다', async () => {
    const html = await render({
      findings: [],
      checkpoints: [
        cp('done-label', 'before', 10),
        cp('done-label', 'after', 9),
        cp('open-label', 'before', 30), // after 가 없다 = 끝나지 않았다
      ],
    })
    expect(html).toContain('끝나지 않음')
    expect(html.indexOf('open-label')).toBeLessThan(html.indexOf('done-label'))
  })

  it('끝난 것과 안 끝난 것을 글자로 구별한다 (색만으로 말하지 않는다)', async () => {
    const html = await render({
      findings: [],
      checkpoints: [cp('done-label', 'before', 10), cp('done-label', 'after', 9)],
    })
    expect(html).toContain('앞뒤 모두')
    expect(html).not.toContain('끝나지 않음')
  })

  it('없으면 다음 한 걸음을 준다', async () => {
    const html = await render({ findings: [] })
    expect(html).toContain('찍어 둔 체크포인트가 없어요')
    expect(html).toContain('/db-checkpoint before')
  })
})
