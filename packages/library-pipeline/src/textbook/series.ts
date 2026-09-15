// packages/library-pipeline/src/textbook/series.ts
//
// **시리즈 정본 — 한 브랜드가 학령 전체를 계단으로 잡는다.**
//
// ── 왜 시리즈인가 (시장 관측 2026-08-21) ─────────────────────────────
// 국내 독해 교재 시장은 **출판사마다 전 학령을 잇는 하나의 사다리**를 갖고 있다:
//
//   능률   주니어 리딩튜터 → 리딩튜터(입문~실력) → 빠바(기초~수능실전) → 리딩파워
//   쎄듀   왓츠 리딩 → 리딩릴레이 → 1316 Reading → 첫단추 → 천일문 독해
//   EBS    올림포스 → 수능특강 → 수능완성 → 기출의 미래
//
// 그리고 **독해는 어휘보다 레벨 사다리가 훨씬 촘촘하다**(단계 5~7개). 난이도가 연속적이라
// 레벨링 수요가 크기 때문이고, 그래서 **지문 레벨링은 시장이 이미 돈을 내고 사는 기능**이다.
//
// ── 사다리를 새로 만들지 않는다 ──────────────────────────────────────
// `vocaflow_levels` 가 이미 학령 사다리다 — 그 표의 `korean_school` 이 곧 계단 이름이다:
//
//     V0 유치원 · V1 초등 저학년 · V2 초등 고학년 · V3 중1-2 · V4 중3
//     V5 고1 · V6 고2 · V7 고3/수능 상위 · V8+ 성인
//
// 시리즈는 **그 위에 얹는 것**이지 평행한 눈금이 아니다. 눈금이 둘이면 반드시 갈린다 —
// 이 저장소는 그 사고를 이미 여러 번 겪었다(같은 것을 두 이름으로 부르던 레지스트리들).
//
// ── 계단마다 유형이 다르다 ───────────────────────────────────────────
// 초등에 순서·삽입을 넣으면 안 된다. 그 유형은 수능 지문 길이를 전제한다(`school-types.ts`).
// 반대로 고등에 파닉스를 넣으면 안 된다. **계단이 다르면 유형 구성도 다르다** —
// 시장의 사다리가 단계마다 다른 책 이름을 갖는 이유가 그것이다.



/** 시리즈 한 계단이 쓰는 문항 유형. 저장 유형 키와 초등 3종을 함께 담는다. */
export type SeriesItemType =
  | 'rhyme'
  | 'word_meaning'
  | 'spell_blank'
  | 'word_order'
  | 'vocab_choice'
  | 'grammar_choice'
  | 'irrelevant'
  | 'order'
  | 'insert'
  // 중등 내신 4종 (2026-08-22).
  //
  // ⚠️ **유형을 만들고 적재까지 했는데 사다리가 0 으로 셌다.** 9,887행이 DB 에 들어간 뒤에도
  //   계단별 문항 수가 그대로였는데, 이 union 과 아래 `types` 목록에 없으면
  //   `measureSeries` 가 그 행을 어느 계단에도 넣지 않기 때문이다. 아무 에러도 안 난다.
  //   **적재는 교재가 되는 것과 다르다** — 계단이 유형을 받아 줘야 비로소 실린다.
  | 'blank_word'
  | 'grammar_fix'
  | 'unit_vocab'
  | 'unit_grammar'
  // ── 시중이 실제로 내는 독해 유형 11종 (실측 2026-09-13) ──────────────
  //
  // ⚠️ **이 열한 개가 union 에 없어서 사다리가 시중을 못 따라가고 있었다.** 조판 로그가
  //   「재고가 0 이라 목표에서 빠진 유형」이라 찍었는데 **재고는 0 이 아니었다** —
  //   V2 만 봐도 blank_word 1,737 · unit_vocab 1,684 · blank 134 · topic 80 · title 46 ·
  //   content_match 28 · irrelevant 27 · long_reference 3 이 DB 에 있었다. 조판기가 풀을
  //   **계단 선언 유형으로 먼저 좁히기 때문에** 선언 밖의 유형이 「재고 0」으로 읽혔던 것이다.
  //   그래서 처방이 거꾸로 안내됐다(문항을 더 만들라 → 실제로는 이 목록을 고칠 일).
  | 'title'
  | 'topic'
  | 'blank'
  | 'content_match'
  | 'main_point'
  | 'purpose'
  | 'mood'
  | 'summary'
  | 'claim'
  | 'implication'
  | 'long_reference'

