// packages/library-pipeline/src/textbook/compose-unit.ts
//
// **독해 교재 단원을 풀에서 조합한다.** 문항 자체가 지문이다.
//
// ── Cycle 1 의 정의가 틀렸다 (실측 2026-08-21) ───────────────────────
// 처음엔 "지문 1편 + 그 지문에서 순서 3 + 삽입 2" 로 잡았다. 산술적으로 불가능했다:
//
//   교재 지문 길이(120~250어) 구간의 글 5편 · **편당 최대 문항 2개**
//   길이 게이트를 넣자 38단원 → 0단원
//
// 원인은 단순하다. DCP 는 4~6문장 문단마다 문항을 만들고, 그런 문단 하나가 60~120어다.
// 250어 안에 그런 문단 3개를 넣을 수 없다.
//
// **실제 수능도 그렇게 하지 않는다** — 순서 문항과 삽입 문항은 각각 **독립 지문**이다.
// 그리고 DCP 문항의 payload 에 이미 그 지문이 들어 있다(`presented` · `remaining`).
//
//   order   379문항 · 평균 4.8문장 · **중앙값 114어** (p10 64 · p90 186)
//   insert  379문항 · 평균 3.8문장 · 중앙값 114어
//
// 수능 순서·삽입 지문이 대략 100~130어다. **문항이 곧 수능 규격 지문이다.**
// 그래서 단원은 "지문에서 뽑는" 것이 아니라 **"풀에서 고르는"** 것이다.

import { type UnitVocab, pickVocabulary } from './assemble-unit'
import {
  CSAT_INSERT_BODY,
  hasArticleChrome,
  hasCitationResidue,
  hasUnbalancedParens,
} from './csat-format'
import { V_TO_MARKET_BUCKET } from './level-chart'
import marketSpec from './market-spec.json'

export type UnitItemType = 'order' | 'insert'

/** 풀에 담긴 문항 하나. 문항 자체가 지문을 품고 있다. */
export interface PoolItem {
  id: string
  type: UnitItemType
  /** 이 문항이 나온 원글. **한 단원 안에서는 서로 달라야 한다.** */
  ref_id: string
  ref_title: string
  v_level: number | null
  /** 문항이 품은 지문. 인용 잔해 검사에 쓴다. */
  passage_text: string
  /** 문항이 품은 지문의 낱말 수. */
  passage_words: number
  /**
   * 문항이 품은 지문의 문장 수.
   *
   * **삽입은 5~9문장이어야 자리 5곳을 고를 수 있다.** 4문장 이하는 자리가 모자라
   * 실전과 다른 형식(①~③)을 연습시키게 된다. 지문이 길면 자리를 골라 쓴다.
   */
  body_sentences: number
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
}

export interface Unit {
  no: number
  band: number
  items: PoolItem[]
  vocabulary: UnitVocab[]
  estimated_minutes: number
  /** 출처. PD·CC 라도 밝힌다 — 교재에 실을 때 필요하다. */
  sources: string[]
}

export interface ComposeResult {
  units: Unit[]
  /** 왜 더 못 만들었는지. 조용히 짧은 권을 내지 않는다. */
  stoppedBecause: string | null
  /** 규격 밖이라 쓰지 않은 문항 수 — 유형별. */
  rejected: {
    tooShort: number
    tooLong: number
    wrongFormat: number
    residue: number
    chrome: number
    /** 인용 안에서 잘려 나온 조각 — 괄호 짝이 안 맞는다. */
    cutFragment: number
    outOfRung: number
  }
  /** 시장 비중을 못 지키고 양보한 횟수. targetShare 를 줬을 때만 0 이 아니다. */
  mixRelaxed: { repeatedType: number; overQuota: number }
}

/**
 * 수능 순서·삽입 지문의 길이 범위.
 *
 * 실측 중앙값 114어 · p10 64 · p90 186. 하한 90 은 **64어짜리를 걸러내기 위한 것**이다 —
 * 4문장 미만으로 읽히면 순서를 맞출 단서가 부족해 찍기가 된다.
 * 상한 200 은 수능 지문 상단(약 130어)에 여유를 둔 값이다.
 */
export const CSAT_ITEM_WORDS = { min: 90, max: 200 } as const

/**
 * **장문(43~45)의 지문 길이 범위 — 다른 자다.**
 *
 * 수능 장문은 지문 하나가 300어 안팎이고 거기에 순서·지칭·일치 세 문항이 붙는다.
 * 짧은 지문의 창(90~200어)을 그대로 대면 장문이 **전량 "너무 길다" 로 걸린다** —
 * 규격 위반이 아니라 **다른 규격**인데 한 자로 재고 있었던 것이다.
 *
 * 집필 규격이 300~340어(문단 4 × 6문장)이므로 앞뒤로 여유를 둔다.
 */
