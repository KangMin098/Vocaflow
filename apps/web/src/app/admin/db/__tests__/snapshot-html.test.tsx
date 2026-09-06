// apps/web/src/app/admin/db/__tests__/snapshot-html.test.tsx
//
// 데이터가 **있는** 상태의 화면을 파일로 떨군다 — 눈으로 볼 수 있게.
//
// 왜 필요한가: 이 화면은 admin RLS 세션이 있어야 데이터가 보인다. 개발 기계에는 그 세션이
// 없어서 브라우저로 열면 늘 빈 화면이고, 그러면 「경보 열여섯 건이 실제로 어떻게 보이는가」를
// 아무도 확인하지 못한 채 설계하게 된다. 픽스처로 그린 HTML 을 떨궈 두면
// scripts/shot-admin-db.mjs 가 앱 CSS 를 입혀 찍는다.
//
// 산출물은 test-results-admin-db/ 아래이고 저장소에 커밋되지 않는다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DbHealthData } from '@/lib/admin/db-health/queries'
import type { FindingRow, HealthMetricRow, LiveSnapshot } from '@/lib/admin/db-health/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

const fetchMock = vi.fn<[], Promise<DbHealthData>>()
vi.mock('@/lib/admin/db-health/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/db-health/queries')>(
    '@/lib/admin/db-health/queries',
  )
  return { ...actual, fetchDbHealth: () => fetchMock() }
})

import AdminDbPage from '../page'

const NOW = new Date()
const iso = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

/** 실 DB 모양(2026-09-06): 5축 5회 수집 · 열린 발견 16 · cron 24h 실패 60. */
const metrics: HealthMetricRow[] = [
  ...[1, 2, 4, 6, 8].map((h, i) => ({
    measured_at: iso(h),
    axis: 'capacity' as const,
    metric: 'db_size_mb',
    value: String(6317 - i * 3),
    dims: { heap_mb: 3684, index_mb: 1622 },
  })),
  ...[1, 2, 4, 6, 8].map((h, i) => ({
    measured_at: iso(h),
    axis: 'connections' as const,
    metric: 'conn_used_pct',
    value: String(28 + i * 2),
    dims: { used: 17, max: 60 },
  })),
  ...[1, 2, 4].map((h, i) => ({
    measured_at: iso(h),
    axis: 'cron' as const,
    metric: 'cron_fail_24h',
    value: String(60 - i * 4),
    dims: { runs: 2909 },
  })),
  ...['library_article_vocabularies', 'shared_words', 'csat_dcp_items', 'shared_dictionary'].flatMap(
    (t, j) =>
      [1, 4].map((h, i) => ({
        measured_at: iso(h),
        axis: 'capacity' as const,
        metric: 'table_size_mb',
        value: String(1974 - j * 400 - i * 9),
        dims: { table: t, index_mb: 531 - j * 90, rows_est: 11343728 - j * 2_000_000 },
      })),
  ),
]

const TITLES = [
  '캐시가 DB 의 4% — shared_buffers 256MB 대 데이터 6,315MB',
  '08:06 UTC 부터 약 55분간 전면 정지 — 쓰기 폭주가 아니라 읽기 포화였다',
  'LCP 워커가 11일째 아무 일도 안 하면서 매번 성공을 보고했다',
  '수집기가 재시작 13분 뒤 "16개 표에 통계 없음"이라 보고했다',
  'search_path 을 고정하지 않은 함수 58개',
  '30초 워커가 6개짜리 background worker 풀을 굶기고 있었다',
  'shared_dictionary 154MB 중 45%가 빈 공간 — 회수 가능',
  '한 번도 스캔되지 않은 인덱스 111개 · 69.6MB',
  '같은 드레인이 크래시 복구 6분 뒤 다시 돌고 있다',
  'DB 가 06:53 에 비정상 종료했다 — 5분 17초 중단 후 자동 복구',
  '9/05 두 시간 연속 단건 PATCH 폭주 — 최대 초당 114건',
  '야간 잡 둘의 예산을 120초 → 300초로 올렸다',
  'recompute-kr-safe 는 12월 31일 15시에만 도는 잡이다',
  '100MB 넘는 표 중 FK 인덱스가 없는 곳은 shared_words 뿐이다',
  'postgres/postgrest/auth 로그가 08:06 UTC 이후 끊겼다',
  'Postgres 가 08:05 UTC 에 조용해졌다 — 약 2시간 전면 정지',
]

const SEV = ['critical', 'warning', 'info'] as const
const AXES = ['capacity', 'cron', 'latency', 'connections', 'advisor', 'integrity'] as const

const findings: FindingRow[] = TITLES.map((title, i) => ({
  id: i + 1,
  fingerprint: `probe:${i}`,
  axis: AXES[i % 6],
  severity: i < 9 ? 'critical' : SEV[(i + 1) % 3],
  title,
  detail:
    '설정 실측: shared_buffers 256MB · effective_cache_size 768MB · work_mem 3.5MB. ' +
    '증거 셋: (1) 활성 질의 두 개가 모두 IO/DataFileRead 대기 중이다. ' +
    '(2) 쓰기가 거의 0인데 statement timeout 이 분당 최대 39건 났다. ' +
    '(3) 재시작 후 캐시가 비어 있어 같은 증상이 재현 중이다.',
  evidence:
    i % 3 === 0
      ? { table: 'public.shared_dictionary', db_size_mb: 6315.4, instance: 't4g.micro' }
      : { job: 'library-pipeline-worker', fails_24h: 60 },
  suggested_sql: i % 2 === 0 ? 'vacuum (full, analyze) public.shared_dictionary;' : null,
  status: i === 3 ? 'ack' : 'open',
  first_seen_at: iso(8 + i * 3),
  last_seen_at: iso(1),
  occurrences: 3 + i,
}))

