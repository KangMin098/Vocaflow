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
 */
export const SERIES_SPINE: readonly SeriesRung[] = [
  {
    step: 1,
    vLevels: [1],
    schoolBand: '초등 저학년',
    volumeTitle: `${SERIES_BRAND} Starter`,
    types: ['rhyme', 'word_meaning', 'spell_blank'],
    rationale:
      '소리·낱말 단위. **지문이 없다.** 순서·삽입은 수능 지문 길이를 전제하므로 여기 넣으면 안 된다.',
  },
  {
    step: 2,
    vLevels: [2],
    schoolBand: '초등 고학년',
    volumeTitle: `${SERIES_BRAND} 1`,
    types: ['rhyme', 'word_meaning', 'spell_blank', 'word_order'],
    rationale: '낱말에서 문장으로. 영작 배열이 첫 문장 단위 과제다 — 정답이 원문이라 확정된다.',
  },
  {
    step: 3,
    vLevels: [3],
    schoolBand: '중학 1-2학년',
    volumeTitle: `${SERIES_BRAND} 2`,
    types: ['word_meaning', 'word_order', 'vocab_choice'],
    rationale: '문장에서 짧은 글로. 어휘 문항이 처음 들어간다(지문 안에서 모순을 찾는 과제).',
  },
  {
    step: 4,
    vLevels: [4],
    schoolBand: '중학 3학년',
    volumeTitle: `${SERIES_BRAND} 3`,
    types: ['word_order', 'vocab_choice', 'grammar_choice'],
    rationale: '고교 진입 준비. 어법이 들어간다 — 중등 내신의 서술형 축과 겹친다.',
  },
  {
    step: 5,
    vLevels: [5],
    schoolBand: '고1',
    volumeTitle: `${SERIES_BRAND} 4`,
    types: ['vocab_choice', 'grammar_choice', 'order', 'insert'],
    rationale: '학평 대응. **순서·삽입이 여기서 열린다** — 지문이 수능 규격(90~200어)에 든다.',
  },
  {
    step: 6,
    vLevels: [6],
    schoolBand: '고2',
    volumeTitle: `${SERIES_BRAND} 5`,
    types: ['vocab_choice', 'grammar_choice', 'order', 'insert', 'irrelevant'],
    rationale: '흐름 무관이 더해진다. 글 전체의 논지를 봐야 풀리는 첫 유형이다.',
  },
  {
    step: 7,
    vLevels: [7],
    schoolBand: '고3 / 수능 상위',
    volumeTitle: `${SERIES_BRAND} 6`,
    types: ['vocab_choice', 'grammar_choice', 'order', 'insert', 'irrelevant'],
    rationale:
      '수능 대응. 유형은 6단과 같고 **지문 레벨이 다르다** — 시장의 최상단도 같은 구조다(리딩튜터 수능PLUS).',
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
