// apps/web/src/lib/textbook/source-live.ts
//
// **원문 적격 — 지금 DB 에서 바로 센 수.** (`csat_source_live_rollup()` RPC · 2026-09-24)
//
// ── 왜 생겼나 ─────────────────────────────────────────────────────────
// `/admin/csat/sources` 맨 위 「교재에 실을 수 있는 원문」은 **커밋된 스냅샷**(`source-eligibility-snapshot.json`)
// 이었다. 스냅샷은 사람이 스캔을 돌려 커밋해야만 바뀌므로, 판정 규격이 v4 로 바뀐 뒤에도 v3 으로 매긴
// 10,560편을 말했고(DB v4 실측 21,038) 그 전에는 gutenberg 퇴출 전 87,720편을 말했다. 원문마다 판정은
// 이미 `csat_source_eligibility` 에 있으므로 **세기만 하면 된다** — 64,102행 0.09초.
//
// 이 모듈은 그 수를 한 모양으로 낸다. 서버(첫 화면)와 API(「지금 다시 세기」 단추)가 **같은 함수**를 쓴다 —
// 둘이 따로 세면 단추를 눌렀을 때 숫자가 이유 없이 바뀐다.
//
// ⚠️ 못 읽으면 `ok: false` 와 이유다. 0 으로 뭉개지 않는다(「판정 0편」과 「못 셌다」는 할 일이 정반대).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SourceLiveRow {
  source: string
  grade: string
  n: number
  withItems: number
}

export interface SourceLive {
  ok: true
  /** 판정 대상 전체(행 수). */
  total: number
  /** 등급별 편수 — DB 에 있는 등급 이름 그대로(v4: usable · blocked · unjudged). */
  byGrade: Record<string, number>
  /** 실어도 되는 편수 = usable. */
  usable: number
  /** 문항이 이미 붙은 원문 수. */
  withItems: number
  bySource: { source: string; total: number; usable: number; blocked: number; unjudged: number }[]
  /** 판정 시각 범위 — 가장 오래된 판정이 곧 이 수의 신선도다. */
  measuredMin: string | null
  measuredMax: string | null
  /** 판정 규격 버전 범위. 둘이 다르면 옛 규격 판정이 섞여 있다. */
  policyMin: number | null
  policyMax: number | null
  /** 이 수를 **센** 시각(서버 시계) — 판정 시각과 다르다. */
  countedAt: string
}

export type SourceLiveResult = SourceLive | { ok: false; error: string; countedAt: string }

interface RpcRow {
  source: string | null
  grade: string | null
  n: number | string
  with_items: number | string
  measured_min: string | null
  measured_max: string | null
  policy_min: number | null
  policy_max: number | null
}

/** RPC 행을 화면 모양으로 접는다 — 순수 함수라 테스트가 DB 없이 잰다. */
export function foldLive(rows: RpcRow[], countedAt: string): SourceLive {
  const byGrade: Record<string, number> = {}
  const bySourceMap = new Map<string, { source: string; total: number; usable: number; blocked: number; unjudged: number }>()
  let total = 0
  let withItems = 0
  let measuredMin: string | null = null
  let measuredMax: string | null = null
  let policyMin: number | null = null
  let policyMax: number | null = null
  for (const r of rows) {
    const n = Number(r.n)
    const grade = r.grade ?? 'unknown'
    const source = r.source ?? '(없음)'
    total += n
    withItems += Number(r.with_items)
    byGrade[grade] = (byGrade[grade] ?? 0) + n
    const s = bySourceMap.get(source) ?? { source, total: 0, usable: 0, blocked: 0, unjudged: 0 }
    s.total += n
    if (grade === 'usable' || grade === 'blocked' || grade === 'unjudged') s[grade] += n
    bySourceMap.set(source, s)
    if (r.measured_min && (!measuredMin || r.measured_min < measuredMin)) measuredMin = r.measured_min
    if (r.measured_max && (!measuredMax || r.measured_max > measuredMax)) measuredMax = r.measured_max
    if (r.policy_min != null && (policyMin == null || r.policy_min < policyMin)) policyMin = r.policy_min
    if (r.policy_max != null && (policyMax == null || r.policy_max > policyMax)) policyMax = r.policy_max
  }
  return {
    ok: true,
    total,
    byGrade,
    usable: byGrade.usable ?? 0,
    withItems,
    bySource: [...bySourceMap.values()].sort((a, b) => b.total - a.total),
    measuredMin,
    measuredMax,
    policyMin,
    policyMax,
    countedAt,
  }
}

export async function loadSourceLive(db: SupabaseClient, now: Date = new Date()): Promise<SourceLiveResult> {
  const countedAt = now.toISOString()
  const { data, error } = await db.rpc('csat_source_live_rollup')
  if (error) return { ok: false, error: `지금 수를 못 셌습니다 — ${error.message}`, countedAt }
  if (!Array.isArray(data)) return { ok: false, error: '지금 수를 못 셌습니다 — 응답 모양이 다릅니다', countedAt }
  return foldLive(data as RpcRow[], countedAt)
}
