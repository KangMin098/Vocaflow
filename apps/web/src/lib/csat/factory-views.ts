// apps/web/src/lib/csat/factory-views.ts
//
// **전략 연구소 두 화면의 실측** — 기획(시장 대비 우위)과 설계(이원목적분류표).
//
// 현황판(`factory.ts`)은 공정마다 눈금 한두 개만 낸다. 여기는 그 눈금 **뒤에 있는 표**다 —
// 어느 출판사의 어느 축에서 지는지, 어느 학령·수준·유형 칸이 비었는지. 현황판이 "막혔다" 고
// 말하면 관리자는 이 화면에서 **어디가** 막혔는지 본다.
//
// ⚠️ 현황판과 **같은 원천**을 쓴다(같은 JSON · 같은 count). 두 화면이 다른 길로 세면 언젠가
//   서로 다른 수를 말하고, 그때부터 둘 다 못 믿는다.

import 'server-only'

import { SERIES_SPINE, SERIES_TYPE_LABEL_KO, type SeriesItemType } from '@vocaflow/library-pipeline'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import {
  BENCH_FILES,
  MARKET_TARGET_INDEX,
  QUERY_TIMEOUT_MS,
  readBench,
  withDeadline,
} from './factory-bench'
import {
  PURE_FUNCTION_TYPES,
  type BlueprintCell,
  type BlueprintRung,
  type BlueprintView,
  type MarketView,
} from './factory-lab-model'

// 판정과 타입은 순수 모듈이 정본이다 — 화면이 `server-only` 를 끌어오지 않도록.
export * from './factory-lab-model'

/* ───────────────────────── 기획 ───────────────────────── */

export async function loadMarketView(): Promise<MarketView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [warehouse, volume, attempts, renders] = await Promise.all([
    readBench(BENCH_FILES.warehouse),
    readBench(BENCH_FILES.volume),
    // 벤치마크 7축이 못 재는 자리의 유일한 근거. **0 과 「못 잼」을 가른다** —
    // 0 은 "아무도 안 풀었다"(사실), null 은 "표를 못 읽었다"(모름)이고 할 일이 다르다.
    db.from('csat_item_attempts').select('id', { count: 'exact', head: true }),
    db.from('textbook_volume_renders').select('band', { count: 'exact', head: true }),
  ])
  return {
    warehouse,
    volume,
    target: MARKET_TARGET_INDEX,
    platform: {
      itemAttempts: attempts.error ? null : (attempts.count ?? 0),
      renderedVolumes: renders.error ? null : (renders.count ?? 0),
      itemAttemptsError: attempts.error ? `관측을 못 읽었다: ${attempts.error.message}` : null,
    },
    loadError:
      warehouse == null && volume == null
        ? `벤치마크 리포트를 못 읽었다 — docs/reports/${BENCH_FILES.volume} 가 없거나 깨졌다. market-benchmark 를 먼저 돌린다`
        : null,
  }
}

/* ───────────────────────── 설계 ───────────────────────── */

async function countCell(db: SupabaseClient, type: string, vLevel: number): Promise<number | null> {
  // 상한 안에 안 오면 「못 잼」이다. 재시도하지 않는다 — 느린 조회는 다시 물어도 느리고,
  // 기다리는 동안 커넥션 풀을 더 조인다.
  const { count } = await withDeadline(
    (signal) =>
      db
        .from('csat_dcp_items')
        .select('id', { count: 'exact', head: true })
        .eq('type', type)
        .eq('v_level', vLevel)
        .abortSignal(signal),
    QUERY_TIMEOUT_MS,
    { count: null } as { count: number | null },
  )
  return count
}

export async function loadBlueprintView(): Promise<BlueprintView> {
  const db = createAdminClient() as unknown as SupabaseClient

  const specs: { step: number; vLevel: number; type: SeriesItemType }[] = []
  for (const rung of SERIES_SPINE) {
    for (const v of rung.vLevels) {
      for (const t of rung.types) {
        if (!PURE_FUNCTION_TYPES.has(t)) specs.push({ step: rung.step, vLevel: v, type: t })
      }
    }
  }

  const [counts, gatesRes] = await Promise.all([
    // 한꺼번에 다 던지면 커넥션 풀이 포화돼 오히려 느려진다 — 6개씩 나눠 보낸다.
    (async () => {
      const out: (number | null)[] = []
      const deadline = Date.now() + 12_000
      for (let i = 0; i < specs.length; i += 6) {
        if (Date.now() > deadline) {
          out.push(...new Array<null>(specs.length - out.length).fill(null))
          break
        }
        out.push(...(await Promise.all(specs.slice(i, i + 6).map((s) => countCell(db, s.type, s.vLevel)))))
      }
      return out
    })(),
    db.from('csat_stage_gates').select('stage, metric, threshold, is_locked, note').order('stage'),
  ])

  const byKey = new Map<string, number | null>()
  specs.forEach((s, i) => byKey.set(`${s.step}|${s.vLevel}|${s.type}`, counts[i] ?? null))

  const axisTypes = new Set<string>()
  for (const rung of SERIES_SPINE) for (const t of rung.types) axisTypes.add(t)

  const rungs: BlueprintRung[] = SERIES_SPINE.map((rung) => {
    const cells: BlueprintCell[] = rung.types.map((t) => {
      const countable = !PURE_FUNCTION_TYPES.has(t)
      // 한 계단이 여러 V-Level 을 쓰면 합산한다 — 지금 규격은 전부 1:1 이지만 배열이므로 편다.
      const count = countable
        ? rung.vLevels.reduce<number | null>((acc, v) => {
            const n = byKey.get(`${rung.step}|${v}|${t}`)
            if (n == null || acc == null) return null
            return acc + n
          }, 0)
        : null
      return { type: t, typeKo: SERIES_TYPE_LABEL_KO[t] ?? t, countable, count }
    })
    return {
      step: rung.step,
      schoolBand: rung.schoolBand,
      vLevels: [...rung.vLevels],
      volumeTitle: rung.volumeTitle,
      rationale: rung.rationale,
      cells,
      emptyTypes: cells.filter((c) => c.countable && c.count === 0).map((c) => c.typeKo),
    }
  })

  return {
    rungs,
    gates: ((gatesRes.data ?? []) as {
      stage: string
      metric: string
      threshold: string | number
      is_locked: boolean | null
      note: string | null
    }[]).map((r) => ({
      stage: r.stage,
      metric: r.metric,
      threshold: Number(r.threshold),
      isLocked: r.is_locked === true,
      note: r.note,
    })),
    typeAxis: [...axisTypes].map((t) => ({
      type: t,
      typeKo: SERIES_TYPE_LABEL_KO[t as SeriesItemType] ?? t,
      countable: !PURE_FUNCTION_TYPES.has(t),
    })),
    loadError: gatesRes.error ? `단계 게이트를 못 읽었다: ${gatesRes.error.message}` : null,
  }
}
