// apps/web/src/app/admin/db/__tests__/density.test.tsx
//
// 「텍스트 위주가 아니라 모니터링 화면인가」를 숫자로 잠근다.
//
// 판정 기준은 취향이 아니라 **연속 텍스트 덩어리의 길이**다. 라벨·수치·표 헤더·버튼은 30자를
// 넘지 않고, 설명 산문만 넘는다. 산문이 화면 글자의 절반을 넘으면 대시보드가 아니라 문서다.
//
// 픽스처는 **실제 DB 모양**이다(2026-09-06 실측: 열린 발견 16건 · detail 평균 372자).
// 두 건짜리 픽스처로 재면 재설계 전후가 둘 다 좋아 보인다 — 이 화면이 무너진 자리는
// 발견이 열여섯 건 쌓였을 때였다.

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
import OldAdminDbPage from './legacy/page-before-redesign'

const NOW = new Date()
const iso = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

const metrics: HealthMetricRow[] = [
  ...[1, 25, 49, 73, 97].map((h, i) => ({
    measured_at: iso(h),
    axis: 'capacity' as const,
    metric: 'db_size_mb',
    value: String(6300 - i * 12),
    dims: { heap_mb: 3684, index_mb: 1622 },
  })),
  ...[1, 25, 49, 73, 97].map((h, i) => ({
    measured_at: iso(h),
    axis: 'connections' as const,
    metric: 'conn_used_pct',
    value: String(38 + i),
    dims: { used: 23, max: 60 },
  })),
  ...[1, 25].map((h, i) => ({
    measured_at: iso(h),
    axis: 'capacity' as const,
    metric: 'table_size_mb',
    value: String(1974 - i * 14),
    dims: { table: 'library_article_vocabularies', index_mb: 531, rows_est: 11343728 },
  })),
  { measured_at: iso(1), axis: 'cron', metric: 'cron_fail_24h', value: '25', dims: { runs: 2909 } },
  { measured_at: iso(1), axis: 'latency', metric: 'slow_stmt_count', value: '3', dims: null },
]

/** 실측 평균 372자에 맞춘 detail. 짧게 쓰면 재설계가 실제보다 좋아 보인다. */
const DETAIL =
  '설정 실측: shared_buffers 256MB, effective_cache_size 768MB, work_mem 3.5MB, max_connections 60. ' +
  'DB 는 6,315MB 라 캐시 비율 4.1%. 첨부 차트의 DISK IO 100% 는 이 구조의 결과다. 증거 셋: ' +
  '(1) 지금 활성 질의 두 개가 모두 IO/DataFileRead 대기 중이다. (2) 9/05 17:20~18:27 에 쓰기가 ' +
  '거의 0인데 statement timeout 이 분당 최대 39건 났다 — 쓰기 폭주가 없어도 읽기만으로 죽는다는 ' +
  '뜻이다. (3) 재시작 후 캐시가 비어 있어 지금 같은 증상이 재현 중이다. 이건 질의 튜닝으로 ' +
  '마지막 한 자리를 줄이는 문제가 아니라 등급 문제다.'

const SEVERITIES = ['critical', 'warning', 'info'] as const

const findings: FindingRow[] = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  fingerprint: `capacity:probe:${i}`,
  axis: (['capacity', 'cron', 'latency', 'connections', 'advisor', 'integrity'] as const)[i % 6],
  severity: SEVERITIES[i % 3],
  title: `발견 ${i} — 캐시가 DB 의 4% 라 읽기가 전부 디스크로 간다`,
  detail: DETAIL,
  evidence: { db_size_mb: 6315.4, shared_buffers_mb: 256, wal_mb: 1024, instance: 't4g.micro' },
  suggested_sql: i % 2 === 0 ? 'select 1;' : null,
  status: 'open',
  first_seen_at: iso(8 + i),
  last_seen_at: iso(1),
  occurrences: 3 + i,
}))

