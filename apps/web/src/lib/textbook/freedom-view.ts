// apps/web/src/lib/textbook/freedom-view.ts
//
// **자유도를 화면 몫으로 — 새 데이터 원천을 만들지 않는다.**
//
// ── 재고는 어디서 오나 (2026-09-16 에 바뀌었다) ──────────────────────
// 처음에는 `type-inventory-snapshot.json`(사람이 스캔을 돌려야 갱신되는 저장소 파일)을 읽었다.
// 감사 실측(2026-09-16): 그 파일은 **841,826문항**을 말하는데 같은 화면의 공정 ⑤·⑥은 DB 집계표
// (`textbook_shelf_inventory_mv` · 30분 갱신)로 **880,247문항**을 말했다. 차이 38,421 중 수준
// 불일치는 1,779 · 댕글링 0 · 책 문항 808 이고 **나머지는 스캔 뒤에 쓰인 문항**이었다 — 낡음이다.
// 한 화면 안에서 위 패널과 아래 공정이 **다른 시점의 재고**를 보고 있었다.
//
// 그래서 **재고는 공정 ⑤·⑥과 같은 집계표에서** 받고(`freedom-load.ts`), **배합은 `rungMix` 에서
// 직접** 계산한다 — 배합은 DB 값이 아니라 시중 실측에서 유도한 규격이라 스냅샷에 담아 둘 이유가
// 없다. 계산식은 스캔(`scripts/textbook/type-inventory-scan.mjs`)과 같게 옮겼다.
// 산수는 여전히 패키지(`freedom.ts`)에 있고, **이 파일은 순수 함수다**(DB 를 부르지 않는다).
//
// ── 무엇을 말하려고 있나 ────────────────────────────────────────────
// 현황판(`production-stages.ts`)은 밴드마다 **60문항 한 권**을 재고 7/7 초록을 띄운다.
// 그 판정은 "한 권을 낼 수 있는가" 에만 맞다. 한 권이 초록이어도 **두 권째가 불가능**할 수
// 있고, 실측이 바로 그랬다(2026-09-15: V2·V7 은 겹치지 않는 권을 딱 하나씩).
// 현황판은 한 권만 보므로 이것을 구조적으로 못 본다. 이 화면 몫이 그 사각을 채운다.

import {
  ITEMS_PER_UNIT,
  bandFreedom,
  freedomIndex,
  rungMix,
  type BandFreedom,
  type FreedomCell,
  type FreedomIndex,
} from '@vocaflow/library-pipeline'

/**
 * 단일유형 특강 한 권의 문항 수.
 *
 * ⚠️ **근거 없이 정하면 목표가 아니라 짐작이 된다.** 시중 유형별 특강(수능 빈칸 특강 류)은
 *   20~40문항대가 흔하고, 우리 조판 단위는 단원당 6문항이다(`ITEMS_PER_UNIT`).
 *   30 은 그 교집합에서 고른 수다 — 5단원 한 권. 이 값을 바꾸면 화면의 분자가 바뀌므로
 *   바꾼 이유를 여기 적는다.
 */
export const SOLO_SIZE = 30

/**
 * 혼합권 한 권의 문항 수 — **스캔과 같은 값**이어야 두 계산이 같은 권 수를 낸다.
 * 정본은 조판기의 기본 `--units 20`(`build-volume.mjs`) × 단원 6문항.
 */
export const ITEMS_PER_VOLUME = 20 * ITEMS_PER_UNIT

/** 학년 사다리 — `rungMix` 가 목표를 갖는 밴드. 스캔의 `BANDS` 와 같다. */
export const FREEDOM_BANDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * 사전의 순수 함수 3종 — **DB 문항이 아니다**(`factory.ts` 의 `PURE_FUNCTION_TYPES` 와 같은 뜻).
 *
 * ⚠️ 집계표에는 이 셋이 없다. 배합에 넣은 채 재고를 집계표에서 받으면 초등 칸이 **거짓 0** 이
 *   된다. 자유도 지수는 이해형만 보므로 결과는 안 바뀌지만, 없는 구멍을 계산에 태우지 않으려고
 *   배합에서 뺀다 — 이 셋을 재는 곳은 스캔(`tallyElementary`)이다.
 */
const PURE_FUNCTION_TYPES: ReadonlySet<string> = new Set(['rhyme', 'word_meaning', 'spell_blank'])

