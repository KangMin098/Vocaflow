// apps/web/src/lib/csat/source-console.ts
//
// **④ 소재 — 소스 관리 콘솔의 서버 읽기.**
//
// 이 파일이 하는 일은 조회 다섯뿐이다: 최신 스냅샷 2행 · 원천 등록부 · 소스 타겟 ·
// 단계 게이트 · 출고분 카운트 둘. 집계는 **DB 가 한다**(`csat_source_rollup()` · 실측
// 1.4~2.6초). 화면은 그 결과를 읽을 뿐이라 방문 한 번에 10만 행을 훑지 않는다.
//
// ── 왜 스냅샷 2행인가 ────────────────────────────────────────────────────
// 한 행이면 「지금 얼마」밖에 못 말한다. 관리자가 실제로 판단하는 것은 **움직임**이다 —
// 「어제보다 +312, 초3~4 는 −14」. 그래서 직전 행을 함께 읽어 증감을 낸다.
//
// ── 왜 게이트를 같이 읽나 (2026-09-15) ───────────────────────────────────
// 밴드가 「지문으로 채우는 칸」인지 「오디오 축으로 채우는 칸」인지는 **게이트의 metric 이
// 정한다**(`source-rollup.ts` §6). 그 판정 없이 밴드를 세면 S5 처럼 지문을 안 쓰는 칸이
// 영구히 빨갛게 서고, 화면은 하지 않아도 될 수확을 시킨다.
//
// ── 실패를 빈 표로 바꾸지 않는다 ─────────────────────────────────────────
// 조회가 죽으면 `error` 를 실어 보낸다. 「0편」과 「못 잼」은 다른 말이고, 이 저장소는
// 그 둘을 섞어 있지도 않은 구멍을 메우러 간 전례가 있다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  auditRegistry,
  audioOnlyGateBands,
  bandStock,
  emptyPassageBands,
  rollupDelta,
  segmentFills,
  stageGates,
  targetProgress,
  type BandStock,
  type RegistryAudit,
  type RollupDelta,
  type SegmentFill,
  type SourceRegistryRow,
  type SourceRollup,
  type SourceTarget,
  type StageGate,
  type StageGateRow,
  type TargetProgress,
} from '@vocaflow/library-pipeline/source-rollup'

import { createAdminClient } from '@/lib/supabase/admin'

export type {
  BandStock,
  RegistryAudit,
  RollupDelta,
  SegmentFill,
  SourceRegistryRow,
  SourceRollup,
  SourceTarget,
  StageGate,
  StageGateRow,
  TargetProgress,
}

export interface SourceConsoleView {
  /** 마지막으로 잰 시각. null 이면 아직 한 번도 안 쟀다(0 이 아니다). */
  takenAt: string | null
  takenBy: string | null
  durationMs: number | null
  prevTakenAt: string | null
  rollup: SourceRollup | null
  delta: RollupDelta | null
  gates: StageGate[]
  /** 단계 밴드별 조판 풀 재고. **화면 전용은 이미 빠져 있다**(집계의 `in_pool`). */
  bands: BandStock[]
  /** 지문으로 채워야 하는데 0편인 밴드 — 그 단계 책은 지금 못 만든다. */
  emptyBands: string[]
  /** 오디오 축으로만 채우는 밴드 — 지문이 0편이어도 **막힌 것이 아니다**. */
  audioBands: string[]
  segments: SegmentFill[]
  targets: TargetProgress[]
  registry: SourceRegistryRow[]
  audit: RegistryAudit | null
  /**
   * 학습자에게 **이미 나간 것**. 재고가 아니라 출고분이다.
   *
   * ⚠️ 이 화면은 오래 이 수(562)를 「지문 재고」라고 불렀다 — `csat_stage_catalog` 뷰가
   * 양쪽 다 `status='published'` 로 걸려 있기 때문이다. 조판이 고르는 풀은 그 200배다.
   * 없애지 않고 남기되 **이름을 바꾼다**: 출고분은 출고분으로 쓸모가 있다.
   *
   * `null` 은 0 이 아니라 **못 셌다**는 뜻이다(없는 테이블도 head 요청엔 count=null 로 온다).
   */
  published: { articles: number | null; books: number | null }
  errors: string[]
}

type SnapshotRow = {
  taken_at: string
  taken_by: string
  duration_ms: number
  payload: SourceRollup
}

export async function loadSourceConsole(): Promise<SourceConsoleView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const errors: string[] = []

  const [snapRes, regRes, tgtRes, gateRes, artRes, bookRes] = await Promise.all([
    db
      .from('csat_source_snapshots')
      .select('taken_at, taken_by, duration_ms, payload')
      .order('taken_at', { ascending: false })
      .limit(2),
    db
      .from('csat_source_registry')
      .select('source, label, license_class, homepage, role_note, harvest_cmd, feed_ids, active, note')
      .order('source'),
    db
      .from('csat_source_targets')
      .select('key, label, scope, match, mode, target_value, basis, sort_order, active, note')
      .order('sort_order'),
    db.from('csat_stage_gates').select('stage, metric'),
    db.from('library_articles').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('library_books').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  if (snapRes.error) errors.push(`스냅샷을 못 읽었다: ${snapRes.error.message}`)
  if (regRes.error) errors.push(`원천 등록부를 못 읽었다: ${regRes.error.message}`)
  if (tgtRes.error) errors.push(`소스 타겟을 못 읽었다: ${tgtRes.error.message}`)
  if (gateRes.error) errors.push(`단계 게이트를 못 읽었다: ${gateRes.error.message}`)

  const snaps = (snapRes.data ?? []) as SnapshotRow[]
  const cur = snaps[0] ?? null
  const prev = snaps[1] ?? null
  const registry = (regRes.data ?? []) as SourceRegistryRow[]
  const gateRows = (gateRes.data ?? []) as StageGateRow[]
  // `target_value` 는 numeric 이라 PostgREST 가 문자열로 준다 — 숫자로 바꾸지 않으면
  // `goal = stock * '0.1'` 이 되어 조용히 NaN 이 된다.
  const targets = ((tgtRes.data ?? []) as (Omit<SourceTarget, 'target_value'> & {
    target_value: number | string
  })[]).map((t) => ({ ...t, target_value: Number(t.target_value) }))

  const rollup = cur?.payload ?? null
  const bands = rollup ? bandStock(rollup, gateRows) : []

  return {
    takenAt: cur?.taken_at ?? null,
    takenBy: cur?.taken_by ?? null,
    durationMs: cur?.duration_ms ?? null,
    prevTakenAt: prev?.taken_at ?? null,
    rollup,
    delta: rollup ? rollupDelta(rollup, prev?.payload ?? null) : null,
    gates: rollup ? stageGates(rollup) : [],
    bands,
    emptyBands: emptyPassageBands(bands),
    audioBands: audioOnlyGateBands(gateRows),
    segments: rollup ? segmentFills(rollup) : [],
    targets: rollup ? targetProgress(rollup, targets) : [],
    registry,
    audit: rollup ? auditRegistry(rollup, registry) : null,
    published: {
      articles: artRes.error ? null : (artRes.count ?? null),
      books: bookRes.error ? null : (bookRes.count ?? null),
    },
    errors,
  }
}
