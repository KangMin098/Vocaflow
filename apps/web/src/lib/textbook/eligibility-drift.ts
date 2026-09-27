// apps/web/src/lib/textbook/eligibility-drift.ts
//
// **커밋된 적격 스냅샷과 지금 DB 의 차이** — 「이 화면의 수치가 얼마나 낡았나」.
//
// ── 왜 생겼나 (실측 2026-09-23 · DD-69 A4) ──────────────────────────
// 「소재 적격」 화면은 커밋된 JSON(`source-eligibility-snapshot.json`)을 읽는다. 그 자체는
// 옳은 선택이다 — 스냅샷에는 **본문을 읽어야 나오는 판정**(발췌창·추출 결함)이 들어 있고,
// 그것은 요청마다 다시 할 수 없다.
//
// 문제는 **드레인을 돌려도 화면이 안 움직인다**는 것이었다. 누군가 스크립트를 다시 돌려
// JSON 을 굽고 커밋해야 하고, 그 사이 관리자는 「안 늘었다」를 보고 안 해도 될 일을 또 한다.
// 실측 그 시점: 스냅샷 2026-09-19 · 87,716행 vs DB 2026-09-20 · 87,720행.
//
// ── 스냅샷을 대체하지 않는다 ────────────────────────────────────────
// 이 모듈이 주는 것은 **차이**다. 화면은 스냅샷을 그대로 그리고, 그 옆에 「스냅샷 이후 DB 는
// 이만큼 움직였다」를 적는다. 그래야 두 가지가 동시에 산다 — 깊은 판정(스냅샷)과
// 지금 값(DB).
//
// ⚠️ **조회가 실패하면 0 이 아니라 `available: false`** 다. 「안 움직였다」와 「못 읽었다」는
//   정반대이고, 뭉개면 화면이 「최신이다」라고 거짓말한다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'
import { withDeadline } from '@/lib/csat/factory-bench'

/** 등급 하나의 스냅샷 대비 증감. */
export interface GradeDrift {
  grade: string
  snapshot: number
  now: number
  /** `now - snapshot`. 음수면 줄었다(판정이 바뀌었거나 글이 빠졌다). */
  delta: number
}

export interface EligibilityDrift {
  /**
   * 지금 DB 를 실제로 읽었는가. `false` 면 **못 읽은 것**이고 「안 움직였다」와 다르다.
   */
  available: boolean
  error: string | null
  /** 스냅샷을 구운 시각(ISO) — 화면이 이미 갖고 있지만, 나란히 적으려고 함께 돌려준다. */
  snapshotAt: string
  /** DB 가 마지막으로 판정한 시각(ISO). 못 읽었으면 null. */
  measuredAt: string | null
  snapshotTotal: number
  /** 지금 DB 의 행 수. 못 읽었으면 null. */
  nowTotal: number | null
  /** 등급별 증감 — 0 이 아닌 것만. 전부 같으면 빈 배열이고 그것이 「안 움직였다」다. */
  grades: GradeDrift[]
}

interface TallyRow {
  v_level: number | null
  grade: string | null
  blocked_by: string | null
  n: number | string
  measured_at: string | null
}

/**
 * 스냅샷과 지금을 견준다.
 *
 * @param snapshotAt 스냅샷을 구운 시각(ISO).
 * @param snapshotByGrade 스냅샷의 등급별 수 — 화면이 이미 읽은 값을 그대로 넘긴다
 *   (여기서 파일을 다시 읽으면 두 곳이 다른 스냅샷을 볼 수 있다).
 * @param timeoutMs 실측 1.35초 / 87,720행. 상한을 넘기면 **「못 읽음」**이지 0 이 아니다.
 */
export async function loadEligibilityDrift(
  snapshotAt: string,
  snapshotByGrade: Record<string, number>,
  timeoutMs = 6_000,
): Promise<EligibilityDrift> {
  const snapshotTotal = Object.values(snapshotByGrade).reduce((n, v) => n + v, 0)
  const base: EligibilityDrift = {
    available: false,
    error: null,
    snapshotAt,
    measuredAt: null,
    snapshotTotal,
    nowTotal: null,
    grades: [],
  }

  const db = createAdminClient() as unknown as SupabaseClient
  const res = await withDeadline(
    (signal) => db.rpc('csat_source_eligibility_tally').abortSignal(signal),
    timeoutMs,
    { data: null, error: { message: `${timeoutMs / 1000}초 안에 안 돌아왔다` } } as {
      data: unknown
      error: { message: string } | null
    },
  )

  if (res.error) {
    // 표가 없거나(마이그레이션 미적용) 느리다 — **0 으로 적지 않는다.**
    return { ...base, error: `지금 값을 못 읽었다: ${res.error.message}` }
  }

  const rows = (res.data ?? []) as TallyRow[]
  if (rows.length === 0) {
    // 행이 0인 것과 조회 실패는 다르다 — 표가 비었으면 그렇게 말한다.
    return { ...base, available: true, nowTotal: 0, measuredAt: null }
  }

  const nowByGrade: Record<string, number> = {}
  let measuredAt: string | null = null
  for (const r of rows) {
    // ⚠️ grade 가 null 인 행을 버리지 않는다 — 버리면 합계가 조용히 모자라진다.
    const g = r.grade ?? 'unknown'
    nowByGrade[g] = (nowByGrade[g] ?? 0) + Number(r.n)
    if (r.measured_at && (measuredAt == null || r.measured_at > measuredAt)) measuredAt = r.measured_at
  }

  const grades: GradeDrift[] = [...new Set([...Object.keys(snapshotByGrade), ...Object.keys(nowByGrade)])]
    .map((grade) => {
      const snapshot = snapshotByGrade[grade] ?? 0
      const now = nowByGrade[grade] ?? 0
      return { grade, snapshot, now, delta: now - snapshot }
    })
    .filter((g) => g.delta !== 0)
    // 움직임이 큰 것부터 — 그것이 다음에 볼 자리다.
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    available: true,
    error: null,
    snapshotAt,
    measuredAt,
    snapshotTotal,
    nowTotal: Object.values(nowByGrade).reduce((n, v) => n + v, 0),
    grades,
  }
}