const live: LiveSnapshot = {
  at: iso(0),
  conn: { max: 60, total: 41, active: 6, idle: 33, idle_in_tx: 2, waiting: 3, used_pct: 68.3 },
  cache_hit_pct: 91.4,
  db_size_mb: 6317.2,
  blocked_locks: 2,
  longest_query_s: 96.4,
  longest_xact_s: 402.1,
  oldest_idle_in_tx_s: 388,
  deadlocks: 0,
  rollbacks: 72,
  cron_fail_24h: 60,
  cron_running: 1,
  sessions: [
    {
      pid: 21874,
      state: 'active',
      wait: 'IO:DataFileRead',
      dur_s: 96.4,
      app: 'PostgREST',
      usename: 'authenticator',
      query:
        'select lemma, meaning_ko from shared_dictionary where lemma = any($1) order by lemma limit 500',
    },
    {
      pid: 21990,
      state: 'active',
      wait: 'Lock:transactionid',
      dur_s: 41.2,
      app: 'pg_cron',
      usename: 'postgres',
      query: 'refresh materialized view concurrently public.textbook_shelf_sources_mv',
    },
    {
      pid: 22011,
      state: 'idle in transaction',
      wait: 'Client:ClientRead',
      dur_s: 388,
      app: 'node',
      usename: 'authenticator',
      query: 'insert into library_article_vocabularies (article_id, lemma) values ($1, $2)',
    },
  ],
  blockers: [
    {
      blocked_pid: 21990,
      blocking_pid: 22011,
      dur_s: 41.2,
      query: 'refresh materialized view concurrently public.textbook_shelf_sources_mv',
    },
  ],
  cron_recent: [
    {
      job: 'library-pipeline-worker',
      status: 'failed',
      at: iso(1),
      dur_s: 11.8,
      msg: 'job startup timeout',
      active: true,
    },
    {
      job: 'refresh-textbook-shelf-stats',
      status: 'failed',
      at: iso(2),
      dur_s: 120,
      msg: 'ERROR: canceling statement due to statement timeout',
      active: true,
    },
    {
      job: 'content-gate-nightly',
      status: 'failed',
      at: iso(5),
      dur_s: 300.2,
      msg: 'ERROR: out of shared memory',
      active: false,
    },
  ],
}

function data(): DbHealthData {
  return {
    metrics,
    findings,
    excepted: [
      {
        ...findings[0],
        id: 99,
        fingerprint: 'advisor:security_definer_view:csat_items_public',
        title: 'csat_items_public 뷰가 SECURITY DEFINER',
        status: 'excepted',
        suggested_sql: null,
        note: '의도된 저작권 경계다 (supabase/migrations/20260903121759)',
      },
    ],
    metricsError: null,
    findingsError: null,
    recentlyResolved: 9,
    anomalies: [
      {
        axis: 'capacity',
        metric: 'db_size_mb',
        subject: null,
        latest: '6900.0',
        prev: '6255.0',
        median_value: '6255.0',
        mad: '3.100',
        robust_z: '4.82',
        pct_change: '10.31',
        samples: 5,
        latest_at: iso(1),
      },
      {
        axis: 'connections',
        metric: 'conn_used_pct',
        subject: null,
        latest: '68.3',
        prev: '30.0',
        median_value: '30.0',
        mad: '0.000',
        robust_z: null,
        pct_change: '127.6',
        samples: 5,
        latest_at: iso(1),
      },
    ],
    checkpoints: [
      {
        label: 'migrate-20260906190000',
        phase: 'before',
        measured_at: iso(3),
        note: '라이브 RPC 추가 전',
        created_at: iso(3),
      },
    ],
    anomaliesError: null,
    checkpointsError: null,
    live,
    liveError: null,
    actionLog: [
      {
        id: 12,
        action: 'analyze_table',
        tier: 'safe',
        target: 'public.shared_dictionary',
        reason: null,
        started_at: iso(0.2),
        finished_at: iso(0.2),
        ok: true,
        result: 'ANALYZE shared_dictionary',
        error: null,
      },
      {
        id: 11,
        action: 'terminate_backend',
        tier: 'guarded',
        target: '21874',
        reason: '잠금 유발 세션 정리',
        started_at: iso(0.5),
        finished_at: iso(0.5),
        ok: false,
        result: null,
        error: '그런 클라이언트 세션이 없다 (pid 21874) — 이미 끝났을 수 있다',
      },
    ],
    actionLogError: null,
  }
}

beforeEach(() => fetchMock.mockReset())

describe('데이터가 있는 상태의 HTML 을 떨군다', () => {
  it('test-results-admin-db/data-state.html', async () => {
    fetchMock.mockResolvedValue(data())
    const html = renderToString(await AdminDbPage())
    mkdirSync('test-results-admin-db', { recursive: true })
    writeFileSync('test-results-admin-db/data-state.html', html, 'utf8')
    expect(html.length).toBeGreaterThan(1000)
  })
})
