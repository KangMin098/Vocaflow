// apps/web/src/lib/csat/product-view.ts
//
// **제품 격자 실측** — (유형 × 학령) 칸마다 "지금 이 권을 낼 수 있나".
//
// 한 번의 집계(`csat_dcp_inventory()`)로 (문항유형 × V-Level) 재고를 받아, 장르 정의가 말하는
// 문항유형끼리 합쳐 칸을 채운다. 65만 행을 다시 세지 않는다 — 그 표를 전수로 세면 50초 뒤
// 빈손으로 온다(`item-count.ts` 헤더).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import { loadDcpInventory } from './item-count'
import {
  GENRES,
  STEPS,
  catalogCoverage,
  genreCoverage,
  judgeCell,
  type CatalogCell,
  type CatalogRow,
} from './product-model'

export interface CatalogView {
  rows: CatalogRow[]
  /** 낼 수 있는 권 / 만들 수 있는 칸 / 못 만드는 칸. */
  coverage: ReturnType<typeof catalogCoverage>
  /** 시중 유형 커버리지 — 이 목표의 헤드라인. */
  genres: ReturnType<typeof genreCoverage>
  /** 집계를 못 읽었으면 그 이유. 칸은 전부 「못 잼」이 된다 — 0 이 아니다. */
  loadError: string | null
}

export async function loadCatalogView(): Promise<CatalogView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const inv = await loadDcpInventory(db)

  // (유형|수준) → {문항, 해설}. 못 읽었으면 빈 지도 — 그러면 모든 칸이 「못 잼」이다.
  const byCell = new Map<string, { items: number; explained: number }>()
  if (inv.ok) {
    for (const c of inv.cells) byCell.set(`${c.type}|${c.vLevel}`, { items: c.items, explained: c.explained })
  }

  const rows: CatalogRow[] = GENRES.map((genre) => {
    const cells: CatalogCell[] = STEPS.map(({ step, vLevels }) => {
      // 장르가 쓰는 문항유형을 그 계단의 V-Level 전부에 걸쳐 합친다.
      let items: number | null = inv.ok ? 0 : null
      let explained: number | null = inv.ok ? 0 : null
      if (inv.ok) {
        for (const t of genre.itemTypes) {
          for (const v of vLevels) {
            const hit = byCell.get(`${t}|${v}`)
            if (!hit) continue
            items = (items ?? 0) + hit.items
            explained = (explained ?? 0) + hit.explained
          }
        }
      }
      const facts = { items, explained, blocked: genre.blocked }
      return { genre: genre.id, step, ...facts, status: judgeCell(facts) }
    })
    return { genre, cells, ready: cells.filter((c) => c.status === 'ready').length }
  })

  return {
    rows,
    coverage: catalogCoverage(rows),
    genres: genreCoverage(rows),
    loadError: inv.ok ? null : `재고 집계를 못 읽었다: ${inv.error}`,
  }
}
