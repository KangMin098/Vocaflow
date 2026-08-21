// apps/web/src/lib/textbook/shelf-query.ts
//
// 교재 서가 **조회부**. 판정·표시는 `shelf.ts`(순수)가 소유한다.
//
// ⚠️ `react.cache` 를 쓰지 않는다 — 호출부가 서가 화면 한 곳뿐이라 이득이 없고,
//    감싸는 순간 이 모듈을 import 하는 렌더 테스트가 `cache is not a function` 으로 죽는다
//    (`lib/admin/retention.ts` 와 같은 판단. CONVENTIONS §vitest 항목).
//
// ── 초등 3종을 어떻게 세나 ──────────────────────────────────────────
// `rhyme`·`word_meaning`·`spell_blank` 는 **DB 에 저장되지 않는다.** 사전에서 결정론적으로
// 생성되므로 저장할 이유가 없다(`elementary.ts`). 그래서 재고에는 **생성 가능 수**를 넣는다.
// 이걸 빠뜨리면 초등 계단이 거짓으로 비어 보이고, 학습자는 "초등 교재가 없다" 고 읽는다.
// 근거 목록은 2022 개정 교육과정 기본어휘(`shared_dictionary.list_tags`)다:
//   kcurr2022_1 초등 808 · kcurr2022_2 중등 1,211 · kcurr2022_0 고등 1,006 (실측 2026-08-21)

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Inventory } from '@vocaflow/library-pipeline'

import { createClient } from '@/lib/supabase/server'

import { buildShelf, type Shelf } from './shelf'

/** 교육과정 어휘 태그 → 그 어휘가 받쳐 주는 V-Level. */
const CURRICULUM_TAG_LEVEL: Record<string, number[]> = {
  kcurr2022_1: [1, 2],
  kcurr2022_2: [3, 4],
  kcurr2022_0: [5, 6, 7],
}

/** 초등 3종 — 낱말 하나로 문항 하나를 만들 수 있다(결정론). */
const ELEMENTARY_TYPES = ['rhyme', 'word_meaning', 'spell_blank'] as const

export async function fetchTextbookShelf(): Promise<Shelf> {
  const client = await createClient()
  const lc = client as unknown as SupabaseClient

  const inventory: Array<{ type: string; vLevel: number | null; count: number }> = []

  // ① DB 저장 유형 — 유형×V레벨 실측
  // 재고는 **집계 전용 RPC** 로 읽는다(20260821120000).
  //
  // ⚠️ 테이블을 직접 조회하면 안 된다. csat_dcp_items 의 RLS 정책은 dcp_admin 하나뿐이라
  //    학습자·비로그인은 **빈 배열**을 받고, 그걸 재료 없음으로 읽으면 문항 1,241개를 가진
  //    계단이 근간 예정 으로 나온다(실측 2026-08-21 — 이 화면이 실제로 그렇게 거짓말했다).
  //    RPC 는 SECURITY DEFINER 로 개수만 돌려준다 — 지문·선지·정답은 나가지 않는다.
  const { data: items, error: itemsError } = await lc.rpc('textbook_shelf_inventory')
  const measured = !itemsError && Array.isArray(items) && items.length > 0

  for (const r of (items ?? []) as Array<{
    item_type: string | null
    v_level: number | null
    item_count: number | null
  }>) {
    if (!r.item_type || r.v_level == null) continue
    inventory.push({ type: r.item_type, vLevel: r.v_level, count: Number(r.item_count ?? 0) })
  }

  // ② 초등 3종 — 생성 가능 수(교육과정 어휘 보유량)
  for (const [tag, levels] of Object.entries(CURRICULUM_TAG_LEVEL)) {
    const { count } = await lc
      .from('shared_dictionary')
      .select('word', { count: 'exact', head: true })
      .contains('list_tags', [tag])
    if (!count) continue
    // 한 낱말이 세 유형 모두를 만들 수 있으므로 유형마다 같은 수를 넣되,
    // 레벨이 여럿이면 나눠 배분한다(같은 어휘를 두 계단이 통째로 세면 재고가 부풀려진다).
    const per = Math.floor(count / levels.length)
    for (const lv of levels) {
      for (const type of ELEMENTARY_TYPES) inventory.push({ type, vLevel: lv, count: per })
    }
  }

  return buildShelf(inventory as Inventory, measured)
}
