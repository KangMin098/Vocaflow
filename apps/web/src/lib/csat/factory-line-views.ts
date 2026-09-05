// apps/web/src/lib/csat/factory-line-views.ts
//
// **생산 라인 네 화면의 실측** — 소재 · 집필 · 검수 · 조판.
//
// ⚠️ 집필 표는 유형 25 × 수준 9 = **225칸**이다. 다 한꺼번에 던지면 서버가 몇 개를 조용히
//   null 로 돌려준다 — 그리고 화면에서 그 빈칸은 "재고 0" 처럼 보여 관리자가 있지도 않은
//   구멍을 메우러 간다. 그래서 **동시 실행 수를 묶어** 물결로 나눠 보낸다(24칸씩 · 실측 7.2초).
//   그래도 새는 것이 있는지는 **유형별 합 == 표 전체 count** 로 확인한다.
//
// ⚠️ 해설 화면(⑥)이 여기 없는 이유: 유형별 해설 보유율은 `answer_key->>explanation_ko` 를
//   유형마다 훑어야 하는데 그 컬럼에 인덱스가 없어 한 번에 5~8초씩 걸리고, 여러 개를 같이
//   던지면 절반이 null 로 온다(실측). 서버에서 한 번에 접는 집계 RPC 가 필요하고 그것은
//   마이그레이션이라 **승인 대기**다. 그때까지 해설은 현황판의 전체 눈금으로만 본다.

import 'server-only'

import { SERIES_SPINE, brandFingerprint } from '@vocaflow/library-pipeline'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import {
  GENERATED_TYPES,
  INVENTORY_LEVELS,
  type AuthorCell,
  type AuthorView,
  type PressView,
  type PressVolumeRow,
  type ReviewLayer,
  type ReviewView,
  type ReviewVolumeRow,
  type SourceBandRow,
  type SourceView,
} from './factory-line-model'

export * from './factory-line-model'

/** 한 물결에 던지는 조회 수. 인덱스가 받는 (유형, 수준) count 는 24개까지 안전했다(실측 225칸 24물결 13.4초 → 10물결 6.5초). jsonb 를 훑는 조회는 8개만 던져도 절반이 null 이 되므로 여기서 쓰지 않는다. */
const WAVE = 24

/** 조회를 물결로 나눠 보낸다 — 전부 한꺼번에 던지면 서버가 조용히 null 을 돌려준다. */
async function inWaves<T, R>(items: T[], run: (t: T) => Promise<R>, size = WAVE): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(run))))
  }
  return out
}

/** count 한 번 — null 이면 한 번 더. 차가운 첫 호출이 빈손으로 오는 일이 있다. */
async function headCount(
  run: () => PromiseLike<{ count: number | null }>,
): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { count } = await run()
    if (count != null) return count
  }
  return null
}

/* ───────────────────────── ④ 소재 ───────────────────────── */

export async function loadSourceView(): Promise<SourceView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [cat, gates] = await Promise.all([
    db
      .from('csat_stage_catalog')
      .select('stage_band, v_level, display_only, license_class, cefr_level'),
    db.from('csat_stage_gates').select('stage'),
  ])

  const rows = (cat.data ?? []) as {
    stage_band: string | null
    v_level: number | null
    display_only: boolean | null
    license_class: string | null
    cefr_level: string | null
  }[]

  const m = new Map<string, SourceBandRow & { _lic: Set<string>; _cefr: Set<string> }>()
  for (const r of rows) {
    const band = r.stage_band ?? '미분류'
    const k = `${band}|${r.v_level}`
    const cur =
      m.get(k) ??
      {
        band,
        vLevel: r.v_level,
        count: 0,
        displayOnly: 0,
        licenseClasses: [],
        cefrLevels: [],
        _lic: new Set<string>(),
        _cefr: new Set<string>(),
      }
    cur.count += 1
    if (r.display_only) cur.displayOnly += 1
    if (r.license_class) cur._lic.add(r.license_class)
    if (r.cefr_level) cur._cefr.add(r.cefr_level)
    m.set(k, cur)
  }

  return {
    rows: [...m.values()]
      .map((r) => ({
        band: r.band,
        vLevel: r.vLevel,
        count: r.count,
        displayOnly: r.displayOnly,
        licenseClasses: [...r._lic].sort(),
        cefrLevels: [...r._cefr].sort(),
      }))
      .sort((a, b) => a.band.localeCompare(b.band) || (a.vLevel ?? 0) - (b.vLevel ?? 0)),
    gateBands: [...new Set(((gates.data ?? []) as { stage: string }[]).map((g) => g.stage))].sort(),
    loadError: cat.error
      ? `지문 재고를 못 읽었다: ${cat.error.message}`
      : gates.error
        ? `단계 게이트를 못 읽었다: ${gates.error.message}`
        : null,
  }
}