export const CSAT_LONG_ITEM_WORDS = { min: 260, max: 400 } as const

/**
 * 장문 묶음 유형 — 위 긴 창을 쓴다.
 *
 * 셋이 **한 지문에서 나온다**(수능 장문 (2) 43~45번). 그래서 한 단원에 셋이 함께 실려야
 * 시험지와 같은 모양이 되는데, 지금 조합기는 "같은 원글은 단원당 하나" 규칙을 쓴다 —
 * 그 규칙을 장문에 그대로 대면 셋 중 하나만 실린다. **묶음 배치는 아직 안 만들었다**(다음 단계).
 */
export const LONG_ITEM_TYPES = new Set([
  // 장문 ② 서사문 (43~45) — 한 이야기에서 셋이 나온다.
  'long_order',
  'long_reference',
  'long_match',
  // 장문 ① 설명문 (41~42) — 한 설명문에서 둘이 나온다. 창은 같다(260~400어).
  'long_title',
  'long_vocab',
])

/**
 * 학교 시험 축 — **지문 한 문단**이면 되는 유형(중등 내신).
 *
 * 수능 창(90~200어)을 그대로 대면 이 유형은 전량 걸린다. 실제로 그래서 13,351문항이
 * 어느 권에도 못 실리고 DB 에만 있었다 — 만든 것과 실리는 것은 다르다.
 */
export const SCHOOL_PARAGRAPH_TYPES = new Set([
  'unit_vocab', 'unit_grammar', 'grammar_choice', 'vocab_choice',
])
/** **문장 하나**면 되는 유형 — 빈칸 쓰기 · 어법 고치기 · 영작 배열. */
export const SCHOOL_SENTENCE_TYPES = new Set(['blank_word', 'grammar_fix', 'word_order'])
export const SCHOOL_ITEM_TYPES = new Set([...SCHOOL_PARAGRAPH_TYPES, ...SCHOOL_SENTENCE_TYPES])

/** 문단 유형의 창 — `middle-choice.ts` 의 생성 규격(40~120어)에 여유를 둔 값. */
export const SCHOOL_PARAGRAPH_WORDS = { min: 40, max: 200 } as const
/** 문장 유형의 창 — `middle-short.ts` 의 `MIDDLE_SENTENCE_WORDS`(6~25어)에 여유를 둔 값. */
export const SCHOOL_SENTENCE_WORDS = { min: 6, max: 40 } as const

/**
 * 초등 저학년 3종 — **지문이 없다.** 사전 낱말 하나가 문항 하나다.
 *
 * 길이 자를 대면 전량 걸린다(지문이 0어다). 그래서 창을 열어 둔다 —
 * 규격을 안 재는 것이 아니라 **잴 지문이 없는 유형**이다.
 */
export const ELEMENTARY_ITEM_TYPES = new Set(['rhyme', 'word_meaning', 'spell_blank'])
export const NO_PASSAGE_WORDS = { min: 0, max: Number.MAX_SAFE_INTEGER } as const

/**
 * 이 문항이 재야 할 지문 길이 범위. **유형이 창을 정하고, 학년이 그것을 좁힌다.**
 *
 * ── 왜 `band` 를 받는가 (실측 2026-08-31) ────────────────────────────
 * 처음에는 유형만 봤다. 그래서 중1 권과 고3 권이 **같은 창(90~200어)** 을 썼다.
 * 시중 교재는 그렇지 않다 — 학년대별 실측 p10~p90 이 이만큼 다르다:
 *
 *   초6  44~125      중1  46~152      고1  47~242      고2  43~188
 *
 * 결과: 조립기가 통과시킨 지문이 **그 학년 시중 규격 밖**이었다. 밴드를 전수로 재고서야
 * 보였다 — A6(지문 어수 규격 적합률)가 6밴드 중 5밴드에서 미달이고, **고1(V5)만 100%** 였다.
 * 고1의 시중 창(47~242)이 조립기 창(90~200)을 통째로 품어서 우연히 맞았던 것이다.
 *
 *   V2 61.9%  V3 58.4%  V4 51.1%  **V5 100%**  V6 76.8%  V7 75.3%
 *
 * ⚠️ **한 밴드만 재면 이 결함은 안 보인다.** V5 만 보고 "규격 100%" 라고 적을 뻔했다.
 *
 * 좁히지 않는 유형이 둘이다:
 *  · 장문(43~45) — 시장 분포의 **꼬리** 자체다(고1 최대 354어). p90 으로 자르면 전량 걸린다.
 *  · 문장 단위·초등 3종 — 잴 지문이 없거나 한 문장이라 학년 창의 하한(43~47어)에 못 미친다.
 *    (벤치마크 A6 도 같은 이유로 이 유형들을 모집단에서 뺀다.)
 *
 * 교차 결과가 비면 유형 창을 그대로 쓴다 — 좁히려다 **재료를 0 으로 만들지 않는다.**
 */
