// apps/web/src/lib/textbook/console-stats.ts
//
// **교재(TBP) 콘솔 집계 — 사다리 · 문항 건강 · 평가 우위를 한 번에 읽는다.**
//
// ── 왜 한 곳에 모으나 ────────────────────────────────────────────────
// 교재 파이프라인의 상태는 지금까지 **스크립트 일곱 개를 따로 돌려야** 보였다
// (`series-report` · `item-health-report` · `evaluation-report` · 유형별 수율 프로브 넷).
// 관리자가 "지금 어디가 막혔나" 를 묻는 자리는 하나인데 답이 일곱 군데에 흩어져 있으면
// 아무도 안 본다 — 이 저장소는 그 사고를 이미 겪었다(잠긴 화면을 아무도 안 봐서 이틀간
// 결함이 남아 있었다).
//
// ⚠️ **없는 것을 0 으로 뭉개지 않는다.** `head:true` 카운트 요청은 없는 테이블에도
//   204/count=null 을 돌려주므로 `count ?? 0` 은 "미처리 0건" 이라는 거짓 안심을 만든다.
//   여기서는 오류를 그대로 올려 화면이 이유를 말하게 한다.

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  EVAL_DIMENSIONS,
  SERIES_BRAND,
  SERIES_SPINE,
  VOLUME_FONTS,
  assessAnswerBias,
  brandFingerprint,
  brandSpecRows,
  measureEvaluation,
  measureSeriesFill,
  type BrandSpecRow,
  type EvalReport,
  type SeriesItemType,
  type SeriesFill,
} from '@vocaflow/library-pipeline'

import { createAdminClient } from '@/lib/supabase/admin'

/** 유형별 저장 문항 — 콘솔 첫 줄. */
export interface TypeRow {
  type: string
  count: number
  /** 정답 번호가 균등한가. 답지가 없는 유형(단답)이면 null. */
  answerBiased: boolean | null
  chi2: number | null
}

/**
 * 조판된 한 권 — `textbook_volume_renders` 한 행을 화면이 읽을 모양으로.
 *
 * ⚠️ 수치를 여기서 다시 계산하지 않는다. 조판기가 찍은 그 값이어야
 *   화면과 손에 쥔 책이 같은 것을 말한다.
 */
export interface VolumeRender {
  band: number
  volumeTitle: string
  step: number | null
  schoolBand: string | null
  units: number
  items: number
  autoPassed: number
  autoTotal: number
  failedChecks: string[]
  /** 해설이 안 붙은 문항 수. 0 이 아니면 해설 드레인을 더 돌려야 한다. */
  missingExplanations: number
  /** 시중 밀도 대비 유형-학년 적합도(0~1). 못 쟀으면 null — 0 으로 뭉개지 않는다. */
  typeMixFit: number | null
  /** 겹치지 않게 줄 수 있는 권수. 원글을 안 쓰는 권(초등 3종)은 null — 원글 재고가 상한이 아니다. */
  distinctVolumes: number | null
  /** 조판 당시 브랜드 규격의 지문. */
  brandFingerprint: string
  /** 현재 규격과 같은가. false 면 그 권은 옛 팔레트·서체로 찍혀 있다. */
  brandCurrent: boolean
  renderCount: number
  renderedAt: string
}

/**
 * 브랜딩 관측면 — **코드에만 있던 규격을 화면으로 끌어올린다.**
 *
 * 2026-08-30 까지 브랜딩(팔레트·서체·판권면)은 패키지 상수였고 조판 결과는 로컬
 * HTML 파일이라 admin 이 읽을 것이 하나도 없었다. 규격은 여기서 읽고(순수 함수),
 * 실제로 그 규격으로 찍혔는지는 조판 기록의 지문이 답한다.
 */