function live(): LiveSnapshot {
  return {
    at: iso(0),
    conn: { max: 60, total: 17, active: 3, idle: 14, idle_in_tx: 0, waiting: 0, used_pct: 28.3 },
    cache_hit_pct: 91.4,
    db_size_mb: 6317.2,
    blocked_locks: 0,
    longest_query_s: 7.7,
    longest_xact_s: 7.7,
    oldest_idle_in_tx_s: 0,
    deadlocks: 0,
    rollbacks: 72,
    cron_fail_24h: 60,
    cron_running: 0,
    sessions: [
      {
        pid: 4242,
        state: 'active',
        wait: 'IO:DataFileRead',
        dur_s: 91,
        app: 'PostgREST',
        usename: 'authenticator',
        query: 'select * from shared_dictionary where lemma = $1',
      },
    ],
    blockers: [],
    cron_recent: [
      {
        job: 'library-pipeline-worker',
        status: 'failed',
        at: iso(1),
        dur_s: 11.8,
        msg: 'job startup timeout',
        active: true,
      },
    ],
  }
}

function data(): DbHealthData {
  return {
    metrics,
    findings,
    excepted: [],
    metricsError: null,
    findingsError: null,
    recentlyResolved: 9,
    anomalies: [],
    checkpoints: [],
    anomaliesError: null,
    checkpointsError: null,
    live: live(),
    liveError: null,
    actionLog: [],
    actionLogError: null,
  }
}