export function itemWordSpec(type: string, band?: number | null): { min: number; max: number } {
  if (ELEMENTARY_ITEM_TYPES.has(type)) return NO_PASSAGE_WORDS
  if (LONG_ITEM_TYPES.has(type)) return CSAT_LONG_ITEM_WORDS
  if (SCHOOL_SENTENCE_TYPES.has(type)) return SCHOOL_SENTENCE_WORDS
  const base = SCHOOL_PARAGRAPH_TYPES.has(type) ? SCHOOL_PARAGRAPH_WORDS : CSAT_ITEM_WORDS

  const grade = band == null ? null : marketPassageWindow(band)
  if (!grade) return base
  const min = Math.max(base.min, grade.min)
  const max = Math.min(base.max, grade.max)
  return min < max ? { min, max } : base
}

/**
 * 시중 교재의 그 학년대 지문 어수 창(p10~p90). 없으면 null.
 *
 * 표를 여기서 다시 만들지 않는다 — `level-chart.ts` 의 `V_TO_MARKET_BUCKET` 이 정본이고
 * 벤치마크의 `V_TO_BUCKET` 과 같은 내용이다. 셋이 갈리면 조판과 채점이 다른 자를 쓰게 된다.
 */
function marketPassageWindow(band: number): { min: number; max: number } | null {
  const bucket = V_TO_MARKET_BUCKET[band]
  if (!bucket) return null
  const w = (marketSpec.passageWords as Record<string, { words?: Record<string, number> } | undefined>)[
    bucket
  ]?.words
  const lo = w?.p10
  const hi = w?.p90
  return typeof lo === 'number' && typeof hi === 'number' && lo < hi ? { min: lo, max: hi } : null
}

/** 단원 기본 구성 — 순서 2 + 삽입 2. 실제 수능 배점 비율과 같다. */
export const DEFAULT_SLOTS = { order: 2, insert: 2 } as const

/**
 * 한 단원에 덧붙일 생성형 문항 수.
 *
 * 뼈대 4문항 + 생성형 2문항 = 6문항이 한 단원이 된다. 시중 교재 한 단원도 대개 5~8문항이다.
 * **0 으로 두면 예전과 똑같이 동작한다** — 생성형이 없는 밴드는 자동으로 그렇게 된다.
 */
export const DEFAULT_EXTRA_PER_UNIT = 2

/**
 * 지문 하나를 통째로 묻는 생성형 유형.
 *
 * `csat_dcp_items.type` 값이다. `csat-types.ts` 의 키(`gist`)와 다를 수 있어 둘 다 담는다 —
 * 요지가 실제로 `gist` ↔ `main_point` 로 갈려 있었다.
 */
export const EXTRA_ITEM_TYPES = new Set([
  'gist',
  'main_point',
  'topic',
  'title',
  'blank',
  'purpose',
  'claim',
  'mood',
  'implication',
  'summary',
  'content_match',
  // 흐름 무관(35번). ⚠️ 이 목록과 `volume-pool.EXTRA_TYPES` **둘 다**에 빠져 있어
  //   1,479문항이 만들어지고도 어느 권에도 실리지 못했다(실측 2026-08-31:
  //   V5 519 · V6 624 · V7 312 · V4 22 · V2 1 · V3 1). 유형 정의·라벨·해설·생성기는
  //   모두 있었다 — 없던 것은 이 한 줄이다. 같은 실패가 이 파일에서 세 번째다.
  'irrelevant',
  // 장문 묶음(43~45). 위 유형들과 달리 **긴 창**을 쓴다(`itemWordSpec`).
  ...LONG_ITEM_TYPES,
])

/**
 * 한 낱말이 한 권에서 실릴 수 있는 최대 횟수.
 *
 * 1(=완전 금지)로 두면 뒤 단원의 어휘가 마른다(실측: 20단원 중 2개가 **0개**).
 * 2로 두는 근거는 둘이다 — ① 학습원칙 2(Spaced Repetition)상 재등장이 오히려 맞고
 * ② 실질 재고가 필요량의 9배가 되어 마르지 않는다(1,844×2 vs 400).
 */