export interface BrandPanel {
  /** 시리즈 이름 — `SERIES_BRAND` 하나에서 온다. */
  brand: string
  /** 지금 규격의 지문. 조판 기록의 값과 대조한다. */
  fingerprint: string
  palette: BrandSpecRow[]
  fonts: { english: string; body: string; mono: string }
  /** 권별 최신 조판. 아직 안 찍은 권은 여기 없다 — 없는 것을 0 으로 만들지 않는다. */
  renders: VolumeRender[]
  /** 옛 규격으로 찍힌 권 = 재조판 대상. */
  staleBands: number[]
  /** 조판 기록 조회가 깨졌을 때 그 이유(표를 비우는 대신 말한다). */
  renderError: string | null
}

export interface TextbookConsoleStats {
  /** 저장 문항 총수. */
  totalItems: number
  byType: TypeRow[]
  series: SeriesFill
  evaluation: EvalReport
  /** 학습자 관측 수 — 0 이면 난이도·변별도를 못 낸다. */
  observations: number
  /** 브랜딩 규격 + 조판 기록. */
  brand: BrandPanel
  /** 조회가 깨졌을 때 그 이유. 화면이 빈 표 대신 이것을 말한다. */
  loadError: string | null
}

/** 저장 형식에 정답 번호가 있는 유형만 쏠림을 잰다. */
const ANSWER_IN_PAYLOAD = new Set(['irrelevant', 'vocab_choice', 'grammar_choice'])
const CHOICES = 5

/** 조판 기록 한 행의 원형. 컬럼 이름은 `textbook_volume_renders` 그대로다. */
interface RenderRow {
  band: number
  volume_title: string
  step: number | null
  school_band: string | null
  units: number
  items: number
  auto_passed: number
  auto_total: number
  failed_checks: string[] | null
  explained_batch: number
  explained_rule: number
  type_mix_fit: number | string | null
  distinct_volumes: number | null
  brand_fingerprint: string
  render_count: number
  rendered_at: string
}

/**
 * 규격은 코드에서, 조판 여부는 DB 에서.
 *
 * ⚠️ 표가 비어도 그것을 "조판 0권" 으로 단정하지 않는다 — 조회가 깨졌을 수도 있고,
 *   그 둘은 관리자가 할 일이 완전히 다르다(조판하기 vs 마이그레이션 확인하기).
 */
async function getBrandPanel(
  db: ReturnType<typeof createAdminClient>,
): Promise<BrandPanel> {
  const current = brandFingerprint()
  const base: BrandPanel = {
    brand: SERIES_BRAND,
    fingerprint: current,
    palette: brandSpecRows(),
    fonts: {
      english: VOLUME_FONTS.english,
      body: VOLUME_FONTS.body,
      mono: VOLUME_FONTS.mono,
    },
    renders: [],
    staleBands: [],
    renderError: null,
  }

  // `textbook_volume_renders` 는 `packages/types` 의 생성 타입에 아직 없다
  // (`pnpm db:types` 를 돌리면 들어온다). 저장소의 기존 방식대로 느슨한 클라이언트로
  // 조회하고, **행의 모양은 위 `RenderRow` 가 진다** — 타입을 잃지 않기 위해서다.
  const loose = db as unknown as SupabaseClient

  const { data, error } = await loose
    .from('textbook_volume_renders')
    .select(
      'band, volume_title, step, school_band, units, items, auto_passed, auto_total, ' +
        'failed_checks, explained_batch, explained_rule, type_mix_fit, distinct_volumes, ' +
        'brand_fingerprint, render_count, rendered_at',
    )
    .order('band')
  if (error) return { ...base, renderError: `조판 기록 조회 실패: ${error.message}` }

  const renders: VolumeRender[] = ((data ?? []) as unknown as RenderRow[]).map((r) => ({
    band: r.band,
    volumeTitle: r.volume_title,
    step: r.step,
    schoolBand: r.school_band,
    units: r.units,
    items: r.items,
    autoPassed: r.auto_passed,
    autoTotal: r.auto_total,
    failedChecks: r.failed_checks ?? [],
    missingExplanations: r.items - r.explained_batch - r.explained_rule,
    typeMixFit: r.type_mix_fit == null ? null : Number(r.type_mix_fit),
    distinctVolumes: r.distinct_volumes,
    brandFingerprint: r.brand_fingerprint,
    brandCurrent: r.brand_fingerprint === current,
    renderCount: r.render_count,
    renderedAt: r.rendered_at,
  }))

  return {
    ...base,
    renders,
    staleBands: renders.filter((r) => !r.brandCurrent).map((r) => r.band),
  }
}

