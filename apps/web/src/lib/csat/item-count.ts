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
 * (유형 × 수준) 재고 집계 — **한 번의 그룹 스캔**(`csat_dcp_inventory()`).
 *
 * ── 왜 RPC 인가 (2026-09-05 실측 → 2026-09-06 적용) ─────────────────
 * `csat_dcp_items` 는 65만 행이다. PostgREST 로 필터 없이 전수를 세면 **50초 뒤
 * `count=null`** 이 온다(세 번 연속). 유형·수준으로 쪼개면 셀마다는 되지만 재고가 있는 칸이
 * 132개라 다 돌면 몇 분이다. 그래서 저장 문항은 `planned` 추정치로 때웠고, **해설 보유율은
 * 아예 못 쟀다** — 공정 ⑥ 이 눈금 없이 남은 이유가 이것이다.
 *
 * 집계 RPC 는 같은 것을 한 번의 순차 훑기로 낸다. 직접 SQL 로는 5,715ms · 132행이고,
 * 값 자체는 맞다(2026-09-06 적용 직후 `execute_sql` 로 확인: 136행 · 문항 656,984 ·
 * 해설 426,696 · 키/값 셈 불일치 **0** — 적재 결함 없음).
 *
 * ⚠️ **그런데 PostgREST 경유로는 아직 못 쓴다.** 같은 함수를 앱과 같은 길(supabase-js →
 *    PostgREST → 풀러)로 부르면 statement_timeout 을 60초로 올려도 **60,079ms 에서 취소**된다
 *    (실측 2회). 직접 SQL 5.7초와 10배 차이다 — 재는 자리가 다르면 수도 다르다는 것을
 *    ACP 에서 한 번 겪고도 여기서 또 확인했다.
 *
 *    타임아웃을 더 올리지 않는다. 그건 "화면이 1분 넘게 멈춰도 된다" 는 뜻이고, 이 저장소가
 *    품질 게이트에서 이미 그 대가를 치렀다. 남은 길은 **미리 계산해 두는 것**(matview +
 *    주기 갱신 — `textbook_shelf_stats` 가 쓰는 방식)이고 그건 별도 승인이 필요하다.
 *
 *    그때까지 이 함수는 `ok:false` 로 돌아오고, 공정 ⑥ 눈금은 **「못 잼」 + 이유**로 남는다.
 *    0 으로 뭉개지 않는다 — 그것이 이 파일의 규칙이다.
 *
 * `explained_key`(키가 있다)와 `explained_value`(값이 JSON null 이 아니다)를 **둘 다** 받는다.
 * 지금은 같지만 갈리기 시작하면 그 자체가 적재 결함의 신호다 — 그때 알아채려고 따로 받는다.
 */
export interface DcpInventoryCell {
  type: string
  vLevel: number
  items: number
  explained: number
}

export type DcpInventory =
  | { ok: true; cells: DcpInventoryCell[]; items: number; explained: number; keyValueGap: number }
  | { ok: false; error: string }

export async function loadDcpInventory(
  db: SupabaseClient,
  // ⚠️ 6초다. 20초로 뒀더니 현황판이 그만큼 통째로 멈췄다 — 어차피 이 경로로는 60초에도
  //    안 오므로 오래 기다릴 이유가 없다. 빨리 포기하고 「못 잼」을 말하는 편이 낫다.
  //    matview 가 붙어 즉답이 되면 이 값은 의미를 잃는다(그때 다시 볼 것).
  timeoutMs = 6_000,
): Promise<DcpInventory> {
  const { data, error } = await withDeadline(
    (signal) => db.rpc('csat_dcp_inventory').abortSignal(signal),
    timeoutMs,
    { data: null, error: { message: `${timeoutMs / 1000}초 안에 안 돌아왔다` } } as {
      data: unknown
      error: { message: string } | null
    },
  )
  if (error || !Array.isArray(data)) {
    return { ok: false, error: error?.message || '서버가 집계를 돌려주지 않았다' }
  }

  const rows = data as {
    type: string
    v_level: number
    items: number | string
    explained_key: number | string
    explained_value: number | string
  }[]

  let items = 0
  let explained = 0
  let keyValueGap = 0
  const cells: DcpInventoryCell[] = []
  for (const r of rows) {
    // count(*) 는 bigint 라 JSON 에서 문자열로 온다 — 숫자로 접어 두지 않으면 합계가 문자열이 된다.
    const n = Number(r.items)
    const k = Number(r.explained_key)
    const v = Number(r.explained_value)
    items += n
    explained += k
    keyValueGap += Math.abs(k - v)
    cells.push({ type: r.type, vLevel: r.v_level, items: n, explained: k })
  }
  return { ok: true, cells, items, explained, keyValueGap }
}

/**
 * 전체 문항 수 — **플래너 통계**(추정치).
 *
 * ⚠️ 2026-09-06 에 이것을 지우고 집계 RPC 로 갈아탔다가 **되돌렸다.** RPC 는 값이 맞지만
 *    PostgREST 경유로 60초에도 안 온다(위 `loadDcpInventory` 주석). 낡음 감시의 제3의 수는
 *    빨라야 쓸모가 있으므로, matview 가 붙기 전까지는 이쪽이 유일한 길이다.
 *
 * `exact` 를 쓰지 않는 이유: 필터 없는 전수 count 는 이 표(65만 행)에서 50초 뒤 `count=null`
 * 로 온다. `planned` 는 2.4초에 답한다 — 통계값이라 오차가 있고, 그래서 이 수는
 * **허용 오차를 넘을 때만** 경고에 쓴다(소수점을 다투는 자리가 아니다).
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