/**
 * 유형 이름표 — 리포트·화면이 함께 쓴다.
 *
 * ⚠️ **`Record<SeriesItemType, string>` 인 것이 핵심이다.** 리포트 스크립트 안에 평범한
 *   객체로 두었더니, 유형을 늘렸을 때 아무 에러 없이 `undefined 291` 이 찍혔다
 *   (2026-08-22 실측). 타입을 걸면 union 에 유형을 더한 순간 **컴파일이 막는다** —
 *   이름표를 빠뜨릴 수 없게 된다.
 */
export const SERIES_TYPE_LABEL_KO: Record<SeriesItemType, string> = {
  rhyme: '파닉스 운율',
  word_meaning: '낱말 뜻',
  spell_blank: '철자 완성',
  word_order: '영작 배열',
  vocab_choice: '어휘',
  grammar_choice: '어법',
  irrelevant: '흐름 무관',
  order: '순서',
  insert: '삽입',
  blank_word: '빈칸 낱말',
  grammar_fix: '어법 고쳐쓰기',
  unit_vocab: '본문 어휘',
  unit_grammar: '단원 문법',
  // 이름표는 `item-drain-export.mjs` 의 유형 정본과 **글자 그대로 같아야 한다** —
  // 두 이름이 갈리면 리포트와 청크가 다른 유형을 말하게 된다.
  title: '제목',
  topic: '주제',
  blank: '빈칸 추론',
  content_match: '내용 일치',
  main_point: '요지',
  purpose: '글의 목적',
  mood: '심경·분위기',
  summary: '요약문 완성',
  claim: '필자의 주장',
  implication: '밑줄 함의 추론',
  long_reference: '장문 지칭',
}

export interface SeriesRung {
  /** 계단 번호 — 1 부터. 학습자에게 보이는 "레벨". */
  step: number
  /** 이 계단이 덮는 `vocaflow_levels.level`. */
  vLevels: number[]
  /** 학령 — `vocaflow_levels.korean_school` 에서 온다. 여기서 새로 짓지 않는다. */
  schoolBand: string
  /** 이 계단의 권 이름. */
  volumeTitle: string
  /** 이 계단이 쓰는 유형. **계단이 다르면 유형도 다르다.** */
  types: SeriesItemType[]
  /** 왜 이 유형 구성인가. */
  rationale: string
}

/**
 * 시리즈 이름.
 *
 * ⚠️ 이름은 **사람이 정할 일**이다. 여기 있는 것은 자리를 잡아 두기 위한 것이고,
 *   바꾸려면 이 상수 하나만 고치면 된다 — 화면·리포트가 전부 여기서 읽는다.
 */
export const SERIES_BRAND = 'Vocaflow Reading' as const

/**
 * 계단 일곱.
 *
 * 시장의 사다리가 5~7단인 것을 따랐고(관측), **단계 경계는 우리가 정하지 않았다** —
 * `vocaflow_levels` 의 학령 구분을 그대로 쓴다. V0(유치원)은 읽기 교재의 대상이 아니라
 * 빼고, V8+(성인)은 학령 사다리 밖이라 뺀다.
 *
 * ── 유형 목록은 **시중 79종 실측에서 나온다** (2026-09-13) ───────────
 * 처음에는 손으로 적었고, 그래서 **시중이 가장 많이 내는 유형을 우리가 안 내고 있었다**:
 *
 *   초등 871쪽   1위 `title` 5.17% · 2위 `blank` 4.71%   ← 둘 다 선언에 없었다
 *   고등 2,467쪽 1위 `blank` 3.89% · 3위 `grammar_fix` 2.43% · 5위 `title` 2.19%  ← 전부 없었다
 *
 * 그 결과 조판이 시장 전체 기준 **V2 16.8% · V7 30.1%** 짜리 권을 내고 있었다. 재고가
 * 없어서가 아니다 — 조판기가 풀을 이 목록으로 먼저 좁히므로, 여기 없으면 DB 에 수천 개가
 * 있어도 안 실린다.
 *
 * 그래서 이제 **규칙으로 정한다**: 그 학교급 `market-spec.json` 의 쪽 등장률이
 * **2‰ 이상**인 유형을 담는다(`rungMix` 의 `RUNG_TYPE_FLOOR_PER_MILLE` 과 같은 바닥선).
 * 바닥선 아래는 담지 않는다 — 중등 `order` 0.09% 처럼 한두 쪽에서만 보인 것을 담으면
 * 그 계단이 영영 못 채우는 칸이 생긴다. 회귀 `series.test.ts` 가 이 규칙을 잠근다.
 *
 * ⚠️ **더하기만 했고 빼지 않았다.** 바닥선 아래로 내려간 기존 선언(중등 `blank_word`·
 * `grammar_choice`)도 그대로 둔다 — 이미 재고가 딸린 실제 공급이고, 빼면 만든 것을 버린다.
 *
 * ⚠️ **1단만 규칙 밖이다.** 시중 초등 코퍼스는 3~6학년 교재이고 1단(V1)은 **지문이 없는**
 * 계단이다(사전 낱말 하나가 문항 하나). 지문 기반 유형을 얹으면 잴 지문이 없어 전량 걸린다.
 */
