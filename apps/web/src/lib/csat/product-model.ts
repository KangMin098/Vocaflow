// apps/web/src/lib/csat/product-model.ts
//
// **제품 정본 — 「무엇을 만들 것인가」.**
//
// ── 왜 이 파일이 새로 필요한가 (2026-09-06 실측) ─────────────────────
// 교재 공장에는 공정 8칸이 있었지만 **제품이라는 개념이 없었다.** 화면은 전부
// "공장이 지금 어떤 상태인가" 를 말하고, "내가 교재 하나를 만들려면 무엇을 눌러야 하나" 에는
// 아무 데도 답하지 않았다. 관리자가 「뭘·어떻게·무엇으로」를 못 읽은 이유가 이것이다.
//
// 더 큰 것이 실측에서 나왔다:
//
//   · 시중 교재 코퍼스(94문서·5,229쪽)의 **유형은 다섯**이다 —
//     독해 60 · 기출 19 · 어휘 8 · 구문 5 · 내신 2 (`scripts/textbook-corpus/query.mjs stats`).
//   · 우리 **재고는 네 유형에 걸쳐 있다** — 독해 21.5만 · 어휘 28.8만 · 구문 15.4만 · 내신 11.3만.
//   · 그런데 **제품은 하나뿐이다** — `Vocaflow Reading` 7권(`series.ts` 의 `SERIES_BRAND`).
//
// 즉 막힌 곳은 생산이 아니라 **제품 정의**다. 어휘·구문·내신 문항을 수십만 개 만들어 두고
// 그것을 담을 책을 정의하지 않아서, 그 재고는 어느 권에도 안 실린다(집필 화면의 「사다리 밖 재고」가
// 세던 바로 그 수다). 공정을 아무리 잘 돌려도 이 칸은 안 채워진다.
//
// 그래서 **주문 격자**를 1급 개념으로 세운다: (유형 × 학령) 한 칸이 곧 한 권이고,
// 칸마다 "지금 만들 수 있나 / 못 만들면 무엇이 없나" 가 붙는다.
//
// ⚠️ 이 파일은 **순수 정의와 판정만** 담는다. 실측은 `product-view.ts` 가 붙인다.

// ⚠️ **배럴(`@vocaflow/library-pipeline`)에서 가져오면 안 된다.** 그 index 는 ingest 모듈
//    전부를 다시 내보내고, 그중 `ingest/storyweaver.ts` 가 `child_process` 를 쓴다. 이 파일은
//    클라이언트 컴포넌트(`CatalogClient`)가 값으로 읽으므로, 배럴을 건드리는 순간 webpack 이
//    그 사슬을 따라가 `Module not found: Can't resolve 'child_process'` 로 **화면이 통째로
//    500** 이 된다(실측 2026-09-06 — 이 파일을 만들자마자 그렇게 됐다).
//    `textbook-cover`·`textbook-kid-source` 가 이미 같은 이유로 서브패스를 쓴다.
import { SERIES_SPINE } from '@vocaflow/library-pipeline/textbook-series'

/* ───────────────────────── 유형(장르) ───────────────────────── */

/**
 * 시중이 실제로 파는 교재 유형 + 우리만 할 수 있는 것 하나.
 *
 * 다섯은 **코퍼스 실측**이다(문서 수를 그대로 적는다 — 이 수가 곧 "시장이 이만큼 판다" 의 근거).
 * `platform` 만 시장에 없는 칸이고, 그래서 시중 대비 우위를 논할 분모가 없다.
 */
export type Genre = 'reading' | 'vocab' | 'syntax' | 'school' | 'pastexam' | 'platform'

export interface GenreDef {
  id: Genre
  /** 화면에 쓰는 이름. 코퍼스 분류축의 이름을 그대로 쓴다 — 다른 말을 쓰면 대조가 안 된다. */
  name: string
  /** 이 유형이 답하는 학습자의 물음. 카드 부제로 쓴다. */
  question: string
  /** 코퍼스에서 이 유형으로 분류된 문서 수. `null` 은 시장에 없는 칸(우리만 하는 것). */
  marketDocs: number | null
  /**
   * 이 유형의 책이 쓰는 **우리 문항 유형**.
   *
   * 비어 있으면 그 유형은 문항으로 만들 수 없다는 뜻이다 — `pastexam` 이 그렇다.
   */
  itemTypes: readonly string[]
  /** 이 유형을 지금 팔 수 없다면 그 이유. 팔 수 있으면 null. */
  blocked: string | null
}

