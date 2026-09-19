// apps/web/src/lib/textbook/freedom-load.ts
//
// **자유도 패널의 재고를 공정 ⑤·⑥과 같은 집계표에서 받는다.**
//
// 계산은 `freedom-view.ts`(순수 함수)에 있고, 이 파일은 조회 한 번만 한다.
// 세는 길은 `item-count.ts` 의 `loadDcpInventory` 하나뿐이다 — 같은 화면의 공정 ⑤ 집필 ·
// ⑥ 해설이 이 함수를 읽는다. 패널이 다른 길로 세면 한 화면이 두 시점의 재고를 말하게 된다
// (2026-09-16 실측: 저장소 스냅샷 841,826 vs 집계표 880,247).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadDcpInventory } from '@/lib/csat/item-count'
import { createAdminClient } from '@/lib/supabase/admin'

import { bandsFromInventory, buildFreedomView, type FreedomView } from './freedom-view'

export async function loadFreedomView(): Promise<FreedomView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const inventory = await loadDcpInventory(db)
  if (!inventory.ok) {
    // ⚠️ 못 읽었으면 **빈 밴드**로 세우고 이유를 적는다. 0 재고로 계산하면 전 밴드가
    //   「0권」으로 찍혀 있지도 않은 구멍을 가리킨다.
    return buildFreedomView([], null, `재고 집계표를 못 읽었다 — ${inventory.error}`)
  }
  return buildFreedomView(bandsFromInventory(inventory.cells), inventory.refreshedAt)
}
