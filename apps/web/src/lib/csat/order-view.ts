// apps/web/src/lib/csat/order-view.ts
//
// **「새 교재 만들기」의 실측** — 준비된 자산을 전부 한 번에 읽는다.
//
// 여기서 읽는 것이 곧 사용자가 말한 "준비된 정보·분석자료" 다:
//   · 원문·문항 재고 → `textbook_shelf_inventory()` 집계표 (30분 갱신)
//   · 문제 분석      → `csat_exams`(수능/모의) · `csat_items` · `csat_item_analyses` · `csat_analysis_reviews`
//   · 플랫폼 자체 연구 → `csat_type_reports` (유형별 리포트)
//   · 시중 교재      → `docs/reports/textbook-market-*.json` (저장소 밖 코퍼스의 집계본)
//   · 브랜드·시리즈  → `SERIES_CATALOG` (정본)
//
// ⚠️ **21권 × 유형마다 조회를 던지지 않는다.** 재고는 집계표 한 번, 근거는 유형 표 한 번이다.
//   칸마다 count 를 던지던 방식이 어떻게 화면을 39초로 만들었는지는 `item-count.ts` 머리말에 있다.

import 'server-only'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SERIES_CATALOG,
  SERIES_ITEMS_PER_VOLUME,
} from '@vocaflow/library-pipeline/textbook-series-catalog'
import { MARKET_UNITS_PER_BOOK } from '@vocaflow/library-pipeline'

import { createAdminClient } from '@/lib/supabase/admin'

import { loadDcpInventory } from './item-count'
import {
  CSAT_BACKING,
  typeLabel,
  type CsatBacking,
  type OrderEvidence,
  type OrderTypeAsset,
  type OrderView,
  type OrderVolume,
} from './order-model'

/**
 * 저장소 뿌리 — `docs/reports/` 가 있는 곳까지 올라간다.
 *
 * cwd 를 상수로 가정하면 안 된다: `next dev` 는 `apps/web`, vitest 는 `apps/web`,
 * 스크립트는 뿌리에서 돈다. 셋 다 같은 파일을 읽어야 화면과 리포트가 같은 수를 말한다.
 */
function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    try {
      readFileSync(resolve(dir, 'docs/reports/textbook-market-series.json'))
      return dir
    } catch {
      const up = resolve(dir, '..')
      if (up === dir) break
      dir = up
    }
  }
  return process.cwd()
}

/** 시중 교재 집계본 — 저장소 안의 리포트 파일이다(원문은 담지 않는다). */
function readMarket(): OrderEvidence['market'] {
  const zero = {
    series: 0,
    publishers: 0,
    documents: 0,
    itemsMeasured: 0,
    index: 0,
    measuredAt: null as string | null,
  }
  try {
    const root = repoRoot()
    const series = JSON.parse(
      readFileSync(resolve(root, 'docs/reports/textbook-market-series.json'), 'utf8')
    ) as { seriesCount?: number; publisherCount?: number; documentsCounted?: number }
    const bench = JSON.parse(
      readFileSync(resolve(root, 'docs/reports/textbook-market-benchmark.json'), 'utf8')
    ) as { itemsMeasured?: number; overallIndex?: number; generatedAt?: string }
    return {
      series: series.seriesCount ?? 0,
      publishers: series.publisherCount ?? 0,
      documents: series.documentsCounted ?? 0,
      itemsMeasured: bench.itemsMeasured ?? 0,
      index: bench.overallIndex ?? 0,
      measuredAt: bench.generatedAt ?? null,
    }
  } catch {
    // 리포트가 없어도 화면은 뜬다 — **0 으로 그리되 0 이라고 말한다.** 없는 값을 지어내지 않는다.
    return zero
  }
}