/**
 * ⚠️ `pastexam`(기출)은 **재고가 있어도 상품이 아니다.** `csat_items` 830문항은 평가원 저작물이라
 *   학습자 경로로 나가지 않는다(`lib/csat/client.ts` 헤더 · 통합 테스트가 지문 유출을 막는다).
 *   시중은 기출을 19문서나 팔지만 우리는 **분석만** 판다 — 그 구분을 코드가 들고 있어야
 *   누군가 "기출 재고 830" 을 보고 책을 만들려 하지 않는다.
 */
export const GENRES: readonly GenreDef[] = [
  {
    id: 'reading',
    name: '독해',
    question: '글 전체의 논지를 잡는가',
    marketDocs: 60,
    itemTypes: [
      'order',
      'insert',
      'irrelevant',
      'blank',
      'title',
      'topic',
      'main_point',
      'summary',
      'purpose',
      'mood',
      'claim',
      'implication',
      'content_match',
      'long_order',
      'long_title',
      'long_match',
      'long_vocab',
      'long_reference',
    ],
    blocked: null,
  },
  {
    id: 'vocab',
    name: '어휘',
    question: '문맥에서 낱말을 고르고 쓰는가',
    marketDocs: 8,
    itemTypes: ['vocab_choice', 'unit_vocab', 'blank_word'],
    blocked: null,
  },
  {
    id: 'syntax',
    name: '구문',
    question: '문장 구조와 어법을 다루는가',
    marketDocs: 5,
    itemTypes: ['grammar_choice', 'grammar_fix', 'unit_grammar', 'word_order'],
    blocked: null,
  },
  {
    id: 'school',
    name: '내신',
    question: '학교 본문으로 시험을 대비하는가',
    marketDocs: 2,
    itemTypes: ['unit_vocab', 'unit_grammar', 'word_order'],
    blocked: null,
  },
  {
    id: 'pastexam',
    name: '기출',
    question: '평가원 문항 그 자체를 푸는가',
    marketDocs: 19,
    itemTypes: [],
    blocked:
      '평가원 저작물이라 학습자 경로로 못 낸다 — 우리가 파는 것은 기출 **분석**이지 기출이 아니다',
  },
  {
    id: 'platform',
    name: '개인 맞춤',
    question: '내 오답과 망각 곡선으로 짜였는가',
    marketDocs: null,
    itemTypes: [],
    blocked:
      '종이가 못 하는 유일한 칸인데 **관측이 없어서 못 짠다** — 문항 시도 기록 위에서만 만들어진다',
  },
] as const

/* ───────────────────────── 한 권의 규격 ───────────────────────── */

/**
 * 한 권에 들어가는 문항 수 — **60**.
 *
 * 짐작이 아니라 조판 기록 실측이다: `textbook_volume_renders` 의 모든 행이 `units 20 · items 60`
 * 이고, 조합기 기본값도 20단원 × 3문항이다(`build-volume.mjs` `--units 20` ·
 * `compose-unit.ts` `perUnit`). 이 수가 곧 "한 칸을 채우려면 재고가 얼마나 필요한가" 의 분모다.
 */
export const ITEMS_PER_VOLUME = 60

/**
 * 한 칸(= 한 권)을 지금 낼 수 있는지의 판정.
 *
 * 순서가 있다 — **재고 → 해설 → 상품성**. 앞이 안 되면 뒤를 볼 필요가 없고,
 * 화면은 "무엇이 없어서 못 내는지" 를 그 순서로 말해야 관리자가 헛일을 안 한다.
 */
export type CellStatus =
  /** 팔 수 있다 — 문항도 해설도 찼다. */
  | 'ready'
  /** 문항은 찼는데 해설이 모자란다. 해설 없는 책은 혼자 공부할 수 없다(시중 A1 축). */
  | 'needsExplain'
  /** 문항이 모자란다. */
  | 'needsItems'
  /** 재고가 아예 없다. */
  | 'empty'
  /** 만들 수 없는 칸 — 저작권·관측 부족 등 생산과 무관한 이유. */
  | 'blocked'
  /** 못 쟀다. 0 이 아니다. */
  | 'unmeasured'

