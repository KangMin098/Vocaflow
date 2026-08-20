// packages/library-pipeline/src/textbook/assemble-unit.ts
//
// **독해 교재 1 단원을 조립한다.** 지문 1 + 문항 N + 어휘 M.
//
// ── 왜 이 파일이 필요한가 (실측 2026-08-21) ──────────────────────────
// 조각은 전부 있었는데 묶는 자리가 없었다:
//
//   vocaflow_levels        학년 축 (V0~11 · 초1-2 ~ 수능 1-2등급)      ✅
//   csat_stage_catalog     지문 + v_level + register + 라이선스        ✅ 173편
//   csat_dcp_items         순서·삽입 문항 (결정론 생성)                ✅ 1,378
//   library_article_vocabularies  지문별 어휘                          ✅
//   ─────────────────────────────────────────────────────────────
//   "1 단원" 이라는 산출물                                             ❌
//
// 산출물이 "기사 1편" 이면 **어디서 끊어 파는지가 없다.** 단원이 판매·진도·완료의 단위다.
//
// ── 순수 함수인 이유 ─────────────────────────────────────────────────
// DB 를 보지 않고 재료를 받는다. 그래야 배치·화면·테스트가 같은 답을 내고,
// 조립 규칙을 회귀로 못 박을 수 있다. 이 저장소가 반복해 겪은 "경로마다 다른 답" 을 막는다.

/** 수능 순서 문항 — 문단의 문장 순서를 섞어 복원시킨다. */
export type UnitItemType = 'order' | 'insert'

export interface UnitItem {
  type: UnitItemType
  paragraph_idx: number
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
}

export interface UnitVocab {
  word: string
  meaning_ko: string | null
  v_level: number | null
  /** 지문 안에서 그 낱말이 처음 나온 문장 — 문맥 없이 외우게 하지 않는다. */
  first_sentence: string | null
  frequency_in_article: number
}

export interface UnitPassage {
  ref_id: string
  title: string
  word_count: number
  v_level: number | null
  cefr_level: string | null
  /** ND 라이선스면 본문을 교재에 실을 수 없다 — 조립 자체를 막는다. */
  display_only: boolean
}

export interface ReadingUnit {
  passage: UnitPassage
  items: UnitItem[]
  vocabulary: UnitVocab[]
  /** 학습자가 이 단원에 쓸 시간(분). 지문 읽기 + 문항 + 어휘. */
  estimated_minutes: number
}

/** 조립이 막힌 이유. 조용히 빈 단원을 내지 않는다. */
export interface UnitBlocked {
  blocked: true
  reason: string
}

export interface AssembleOptions {
  /** 순서 문항 목표 수. 기본 3. */
  orderCount?: number
  /** 삽입 문항 목표 수. 기본 2. */
  insertCount?: number
  /** 어휘 목표 수. 기본 20. */
  vocabCount?: number
  /**
   * 학습자 밴드. 어휘를 이 밴드 ±1 에서 고른다.
   *
   * ⚠️ i+1 (학습원칙 3 · Desirable Difficulty) — 다 아는 낱말만 주면 배울 게 없고,
   *   전부 모르는 낱말이면 지문을 못 읽는다. 밴드보다 한 칸 위까지만 담는다.
   */
  learnerBand?: number
}

/**
 * 교재 지문으로 쓸 수 있는 길이 범위.
 *
 * ── 근거 (실측 2026-08-21) ───────────────────────────────────────────
 * 길이 판단 없이 조립했더니 이런 "단원" 이 나왔다:
 *
 *     Prague   13,942어 · 127분
 *     Kyoto     8,638어 ·  82분
 *
 * 수능 지문은 130~190어다. 교재 단원 지문도 그 언저리이고, 넉넉히 잡아도 250어를
 * 넘지 않는다. 127분짜리는 단원이 아니라 책 한 권이다.
 *
 * ⚠️ **문항 수확량과 교재 적합성은 반비례한다.** DCP 는 문단 단위로 문항을 만들므로
 *   긴 글일수록 문항이 많이 나온다(plos 27.5문항/편 · wikivoyage 13.0). 그런데 그런 글은
 *   지문으로 못 쓴다. 수확량만 보고 소스를 고르면 정확히 틀린 것을 고르게 된다.
 *
 * 상한을 넘는 글은 **버리는 게 아니라 발췌해야 한다** — 그건 별도 단계이고,
 * 여기서는 통째로 실을 수 없다는 것만 말한다.
 */
export const PASSAGE_WORDS = { min: 120, max: 250 } as const

/** 지문 읽기 속도(분당 낱말). `analyze-article` 의 200wpm 보다 낮다 — 문항을 풀며 읽는다. */
export const UNIT_READ_WPM = 120
/** 문항 1개당 소요(분). 순서·삽입은 문단을 다시 읽어야 해서 짧지 않다. */
export const MINUTES_PER_ITEM = 2
/** 어휘 1개당 소요(분). */
export const MINUTES_PER_VOCAB = 0.25