export const SERIES_SPINE: readonly SeriesRung[] = [
  {
    step: 1,
    vLevels: [1],
    schoolBand: '초등 저학년',
    volumeTitle: `${SERIES_BRAND} Starter`,
    types: ['rhyme', 'word_meaning', 'spell_blank'],
    rationale:
      '소리·낱말 단위. **지문이 없다.** 순서·삽입은 수능 지문 길이를 전제하므로 여기 넣으면 안 되고, ' +
      '제목·빈칸처럼 지문을 통째로 묻는 유형도 잴 지문이 없어 못 낸다 — 시장 규칙의 유일한 예외다.',
  },
  {
    step: 2,
    vLevels: [2],
    schoolBand: '초등 고학년',
    volumeTitle: `${SERIES_BRAND} 1`,
    types: [
      'rhyme',
      'word_meaning',
      'spell_blank',
      'word_order',
      // 시중 초등 상위 — title 5.17% · blank 4.71% · topic 3.21% · irrelevant 1.72%
      'title',
      'blank',
      'topic',
      'irrelevant',
      'blank_word',
      'content_match',
      'unit_vocab',
      'long_reference',
    ],
    rationale:
      '낱말에서 글로. 영작 배열이 첫 문장 단위 과제고, **여기서 지문을 통째로 묻는 유형이 열린다** — ' +
      '시중 초등 교재가 가장 많이 내는 것이 제목(5.17%)과 빈칸(4.71%)이다. 순서·삽입은 시중 초등에 ' +
      '**한 쪽도 없어서**(0%) 넣지 않는다.',
  },
  {
    step: 3,
    vLevels: [3],
    schoolBand: '중학 1-2학년',
    volumeTitle: `${SERIES_BRAND} 2`,
    types: [
      'word_meaning',
      'word_order',
      'vocab_choice',
      'unit_vocab',
      'blank_word',
      // 시중 중등 상위 — unit_vocab 1.99% · word_order 1.99% · title 1.61% · topic 1.61%
      'title',
      'topic',
      'blank',
      'content_match',
      'grammar_fix',
      'insert',
      'irrelevant',
    ],
    rationale:
      '문장에서 짧은 글로. 어휘 문항이 처음 들어가고 중등 내신의 **본문 어휘**와 **빈칸 낱말**이 여기서 열린다. ' +
      '시중 중등은 제목·주제를 초등만큼 내므로(각 1.61%) 여기서도 함께 낸다. ' +
      '순서(0.09%)는 바닥선 아래라 5단으로 미룬다 — 삽입(0.28%)만 여기서 연다.',
  },
  {
    step: 4,
    vLevels: [4],
    schoolBand: '중학 3학년',
    volumeTitle: `${SERIES_BRAND} 3`,
    types: [
      'word_order',
      'vocab_choice',
      'grammar_choice',
      'unit_vocab',
      'blank_word',
      'unit_grammar',
      'grammar_fix',
      'title',
      'topic',
      'blank',
      'content_match',
      'insert',
      'irrelevant',
    ],
    rationale:
      '고교 진입 준비. **단원 문법**(객관식)과 **어법 고쳐 쓰기**(단답)가 함께 열린다 — ' +
      '같은 규칙을 묻되 하나는 고르게 하고 하나는 쓰게 하기 때문이고, 학교 시험이 실제로 그렇게 낸다. ' +
      '유형 구성은 3단과 같은 중등 실측을 쓰되 어법 축이 더해진 자리다.',
  },
  {
    step: 5,
    vLevels: [5],
    schoolBand: '고1',
    volumeTitle: `${SERIES_BRAND} 4`,
    types: [
      'blank',
      'vocab_choice',
      'grammar_fix',
      'order',
      'title',
      'topic',
      'content_match',
      'irrelevant',
      'insert',
      'purpose',
      'mood',
      'summary',
      'main_point',
      'claim',
      'implication',
      'long_reference',
      'word_order',
      'grammar_choice',
      'blank_word',
    ],
    rationale:
      '학평 대응. **순서가 여기서 열리고**(시중 고등 2.23%, 중등은 0.09%로 바닥선 아래) ' +
      '빈칸이 1위(3.89%)가 된다. 고1 학력평가는 유형 구성이 이미 수능과 같으므로 ' +
      '**고등 세 계단은 같은 유형을 쓴다** — 갈리는 것은 지문 레벨이다.',
  },
  {
    step: 6,
    vLevels: [6],
    schoolBand: '고2',
    volumeTitle: `${SERIES_BRAND} 5`,
    types: [
      'blank',
      'vocab_choice',
      'grammar_fix',
      'order',
      'title',
      'topic',
      'content_match',
      'irrelevant',
      'insert',
      'purpose',
      'mood',
      'summary',
      'main_point',
      'claim',
      'implication',
      'long_reference',
      'word_order',
      'grammar_choice',
      'blank_word',
    ],
    rationale:
      '고2 심화. ' +
      '유형은 5단과 같다 — **시중 실측이 고1/고2/고3 을 가르지 않는다**(코퍼스가 「고등」 한 칸이다). ' +
      '전에는 여기서 흐름 무관이 더해진다고 적었는데, 실측은 그 유형을 고등 전체에서 1.58%로 고르게 낸다. ' +
      '계단을 가르는 것은 지문 레벨이다.',
  },
  {
    step: 7,
    vLevels: [7],
    schoolBand: '고3 / 수능 상위',
    volumeTitle: `${SERIES_BRAND} 6`,
    types: [
      'blank',
      'vocab_choice',
      'grammar_fix',
      'order',
      'title',
      'topic',
      'content_match',
      'irrelevant',
      'insert',
      'purpose',
      'mood',
      'summary',
      'main_point',
      'claim',
      'implication',
      'long_reference',
      'word_order',
      'grammar_choice',
      'blank_word',
    ],
    rationale:
      '수능 대응. 유형은 5·6단과 같고 **지문 레벨이 다르다** — 시장의 최상단도 같은 구조다(리딩튜터 수능PLUS).',
  },
] as const

