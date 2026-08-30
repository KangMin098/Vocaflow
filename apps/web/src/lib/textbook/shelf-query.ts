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
//
// ⚠️ **이 표도 학습자에게 직접 열려 있지 않다.** `shared_dictionary` 의 RLS 는
//    `authenticated read dictionary` 하나뿐이라 **비로그인은 0을 받는다.** 서가는 공개 표면이므로
//    (apps/web/CLAUDE.md 공개 표면 표) 그대로 두면 초등 계단이 로그아웃 상태에서만 비어 보인다 —
//    로그인해서 확인하면 멀쩡하니 **아무도 못 잡는 종류의 거짓말**이다(실측 2026-08-22: 7/7 vs 5/7).
//    그래서 집계 RPC 를 먼저 쓰고, 없으면 표를 직접 읽되 **실패를 0으로 적지 않는다.**

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
  //
  // ⚠️ 집계 RPC 셋(재고 · 교육과정 어휘 · 출처)은 **서로를 기다릴 이유가 없다.**
  //    차례로 await 하던 동안 이 공개 카탈로그의 서버 시간은 세 왕복의 **합**이었다
  //    (실측 2026-08-30: 547 + 2,093 + 496 = 3.1초 → 화면 완료 2.77초).
  //    함께 띄우면 가장 느린 하나로 수렴한다. 셋 다 읽기 전용 집계라 순서 의존이 없다.
  const [inventoryRes, vocabRes, sourcesRes] = await Promise.all([
    lc.rpc('textbook_shelf_inventory'),
    lc.rpc('textbook_curriculum_vocab_counts'),
    lc.rpc('textbook_shelf_sources'),
  ])

  const { data: items, error: itemsError } = inventoryRes
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
  //
  // 집계 RPC(20260822090000) 를 먼저 시도한다. 없으면 표를 직접 읽는다 —
  // 로그인 상태에서는 그 경로도 동작하므로, RPC 적용 전에도 기능이 죽지 않는다.
  const vocabCounts = new Map<string, number>()
  let elementaryMeasured = false

  const { data: viaRpc, error: rpcError } = vocabRes
  if (!rpcError && Array.isArray(viaRpc)) {
    for (const r of viaRpc as Array<{ list_tag: string | null; word_count: number | null }>) {
      if (r.list_tag) vocabCounts.set(r.list_tag, Number(r.word_count ?? 0))
    }
    elementaryMeasured = vocabCounts.size > 0
  } else {
    // ── 폴백 (RPC 적용 전) ────────────────────────────────────────────────
    // ⚠️ **RLS 는 오류를 내지 않는다. 행을 지운다.** 익명 요청에서 이 표는 빈 결과를 돌려주므로
    //    `count` 는 0 이고 `error` 는 null 이다 — 클라이언트 쪽에서는 "0낱말" 과 "못 읽음" 을
    //    **구별할 방법이 없다.** `if (!count) continue` 로 넘기던 것이 정확히 이 함정이었다.
    //
    //    그래서 세션 유무로 가른다: 로그인 상태라면 정책(`authenticated read dictionary`)을
    //    통과하므로 값을 믿을 수 있고, 비로그인이면 **읽을 수 없음이 확정**이라 못 잰 것으로 적는다.
    //    추측이 아니라 정책을 그대로 반영한 판정이다.
    const {
      data: { user },
    } = await client.auth.getUser()

    if (user) {
      let ok = true
      for (const tag of Object.keys(CURRICULUM_TAG_LEVEL)) {
        const { count, error } = await lc
          .from('shared_dictionary')
          .select('word', { count: 'exact', head: true })
          .contains('list_tags', [tag])
        if (error || count == null) {
          ok = false
          continue
        }
        vocabCounts.set(tag, count)
      }
      elementaryMeasured = ok && vocabCounts.size > 0
    } else {
      elementaryMeasured = false
    }
  }

  for (const [tag, levels] of Object.entries(CURRICULUM_TAG_LEVEL)) {
    const count = vocabCounts.get(tag)
    if (!count) continue
    // 한 낱말이 세 유형 모두를 만들 수 있으므로 유형마다 같은 수를 넣되,
    // 레벨이 여럿이면 나눠 배분한다(같은 어휘를 두 계단이 통째로 세면 재고가 부풀려진다).
    const per = Math.floor(count / levels.length)
    for (const lv of levels) {
      for (const type of ELEMENTARY_TYPES) inventory.push({ type, vLevel: lv, count: per })
    }
  }

  // ③ 지문 출처 — 집계 RPC(20260822090000). 못 읽으면 빈 맵이고, 화면은 출처 축을 안 낸다.
  const sourcesByLevel: Record<number, Record<string, number>> = {}
  const { data: srcRows, error: srcError } = sourcesRes
  if (!srcError && Array.isArray(srcRows)) {
    for (const r of srcRows as Array<{
      v_level: number | null
      source_family: string | null
      item_count: number | null
    }>) {
      if (r.v_level == null || !r.source_family) continue
      const bucket = (sourcesByLevel[r.v_level] ??= {})
      bucket[r.source_family] = (bucket[r.source_family] ?? 0) + Number(r.item_count ?? 0)
    }
  }

  return buildShelf(
    inventory as Inventory,
    sourcesByLevel,
    measured,
    undefined,
    elementaryMeasured,
  )
}
