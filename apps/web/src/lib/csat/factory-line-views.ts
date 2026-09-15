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
import { VOLUME_FONTS, brandSpecRows } from '@vocaflow/library-pipeline/textbook-brand'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import { loadDcpInventory } from './item-count'

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
} from './factory-line-model'

export * from './factory-line-model'

/* ───────────────────────── ④ 소재 ───────────────────────── */
//
// **여기 있던 `loadSourceView` 는 2026-09-15 에 지웠다 — 틀린 것을 세고 있었다.**
//
// `csat_stage_catalog` 는 테이블이 아니라 **뷰**이고 양쪽 갈래가 다 `status = published` 로
// 걸려 있다. 그래서 이 함수가 「지문 재고」라 부르며 세던 562편은 **이미 학습자에게 나간 것**
// 이었고, 조판이 실제로 고르는 풀(실측 2026-09-13: 87,556편)의 0.6% 였다. 두 화면(④ 소재 ·
// 현황판)이 그 수를 근거로 「재료가 없다」고 말해 왔다.
//
// 지금은 `lib/csat/source-console.ts` 의 `loadSourceConsole()` 이 6시간 스냅샷에서 읽는다 —
// 집계는 DB(`csat_source_rollup()`)가 하고, 밴드 접기는 `source-rollup.ts` §6 이 한 벌로 갖는다.
// 출고분(562)은 없어지지 않았다. **이름만 정직해졌다**(콘솔의 `published`).

/* ───────────────────────── ⑤ 집필 ───────────────────────── */

export async function loadAuthorView(): Promise<AuthorView> {
  const db = createAdminClient() as unknown as SupabaseClient

  const specs: { type: string; vLevel: number }[] = []
  for (const t of GENERATED_TYPES) for (const v of INVENTORY_LEVELS) specs.push({ type: t, vLevel: v })

  // ⚠️ 예전에는 이 225칸을 **칸마다 따로 세었다**(15초 예산 안에 못 들어오면 남은 칸은
  //   「못 잼」). 실제로 예산을 넘겨 29~133칸이 회색으로 남는 일이 잦았고, 그때마다 화면은
  //   있지도 않은 구멍을 가리켰다. 전수 count 로 총계를 내는 길도 막혀 있었다 —
  //   필터 없는 count 는 이 표에서 50초 뒤 빈손으로 온다(실측 2026-09-05 · 세 번 연속).
  //
  //   2026-09-06 — **이미 있던 집계표**(`textbook_shelf_inventory_mv` · 30분 갱신)가
  //   같은 (유형 × 수준) 칸을 통째로 준다. 조회 **1회 · 1.2초**(실측)로 225회를 대신하고,
  //   예산을 넘겨 회색으로 남는 칸이 없다.
  //
  //   낡음 감시(총계 vs 칸 합)는 그래서 의미를 잃었다 — 둘이 같은 출처라 자기 자신과
  //   비교하는 셈이다. 대신 **집계표가 언제 갱신됐는지**를 화면이 말한다(`refreshedAt`).
  const inventory = await loadDcpInventory(db)
  const byCell = new Map<string, number>()
  if (inventory.ok) {
    for (const c of inventory.cells) byCell.set(`${c.type}|${c.vLevel}`, c.items)
  }
  // 집계표에 없는 칸은 **0**이다 — group by 결과라 재고가 0인 칸은 행 자체가 없다.
  // 못 읽었을 때만 null 로 남긴다(0 과 「못 잼」을 가른다).
  const cells: AuthorCell[] = specs.map((s) => ({
    ...s,
    count: inventory.ok ? (byCell.get(`${s.type}|${s.vLevel}`) ?? 0) : null,
  }))

  const ladderCells: { type: string; vLevel: number }[] = []
  for (const rung of SERIES_SPINE) {
    for (const v of rung.vLevels) for (const t of rung.types) ladderCells.push({ type: t, vLevel: v })
  }

  const summed = cells.reduce((n, c) => n + (c.count ?? 0), 0)
  const unmeasured = cells.filter((c) => c.count == null).length
  // ── 「목록이 낡았나」 검사는 은퇴했다 (2026-09-06) ─────────────────
  // 플래너 통계(`reltuples`)를 제3의 수로 삼아 칸 합과 견주던 검사가 있었다. 집계표로 옮긴
  // 뒤로는 그 비교가 뜻을 잃는다 — 집계표가 칸을 **전부** 주므로 합과의 차이는 오차가 아니라
  // **사다리 밖 재고**(정상)다. 남겨 두면 늘 경보가 울리고, 늘 울리는 경보는 아무도 안 본다.
  // 목록이 낡았는지는 통합 테스트가 유형 축을 직접 대조해 잡는다.

  // ⚠️ 원인이 둘이고 **할 일이 정반대**다.
  //   · 못 센 칸이 있다 → 조회가 빈손으로 왔다. 새로고침하면 대개 맞는다.
  //   · 다 셌는데 모자란다 → **목록에 없는 유형이 있다.** 그 재고는 이 표에서 통째로 안 보이고,
  //     관리자는 있지도 않은 여유를 믿게 된다. 상수를 고쳐야 한다.
  //   한 문장으로 뭉치면 관리자가 새로고침만 하다가 낡은 목록을 못 본다.
  return {
    cells,
    // **칸을 더한 값이 총계다** — 전수 count 는 이 표에서 못 쓴다. 칸이 하나라도 빈손이면
    // 그만큼 모자란 값이므로, 그때는 총계를 내지 않는다(모자란 수를 정확한 총계로 내밀면 안 된다).
    total: unmeasured ? null : summed,
    ladderCells,
    loadError: unmeasured
      ? `집계표를 못 읽었다 — ${inventory.ok ? '' : inventory.error}. 총계는 내지 않는다 (모자란 수를 정확한 값처럼 내밀지 않기 위해서다)`
      : null,
    // 30분마다 갱신되는 집계표라 **지금 값이 아닐 수 있다.** 드레인 직후 "왜 안 늘었지" 로
    // 읽히지 않도록 화면이 시점을 말한다.
    inventoryAt: inventory.ok ? inventory.refreshedAt : null,
  }
}

