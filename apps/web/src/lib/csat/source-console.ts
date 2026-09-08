// apps/web/src/lib/csat/source-console.ts
//
// **④ 소재 — 소스 관리 콘솔의 서버 읽기.**
//
// 이 파일이 하는 일은 조회 셋뿐이다: 최신 스냅샷 2행 · 원천 등록부 · 소스 타겟.
// 집계는 **DB 가 한다**(`csat_source_rollup()` · 실측 1.4~2.6초). 화면은 그 결과를 읽을 뿐이라
// 방문 한 번에 91,360행을 훑지 않는다.
//
// ── 왜 스냅샷 2행인가 ────────────────────────────────────────────────────
// 한 행이면 「지금 얼마」밖에 못 말한다. 관리자가 실제로 판단하는 것은 **움직임**이다 —
// 「어제보다 +312, 초3~4 는 −14」. 그래서 직전 행을 함께 읽어 증감을 낸다.
//
// ── 실패를 빈 표로 바꾸지 않는다 ─────────────────────────────────────────
// 조회가 죽으면 `error` 를 실어 보낸다. 「0편」과 「못 잼」은 다른 말이고, 이 저장소는
// 그 둘을 섞어 있지도 않은 구멍을 메우러 간 전례가 있다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  auditRegistry,
  rollupDelta,
  segmentFills,
  stageGates,
  targetProgress,
  type RegistryAudit,
  type RollupDelta,
  type SegmentFill,
  type SourceRegistryRow,
  type SourceRollup,
  type SourceTarget,
  type StageGate,
  type TargetProgress,
} from '@vocaflow/library-pipeline/source-rollup'

import { createAdminClient } from '@/lib/supabase/admin'

export type {
  RegistryAudit,
  RollupDelta,
  SegmentFill,
  SourceRegistryRow,
  SourceRollup,
  SourceTarget,
  StageGate,
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
  segments: SegmentFill[]
  targets: TargetProgress[]
  registry: SourceRegistryRow[]
  audit: RegistryAudit | null
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

  const [snapRes, regRes, tgtRes] = await Promise.all([
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
  ])

  if (snapRes.error) errors.push(`스냅샷을 못 읽었다: ${snapRes.error.message}`)
  if (regRes.error) errors.push(`원천 등록부를 못 읽었다: ${regRes.error.message}`)
  if (tgtRes.error) errors.push(`소스 타겟을 못 읽었다: ${tgtRes.error.message}`)

  const snaps = (snapRes.data ?? []) as SnapshotRow[]
  const cur = snaps[0] ?? null
  const prev = snaps[1] ?? null
  const registry = (regRes.data ?? []) as SourceRegistryRow[]
  // `target_value` 는 numeric 이라 PostgREST 가 문자열로 준다 — 숫자로 바꾸지 않으면
  // `goal = stock * '0.1'` 이 되어 조용히 NaN 이 된다.
  const targets = ((tgtRes.data ?? []) as (Omit<SourceTarget, 'target_value'> & {
    target_value: number | string
  })[]).map((t) => ({ ...t, target_value: Number(t.target_value) }))

  const rollup = cur?.payload ?? null

  return {
    takenAt: cur?.taken_at ?? null,
    takenBy: cur?.taken_by ?? null,
    durationMs: cur?.duration_ms ?? null,
    prevTakenAt: prev?.taken_at ?? null,
    rollup,
    delta: rollup ? rollupDelta(rollup, prev?.payload ?? null) : null,
    gates: rollup ? stageGates(rollup) : [],
    segments: rollup ? segmentFills(rollup) : [],
    targets: rollup ? targetProgress(rollup, targets) : [],
    registry,
    audit: rollup ? auditRegistry(rollup, registry) : null,
    errors,
  }
}
