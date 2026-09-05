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
  KID_BANDS,
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

/** `feed_label` 로 센다. `quarantinedOnly` 면 명시적 격리만. */
async function countByLabel(db: Db, label: string, quarantinedOnly: boolean): Promise<number> {
  let q = db
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('feed_label', label)
  if (quarantinedOnly) q = q.eq('csat_fit->gate->>publishable', 'false')
  const { count, error } = await q
  if (error) throw new Error(error.message)
  if (count == null) throw new Error('카운트가 비었다 — 테이블이나 권한을 확인해야 한다')
  return count
}

/** 각색분은 칸이 아니라 `feed_id` 로 갈린다. */
async function countAdapted(db: Db, quarantinedOnly: boolean): Promise<number> {
  let q = db
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('feed_id', 'adapted')
  if (quarantinedOnly) q = q.eq('csat_fit->gate->>publishable', 'false')
  const { count, error } = await q
  if (error) throw new Error(error.message)
  if (count == null) throw new Error('카운트가 비었다 — 테이블이나 권한을 확인해야 한다')
  return count
}

export async function getKidSourcePanel(): Promise<KidSourcePanel> {
  const db = createAdminClient()
  try {
    // 칸마다 두 번(적재 · 격리) + 각색 두 번 — 열두 질의를 한꺼번에 보낸다.
    // 순차로 돌리면 대기가 줄줄이 더해져 화면이 늦는다(수확기에서 같은 함정을 밟았다).
    const [bandCounts, adaptedHeld, adaptedQuarantined] = await Promise.all([
      Promise.all(
        KID_BANDS.map(async (band) => {
          const label = kidFeedLabel(band)
          const [held, quarantined] = await Promise.all([
            countByLabel(db, label, false),
            countByLabel(db, label, true),
          ])
          return [band, { held, quarantined }] as const
        })
      ),
      countAdapted(db, false),
      countAdapted(db, true),
    ])

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
