// apps/web/src/lib/csat/product-view.ts
//
// **제품 격자 실측** — (유형 × 학령) 칸마다 "지금 이 권을 낼 수 있나".
//
// 한 번의 집계(`loadDcpInventory()` → `textbook_shelf_inventory()` 집계표)로 (문항유형 ×
// V-Level) 재고를 받아, 장르 정의가 말하는
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
  hasProductLine,
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
  const [inv, renders] = await Promise.all([
    loadDcpInventory(db),
    // ⚠️ 조판 기록에 **유형 칸이 없다.** 지금 찍힌 7권은 전부 `Vocaflow Reading`(독해)이므로
    //   step 만 보고 독해로 센다. 어휘·구문·내신을 찍기 시작하면 기록에 유형을 남겨야 하고,
    //   그 전까지 이 화면은 "다른 유형은 하나도 안 찍혔다" 를 정확히 말한다(사실이다).
    db.from('textbook_volume_renders').select('step'),
  ])
  const publishedSteps = new Set<number>(
    ((renders.data ?? []) as { step: number | null }[])
      .map((r) => r.step)
      .filter((n): n is number => n != null),
  )

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
      // 제품 라인 유무는 재고와 무관하다 — 사다리에서 계산해 붙인다.
      const facts = {
        items,
        explained,
        blocked: genre.blocked,
        hasProductLine: hasProductLine(genre.id, step),
      }
      // **한 밴드의 권은 하나다.** 사다리 한 단이 유형을 섞어 한 권을 내므로, 그 단의 권이
      // 나왔고 그 권이 이 유형을 담는다면 이 유형은 **이미 인쇄돼 나간 것**이다.
      //
      // ⚠️ 예전에는 `genre.id === 'reading'` 으로만 셌다. 그러면 어휘·구문·내신 칸이
      //   「낼 수 있는데 안 냈다」로 잡히는데, 그 칸을 찍으려 해도 **새로 나올 권이 없다** —
      //   그 밴드의 권은 이미 나왔고 그 안에 이 유형이 들어 있다. 실측 2026-09-06 에 그렇게
      //   센 탓에 헤드라인이 「찍기만 하면 되는 책 14권」이라고 적었다(그 전에는 18권).
      const published = publishedSteps.has(step) && facts.hasProductLine
      return { genre: genre.id, step, ...facts, status: judgeCell(facts), published }
    })
    const ready = cells.filter((c) => c.status === 'ready')
    return { genre, cells, ready: ready.length, published: ready.filter((c) => c.published).length }
  })

  return {
    rows,
    coverage: catalogCoverage(rows),
    genres: genreCoverage(rows),
    loadError: inv.ok ? null : `재고 집계를 못 읽었다: ${inv.error}`,
  }
}
