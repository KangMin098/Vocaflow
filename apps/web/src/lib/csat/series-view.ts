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

import { SERIES_TYPE_LABEL_KO } from '@vocaflow/library-pipeline/textbook-series'
import { brandFingerprint } from '@vocaflow/library-pipeline/textbook-brand'
import {
  SCHOOL_SERIES_BLOCKED,
  SERIES_CATALOG,
  seriesDefined,
} from '@vocaflow/library-pipeline/textbook-series-catalog'
import {
  judgeLifecycle,
  nextActionOf,
  seriesGaps,
} from '@vocaflow/library-pipeline/textbook-series-lifecycle'

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
    // 시리즈마다 자기 기록을 갖는다 — 마이그레이션 `textbook_volume_renders_series` 가
    // `(series, band)` 복합 키를 넣기 전에는 `band` 하나로 키를 잡아 어휘 권이 독해 기록을
    // 덮었다(실측 2026-09-06 에 band 5 를 그렇게 잃었다).
    db.from('textbook_volume_renders').select('series, step, brand_fingerprint'),
  ])

  // ⚠️ 조판 기록을 **못 읽은 것**과 **한 권도 없는 것**은 다르다. 앞의 것을 0 으로 세면
  //   화면이 「아직 안 찍었네」로 읽고, 그것이 이 파일이 2026-09-06 에 이미 겪은 사고다.
  const rendersRead = !renders.error
  const renderRows = ((renders.data ?? []) as {
    series: string | null
    step: number | null
    brand_fingerprint: string | null
  }[]).filter((r) => r.step != null)

  /** 「그 시리즈의 그 단이 나갔는가」 — 키가 시리즈+단이다. 단만 보면 남의 권을 센다. */
  const publishedKeys = new Set<string>(
    renderRows.map((r) => `${r.series ?? 'reading'}|${r.step}`),
  )

  // 지금 규격의 지문. 이것과 다른 지문으로 찍힌 권은 **나갔지만 낡은 권**이고,
  // 그 시리즈의 생애는 출고가 아니라 개정이다.
  const fingerprintNow = brandFingerprint()
  const staleBySeries = new Map<string, number>()
  for (const r of renderRows) {
    const id = r.series ?? 'reading'
    if (r.brand_fingerprint !== fingerprintNow) staleBySeries.set(id, (staleBySeries.get(id) ?? 0) + 1)
  }

  const byCell = new Map<string, { items: number; explained: number }>()
  if (inv.ok) {
    for (const c of inv.cells) byCell.set(`${c.type}|${c.vLevel}`, { items: c.items, explained: c.explained })
  }

  const rows: SeriesRow[] = SERIES_CATALOG.map((s) => {
    const volumes: VolumeCell[] = SERIES_STEPS.map(({ step, schoolBand }) => {
      const rung = s.rungs.find((r) => r.step === step)
      if (!rung) {
        return {
          step,
          schoolBand,
          title: null,
          items: null,
          explained: null,
          status: 'noRung' as const,
          types: [],
          recipe: null,
        }
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
      const published = publishedKeys.has(`${s.id}|${step}`)
      return {
        step,
        schoolBand,
        title: rung.volumeTitle,
        items,
        explained,
        // 이름표는 정본에서 온다 — 화면이 유형 이름을 다시 지으면 조판물과 갈린다.
        types: rung.types.map((t) => SERIES_TYPE_LABEL_KO[t] ?? t),
        recipe: rung.rationale,
        status: judgeVolume({ hasRung: true, published, items, explained }),
      }
    })
    const publishedCount = volumes.filter((v) => v.status === 'published').length
    const readyCount = volumes.filter((v) => v.status === 'ready').length
    const stale = rendersRead ? (staleBySeries.get(s.id) ?? 0) : null
    // ⚠️ **「팔고 있나」는 상수가 아니라 사실이다.** 카탈로그의 뜻(`intent`)은 정의 시점의
    //   값이라 찍고 나면 낡는다 — 실측 2026-09-06 에 어휘·구문 12권을 찍었는데도 화면이
    //   「한 번도 안 찍은 시리즈 2개」라고 적었다. 생애는 기록에서 파생한다.
    const lifecycle = judgeLifecycle({
      intent: s.intent,
      rungs: s.rungs.length,
      publishedVolumes: rendersRead ? publishedCount : null,
      readyVolumes: inv.ok ? readyCount : null,
      staleVolumes: stale,
    })
    return {
      id: s.id,
      brand: s.brand,
      question: s.question,
      accent: s.accent,
      lifecycle,
      intent: s.intent,
      origin: s.origin,
      nextAction: nextActionOf(lifecycle, {
        readyVolumes: inv.ok ? readyCount : null,
        staleVolumes: stale,
        seriesId: s.id,
      }),
      stale,
      marketSeries: s.marketSeries,
      marketExamples: s.marketExamples,
      volumes,
      ready: readyCount,
      published: publishedCount,
      rungs: s.rungs.length,
    }
  })

  return {
    rows,
    // 분모(시장 22)는 코퍼스 실측이고, 분자는 **조판 기록**이다 — 정의만 해 둔 시리즈를
    // 「판다」로 세면 그 수가 거짓이 된다.
    counts: {
      ...seriesDefined(),
      shipping: rows.filter((r) => r.lifecycle === 'shipping' || r.lifecycle === 'revising')
        .length,
    },
    // 다음 유형의 후보 — 못 만드는 칸은 그 이유와 함께 적는다(빈칸으로 두면 「잊은 것」처럼 읽힌다).
    gaps: seriesGaps(SERIES_CATALOG, { school: SCHOOL_SERIES_BLOCKED }),
    inventoryAt: inv.ok ? inv.refreshedAt : null,
    notMaking: NOT_MAKING,
    loadError: inv.ok ? null : `재고를 못 읽었다: ${inv.error}`,
  }
}