/** 재고 — 유형·레벨별 문항 수. DB 실측을 그대로 넣는다. */
export type Inventory = ReadonlyArray<{ type: SeriesItemType; vLevel: number | null; count: number }>

export interface RungFill {
  rung: SeriesRung
  /** 유형별 보유 수. 그 계단이 쓰는 유형만. */
  byType: Record<string, number>
  /** 그 계단에서 쓸 수 있는 문항 총수. */
  total: number
  /** 쓰기로 한 유형 중 **재고가 0인 것**. 여기가 비면 그 계단의 책이 반쪽이다. */
  emptyTypes: SeriesItemType[]
}

export interface SeriesFill {
  brand: string
  rungs: RungFill[]
  /** 문항이 하나도 없는 계단 — **사다리가 끊긴 자리**다. */
  brokenSteps: number[]
}

/**
 * 사다리를 재고에 대 본다.
 *
 * **브랜드는 이름이 아니라 채울 수 있는 계단이다.** 계단 하나가 비면 학습자는 그 학년에서
 * 다른 출판사로 갈아탄다 — 시장의 사다리가 촘촘한 이유가 그것이다.
 *
 * ⚠️ 초등 3종(`rhyme`·`word_meaning`·`spell_blank`)은 DB 에 저장되지 않는다
 *   (사전의 순수 함수라 저장할 이유가 없다 — `elementary.ts` 참조). 재고를 넣을 때
 *   그 세 유형은 **생성 가능 수**를 넣어야 하고, 안 넣으면 초등 계단이 거짓으로 비어 보인다.
 */
export function measureSeriesFill(
  inventory: Inventory,
  spine: readonly SeriesRung[] = SERIES_SPINE,
): SeriesFill {
  const rungs: RungFill[] = spine.map((rung) => {
    const byType: Record<string, number> = {}
    for (const t of rung.types) byType[t] = 0
    for (const row of inventory) {
      if (row.vLevel == null || !rung.vLevels.includes(row.vLevel)) continue
      if (!(row.type in byType)) continue
      byType[row.type]! += row.count
    }
    const total = Object.values(byType).reduce((s, n) => s + n, 0)
    return {
      rung,
      byType,
      total,
      emptyTypes: rung.types.filter((t) => (byType[t] ?? 0) === 0),
    }
  })

  return {
    brand: SERIES_BRAND,
    rungs,
    brokenSteps: rungs.filter((r) => r.total === 0).map((r) => r.rung.step),
  }
}

/** 시리즈가 덮는 수능 유형 — 커버리지 표(`csat-types`)와 어긋나지 않게 대조용. */
export const SERIES_CSAT_TYPES: readonly string[] = [
  'vocabulary',
  'grammar',
  'irrelevant',
  'order',
  'insert',
]