export const MAX_WORD_APPEARANCES = 2

/** 문항 1개 소요(분). 지문을 읽고 순서를 맞춰야 해서 짧지 않다. */
export const MINUTES_PER_ITEM = 3
/** 어휘 1개 소요(분). */
export const MINUTES_PER_VOCAB = 0.25

export interface ComposeOptions {
  band: number
  /** 만들 단원 수. 재료가 모자라면 만들 수 있는 만큼만 만들고 사유를 남긴다. */
  unitCount?: number
  slots?: { order: number; insert: number }
  vocabCount?: number
  /**
   * 단원마다 덧붙일 생성형 문항 수(요지·주제·제목·빈칸 …).
   *
   * 뼈대를 바꾸지 않고 뒤에 얹는다 — 있으면 더 싣고 없으면 그대로다.
   * 그래야 이 유형이 아직 없는 밴드의 권이 후퇴하지 않는다.
   */
  extraPerUnit?: number
  /**
   * 이 권이 쓸 수 있는 문항 유형 — `SERIES_SPINE` 의 단수별 `types`.
   *
   * ⚠️ **유형은 난이도가 아니라 학년의 신분증이다.** 시중 79종 실측(`market-spec.json`
   * `typeDensity`)에서 순서·삽입은 중등 쪽당 0.4~1.0%, 고등 3% 대다. 초등은 0 이다.
   * 이 갈래가 없던 동안 V3(중1-2) 권 120문항 중 **80문항이 수능 순서·삽입**이었다 —
   * 재고에 그것밖에 없어서였지, 그 학년 교재라서가 아니었다.
   *
   * 주지 않으면 예전과 똑같이 동작한다(전 유형 허용).
   */
  allowedTypes?: readonly string[]
  /**
   * 유형별 목표 비중(합 1) — `rungMix()` 가 시장 밀도에서 유도한 값.
   *
   * 주면 **뼈대/덧붙임 이분법을 쓰지 않는다.** 권 전체 문항 수에 비중을 곱해 유형별
   * 몫을 정하고(최대잉여법), 단원을 돌며 그 몫에서 뽑는다. 이분법으로는 비중을
   * 정수 칸으로 바꾸는 순간 작은 유형이 0 으로 눌린다 — 실제로 `order` 11%가
   * 0칸이 됐다. 비중을 지키려면 배분도 비중으로 해야 한다.
   */
  targetShare?: Record<string, number>
  /** 한 단원의 문항 수. `targetShare` 를 줄 때만 쓴다. */
  itemsPerUnit?: number
}

/**
 * 비중을 정수 몫으로 나눈다 — **최대잉여법**.
 *
 * 단순 반올림은 합이 안 맞고 작은 유형을 0 으로 만든다. 잉여가 큰 순으로 남은 몫을
 * 하나씩 준다. 같은 잉여면 유형 이름 순 — 재실행해도 같은 결과가 나와야 한다.
 */
export function largestRemainder(
  share: Record<string, number>,
  total: number,
): Record<string, number> {
  const entries = Object.entries(share).filter(([, v]) => v > 0)
  const sum = entries.reduce((a, [, v]) => a + v, 0)
  if (sum <= 0 || total <= 0) return {}
  const raw = entries.map(([t, v]) => ({ t, exact: (v / sum) * total }))
  const out: Record<string, number> = {}
  let assigned = 0
  for (const r of raw) {
    const floor = Math.floor(r.exact)
    out[r.t] = floor
    assigned += floor
  }
  const rest = [...raw].sort(
    (x, y) => (y.exact - Math.floor(y.exact)) - (x.exact - Math.floor(x.exact)) || x.t.localeCompare(y.t),
  )
  for (let i = 0; assigned < total && i < rest.length * 2; i += 1) {
    const r = rest[i % rest.length]
    if (!r) break
    out[r.t] = (out[r.t] ?? 0) + 1
    assigned += 1
  }
  return out
}

/**
 * 풀에서 단원을 조합한다.
 *
 * 규칙 셋이 전부다:
 *   ① 문항 지문이 수능 규격 길이일 것
 *   ② **한 단원 안의 문항은 서로 다른 원글에서** 올 것
 *   ③ 어휘는 그 단원이 쓴 원글들에서, 학습자 밴드 ±1 우선
 *
 * ②가 핵심이다. 우리 풀은 원글이 적고 문항이 많다(V6 은 17편에서 168문항).
 * 이 규칙이 없으면 한 단원의 네 문항이 전부 같은 글에서 나와, 학습자가 같은 소재를
 * 네 번 읽는다 — 문항 수는 채워지지만 교재로는 실패다.
 */
