// apps/web/src/lib/csat/item-count.ts
//
// **`csat_dcp_items` 를 세는 유일한 길.**
//
// ── 왜 한 곳으로 모으나 ──────────────────────────────────────────────
// 같은 칸을 세는 코드가 세 군데에 따로 있었다 — 현황판(`factory.ts`) · 설계(`factory-views.ts`) ·
// 집필(`factory-line-views.ts`). 셋이 상한·재시도·물결 크기가 조금씩 달랐고, 그 결과
// **두 화면이 같은 칸을 다른 수로 말할 수 있는 구조**였다. 실측 2026-09-06 에 통합 테스트가
// 「초등 고학년/word_order 가 두 화면에서 다르다(0 vs 249)」로 걸렸다.
//
// 화면끼리 어긋나면 관리자는 어느 쪽을 믿을지 정할 방법이 없다. 그래서 세는 방법을 하나만 둔다 —
// 여기가 바뀌면 세 화면이 **함께** 바뀐다.
//
// ── 이 표를 셀 때의 제약 (전부 실측) ─────────────────────────────────
// · **필터 없는 전수 `exact` count 는 안 된다.** 65만 행을 PostgREST 로 전수 세면 50초 뒤
//   `count=null` 로 온다(세 번 연속). 같은 count 를 직접 SQL 로는 즉시 낸다 — DB 가 아니라
//   PostgREST 쪽 한계다. 총계가 필요하면 `plannedTotal()`(플래너 통계 · 추정)을 쓴다.
// · **(유형, 수준)으로 쪼개면 인덱스를 타서 된다.** `(v_level, type)` 인덱스가 있어서다.
//   `type` 단독 필터는 선두 열이 없어 인덱스를 못 타고 20초 벽에 걸린다.
// · **한꺼번에 많이 던지면 오히려 느려진다.** 커넥션 풀이 포화되면 전부 줄을 선다
//   (idle 백엔드로 가득 찬 채 화면이 39초). 그래서 물결로 나눈다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { QUERY_TIMEOUT_MS, withDeadline } from './factory-bench'

/** 한 물결에 던지는 조회 수. 풀이 감당할 만큼만 — 크게 잡으면 되레 느려진다. */
export const COUNT_WAVE = 6

/** 물결 전체에 주는 시간. 넘기면 남은 칸은 **못 잼**으로 남는다(0 이 아니다). */
export const SWEEP_BUDGET_MS = 15_000

/** 세려는 칸 하나. */
export interface CountSpec {
  type: string
  vLevel: number
}

/**
 * 칸 하나를 센다 — 상한 안에 안 오면 `null`.
 *
 * **재시도하지 않는다.** 느린 조회는 다시 물어도 느리고, 기다리는 동안 커넥션 풀을 더 조여
 * 다음 칸까지 늦춘다(실측: 재시도가 50초를 100초로 만들었다).
 */
export async function countItemCell(
  db: SupabaseClient,
  spec: CountSpec,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<number | null> {
  const { count } = await withDeadline(
    (signal) =>
      db
        .from('csat_dcp_items')
        .select('id', { count: 'exact', head: true })
        .eq('type', spec.type)
        .eq('v_level', spec.vLevel)
        .abortSignal(signal),
    timeoutMs,
    { count: null } as { count: number | null },
  )
  return count
}

/**
 * 칸 여러 개를 **물결로 나눠** 센다. 예산을 넘기면 남은 칸을 포기하고 `null` 로 남긴다.
 *
 * ⚠️ 포기한 칸을 **0 으로 채우지 않는다.** 0 은 "재고가 없다"(사실)이고 `null` 은 "못 셌다"(모름)라서
 * 할 일이 정반대다 — 0 으로 채우면 관리자가 있지도 않은 구멍을 메우러 간다.
 */
export async function countItemCells(
  db: SupabaseClient,
  specs: readonly CountSpec[],
  budgetMs = SWEEP_BUDGET_MS,
): Promise<(number | null)[]> {
  const out: (number | null)[] = []
  const deadline = Date.now() + budgetMs
  for (let i = 0; i < specs.length; i += COUNT_WAVE) {
    if (Date.now() > deadline) {
      out.push(...new Array<null>(specs.length - out.length).fill(null))
      break
    }
    out.push(
      ...(await Promise.all(specs.slice(i, i + COUNT_WAVE).map((s) => countItemCell(db, s)))),
    )
  }
  return out
}

/**
 * 표 전체의 문항 수 — **추정이다.**
 *
 * 정확한 전수 count 는 이 표에서 안 된다(위 제약 참조). `count: 'planned'` 는 플래너 통계라
 * 2.4초에 나오지만 정확하지 않다(654,390 vs 실제 655,092 · 0.1% 차). 화면은 이 값에 `≈` 를
 * 붙이고 근거를 적어야 한다 — 추정을 정확한 값처럼 적으면 그 수로 계산한 비율이 조용히 틀린다.
 */
export async function plannedItemTotal(
  db: SupabaseClient,
  timeoutMs = 6_000,
): Promise<{ count: number | null; message: string | null }> {
  const { count, error } = await withDeadline(
    (signal) =>
      db.from('csat_dcp_items').select('id', { count: 'planned', head: true }).abortSignal(signal),
    timeoutMs,
    { count: null, error: { message: `${timeoutMs / 1000}초 안에 안 돌아왔다` } } as {
      count: number | null
      error: { message: string } | null
    },
  )
  return { count, message: count == null ? (error?.message ?? '서버가 수를 돌려주지 않았다') : null }
}
