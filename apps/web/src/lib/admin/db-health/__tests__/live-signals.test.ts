// apps/web/src/lib/admin/db-health/__tests__/live-signals.test.ts
//
// 라이브 신호 판정과 조치 추천의 계약.
//
// 이 파일이 잠그는 것 중 가장 비싼 것은 **"모른다" 를 "정상" 으로 말하지 않는다** 이다.
// 라이브를 못 읽었는데 초록 불을 켜는 화면은, 아무것도 안 보여 주는 화면보다 나쁘다.

import { describe, expect, it } from 'vitest'

import {
  CACHE_DELTA_MIN_BLOCKS,
  cacheHitDelta,
  gaugeFill,
  overallStatus,
  signalLevel,
  suggestActions,
} from '../derive'
import { ACTION_CATALOG, LIVE_THRESHOLDS } from '../types'
import type { FindingRow, LiveSnapshot } from '../types'

function live(over: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    at: new Date().toISOString(),
    uptime_h: 26.4,
    blks_hit: 164_700_000,
    blks_read: 12_000_000,
    cron_fail_1h: 0,
    conn: { max: 60, total: 17, active: 3, idle: 14, idle_in_tx: 0, waiting: 0, used_pct: 28.3 },
    cache_hit_pct: 99.6,
    db_size_mb: 6317.2,
    blocked_locks: 0,
    longest_query_s: 1.2,
    longest_xact_s: 1.2,
    oldest_idle_in_tx_s: 0,
    deadlocks: 0,
    rollbacks: 72,
    cron_fail_24h: 0,
    cron_running: 0,
    sessions: [],
    blockers: [],
    cron_recent: [],
    ...over,
  }
}

function finding(over: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 1,
    fingerprint: 'capacity:table:x',
    axis: 'capacity',
    severity: 'warning',
    title: '제목',
    detail: '내용',
    evidence: {},
    suggested_sql: null,
    status: 'open',
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    occurrences: 1,
    ...over,
  }
}

describe('signalLevel — 임계값은 한 곳에만 있다', () => {
  it('높을수록 나쁜 신호', () => {
    expect(signalLevel('conn_used_pct', 30)).toBe('ok')
    expect(signalLevel('conn_used_pct', 70)).toBe('warn')
    expect(signalLevel('conn_used_pct', 85)).toBe('crit')
    expect(signalLevel('conn_used_pct', 99)).toBe('crit')
  })

  it('낮을수록 나쁜 신호 (캐시 적중)', () => {
    expect(signalLevel('cache_hit_pct', 99.6)).toBe('ok')
    expect(signalLevel('cache_hit_pct', 99)).toBe('warn')
    expect(signalLevel('cache_hit_pct', 91.4)).toBe('crit')
  })

  it('임계값이 없는 신호는 판정하지 않는다 — 없는 기준을 지어내지 않는다', () => {
    expect(LIVE_THRESHOLDS.db_size_mb).toBeNull()
    expect(signalLevel('db_size_mb', 999_999)).toBe('unknown')
    expect(gaugeFill('db_size_mb', 999_999)).toBeNull()
  })

  it('값이 없으면 정상이 아니라 모름이다', () => {
    expect(signalLevel('cache_hit_pct', null)).toBe('unknown')
    expect(signalLevel('conn_used_pct', Number.NaN)).toBe('unknown')
  })

  it('임계값은 이 DB 의 실측 설정에 걸려 있다 (근거 문자열이 비어 있지 않다)', () => {
    for (const [key, t] of Object.entries(LIVE_THRESHOLDS)) {
      if (t === null) continue
      expect(t.why, `${key} 의 임계값 근거가 비었다`).toBeTruthy()
      expect(t.why.length).toBeGreaterThan(3)
    }
  })
})

describe('overallStatus — 가장 나쁜 하나가 전체를 정한다', () => {
  const base = { criticalCount: 0, warningCount: 0, stale: false, liveError: null }

  it('전부 정상이면 정상', () => {
    expect(overallStatus({ ...base, live: live() }).level).toBe('ok')
  })

  it('라이브 하나가 치명이면 나머지가 멀쩡해도 장애', () => {
    const s = overallStatus({ ...base, live: live({ cron_fail_1h: 9 }) })
    expect(s.level).toBe('crit')
    expect(s.headline).toBe('장애')
  })

  it('누적 캐시 적중이 낮다는 것만으로 장애라 하지 않는다', () => {
    // ⚠️ 실측 2026-09-06: 재시작 2.3시간 뒤 누적 92.8% 였고 화면이 「장애」를 띄웠다.
    //    캐시가 빈 채로 시작한 평균이라 낮은 것이 정상이었고, 실제로 93.1% 로 오르는 중이었다.
    //    구조적으로 낮은 캐시는 판정층이 치명 발견으로 들고 있다 — 같은 것을 두 번 세지 않는다.
    const s = overallStatus({ ...base, live: live({ cache_hit_pct: 91.4 }) })
    expect(s.level).toBe('ok')
  })

  it('24시간 누적 실패는 판정에 쓰지 않는다 — 최근 1시간만 본다', () => {
    const s = overallStatus({ ...base, live: live({ cron_fail_24h: 61, cron_fail_1h: 0 }) })
    expect(s.level).toBe('ok')
  })

  it('치명 발견이 있으면 라이브가 조용해도 장애', () => {
    expect(overallStatus({ ...base, live: live(), criticalCount: 9 }).level).toBe('crit')
  })

  it('라이브를 못 읽으면 정상이 아니라 모름', () => {
    const s = overallStatus({ ...base, live: null, liveError: 'permission denied' })
    expect(s.level).toBe('unknown')
    expect(s.headline).not.toBe('정상')
  })

  it('라이브를 아직 안 읽었어도 정상이라고 말하지 않는다', () => {
    expect(overallStatus({ ...base, live: null }).level).toBe('unknown')
  })

  it('수집이 낡으면 (치명이 없어도) 모름 — 낡은 숫자로 정상이라 말하지 않는다', () => {
    const s = overallStatus({ ...base, live: live(), stale: true })
    expect(s.level).toBe('unknown')
    expect(s.headline).toBe('수집 멈춤')
  })

  it('치명은 낡음보다 앞선다 — 급한 것을 뒤로 미루지 않는다', () => {
    expect(overallStatus({ ...base, live: live(), stale: true, criticalCount: 1 }).level).toBe('crit')
  })

  it('경계만 있으면 주의', () => {
    expect(overallStatus({ ...base, live: live({ cron_fail_1h: 3 }) }).level).toBe('warn')
  })
})