/**
 * 단원 하나를 조립한다.
 *
 * 재료가 모자라면 **부분 단원을 내지 않고 막는다** — 문항 2개짜리 단원은
 * 교재로 팔 수 없고, 그런 것이 섞이면 권 전체의 신뢰가 깎인다.
 */
export function assembleReadingUnit(
  passage: UnitPassage,
  items: ReadonlyArray<UnitItem>,
  vocabulary: ReadonlyArray<UnitVocab>,
  options: AssembleOptions = {},
): ReadingUnit | UnitBlocked {
  const wantOrder = options.orderCount ?? 3
  const wantInsert = options.insertCount ?? 2
  const wantVocab = options.vocabCount ?? 20

  // ND 는 본문을 그대로 실을 수 없다. 문항이 아무리 많아도 교재가 안 된다.
  if (passage.display_only) {
    return {
      blocked: true,
      reason: `${passage.title}: 라이선스가 본문 게재를 허용하지 않는다(display_only) — 재저작 경로로 보내야 한다.`,
    }
  }

  // 길이는 문항보다 먼저 본다 — 13,942어짜리는 문항이 40개여도 단원이 못 된다.
  const w = passage.word_count
  if (w < PASSAGE_WORDS.min || w > PASSAGE_WORDS.max) {
    const how = w > PASSAGE_WORDS.max ? '길다 — 발췌가 필요하다' : '짧다'
    return {
      blocked: true,
      reason:
        `${passage.title}: 지문 ${w.toLocaleString()}어로 교재 지문 범위` +
        `(${PASSAGE_WORDS.min}~${PASSAGE_WORDS.max}어) 밖이라 ${how}. ` +
        `수능 지문은 130~190어다.`,
    }
  }

  const orders = items.filter((i) => i.type === 'order')
  const inserts = items.filter((i) => i.type === 'insert')
  if (orders.length < wantOrder || inserts.length < wantInsert) {
    return {
      blocked: true,
      reason:
        `${passage.title}: 문항 부족 — 순서 ${orders.length}/${wantOrder} · 삽입 ${inserts.length}/${wantInsert}. ` +
        `문단이 4~6문장이어야 DCP 가 문항을 만든다(짧은 문단으로 쓰인 글은 수확량이 0에 가깝다).`,
    }
  }

  // 문단이 흩어져야 지문 전체를 읽게 된다 — 같은 문단에서 여러 문항을 뽑으면
  //   학습자가 그 문단만 붙들고 나머지를 건너뛴다.
  const spread = (pool: ReadonlyArray<UnitItem>, n: number): UnitItem[] => {
    const seen = new Set<number>()
    const picked: UnitItem[] = []
    for (const it of pool) {
      if (picked.length >= n) break
      if (seen.has(it.paragraph_idx)) continue
      seen.add(it.paragraph_idx)
      picked.push(it)
    }
    // 문단이 모자라면 그때는 중복을 허용한다 — 막는 것보다 낫다.
    for (const it of pool) {
      if (picked.length >= n) break
      if (!picked.includes(it)) picked.push(it)
    }
    return picked
  }

  const chosen = [...spread(orders, wantOrder), ...spread(inserts, wantInsert)]

  const band = options.learnerBand ?? passage.v_level ?? null
  const vocab = pickVocabulary(vocabulary, wantVocab, band)

  const minutes =
    Math.ceil(passage.word_count / UNIT_READ_WPM) +
    chosen.length * MINUTES_PER_ITEM +
    Math.ceil(vocab.length * MINUTES_PER_VOCAB)

  return {
    passage,
    items: chosen,
    vocabulary: vocab,
    estimated_minutes: minutes,
  }
}

/**
 * 어휘를 고른다 — **밴드 ±1 우선, 그 안에서 지문 빈도 순**.
 *
 * 빈도만으로 고르면 the·of 같은 것이 올라오고, 등급만으로 고르면 지문에 한 번 나온
 * 어려운 낱말이 올라온다. 둘을 겹쳐야 "이 지문을 읽는 데 필요한 낱말" 이 된다.
 */
export function pickVocabulary(
  pool: ReadonlyArray<UnitVocab>,
  want: number,
  band: number | null,
): UnitVocab[] {
  // 뜻이 없는 낱말은 교재에 못 싣는다 — 빈칸이 그대로 인쇄된다.
  const usable = pool.filter((v) => v.meaning_ko && v.meaning_ko.trim().length > 0)
  if (band == null) {
    return [...usable].sort((a, b) => b.frequency_in_article - a.frequency_in_article).slice(0, want)
  }
  const inBand = usable.filter(
    (v) => v.v_level != null && v.v_level >= band - 1 && v.v_level <= band + 1,
  )
  const rest = usable.filter((v) => !inBand.includes(v))
  const byFreq = (a: UnitVocab, b: UnitVocab): number =>
    b.frequency_in_article - a.frequency_in_article
  return [...inBand.sort(byFreq), ...rest.sort(byFreq)].slice(0, want)
}

/** 조립 결과가 막힌 것인지. */
export function isBlocked(u: ReadingUnit | UnitBlocked): u is UnitBlocked {
  return (u as UnitBlocked).blocked === true
}