export function composeUnits(
  pool: ReadonlyArray<PoolItem>,
  vocabByRef: ReadonlyMap<string, ReadonlyArray<UnitVocab>>,
  options: ComposeOptions,
): ComposeResult {
  // 사다리 단수가 순서·삽입을 안 쓰면 뼈대 칸도 0 이어야 한다 —
  // 그러지 않으면 "재료 부족" 으로 권이 통째로 안 나온다.
  const allowedSet = options.allowedTypes ? new Set(options.allowedTypes) : null
  const baseSlots = options.slots ?? DEFAULT_SLOTS
  const slots = allowedSet
    ? {
        order: allowedSet.has('order') ? baseSlots.order : 0,
        insert: allowedSet.has('insert') ? baseSlots.insert : 0,
      }
    : baseSlots
  // 뼈대가 비면 단원이 통째로 빈다 — 그때는 덧붙임이 단원을 채운다.
  const skeletonSize = slots.order + slots.insert
  const wantExtra = options.extraPerUnit
    ?? (skeletonSize === 0 ? 6 : DEFAULT_EXTRA_PER_UNIT)
  const wantUnits = options.unitCount ?? 20
  const wantVocab = options.vocabCount ?? 20

  let tooShort = 0
  let tooLong = 0
  let wrongFormat = 0
  let residue = 0
  let chrome = 0
  let cutFragment = 0
  let outOfRung = 0
  // 사다리 단수가 쓰는 유형만 남긴다. 주지 않으면 전 유형 허용(예전 동작).
  const allowed = allowedSet
  const fit = pool.filter((p) => {
    if (allowed && !allowed.has(p.type)) {
      outOfRung++
      return false
    }
    // 유형이 창을 정하고 **학년이 그것을 좁힌다** — 장문은 300어가 정상이고, 짧은 지문의
    // 자로 재면 전량 걸린다. 밴드를 안 넘기면 중1 권이 고3 창을 쓴다(`itemWordSpec` 주석).
    const spec = itemWordSpec(p.type, options.band)
    if (p.passage_words < spec.min) {
      tooShort++
      return false
    }
    if (p.passage_words > spec.max) {
      tooLong++
      return false
    }
    // 수능 인쇄 형식으로 바꿀 수 없는 것은 여기서 뺀다 — 조합한 뒤에 발견하면
    //   단원에 "변환 불가" 자리가 생기고, 그건 교재로 나갈 수 없다.
    // ⚠️ 문단 규격은 **뼈대 유형에만** 적용한다. 생성형 유형은 지문 하나를 통째로 묻기 때문에
    //   "삽입 자리 5곳" 이나 "(A)(B)(C) 세 덩어리" 같은 조건이 성립하지 않는다.
    //   여기서 같은 자를 대면 멀쩡한 문항이 전량 걸린다.
    if (
      p.type === 'insert' &&
      (p.body_sentences < CSAT_INSERT_BODY.min || p.body_sentences > CSAT_INSERT_BODY.max)
    ) {
      wrongFormat++
      return false
    }
    if (p.type === 'order' && p.body_sentences < 4) {
      wrongFormat++
      return false
    }
    // 학술 인용 잔해(`[]`·`[12]`)가 있으면 교재에 인쇄될 수 없다.
    //   실측 758개 중 64개(8.4%) — 전부 PLOS 논문이었다.
    //   초등 3종은 사전에서 나와 논문 잔해가 있을 수 없다 — 검사 대상이 아니다.
    if (!ELEMENTARY_ITEM_TYPES.has(p.type) && hasCitationResidue(p.passage_text)) {
      residue++
      return false
    }
    // 기사 껍데기("Abstract" · "Methods" 같은 절 이름, 바이라인, 저작권 줄)가 남은 지문은
    // 교재에 실을 수 없다. 판정은 `hasArticleChrome()` 하나이고 드레인 적재기도 그걸 쓴다.
    //
    // ⚠️ **게이트가 적재 쪽에만 있었다.** 손으로 쓰는 드레인은 막았지만 학교 축은
    //   `store-new-types.mjs` 가 만들어 그 문을 안 지난다 — 실측 2026-08-31:
    //   V7 학교 축 28,684문항 중 **922개(3.2%)에 `Abstract` 가 박혀 있었고** 실제로
    //   조판물에 인쇄됐다("Abstract Proteus mirabilis is an leading cause…").
    //   지우지 않고 **고르는 자리에서 막는다** — 재고는 남기고 인쇄만 거른다.
    if (!ELEMENTARY_ITEM_TYPES.has(p.type) && hasArticleChrome(p.passage_text)) {
      chrome++
      return false
    }
    // 괄호 짝이 안 맞으면 인용 안에서 **잘려 나온 조각**이다 — `hasUnbalancedParens` 참조.
    //   교정기를 배선하고 나서야 보였다(실측 2026-08-31 V7 1건). 잡티가 아니라 잘린 글이라
    //   정규화로 덮지 않고 여기서 막는다. 재고 손실 0.7%(544/76,000).
    if (!ELEMENTARY_ITEM_TYPES.has(p.type) && hasUnbalancedParens(p.passage_text)) {
      cutFragment++
      return false
    }
    return true
  })

  // 원글이 골고루 쓰이도록 — 같은 글의 문항이 앞 단원에 몰리면 뒤 단원이 굶는다.
  const byType: Record<UnitItemType, PoolItem[]> & { extra: PoolItem[] } = {
    order: fit.filter((p) => p.type === 'order'),
    insert: fit.filter((p) => p.type === 'insert'),
    // 생성형·학교 시험 축은 뼈대가 아니라 덧붙임이다 — 위 `EXTRA_ITEM_TYPES` 주석 참조.
    extra: fit.filter((p) => EXTRA_ITEM_TYPES.has(p.type) || SCHOOL_ITEM_TYPES.has(p.type) || ELEMENTARY_ITEM_TYPES.has(p.type)),
  }
  for (const t of ['order', 'insert'] as const) {
    byType[t] = roundRobinByRef(byType[t])
  }
  // 덧붙임도 글이 골고루 쓰이게 돌린다 — 안 그러면 앞 단원이 한 글의 유형을 다 가져간다.
  byType.extra = roundRobinByRef(byType.extra)

  // ── 비중 배분 경로 ────────────────────────────────────────────────
  // `targetShare` 를 주면 유형별 몫을 권 전체에서 먼저 나눠 두고 단원을 돌며 뽑는다.
  // 뼈대/덧붙임 이분법은 비중을 정수 칸으로 바꾸며 작은 유형을 0 으로 눌러 버린다.
  const perUnit = options.itemsPerUnit ?? (slots.order + slots.insert + wantExtra)
  const byShare = options.targetShare
    ? (() => {
        const pools = new Map<string, PoolItem[]>()
        for (const it of fit) {
          if (!((options.targetShare?.[it.type] ?? 0) > 0)) continue
          if (!pools.has(it.type)) pools.set(it.type, [])
          pools.get(it.type)!.push(it)
        }
        for (const [t, list] of pools) pools.set(t, roundRobinByRef(list))
        // 재고가 없는 유형은 비중에서 뺀다 — 두면 그 몫이 빈칸으로 남는다.
        const live: Record<string, number> = {}
        for (const [t, v] of Object.entries(options.targetShare!)) {
          if ((pools.get(t)?.length ?? 0) > 0) live[t] = v
        }
        return { pools, quota: largestRemainder(live, wantUnits * perUnit) }
      })()
    : null

  // 시장 비중을 지키지 못하고 양보한 횟수 — 조용히 넘어가지 않는다.
  const mixRelaxed = { repeatedType: 0, overQuota: 0 }

  const used = new Set<string>()
  // 권 전체에서 낱말이 몇 번 실렸는지. **금지가 아니라 상한**이다 — 아래 주석 참조.
  const wordCount = new Map<string, number>()
  const units: Unit[] = []
  let stoppedBecause: string | null = null

  for (let n = 1; n <= wantUnits; n++) {
    const picked: PoolItem[] = []
    const refsInUnit = new Set<string>()
    let short: UnitItemType | null = null

    if (byShare) {
      // 남은 몫이 많은 유형부터 뽑는다 — 뒤 단원에 한 유형이 몰리지 않는다.
      //
      // ⚠️ **3단 폴백이 필요하다.** 처음엔 1단(몫 남음 + 유형 중복 금지)만 뒀더니
      //   20단원짜리가 12단원에서 멈췄다 — 단원 후반에 "몫이 남았고 아직 안 쓴 유형" 이
      //   말라서다. 시중 교재도 한 단원에 같은 유형을 두 번 낸다. 재고가 허용하는
      //   만큼만 양보하되 **양보한 사실은 세어서 남긴다**(mixRelaxed).
      const takeOne = (allowRepeatType: boolean, ignoreQuota: boolean): boolean => {
        const cands = Object.entries(byShare.quota)
          .filter(([t, left]) => (ignoreQuota || left > 0)
            && (allowRepeatType || !picked.some((x) => x.type === t)))
          .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        for (const [t] of cands) {
          const list = byShare.pools.get(t) ?? []
          const hit = list.find((it) => !used.has(it.id) && !refsInUnit.has(it.ref_id))
          if (!hit) continue
          picked.push(hit)
          refsInUnit.add(hit.ref_id)
          used.add(hit.id)
          byShare.quota[t] = (byShare.quota[t] ?? 0) - 1
          return true
        }
        return false
      }
      for (let k = 0; k < perUnit; k += 1) {
        if (takeOne(false, false)) continue
        if (takeOne(true, false)) { mixRelaxed.repeatedType += 1; continue }
        if (takeOne(true, true)) { mixRelaxed.overQuota += 1; continue }
        break
      }
      if (picked.length < perUnit) {
        stoppedBecause = `재료 부족 — ${n - 1}단원까지 만들었다 (마지막 단원 ${picked.length}/${perUnit}문항)`
        break
      }
    } else {

    for (const t of ['order', 'insert'] as const) {
      const need = slots[t]
      let got = 0
      for (const it of byType[t]) {
        if (got >= need) break
        if (used.has(it.id)) continue
        if (refsInUnit.has(it.ref_id)) continue // ② 같은 글 두 번 금지
        picked.push(it)
        refsInUnit.add(it.ref_id)
        got++
      }
      if (got < need) short = t
    }

    if (short) {
      const label = short === 'order' ? '순서' : '삽입'
      stoppedBecause =
        `${n - 1}단원까지 만들고 멈췄다 — ${label} 문항이 모자란다. ` +
        `한 단원 안에서 원글이 겹치면 안 되므로, 문항 수보다 **원글 수**가 먼저 바닥난다.`
      break
    }

    // ②-b **생성형 문항을 덧붙인다** — 뼈대(순서 2 + 삽입 2)는 그대로 두고 뒤에 얹는다.
    //
    // ⚠️ 뼈대에 끼워 넣으면 이 유형이 아직 없는 밴드의 권이 통째로 줄어든다. 있으면 더 싣고
    //   없으면 그대로여야 이미 완성된 권이 후퇴하지 않는다.
    //
    // ⚠️ **이걸 안 하면 문항을 만들어도 책에 안 실린다.** 실제로 그랬다 — 생성형 64문항을
    //   넣고도 조합기가 `order`·`insert` 만 보고 있어서 권은 하나도 안 달라졌다.
    //   만든 것과 작동하는 것은 다르다.
    const extras: PoolItem[] = []
    for (const it of byType.extra) {
      if (extras.length >= wantExtra) break
      if (used.has(it.id)) continue
      // ⚠️ **덧붙임도 같은 글 금지를 지킨다.** 처음엔 "같은 지문을 다른 각도로 묻는 것은
      //   교재에서 정상" 이라고 열어 뒀는데, 자동 검수의 "한 단원에서 같은 글이 반복되지
      //   않는다" 가 바로 떨어졌다(20단원 중 2). 규칙을 내 편의로 무르지 않는다 —
      //   재고가 늘면 저절로 풀리는 제약이다.
      if (refsInUnit.has(it.ref_id)) continue
      if (extras.some((e) => e.ref_id === it.ref_id)) continue
      // 같은 유형이 한 단원에 두 번 나오지도 않게 한다.
      if (extras.some((e) => e.type === it.type)) continue
      extras.push(it)
    }
    picked.push(...extras)
    }   // ← 비중 배분을 안 쓸 때의 예전 경로 끝

    for (const it of picked) used.add(it.id)

    // ③ 이 단원이 쓴 글들의 어휘만 모은다 — 안 읽은 글의 낱말을 외우게 하지 않는다.
    //
    // ⚠️ 글별 쿼터를 준다. 다 합쳐 빈도순으로 고르면 **긴 글 하나가 독식한다** —
    //   실측: 단원 1의 어휘 12개가 전부 'Black hole'(위키백과) 에서 나왔고
    //   나머지 세 글의 낱말은 하나도 안 실렸다. 학습자는 네 지문을 읽는데
    //   어휘 목록은 한 지문 것만 준 셈이다.
    // ⚠️ 낱말 재등장은 **금지가 아니라 상한**이다(`MAX_WORD_APPEARANCES`).
    //
    //   처음엔 권 전체에서 한 번만 싣도록 완전히 막았다. 그랬더니 **뒤 두 단원의 어휘가
    //   0개**가 됐다 — 원글이 적어 뒤 단원은 이미 많이 쓴 글을 다시 받는데, 그 글의
    //   낱말이 전부 소진돼 있었다.
    //
    //   그리고 완전 금지는 이 저장소의 학습 원칙과도 어긋난다 — **Spaced Repetition**
    //   (학습원칙 2). 같은 낱말이 다른 지문에서 다시 나오는 것은 결함이 아니라 설계다.
    //   막아야 할 것은 "한 글에서 늘 상위 5개만 나오는 것" 이었지 재등장 자체가 아니었다.
    //
    //   실측 근거(V5): 필요 400개(20단원×20) · 밴드±1 재고 1,844개.
    //   낱말당 2회까지면 실질 재고가 3,688개라 충분하다.
    const notUsed = (ref: string): UnitVocab[] =>
      (vocabByRef.get(ref) ?? []).filter(
        (v) => (wordCount.get(v.word) ?? 0) < MAX_WORD_APPEARANCES,
      )

    const perRef = Math.ceil(wantVocab / Math.max(1, refsInUnit.size))
    const quota: UnitVocab[] = []
    for (const ref of refsInUnit) quota.push(...pickVocabulary(notUsed(ref), perRef, options.band))

    let vocabulary = pickVocabulary(dedupeWords(quota), wantVocab, options.band)
    // 쿼터로 못 채우면(글마다 밴드 맞는 낱말 수가 다르다) 같은 단원의 글들에서 더 가져온다.
    //   실측: 쿼터만 쓰면 뒤 단원이 5개까지 줄었다 — 목표는 20 이다.
    if (vocabulary.length < wantVocab) {
      // 쿼터에 이미 담은 낱말은 빼고 모은다 — 겹쳐 담으면 `dedupeWords` 가 빈도를
      //   두 번 더해 목록의 빈도가 실제의 두 배가 된다(회귀가 이걸 잡았다).
      const inQuota = new Set(quota.map((v) => v.word))
      const rest: UnitVocab[] = []
      for (const ref of refsInUnit) {
        rest.push(...notUsed(ref).filter((v) => !inQuota.has(v.word)))
      }
      vocabulary = pickVocabulary(dedupeWords([...quota, ...rest]), wantVocab, options.band)
    }
    for (const v of vocabulary) wordCount.set(v.word, (wordCount.get(v.word) ?? 0) + 1)

    units.push({
      no: n,
      band: options.band,
      items: picked,
      vocabulary,
      estimated_minutes:
        picked.length * MINUTES_PER_ITEM + Math.ceil(vocabulary.length * MINUTES_PER_VOCAB),
      sources: [...new Set(picked.map((p) => p.ref_title))],
    })
  }

  if (!stoppedBecause && units.length < wantUnits) {
    stoppedBecause = `${units.length}단원만 만들었다.`
  }
  return {
    units,
    stoppedBecause,
    rejected: { tooShort, tooLong, wrongFormat, residue, chrome, cutFragment, outOfRung },
    mixRelaxed,
  }
}