describe('cacheHitDelta — 「지금」은 증분에서만 나온다', () => {
  const snap = (hit: number, read: number) => ({ blks_hit: hit, blks_read: read })

  it('두 표본 사이의 비율을 낸다', () => {
    // 100 hit + 10 read = 90.9%
    expect(cacheHitDelta(snap(1000, 1000), snap(1000 + 10_000, 1000 + 1000))).toBe(90.9)
  })

  it('표본이 하나뿐이면 재지 않는다 — 「정상」이 아니라 「모름」이다', () => {
    expect(cacheHitDelta(null, snap(1000, 100))).toBeNull()
    expect(cacheHitDelta(snap(1000, 100), null)).toBeNull()
  })

  it('카운터가 되감기면(재시작) 두 창을 이어 붙이지 않는다', () => {
    expect(cacheHitDelta(snap(10_000_000, 1_000_000), snap(500, 50))).toBeNull()
  })

  it('그 사이 읽은 블록이 너무 적으면 재지 않는다 — 유휴 구간의 비율은 잡음이다', () => {
    expect(cacheHitDelta(snap(1000, 100), snap(1050, 105))).toBeNull()
    expect(CACHE_DELTA_MIN_BLOCKS).toBeGreaterThan(0)
  })
})

describe('suggestActions — 증거에 대상이 있을 때만 붙인다', () => {
  it('대상이 없으면 표 조치를 붙이지 않는다 (되돌아오는 버튼은 안 만든다)', () => {
    expect(suggestActions(finding()).some((a) => a.action === 'analyze_table')).toBe(false)
  })

  it('evidence.table 이 있으면 통계 갱신을 붙인다', () => {
    const a = suggestActions(finding({ evidence: { table: 'public.shared_words' } }))
    expect(a).toContainEqual({ action: 'analyze_table', target: 'public.shared_words' })
  })

  it('evidence.job 이 있으면 잡 정지를 붙인다', () => {
    const a = suggestActions(finding({ axis: 'cron', evidence: { job: 'library-pipeline-worker' } }))
    expect(a).toContainEqual({ action: 'cron_disable_job', target: 'library-pipeline-worker' })
  })

  it('같은 조치를 두 번 붙이지 않는다', () => {
    const a = suggestActions(
      finding({ fingerprint: 'integrity:stats_stale', title: '통계가 낡은 표 16개' }),
    )
    expect(a.filter((x) => x.action === 'analyze_stale_tables')).toHaveLength(1)
  })

  it('축만 보고 붙이지 않는다 — 한 줄에 버튼이 넷이면 아무도 안 읽는다', () => {
    const a = suggestActions(finding({ axis: 'connections', evidence: {} }))
    expect(a.some((x) => x.action === 'terminate_idle_in_tx')).toBe(false)
    const b = suggestActions(finding({ fingerprint: 'connections:idle_in_tx' }))
    expect(b.some((x) => x.action === 'terminate_idle_in_tx')).toBe(true)
  })

  it('되돌릴 수 없는 조치는 추천하지 않는다 — 카탈로그 자체에 없다', () => {
    const keys = Object.keys(ACTION_CATALOG)
    for (const forbidden of ['vacuum_full', 'drop_index', 'alter_system', 'reindex']) {
      expect(keys).not.toContain(forbidden)
    }
  })
})

describe('ACTION_CATALOG — DB 허용 목록과 같아야 한다', () => {
  // ⚠️ 이 목록이 DB 함수(db_health_run_action)의 CASE 와 갈리면 화면에 눌러도 거절당하는
  //    버튼이 생긴다. 거절당하는 버튼은 다음부터 아무도 안 누른다.
  //    DB 쪽 실제 목록은 마이그레이션 20260906190500 에 있다.
  const DB_ALLOWLIST = {
    analyze_table: 'safe',
    analyze_stale_tables: 'safe',
    cancel_query: 'safe',
    cron_enable_job: 'safe',
    terminate_backend: 'guarded',
    terminate_idle_in_tx: 'guarded',
    cron_disable_job: 'guarded',
  } as const

  it('키가 정확히 같다', () => {
    expect(Object.keys(ACTION_CATALOG).sort()).toEqual(Object.keys(DB_ALLOWLIST).sort())
  })

  it('등급이 정확히 같다 — safe 로 잘못 적으면 사유 없이 세션이 끊긴다', () => {
    for (const [k, tier] of Object.entries(DB_ALLOWLIST)) {
      expect(ACTION_CATALOG[k as keyof typeof ACTION_CATALOG].tier, k).toBe(tier)
    }
  })

  it('모든 조치가 무슨 일이 일어나는지 한 줄로 말한다', () => {
    for (const [k, v] of Object.entries(ACTION_CATALOG)) {
      expect(v.effect.length, k).toBeGreaterThan(10)
      expect(v.label.length, k).toBeGreaterThan(1)
    }
  })
})
