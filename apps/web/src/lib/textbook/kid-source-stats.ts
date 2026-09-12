// apps/web/src/lib/textbook/kid-source-stats.ts
//
// **초·중 원문 재고를 콘솔이 읽는다 — 지금까지는 CLI 로만 보였다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 이 재고는 `scripts/textbook/kid-inventory.mjs` 를 돌려야만 보였고, 진행 상황은
// 보고서 `.md` 에만 남았다. 관리자가 "지금 어디가 막혔나" 를 묻는 자리는 콘솔인데
// 답이 로컬 파일에 있으면 아무도 안 본다 — 이 저장소가 반복해서 지적받은 지점이다.
//
// ── 세는 법을 여기서 다시 정하지 않는다 ──────────────────────────────
// 목표·몫·"게시 가능" 의 정의는 `@vocaflow/library-pipeline` 의 `buildKidInventory` 가
// 갖는다. 스크립트도 같은 함수를 쓴다 — 그래야 화면과 CLI 가 같은 답을 한다.
//
// ⚠️ **두 번 세서 뺀다.** `.not(col,'eq','false')` 한 번으로 세면 PostgREST 가
//   SQL `col <> 'false'` 로 번역하는데 `col` 이 NULL 이면 UNKNOWN 이라 **미판정 행이
//   조용히 사라진다**(실측 2026-09-05: 초3~4 를 449 로 셌으나 실제 507).
// ⚠️ **없는 것을 0 으로 뭉개지 않는다.** `head:true` 카운트는 없는 테이블에도
//   204/count=null 을 돌려주므로 `count ?? 0` 은 거짓 안심을 만든다. 오류는 올린다.

import {
  ADAPTED_FEED_ID,
  KID_BANDS,
  KID_FEED_ID,
  buildKidInventory,
  kidFeedLabel,
  type KidBand,
  type KidSourceInventory,
} from '@vocaflow/library-pipeline'

import { createAdminClient } from '@/lib/supabase/admin'

export interface KidSourcePanel {
  inventory: KidSourceInventory | null
  /** 조회가 깨졌을 때 그 이유. 화면이 빈 표 대신 이것을 말한다. */
  error: string | null
}

type Db = ReturnType<typeof createAdminClient>

/**
 * 한 피드(+선택적으로 한 칸)의 행을 센다.
 *
 * ⚠️ **`feed_id` 를 반드시 먼저 건다** — `idx_la_feed (feed_id, feed_label)` 의 선두 컬럼이다.
 *   복합 인덱스는 선두 컬럼이 조건에 없으면 못 쓴다. `feed_label` 만으로 세면 90,485행
 *   순차 스캔이 되어 8초 statement timeout 에 걸린다(실측 2026-09-06 — 인덱스를 넣고도
 *   죽었던 이유가 이것이었다. `feed_id` 를 함께 걸자 같은 질의가 47ms 가 됐다).
 */
async function countRows(
  db: Db,
  feedId: string,
  label: string | null,
  quarantinedOnly: boolean
): Promise<number> {
  let q = db
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('feed_id', feedId)
  if (label) q = q.eq('feed_label', label)
  if (quarantinedOnly) q = q.eq('csat_fit->gate->>publishable', 'false')
  const { count, error } = await q
  if (error) throw new Error(error.message || '이유 없는 실패 — 대개 statement timeout 이다')
  if (count == null) throw new Error('카운트가 비었다 — 테이블이나 권한을 확인해야 한다')
  return count
}

export async function getKidSourcePanel(): Promise<KidSourcePanel> {
  const db = createAdminClient()
  try {
    // ⚠️ **한꺼번에 쏘지 않는다.** 처음엔 열두 질의를 `Promise.all` 로 보냈는데, 표가
    //   90,485행이 되자 **그 병렬이 스스로를 밀어냈다** — 질의 하나는 1.2초인데 열둘을
    //   같이 보내면 각자 8초 제한을 넘겨 전부 죽었다(실측 2026-09-06 · 503 도 섞였다).
    //   순차로 돌리면 열둘이 다 통과하고 **전체 1.5초**다. 병렬이 늘 빠른 것이 아니다.
    const bandCounts: (readonly [KidBand, { held: number; quarantined: number }])[] = []
    for (const band of KID_BANDS) {
      const label = kidFeedLabel(band)
      const held = await countRows(db, KID_FEED_ID, label, false)
      const quarantined = await countRows(db, KID_FEED_ID, label, true)
      bandCounts.push([band, { held, quarantined }] as const)
    }
    const adaptedHeld = await countRows(db, ADAPTED_FEED_ID, null, false)
    const adaptedQuarantined = await countRows(db, ADAPTED_FEED_ID, null, true)

    const counts = Object.fromEntries(bandCounts) as Record<
      KidBand,
      { held: number; quarantined: number }
    >
    return {
      inventory: buildKidInventory(counts, {
        held: adaptedHeld,
        quarantined: adaptedQuarantined,
      }),
      error: null,
    }
  } catch (e) {
    return { inventory: null, error: `초·중 원문 재고를 못 읽었다: ${(e as Error).message}` }
  }
}