export const CELL_STATUS_KO: Record<CellStatus, { label: string; color: string }> = {
  ready: { label: '낼 수 있음', color: '#2E7D5A' },
  needsExplain: { label: '해설 모자람', color: '#B5803A' },
  needsItems: { label: '문항 모자람', color: '#B5803A' },
  empty: { label: '재고 없음', color: '#9C3A30' },
  blocked: { label: '못 냄', color: '#8A8278' },
  unmeasured: { label: '못 잼', color: '#8A8278' },
}

export interface CellFacts {
  /** 그 (유형 × 학령) 칸의 문항 수. 못 쟀으면 null. */
  items: number | null
  /** 그중 해설이 붙은 수. 못 쟀으면 null. */
  explained: number | null
  /** 생산과 무관한 차단 사유(장르에서 옴). */
  blocked: string | null
}

/**
 * 칸 하나를 판정한다.
 *
 * ⚠️ **해설은 「전부」를 요구하지 않는다.** 한 권에 60문항이 들어가므로 필요한 것은
 *   *그 권에 실을* 60개의 해설이지 재고 전체의 해설이 아니다. 전량을 요구하면
 *   재고 16만 개짜리 칸이 영원히 빨간색이 되고, 그 빨강은 아무 행동도 지시하지 않는다.
 */
export function judgeCell(f: CellFacts): CellStatus {
  if (f.blocked) return 'blocked'
  if (f.items == null || f.explained == null) return 'unmeasured'
  if (f.items === 0) return 'empty'
  if (f.items < ITEMS_PER_VOLUME) return 'needsItems'
  if (f.explained < ITEMS_PER_VOLUME) return 'needsExplain'
  return 'ready'
}

/** 격자 한 칸 — 화면이 받는 모양. */
export interface CatalogCell extends CellFacts {
  genre: Genre
  /** 학령 계단 번호(1~7). `SERIES_SPINE` 의 `step`. */
  step: number
  status: CellStatus
  /**
   * 이 칸이 **실제로 조판돼 나갔는가.**
   *
   * `status === 'ready'` 와 다르다 — ready 는 "낼 수 있다", published 는 "냈다" 다.
   * 둘의 차이가 이 화면의 요점이다: 실측 2026-09-06 에 낼 수 있는 권 24 중 조판된 것은
   * **7권(독해)뿐**이었다. 나머지 17권은 재고가 있는데 **제품으로 정의되지 않아** 안 나온 것이다.
   */
  published: boolean
}

export interface CatalogRow {
  genre: GenreDef
  cells: CatalogCell[]
  /** 이 유형에서 낼 수 있는 권 수. */
  ready: number
  /** 그중 실제로 조판돼 나간 권 수. */
  published: number
}

/** 학령 축 — 제품 격자의 가로. 사다리 정본을 그대로 쓴다(다른 눈금을 쓰면 조판과 어긋난다). */
export const STEPS = SERIES_SPINE.map((r) => ({
  step: r.step,
  schoolBand: r.schoolBand,
  vLevels: [...r.vLevels],
}))

/** 격자 전체에서 낼 수 있는 권 / 만들 수 있는 칸. 막힌 칸은 분모에서 뺀다. */
export function catalogCoverage(rows: readonly CatalogRow[]): {
  ready: number
  buildable: number
  blockedCells: number
  /** 낼 수 있는데 **안 낸** 권 — 이 화면에서 가장 행동을 부르는 수다. */
  unpublished: number
} {
  let ready = 0
  let buildable = 0
  let blockedCells = 0
  let unpublished = 0
  for (const r of rows) {
    for (const c of r.cells) {
      if (c.status === 'blocked') {
        blockedCells += 1
        continue
      }
      buildable += 1
      if (c.status === 'ready') {
        ready += 1
        if (!c.published) unpublished += 1
      }
    }
  }
  return { ready, buildable, blockedCells, unpublished }
}

/**
 * 시중 유형 커버리지 — **우리가 파는 유형 / 시장이 파는 유형.**
 *
 * 한 유형이라도 낼 수 있는 권이 하나 있으면 "그 유형을 판다" 로 센다. 시장에 없는 칸
 * (`marketDocs === null`)은 분모에서 뺀다 — 비교 대상이 없는 것을 커버리지로 세면 분모가 부푼다.
 */
export function genreCoverage(rows: readonly CatalogRow[]): { covered: number; market: number } {
  const market = rows.filter((r) => r.genre.marketDocs != null)
  return { covered: market.filter((r) => r.ready > 0).length, market: market.length }
}