/* ───────────────────────── ⑦ 검수 ───────────────────────── */

type Colophon = {
  review?: {
    passageSpec?: string | null
    answerBias?: { chi2: number; cramersV: number; biased: boolean } | null
    proofread?: { passages: number; defective: number } | null
    /** 조판기가 잰 3인 페르소나 검수(`render-volume.mjs`). 옛 행에는 없다. */
    personaReview?: { quorum: number; items: number; passed: number; settled: number | null } | null
  }
}

export async function loadReviewView(): Promise<ReviewView> {
  const db = createAdminClient() as unknown as SupabaseClient
  // ⚠️ 기출 커버리지 RPC(csat_coverage)를 더 이상 부르지 않는다 — 이 화면은 **교재** 검수를
  //   말하는 자리이고, 그 RPC 는 기출 분석을 센다. 부르는 것만으로 「그 수가 여기 쓰인다」는
  //   오해가 생긴다(실측 2026-09-13: 실제로 L2 가 그것을 세고 있었다).
  const renders = await db
    .from('textbook_volume_renders')
    .select('band, volume_title, items, auto_passed, auto_total, failed_checks, colophon')
    .order('band')

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
    personaReview: r.colophon?.review?.personaReview ?? null,
  }))

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
    // ── L2 는 **교재 문항**을 센다 ─────────────────────────────────────
    //
    // ⚠️ 이 층은 오래 **다른 표**를 세고 있었다(실측 2026-09-13). `csat_coverage()` 는
    //   `csat_item_analyses` — 학습자에게 가지 않는 **기출 분석**이다. 그 쪽은 3인 검수를
    //   6,702행 받았고, 학습자가 실제로 받는 교재 문항은 **0건**이었다. 그런데 이 눈금은
    //   기출 수를 읽어 초록이었다 — 그래서 교재 쪽 구멍을 아무도 못 봤다
    //   (`publish-gate.ts` 머리 주석이 기록한 그 사고다).
    //
    // 세는 곳은 조판기 하나다. 화면은 **그 권이 조판될 때 잰 값**을 읽을 뿐 다시 세지
    // 않는다 — 어느 문항이 그 권에 실렸는지는 조판기만 알기 때문이다.
    (() => {
      const measured = volumes.filter((v) => v.personaReview != null)
      const anyRender = volumes.length > 0
      return {
        id: 'L2' as const,
        name: '3인 페르소나',
        looksAt:
          '출제자 · 오답분석가 · 현장강사가 각자 읽고 전원 pass 를 줬는가 — **교재 문항** 기준(기출 분석이 아니다)',
        passed: measured.length ? measured.reduce((n, v) => n + (v.personaReview?.passed ?? 0), 0) : null,
        total: measured.length ? measured.reduce((n, v) => n + (v.personaReview?.items ?? 0), 0) : null,
        unmeasuredReason: measured.length
          ? null
          : anyRender
            ? '조판 기록에 검수 실측이 없다 — 이 눈금이 붙기 전에 찍힌 권이다. 다시 조판하면 채워진다'
            : '조판된 권이 없다',
        cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/item-review-drain-export.mjs --band 5',
      }
    })(),
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
    brand: { rows: brandSpecRows(), fonts: VOLUME_FONTS },
    loadError: error ? `조판 기록 조회 실패: ${error.message}` : null,
  }
}