/**
 * **시장이 교재를 고르는 기준이 되는 이해·추론형.**
 *
 * ⚠️ 기계 변환형(`blank_word` · `grammar_fix` · `unit_vocab` …)을 섞어 세면 자유도가
 *   좋아 **보인다** — 그쪽은 재고가 수만이라 어느 밴드든 통과하기 때문이다. 그런데 시중이
 *   유형별 특강으로 파는 것도, 수능이 묻는 것도 이 열하나다. 섞으면 지수가 실제 능력보다
 *   높게 나오고, 그 수를 보고는 아무도 구멍을 메우러 가지 않는다.
 *   정본은 `order-model.ts` 의 `CSAT_BACKING` 에서 평가원 대응이 있는 유형들이다.
 */
export const COMPREHENSION_TYPES: readonly string[] = [
  'title',
  'topic',
  'blank',
  'content_match',
  'main_point',
  'purpose',
  'mood',
  'summary',
  'claim',
  'implication',
  'long_reference',
]

export interface SnapType {
  type: string
  items: number
  needPerVolume: number
}
export interface SnapBand {
  vLevel: number
  /** **목표 배합**의 유형들 — 배합에 없는 유형은 재고가 있어도 여기 없다. */
  types: SnapType[]
  /**
   * **실재고** — 배합과 무관하게 그 밴드에 실제로 있는 (유형 → 문항 수).
   *
   * 없으면 `undefined` 이고, 그때는 **못 쟀다**로 다뤄야 한다 — `types` 로 대신하면 배합 밖
   * 유형이 0 으로 찍혀 "만들어야 할 것" 과 "이 권이 안 쓰는 것" 이 뒤섞인다.
   */
  stock?: { type: string; items: number }[]
  /** 스캔이 스스로 계산해 둔 권 수. 라이브 재고로 만든 밴드는 같은 식으로 여기서 계산한다. */
  volumes: number
  bindingType: string | null
}

/** 집계표 한 칸 — `item-count.ts` 의 `DcpInventoryCell` 과 같은 모양(필요한 열만). */
export interface InventoryCellLike {
  type: string
  vLevel: number
  items: number
}

/**
 * 집계표 칸 → 밴드 7개.
 *
 * 배합은 `rungMix(v).targetShare` 에서, 권당 필요 수는 스캔과 **같은 식**
 * (`max(1, round(ITEMS_PER_VOLUME × 비중))`)으로, 권 수는 **가장 얇은 유형**이 정한다.
 */
export function bandsFromInventory(cells: readonly InventoryCellLike[]): SnapBand[] {
  return FREEDOM_BANDS.map((v) => {
    const here = cells.filter((c) => c.vLevel === v)
    const stockOf = new Map(here.map((c) => [c.type, c.items]))
    const types: SnapType[] = Object.entries(rungMix(v).targetShare)
      .filter(([type]) => !PURE_FUNCTION_TYPES.has(type))
      .map(([type, share]) => ({
        type,
        items: stockOf.get(type) ?? 0,
        needPerVolume: Math.max(1, Math.round(ITEMS_PER_VOLUME * share)),
      }))
    const binding = types.reduce<{ type: string; volumes: number } | null>((worst, t) => {
      const volumes = Math.floor(t.items / t.needPerVolume)
      return worst == null || volumes < worst.volumes ? { type: t.type, volumes } : worst
    }, null)
    return {
      vLevel: v,
      types,
      stock: here.map((c) => ({ type: c.type, items: c.items })).sort((a, b) => b.items - a.items),
      volumes: binding ? binding.volumes : 0,
      bindingType: binding ? binding.type : null,
    }
  })
}

/**
 * 그 밴드의 칸들 — **재고는 `stock`, 배합은 `types`** 에서 온다.
 *
 * ⚠️ 두 출처를 섞지 않는 것이 이 함수의 전부다. `types` 는 목표 배합이라 배합 밖 유형이
 *   빠져 있고, 그것을 재고로 읽으면 있는 문항을 0 으로 센다(실측 2026-09-15: V3 의
 *   `main_point` 16문항이 0 으로 찍혀 화면이 "하나도 없다" 고 말했다).
 *   `stock` 이 없으면 **못 쟀다(`null`)** 로 둔다 — 0 이라고 지어내지 않는다.
 */
