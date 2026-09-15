// apps/web/src/lib/textbook/freedom-view.ts
//
// **자유도를 화면 몫으로 — 새 데이터 원천을 만들지 않는다.**
//
// ── 왜 스캔을 새로 안 짓나 ──────────────────────────────────────────
// 자유도는 (밴드 × 유형) 재고와 배합만 있으면 나오는데, 그 둘은 **이미 스냅샷에 있다**
// (`type-inventory-snapshot.json` · `type-inventory-scan.mjs` 가 굽는다). 스캔을 하나 더
// 지으면 같은 표를 두 번 세게 되고, 두 수가 갈리는 날 화면이 어느 쪽을 말하는지 알 수 없다.
// (이 저장소는 어수 창에서 이미 그 일을 겪었다 — 뽑는 자와 싣는 자가 달랐다.)
//
// 그래서 이 파일은 **읽어서 옮기기만** 한다. 산수는 패키지(`freedom.ts`)에 있고 시험이 붙어 있다.
//
// ── 무엇을 말하려고 있나 ────────────────────────────────────────────
// 현황판(`production-stages.ts`)은 밴드마다 **60문항 한 권**을 재고 7/7 초록을 띄운다.
// 그 판정은 "한 권을 낼 수 있는가" 에만 맞다. 한 권이 초록이어도 **두 권째가 불가능**할 수
// 있고, 실측이 바로 그랬다(2026-09-15: V2·V7 은 겹치지 않는 권을 딱 하나씩).
// 현황판은 한 권만 보므로 이것을 구조적으로 못 본다. 이 화면 몫이 그 사각을 채운다.

import {
  bandFreedom,
  freedomIndex,
  type BandFreedom,
  type FreedomCell,
  type FreedomIndex,
} from '@vocaflow/library-pipeline'

import raw from './type-inventory-snapshot.json'

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

interface SnapType {
  type: string
  items: number
  needPerVolume: number
}
interface SnapBand {
  vLevel: number
  /** **목표 배합**의 유형들 — 배합에 없는 유형은 재고가 있어도 여기 없다. */
  types: SnapType[]
  /**
   * **실재고** — 배합과 무관하게 그 밴드에 실제로 있는 (유형 → 문항 수).
   *
   * ⚠️ 낡은 스냅샷에는 이 열이 없다(2026-09-15 에 생겼다). 없으면 `undefined` 이고,
   *   그때는 **못 쟀다**로 다뤄야 한다 — `types` 로 대신하면 배합 밖 유형이 0 으로 찍혀
   *   "만들어야 할 것" 과 "이 권이 안 쓰는 것" 이 뒤섞인다.
   */
  stock?: { type: string; items: number; articles: number }[]
  volumes: number
  bindingType: string | null
}
interface Snapshot {
  measuredAt: string
  bands: SnapBand[]
}

const snap = raw as unknown as Snapshot

/**
 * 그 밴드의 칸들 — **재고는 `stock`, 배합은 `types`** 에서 온다.
 *
 * ⚠️ 두 출처를 섞지 않는 것이 이 함수의 전부다. `types` 는 목표 배합이라 배합 밖 유형이
 *   빠져 있고, 그것을 재고로 읽으면 있는 문항을 0 으로 센다(실측 2026-09-15: V3 의
 *   `main_point` 16문항이 0 으로 찍혀 화면이 "하나도 없다" 고 말했다).
 *   `stock` 이 없는 낡은 스냅샷에서는 **못 쟀다(`null`)** 로 둔다 — 0 이라고 지어내지 않는다.
 */
export function cellsOf(
  band: SnapBand,
  types: readonly string[] = COMPREHENSION_TYPES,
): FreedomCell[] {
  const mix = new Map(band.types.map((t) => [t.type, t]))
  const stock = band.stock ? new Map(band.stock.map((s) => [s.type, s.items])) : null
  return types.map((type) => ({
    type,
    // 스캔은 전 유형을 훑으므로, `stock` 이 있는데 그 유형이 없으면 진짜 0 이다.
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
  measuredAt: string
  soloSize: number
  index: FreedomIndex
  /** 이해형을 안 쓰는 밴드 — 지수 분모에서 뺀 이유를 화면이 말해야 한다. */
  outOfScope: number[]
  /** 스냅샷이 스스로 계산한 권 수와 우리 계산이 갈리는 밴드. 비어 있어야 정상이다. */
  drift: { vLevel: number; snapshot: number; ours: number | null }[]
}

/**
 * 스냅샷 → 자유도.
 *
 * ⚠️ **스냅샷과 대조한다.** 스냅샷은 자기 `volumes` 를 이미 갖고 있으므로, 같은 입력에서
 *   같은 수가 나와야 한다. 갈리면 둘 중 하나가 틀린 것이고 그 사실이 화면에 떠야 한다 —
 *   조용히 다른 수를 말하는 것이 최악이다.
 *   (대조는 **전 유형** 기준이다. 자유도 지수는 이해형만 보지만, 스냅샷의 `volumes` 는
 *   배합 전체를 보고 낸 수이기 때문이다.)
 */
export function buildFreedomView(): FreedomView {
  const inScope = snap.bands.filter(usesComprehension)
  const bands: BandFreedom[] = inScope.map((b) => bandFreedom(b.vLevel, cellsOf(b), SOLO_SIZE))
  const outOfScope = snap.bands.filter((b) => !usesComprehension(b)).map((b) => b.vLevel)
  const drift: FreedomView['drift'] = []
  for (const b of snap.bands) {
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
    measuredAt: snap.measuredAt,
    soloSize: SOLO_SIZE,
    index: freedomIndex(bands, SOLO_SIZE),
    outOfScope,
    drift,
  }
}