/* ───────────────────────── ⑤ 집필 ───────────────────────── */

export async function loadAuthorView(): Promise<AuthorView> {
  const db = createAdminClient() as unknown as SupabaseClient

  const specs: { type: string; vLevel: number }[] = []
  for (const t of GENERATED_TYPES) for (const v of INVENTORY_LEVELS) specs.push({ type: t, vLevel: v })

  const [counts, total] = await Promise.all([
    inWaves(specs, (s) =>
      headCount(() =>
        db
          .from('csat_dcp_items')
          .select('id', { count: 'exact', head: true })
          .eq('type', s.type)
          .eq('v_level', s.vLevel),
      ),
    ),
    headCount(() => db.from('csat_dcp_items').select('id', { count: 'exact', head: true })),
  ])

  const cells: AuthorCell[] = specs.map((s, i) => ({ ...s, count: counts[i] ?? null }))

  const ladderCells: { type: string; vLevel: number }[] = []
  for (const rung of SERIES_SPINE) {
    for (const v of rung.vLevels) for (const t of rung.types) ladderCells.push({ type: t, vLevel: v })
  }

  const summed = cells.reduce((n, c) => n + (c.count ?? 0), 0)
  const missed = total != null && summed < total ? total - summed : 0
  const unmeasured = cells.filter((c) => c.count == null).length

  // ⚠️ 합이 모자란 원인은 둘이고 **할 일이 정반대**다.
  //   · 못 센 칸이 있다 → 조회가 빈손으로 왔다. 새로고침하면 대개 맞는다.
  //   · 다 셌는데 모자란다 → **목록에 없는 유형이 있다.** 그 재고는 이 표에서 통째로 안 보이고,
  //     관리자는 있지도 않은 여유를 믿게 된다. 상수를 고쳐야 한다.
  //   한 문장으로 뭉치면 관리자가 새로고침만 하다가 낡은 목록을 못 본다.
  return {
    cells,
    total,
    ladderCells,
    loadError: !missed
      ? null
      : unmeasured
        ? `못 센 칸 ${unmeasured}개 — 표에 안 잡힌 문항 ${missed.toLocaleString()}개. 새로고침하면 대개 맞는다`
        : `유형 목록이 낡았다 — 다 셌는데도 ${missed.toLocaleString()}개가 표 밖이다. GENERATED_TYPES 를 갱신한다`,
  }
}

/* ───────────────────────── ⑦ 검수 ───────────────────────── */

type Colophon = {
  review?: {
    passageSpec?: string | null
    answerBias?: { chi2: number; cramersV: number; biased: boolean } | null
    proofread?: { passages: number; defective: number } | null
  }
}