export function cellsOf(
  band: SnapBand,
  types: readonly string[] = COMPREHENSION_TYPES,
): FreedomCell[] {
  const mix = new Map(band.types.map((t) => [t.type, t]))
  const stock = band.stock ? new Map(band.stock.map((s) => [s.type, s.items])) : null
  return types.map((type) => ({
    type,
    // 집계표는 전 유형을 담으므로, `stock` 이 있는데 그 유형이 없으면 진짜 0 이다.
    items: stock ? (stock.get(type) ?? 0) : null,
    needPerVolume: mix.get(type)?.needPerVolume ?? 0,
  }))
}

/**
 * 그 밴드가 **이해·추론형을 쓰기로 한 밴드인가.**
 *
 * ⚠️ 초등 저학년(V1)은 배합이 `rhyme` · `word_meaning` · `spell_blank` 셋뿐이다 —
 *   수능 빈칸추론을 안 내는 것이 **설계**지 구멍이 아니다. 그런데 이해형 11종으로 재면
 *   V1 이 `0/11` 로 찍히고, 지수는 29.9% 가 된다(V2~V7 만 보면 34.8%). 그 5%p 는
 *   "초1용 수능 빈칸추론이 없다" 는 뜻이라 **아무도 메워서는 안 되는 구멍**이다.
 *   없는 일을 할 일 목록에 올리지 않으려고 범위를 명시한다.
 */
export const usesComprehension = (band: SnapBand): boolean =>
  band.types.some((t) => COMPREHENSION_TYPES.includes(t.type) && t.needPerVolume > 0)

export interface FreedomView {
  /** 재고를 잰 시각 — 집계표 갱신 시각. 못 읽었으면 null. */
  measuredAt: string | null
  soloSize: number
  index: FreedomIndex
  /** 이해형을 안 쓰는 밴드 — 지수 분모에서 뺀 이유를 화면이 말해야 한다. */
  outOfScope: number[]
  /**
   * 밴드가 스스로 들고 온 권 수와 패키지 계산(`bandFreedom`)이 갈리는 밴드. 비어 있어야 정상이다.
   * 두 계산은 같은 입력에서 같은 수를 내야 한다 — 갈리면 식 하나가 틀린 것이다.
   */
  drift: { vLevel: number; snapshot: number; ours: number | null }[]
  /** 재고를 못 읽었을 때만. 그때 지수는 빈 밴드로 서고 화면이 이유를 적는다. */
  loadError: string | null
}

/**
 * 밴드 → 자유도. **순수 함수** — 재고는 인자로 받는다.
 *
 * ⚠️ **두 계산을 대조한다.** 밴드는 자기 `volumes` 를 이미 갖고 있으므로(스캔 또는
 *   `bandsFromInventory`), 같은 입력에서 패키지 계산이 같은 수를 내야 한다. 갈리면 둘 중
 *   하나가 틀린 것이고 그 사실이 화면에 떠야 한다 — 조용히 다른 수를 말하는 것이 최악이다.
 *   (대조는 **배합 전체** 기준이다. 자유도 지수는 이해형만 보지만 `volumes` 는 배합 전체의 수다.)
 */
export function buildFreedomView(
  bands: readonly SnapBand[],
  measuredAt: string | null,
  loadError: string | null = null,
): FreedomView {
  const inScope = bands.filter(usesComprehension)
  const measured: BandFreedom[] = inScope.map((b) => bandFreedom(b.vLevel, cellsOf(b), SOLO_SIZE))
  const outOfScope = bands.filter((b) => !usesComprehension(b)).map((b) => b.vLevel)
  const drift: FreedomView['drift'] = []
  for (const b of bands) {
    // 배합이 비면(라이브 V1 — 순수 함수 3종만 쓰는 밴드) 대조할 것이 없다. 패키지는 그때
    // `null` 을, 밴드는 `0` 을 들고 있어 **거짓 경보**가 난다 — 실측으로 확인한 자리다.
    if (!b.types.length) continue
    const all = bandFreedom(
      b.vLevel,
      cellsOf(
        b,
        b.types.map((t) => t.type),
      ),
      SOLO_SIZE,
    )
    if (all.mix.volumes !== b.volumes) {
      drift.push({ vLevel: b.vLevel, snapshot: b.volumes, ours: all.mix.volumes })
    }
  }
  return {
    measuredAt,
    soloSize: SOLO_SIZE,
    index: freedomIndex(measured, SOLO_SIZE),
    outOfScope,
    drift,
    loadError,
  }
}