/** 보이는 텍스트만 뽑는다 - 태그/스크립트/스타일 제거 후 연속 덩어리 목록. */
export function visibleChunks(html: string): string[] {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .split(/<[^>]+>/)
    .map((s) =>
      s
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((s) => s.length > 0)
}

/** 30자를 넘는 덩어리 = 설명 산문. 라벨/수치/헤더/버튼은 그 아래에서 끝난다. */
export const PROSE_MIN = 30

/**
 * 접힌 위 첫 화면(데스크톱 1280×900)이 답해야 하는 다섯 질문.
 * 좌표 실측이 아니라 **문자열 존재**로 잰다 — renderToString 에는 레이아웃이 없다.
 * 좌표는 별도 런타임 훑기가 본다(scripts/audit).
 */
export const FIRST_SCREEN_QUESTIONS = [
  { q: '지금 정상인가', probe: ['정상', '주의', '장애', '수집 멈춤', '지금 상태를 읽지 못함'] },
  { q: '무엇이 문제인가', probe: ['치명 ', '주의 ', '참고 '] },
  { q: '얼마나 급한가', probe: ['라이브 임계 초과', '치명 발견'] },
  { q: '데이터가 신선한가', probe: ['초 전 값', '스냅샷 '] },
  { q: '다음 조치는 무엇인가', probe: ['지금 수집', '새로 읽기'] },
]

/**
 * DB 에서 온 문자열 — 경보 제목·본문·쿼리처럼 **화면이 쓴 것이 아닌** 텍스트.
 *
 * ⚠️ 이 구분이 없으면 규칙이 틀린다. 처음엔 "30자 넘는 덩어리 = 산문" 으로만 쟀는데
 *    남은 것의 대부분이 경보 **제목**이었다(실측 제목 길이 41~75자). 제목은 모니터링
 *    화면의 짐이 아니라 화물이다 — 그걸 줄이라고 요구하면 화면이 정보를 감추게 된다.
 *    재설계가 줄여야 하는 것은 **화면이 스스로 쓴 설명문**이다.
 */
function dataStrings(): string[] {
  return [
    ...findings.flatMap((f) => [f.title, f.detail, f.suggested_sql ?? '']),
    ...live().sessions.map((s) => s.query),
    ...live().cron_recent.map((r) => r.msg),
  ].filter(Boolean)
}

export function proseRatio(html: string) {
  const chunks = visibleChunks(html)
  const total = chunks.reduce((a, c) => a + c.length, 0)
  const fromData = dataStrings()
  const isData = (c: string) => fromData.some((d) => d.includes(c) || c.includes(d))
  const prose = chunks.filter((c) => c.length >= PROSE_MIN && !isData(c))
  const proseChars = prose.reduce((a, c) => a + c.length, 0)
  return { total, proseChars, ratio: total === 0 ? 0 : proseChars / total, prose, chunks }
}

beforeEach(() => fetchMock.mockReset())

async function renderNew(): Promise<string> {
  fetchMock.mockResolvedValue(data())
  return renderToString(await AdminDbPage())
}

async function renderOld(): Promise<string> {
  fetchMock.mockResolvedValue(data())
  return renderToString(await OldAdminDbPage())
}

/**
 * 라쳇 값은 **재설계 시점 실측**이다(2026-09-06, 발견 16건 픽스처).
 *   총 가시 텍스트  9,497자 → 2,044자   (-78%)
 *   화면 자체 설명문   403자 →    60자   (-85%)
 *   가장 긴 덩어리    440자 →    48자
 * 여유는 실측의 1.5배 안쪽으로만 둔다 — 여유가 크면 라쳇이 아니라 장식이다.
 */
const RATCHET = { totalChars: 3000, proseChars: 150, proseRatio: 0.05, longestChunk: 200 }

describe('텍스트 분량 — 읽어야 할 것이 아니라 봐야 할 것이 있다', () => {
  it('전체 가시 텍스트가 라쳇 안에 있다', async () => {
    const r = proseRatio(await renderNew())
    // eslint-disable-next-line no-console
    console.log(`[after] total=${r.total} prose=${r.proseChars} ratio=${r.ratio.toFixed(3)}`)
    expect(r.total).toBeLessThanOrEqual(RATCHET.totalChars)
  })

  it('화면이 스스로 쓴 설명문이 라쳇 안에 있다', async () => {
    const r = proseRatio(await renderNew())
    expect(r.proseChars).toBeLessThanOrEqual(RATCHET.proseChars)
    expect(r.ratio).toBeLessThanOrEqual(RATCHET.proseRatio)
  })

  it('같은 데이터에서 재설계 전보다 적다 — 기준선을 함께 잰다', async () => {
    // ⚠️ 이 비교가 이 파일의 핵심이다. 절대값만 잠그면 "원래 좋았다" 와 구별되지 않는다.
    //    재설계 전 화면(__oldpage.tsx)은 이 비교를 위해 남겨 둔 사본이다.
    const before = proseRatio(await renderOld())
    const after = proseRatio(await renderNew())
    // eslint-disable-next-line no-console
    console.log(
      `[before] total=${before.total} prose=${before.proseChars}\n` +
        `[after ] total=${after.total} prose=${after.proseChars}`,
    )
    expect(after.total).toBeLessThan(before.total / 2)
    expect(after.proseChars).toBeLessThan(before.proseChars)
  })

  it('가장 긴 덩어리가 200자를 넘지 않는다 — 한 문단이 화면을 밀어내지 않는다', async () => {
    const r = proseRatio(await renderNew())
    const longest = r.chunks.reduce((a, c) => Math.max(a, c.length), 0)
    // eslint-disable-next-line no-console
    console.log(`[after] longest chunk=${longest}자`)
    expect(longest).toBeLessThanOrEqual(RATCHET.longestChunk)
  })

  it('설명을 지운 것이 아니라 옮긴 것이다 — 풍선말이 화면에 있다', async () => {
    // 산문을 없애기만 하면 "왜 위험한가" 를 아무도 못 말한다. 접어 두되 버리지는 않는다.
    const html = await renderNew()
    const tips = html.match(/aria-label="[^"]* 설명"/g) ?? []
    // eslint-disable-next-line no-console
    console.log(`[after] 풍선말 ${tips.length}개`)
    expect(tips.length).toBeGreaterThanOrEqual(6)
  })
})

describe('첫 화면 다섯 질문 — 스크롤 없이 답한다', () => {
  it('다섯 질문에 모두 답할 재료가 있다', async () => {
    const html = await renderNew()
    for (const { q, probe } of FIRST_SCREEN_QUESTIONS) {
      expect(probe.some((p) => html.includes(p)), `답 없음: ${q}`).toBe(true)
    }
  })
})