export async function loadOrderView(): Promise<OrderView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [inv, types, reports, itemRows, analyses, reviews, exams, renders] = await Promise.all([
    loadDcpInventory(db),
    db.from('csat_types').select('id, name'),
    db.from('csat_type_reports').select('type_id, status'),
    // 유형별 기출 문항 수 — 802행이라 그대로 세어 접는다(집계 RPC 를 새로 만들 이유가 없다).
    db.from('csat_items').select('id, type_id'),
    // 유형별 분석 수는 문항을 거쳐야 나온다(분석 표에 type_id 가 없다). 2,234행이라 그대로 읽는다.
    db.from('csat_item_analyses').select('item_id').eq('status', 'published'),
    db.from('csat_analysis_reviews').select('id', { count: 'exact', head: true }),
    db.from('csat_exams').select('id, kind'),
    db.from('textbook_volume_renders').select('series, step'),
  ])

  const typeName = new Map<string, string>(
    ((types.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  )
  const published = new Set<string>(
    ((reports.data ?? []) as { type_id: string; status: string | null }[])
      .filter((r) => r.status === 'published')
      .map((r) => r.type_id)
  )
  const itemsByType = new Map<string, number>()
  const typeOfItem = new Map<string, string>()
  for (const r of (itemRows.data ?? []) as { id: string; type_id: string | null }[]) {
    if (!r.type_id) continue
    typeOfItem.set(r.id, r.type_id)
    itemsByType.set(r.type_id, (itemsByType.get(r.type_id) ?? 0) + 1)
  }
  const analysesByType = new Map<string, number>()
  for (const a of (analyses.data ?? []) as { item_id: string | null }[]) {
    const t = a.item_id ? typeOfItem.get(a.item_id) : undefined
    if (t) analysesByType.set(t, (analysesByType.get(t) ?? 0) + 1)
  }

  const examKind = { suneung: 0, mock: 0 }
  for (const e of (exams.data ?? []) as { kind: string | null }[]) {
    if (e.kind === 'suneung') examKind.suneung += 1
    else if (e.kind === 'mock') examKind.mock += 1
  }

  /** 「그 시리즈의 그 단이 나갔는가」 — 키가 시리즈+단이다. 단만 보면 남의 권을 센다. */
  const publishedVolumes = new Set<string>(
    ((renders.data ?? []) as { series: string | null; step: number | null }[])
      .filter((r) => r.step != null)
      .map((r) => `${r.series ?? 'reading'}|${r.step}`)
  )

  const byCell = new Map<string, { items: number; explained: number }>()
  if (inv.ok) {
    for (const c of inv.cells)
      byCell.set(`${c.type}|${c.vLevel}`, { items: c.items, explained: c.explained })
  }

  const backing = (t: keyof typeof CSAT_BACKING): CsatBacking[] =>
    (CSAT_BACKING[t] ?? []).map((id) => ({
      id,
      name: typeName.get(id) ?? id,
      items: itemsByType.get(id) ?? 0,
      analyses: analysesByType.get(id) ?? 0,
      report: published.has(id),
    }))

  const volumes: OrderVolume[] = SERIES_CATALOG.flatMap((s) =>
    s.rungs.map((rung) => {
      const assets: OrderTypeAsset[] = rung.types.map((t) => {
        let items: number | null = inv.ok ? 0 : null
        let explained: number | null = inv.ok ? 0 : null
        if (inv.ok) {
          for (const v of rung.vLevels) {
            const cell = byCell.get(`${t}|${v}`)
            if (cell) {
              items = (items ?? 0) + cell.items
              explained = (explained ?? 0) + cell.explained
            }
          }
        }
        return { type: t, label: typeLabel(t), items, explained, csat: backing(t) }
      })
      const sum = (pick: (a: OrderTypeAsset) => number | null): number | null =>
        assets.some((a) => pick(a) == null) ? null : assets.reduce((n, a) => n + (pick(a) ?? 0), 0)
      return {
        seriesId: s.id,
        brand: s.brand,
        accent: s.accent,
        step: rung.step,
        schoolBand: rung.schoolBand,
        title: rung.volumeTitle,
        recipe: rung.rationale,
        types: assets,
        items: sum((a) => a.items),
        explained: sum((a) => a.explained),
        published: publishedVolumes.has(`${s.id}|${rung.step}`),
      }
    })
  )

  return {
    volumes,
    evidence: {
      exams: examKind,
      items: (itemRows.data ?? []).length,
      analyses: (analyses.data ?? []).length,
      reviews: reviews.count ?? 0,
      typeReports: published.size,
      typeReportsTotal: typeName.size,
      market: readMarket(),
    },
    itemsPerVolume: SERIES_ITEMS_PER_VOLUME,
    // ⚠️ `.median` 이다 — 조판기(`render-volume.mjs`)의 기본값과 **같은 자리**를 읽는다.
    //   여기서 20 같은 수를 손으로 적으면 화면이 시키는 명령과 조판기가 실제로 찍는 권이
    //   달라진다(그 상수가 근거 없이 20이었던 사고는 `scorecard.ts` 머리말에 적혀 있다).
    unitsPerBook: MARKET_UNITS_PER_BOOK.median,
    inventoryAt: inv.ok ? inv.refreshedAt : null,
    loadError: inv.ok ? null : `재고를 못 읽었다: ${inv.error}`,
  }
}