/**
 * 같은 원글의 문항이 연달아 오지 않게 재배열한다.
 *
 * 정렬 없이 그대로 쓰면 원글 하나의 문항 10개가 앞 단원들을 다 채우고, 뒤 단원은
 * 남은 글이 없어 굶는다. 글을 번갈아 꺼내면 같은 재료로 더 많은 단원이 나온다.
 */
export function roundRobinByRef(items: ReadonlyArray<PoolItem>): PoolItem[] {
  const groups = new Map<string, PoolItem[]>()
  for (const it of items) {
    if (!groups.has(it.ref_id)) groups.set(it.ref_id, [])
    groups.get(it.ref_id)!.push(it)
  }
  const queues = [...groups.values()]
  const out: PoolItem[] = []
  let moved = true
  while (moved) {
    moved = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        out.push(next)
        moved = true
      }
    }
  }
  return out
}

/** 같은 낱말이 여러 글에서 오면 빈도를 합친다 — 목록에 두 번 싣지 않는다. */
function dedupeWords(pool: ReadonlyArray<UnitVocab>): UnitVocab[] {
  const byWord = new Map<string, UnitVocab>()
  for (const v of pool) {
    const prev = byWord.get(v.word)
    if (!prev) byWord.set(v.word, { ...v })
    else prev.frequency_in_article += v.frequency_in_article
  }
  return [...byWord.values()]
}
