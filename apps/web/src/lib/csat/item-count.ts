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

/**
 * ~~물결 전체에 주는 시간~~ — **더는 쓰지 않는다.**
 *
 * 칸마다 count 를 던지던 시절의 상한이었다. 지금은 집계표를 **한 번** 읽으므로 나눌 물결도,
 * 중간에 포기할 예산도 없다. 상수를 남겨 두면 "여기에 예산이 있다" 는 거짓 인상을 준다.
 */
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
 * 칸 여러 개를 센다 — **집계표 한 번**으로.
 *
 * ⚠️ 예전에는 칸마다 조회를 따로 던져 물결로 나눴다(6개씩 · 15초 예산). 그 방식은
 *   ① 예산을 넘기면 남은 칸이 「못 잼」으로 남았고(실측 29~133칸이 회색으로 덮였다)
 *   ② 무엇보다 **화면마다 다른 수를 말할 수 있었다** — 어느 화면이 어디까지 셌느냐에
 *      따라 갈렸기 때문이다. 이 파일이 존재하는 이유가 바로 그것을 막는 것이었는데도.
 *
 *   2026-09-06 — 집계표(`textbook_shelf_inventory_mv` · 30분 갱신)를 한 번 읽고 나눠 준다.
 *   조회 1회 · 1.2초(실측)로 225칸이 한꺼번에 오고, 예산에 걸려 빠지는 칸이 없다.
 *
 * ⚠️ 집계표에 **없는 칸은 0** 이다 — group by 결과라 재고가 0인 칸은 행 자체가 없다.
 *   못 읽었을 때만 `null`(못 잼)로 남긴다. 0 과 「못 잼」을 가르는 규칙은 그대로다.
 */
export async function countItemCells(
  db: SupabaseClient,
  specs: readonly CountSpec[],
): Promise<(number | null)[]> {
  const inventory = await loadDcpInventory(db)
  if (!inventory.ok) return specs.map(() => null)
  const byCell = new Map<string, number>()
  for (const c of inventory.cells) byCell.set(`${c.type}|${c.vLevel}`, c.items)
  return specs.map((s) => byCell.get(`${s.type}|${s.vLevel}`) ?? 0)
}

/**
 * (유형 × 수준) 재고 집계 — **이미 있던 집계표를 읽는다.**
 *
 * ── 왜 새로 만들지 않았나 (2026-09-06) ───────────────────────────────
 * 이 값을 내려고 `csat_dcp_inventory()` 를 만들었다가 **버렸다.** 직접 SQL 로는 5.7초에
 * 정상이었지만 앱과 같은 길(PostgREST → 풀러)로는 statement_timeout 60초에도 취소됐다
 * (실측 60,079ms · 2회). 그때 처방으로 "matview 를 만들자" 고 적었는데 —
 * **이미 있었다**: `textbook_shelf_inventory_mv`(20260831090000).
 *
 * 같은 표(`csat_dcp_items`)를 (유형 × 수준)으로 집계하고 30분마다 CONCURRENTLY 갱신한다.
 * 읽기는 `textbook_shelf_inventory()` RPC 로 **1.2초**(실측, 136행 · 문항 656,984) —
 * 우리가 만들려던 것과 같은 수를 60배 빠르게 준다.
 *
 * ⚠️ 해설 판정은 그쪽 정의를 따른다 — `COALESCE(NULLIF(explanation_ko,''), NULLIF(rationale_ko,''))`.
 *    우리 함수는 `explanation_ko` 키만 봤고 빈 값도 세어 427,831 대신 426,696 을 냈다.
 *    **1,135건 차이**이고, 저쪽이 옳다 — 키만 있고 값이 빈 문항을 「해설 있음」으로 세면
 *    구멍이 영영 안 보인다(그 migration 주석이 같은 이유를 적어 두었다).
 *
 * ⚠️ **낡을 수 있다.** 그래서 `refreshedAt` 을 함께 돌려주고 화면이 "언제 센 값인지" 를
 *    말하게 한다. 낡은 값을 지금 값인 척하지 않는 것이 이 저장소의 규칙이다.
 */
export interface DcpInventoryCell {
  type: string
  vLevel: number
  items: number
  explained: number
}

export type DcpInventory =
  | {
      ok: true
      cells: DcpInventoryCell[]
      items: number
      explained: number
      /** 집계표가 마지막으로 갱신된 시각. 못 읽었으면 null — 그때는 신선도를 주장하지 않는다. */
      refreshedAt: string | null
    }
  | { ok: false; error: string }

export async function loadDcpInventory(
  db: SupabaseClient,
  timeoutMs = 6_000,
): Promise<DcpInventory> {
  const [inv, meta] = await Promise.all([
    withDeadline(
      (signal) => db.rpc('textbook_shelf_inventory').abortSignal(signal),
      timeoutMs,
      { data: null, error: { message: `${timeoutMs / 1000}초 안에 안 돌아왔다` } } as {
        data: unknown
        error: { message: string } | null
      },
    ),
    withDeadline(
      (signal) => db.rpc('textbook_shelf_refreshed_at').abortSignal(signal),
      timeoutMs,
      { data: null, error: null } as { data: unknown; error: { message: string } | null },
    ),
  ])

  if (inv.error || !Array.isArray(inv.data)) {
    return { ok: false, error: inv.error?.message || '서버가 집계를 돌려주지 않았다' }
  }

  const rows = inv.data as {
    item_type: string
    v_level: number
    item_count: number | string
    explained_count: number | string
  }[]

  let items = 0
  let explained = 0
  const cells: DcpInventoryCell[] = []
  for (const r of rows) {
    // count(*) 는 bigint 라 JSON 에서 문자열로 온다 — 숫자로 접지 않으면 합계가 문자열이 된다.
    const n = Number(r.item_count)
    const e = Number(r.explained_count)
    items += n
    explained += e
    cells.push({ type: r.item_type, vLevel: r.v_level, items: n, explained: e })
  }

  const refreshedAt = typeof meta.data === 'string' ? meta.data : null
  return { ok: true, cells, items, explained, refreshedAt }
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
