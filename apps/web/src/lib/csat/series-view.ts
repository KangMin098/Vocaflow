// apps/web/src/lib/csat/series-view.ts
//
// **카탈로그의 실측 — 시리즈 × 단계.**
//
// ⚠️ 축이 바뀌었다(2026-09-06). 예전 격자는 (유형 × 학령) 42칸이었는데 **시장이 그 축으로
//   안 판다.** 서점에 있는 것은 「독해 고1」이 아니라 「리딩튜터 주니어 Level 2」이고,
//   한 브랜드가 학령 전체를 계단으로 잇는다. 그 축을 안 쓰는 동안 화면은 만들 수 없는 책을
//   세고 있었다(헤드라인 18권 → 실제 0권).
//
// 한 칸 = **한 권**이다. 그 권이 쓰는 유형·레벨의 재고를 합쳐 「지금 찍을 수 있나」를 판정한다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SERIES_CATALOG,
  seriesShipping,
} from '@vocaflow/library-pipeline/textbook-series-catalog'

import { createAdminClient } from '@/lib/supabase/admin'

import { loadDcpInventory } from './item-count'
import {
  NOT_MAKING,
  SERIES_STEPS,
  judgeVolume,
  type SeriesCatalogView,
  type SeriesRow,
  type VolumeCell,
} from './series-model'

export async function loadSeriesCatalog(): Promise<SeriesCatalogView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [inv, renders] = await Promise.all([
    loadDcpInventory(db),
    // ⚠️ 조판 기록에 **시리즈 칸이 없다.** 지금 찍힌 권은 전부 독해라 그렇게 셀 수 있고,
    //   그것이 사실이기도 하다(어휘·구문은 draft — 한 번도 안 찍었다). 어휘를 찍기 시작하면
    //   기록에 시리즈를 남겨야 하고, 그 전까지 이 화면은 "다른 시리즈는 하나도 안 나갔다" 를
    //   정확히 말한다.
    db.from('textbook_volume_renders').select('step'),
  ])

  const publishedSteps = new Set<number>(
    ((renders.data ?? []) as { step: number | null }[])
      .map((r) => r.step)
      .filter((n): n is number => n != null),
  )

  const byCell = new Map<string, { items: number; explained: number }>()
  if (inv.ok) {
    for (const c of inv.cells) byCell.set(`${c.type}|${c.vLevel}`, { items: c.items, explained: c.explained })
  }

  const rows: SeriesRow[] = SERIES_CATALOG.map((s) => {
    const volumes: VolumeCell[] = SERIES_STEPS.map(({ step, schoolBand }) => {
      const rung = s.rungs.find((r) => r.step === step)
      if (!rung) {
        return { step, schoolBand, title: null, items: null, explained: null, status: 'noRung' as const }
      }
      let items: number | null = inv.ok ? 0 : null
      let explained: number | null = inv.ok ? 0 : null
      if (inv.ok) {
        for (const t of rung.types) {
          for (const v of rung.vLevels) {
            const cell = byCell.get(`${t}|${v}`)
            if (cell) {
              items = (items ?? 0) + cell.items
              explained = (explained ?? 0) + cell.explained
            }
          }
        }
      }
      // 조판 기록에 시리즈가 없으므로 독해만 「냈다」로 셀 수 있다 — 위 주석 참조.
      const published = s.id === 'reading' && publishedSteps.has(step)
      return {
        step,
        schoolBand,
        title: rung.volumeTitle,
        items,
        explained,
        status: judgeVolume({ hasRung: true, published, items, explained }),
      }
    })
    return {
      id: s.id,
      brand: s.brand,
      question: s.question,
      accent: s.accent,
      status: s.status,
      nextStep: s.nextStep,
      marketSeries: s.marketSeries,
      marketExamples: s.marketExamples,
      volumes,
      ready: volumes.filter((v) => v.status === 'ready').length,
      published: volumes.filter((v) => v.status === 'published').length,
      rungs: s.rungs.length,
    }
  })

  return {
    rows,
    counts: seriesShipping(),
    inventoryAt: inv.ok ? inv.refreshedAt : null,
    notMaking: NOT_MAKING,
    loadError: inv.ok ? null : `재고를 못 읽었다: ${inv.error}`,
  }
}