export async function loadReviewView(): Promise<ReviewView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [renders, coverage] = await Promise.all([
    db
      .from('textbook_volume_renders')
      .select('band, volume_title, items, auto_passed, auto_total, failed_checks, colophon')
      .order('band'),
    db.rpc('csat_coverage'),
  ])

  const rows = (renders.data ?? []) as {
    band: number
    volume_title: string | null
    items: number
    auto_passed: number
    auto_total: number
    failed_checks: string[] | null
    colophon: Colophon | null
  }[]

  const volumes: ReviewVolumeRow[] = rows.map((r) => ({
    band: r.band,
    volumeTitle: r.volume_title,
    items: r.items,
    autoPassed: r.auto_passed,
    autoTotal: r.auto_total,
    failedChecks: r.failed_checks ?? [],
    // ⚠️ 옛 행에는 이 셋이 없다 — **null 로 남긴다.** 0 으로 채우면 "지적 0건" 이라는
    //   거짓말이 되고, 화면은 검수가 돌았다고 믿게 된다.
    answerBias: r.colophon?.review?.answerBias ?? null,
    proofread: r.colophon?.review?.proofread ?? null,
    passageSpec: r.colophon?.review?.passageSpec ?? null,
  }))

  const cov = (coverage.data ?? []) as { in_scope_items: number; published: number }[]
  const rendersFailed = renders.error != null

  const layers: ReviewLayer[] = [
    {
      id: 'L1',
      name: '기계 게이트',
      looksAt: '인용이 지문에 문자 그대로 있는가 · 정답이 평가원 정답표와 같은가 · 순환논법 8종 · 규칙 교정',
      passed: rendersFailed ? null : volumes.filter((v) => v.proofread != null).length,
      total: rendersFailed ? null : volumes.length,
      unmeasuredReason: rendersFailed ? `조판 기록 조회 실패: ${renders.error?.message}` : null,
      cmd: 'node scripts/csat/analysis-drain-validate.mjs',
    },
    {
      id: 'L2',
      name: '3인 페르소나',
      looksAt: '출제자 · 오답분석가 · 현장강사가 각자 읽고 전원 pass 를 줬는가 (DB 트리거가 강제)',
      passed: coverage.error ? null : cov.reduce((n, r) => n + r.published, 0),
      total: coverage.error ? null : cov.reduce((n, r) => n + r.in_scope_items, 0),
      unmeasuredReason: coverage.error ? `커버리지 RPC 실패: ${coverage.error.message}` : null,
      cmd: 'node scripts/csat/analysis-drain-import.mjs --commit',
    },
    {
      id: 'L3',
      name: '교차 대조',
      looksAt: '정답 번호가 한쪽으로 쏠렸는가(χ² 와 Cramér V 를 둘 다 넘겨야 편향) · 지문 규격',
      passed: rendersFailed ? null : volumes.filter((v) => v.answerBias != null).length,
      total: rendersFailed ? null : volumes.length,
      unmeasuredReason: rendersFailed ? '조판 기록 없음' : null,
      cmd: 'pnpm dlx tsx scripts/textbook/item-health-report.mjs',
    },
    {
      id: 'L4',
      name: '외부 대조',
      looksAt: '시중 교재 7축과 견줘 실제로 이기는가 — 안 재면 「우위」는 주장일 뿐이다',
      passed: null,
      total: null,
      unmeasuredReason: '기획 화면이 재는 축이다 — 여기서 다시 세지 않는다',
      cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher',
    },
  ]

  return {
    layers,
    volumes,
    loadError: rendersFailed ? `조판 기록 조회 실패: ${renders.error?.message}` : null,
  }
}

/* ───────────────────────── ⑧ 조판 ───────────────────────── */

export async function loadPressView(): Promise<PressView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await db
    .from('textbook_volume_renders')
    .select(
      'band, volume_title, step, school_band, units, items, explained_batch, explained_rule, ' +
        'type_mix_fit, distinct_volumes, articles_with_items, articles_idle, ' +
        'brand_fingerprint, render_count, rendered_at, out_path',
    )
    .order('band')

  const current = brandFingerprint()
  const rows = (data ?? []) as unknown as {
    band: number
    volume_title: string | null
    step: number | null
    school_band: string | null
    units: number
    items: number
    explained_batch: number
    explained_rule: number
    type_mix_fit: string | number | null
    distinct_volumes: number | null
    articles_with_items: number | null
    articles_idle: number | null
    brand_fingerprint: string | null
    render_count: number
    rendered_at: string | null
    out_path: string | null
  }[]

  const volumes: PressVolumeRow[] = rows.map((r) => ({
    band: r.band,
    volumeTitle: r.volume_title,
    step: r.step,
    schoolBand: r.school_band,
    units: r.units,
    items: r.items,
    missingExplanations: r.items - r.explained_batch - r.explained_rule,
    typeMixFit: r.type_mix_fit == null ? null : Number(r.type_mix_fit),
    distinctVolumes: r.distinct_volumes,
    articlesWithItems: r.articles_with_items,
    articlesIdle: r.articles_idle,
    brandCurrent: r.brand_fingerprint === current,
    renderCount: r.render_count,
    renderedAt: r.rendered_at,
    outPath: r.out_path,
  }))

  return {
    volumes,
    rungs: SERIES_SPINE.length,
    brandFingerprint: current,
    loadError: error ? `조판 기록 조회 실패: ${error.message}` : null,
  }
}