export async function getTextbookConsoleStats(): Promise<TextbookConsoleStats> {
  const empty: TextbookConsoleStats = {
    totalItems: 0,
    byType: [],
    series: measureSeriesFill([]),
    evaluation: measureEvaluation(EVAL_DIMENSIONS),
    observations: 0,
    brand: {
      brand: SERIES_BRAND,
      fingerprint: brandFingerprint(),
      palette: brandSpecRows(),
      fonts: { english: VOLUME_FONTS.english, body: VOLUME_FONTS.body, mono: VOLUME_FONTS.mono },
      renders: [],
      staleBands: [],
      renderError: null,
    },
    loadError: null,
  }

  const db = createAdminClient()
  // 규격은 순수 함수라 항상 나온다 — 문항 조회가 깨져도 브랜드 표는 살아 있어야 한다.
  const brand = await getBrandPanel(db)

  // 1,000행 조용한 절단에 두 번 당한 저장소다 — 페이지로 받는다.
  const rows: { type: string; v_level: number | null; answer_key: unknown }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('csat_dcp_items')
      .select('type, v_level, answer_key')
      .order('id')
      .range(from, from + 999)
    if (error) return { ...empty, brand, loadError: `문항 조회 실패: ${error.message}` }
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }

  const counts = new Map<string, number>()
  const answers = new Map<string, number[]>()
  const inventory: { type: SeriesItemType; vLevel: number | null; count: number }[] = []
  const invKey = new Map<string, number>()

  for (const r of rows) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    const k = `${r.type}|${r.v_level}`
    invKey.set(k, (invKey.get(k) ?? 0) + 1)
    if (!ANSWER_IN_PAYLOAD.has(r.type)) continue
    const pos = (r.answer_key as { position?: number } | null)?.position
    if (typeof pos !== 'number' || pos < 1 || pos > CHOICES) continue
    const arr = answers.get(r.type) ?? new Array(CHOICES).fill(0)
    arr[pos - 1]! += 1
    answers.set(r.type, arr)
  }

  for (const [k, count] of invKey) {
    const [type, v] = k.split('|')
    inventory.push({
      type: type as SeriesItemType,
      vLevel: v === 'null' ? null : Number(v),
      count,
    })
  }

  const byType: TypeRow[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const hist = answers.get(type)
      if (!hist) return { type, count, answerBiased: null, chi2: null }
      const bias = assessAnswerBias(hist)
      return { type, count, answerBiased: bias.biased, chi2: bias.chi2 }
    })

  // 관측 — 0 이면 그 사실 자체가 정보다(평가·개정 단계가 반쪽이라는 뜻).
  const { count: attempts, error: aErr } = await db
    .from('csat_item_attempts')
    .select('id', { count: 'exact', head: true })
  if (aErr) return { ...empty, brand, loadError: `관측 조회 실패: ${aErr.message}` }

  return {
    totalItems: rows.length,
    byType,
    // ⚠️ 초등 3종은 DB 에 없다(사전의 순수 함수) — 여기 사다리는 **저장 문항 기준**이라
    //   초등 계단이 비어 보인다. 전체 수율은 `series-report` 스크립트가 낸다.
    series: measureSeriesFill(inventory, SERIES_SPINE),
    evaluation: measureEvaluation(EVAL_DIMENSIONS),
    observations: attempts ?? 0,
    brand,
    loadError: null,
  }
}
