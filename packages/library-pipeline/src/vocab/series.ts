// packages/library-pipeline/src/vocab/series.ts
//
// **단어장 시리즈 정본 — 한 브랜드가 학령 전체를 계단으로 잡는다.**
//
// ── 왜 독해와 같은 사다리를 타는가 ───────────────────────────────────
// `textbook/series.ts` 는 이미 사다리를 하나 세웠고, 그 사다리는 우리가 지은 것이 아니라
// `vocaflow_levels.korean_school` 을 그대로 쓴 것이다. **여기서 두 번째 눈금을 만들면
// 반드시 갈린다** — 이 저장소는 같은 것을 두 이름으로 부르다 어긋난 사고를 여러 번 겪었다.
//
// 그래서 계단의 **경계**(step · vLevels · schoolBand)는 `SERIES_SPINE` 에서 **읽어 온다.**
// 여기서 새로 정하는 것은 그 계단 위에 무엇을 **얹느냐**뿐이다 — 어떤 묶음 원리를 쓰고,
// 하루에 몇 낱말을 주는가.
//
// ── 시장이 실제로 어떻게 구성하는가 (실측 2026-08-30) ────────────────
// `market-spec.json` — 시중 어휘 교재 4종 112쪽 · 표제어 140칸에서 잰 값이다.
//
//   · **페이싱은 전 권이 `DAY` 단위다** (4/4권). 능률VOCA 고등 기본은 STUDY PLAN 에
//     `DAY 01–40` 이 찍혀 있다 — 40 계단으로 잘라 파는 것이 시장의 기본형이다.
//   · **PART 는 묶음 원리로 가른다** — 핵심(빈도) · 어원별 · 주제별 · 반의어/혼동어/다의어 ·
//     함께 외우면 좋은 어휘(연어) · 숙어 · 여러 뜻(다의). **일곱 축이다.**
//   · 표제어 한 칸의 보유율: 예문 0.91 · 예문 한국어역 0.92 · 파생어 0.41 ·
//     유의/반의 0.26 · 다의 분리 0.44 · 품사 0.92. (추출 하한값 — 실제는 더 높다)
//
// ── 우리가 이길 수 있는 자리 ────────────────────────────────────────
// 시장이 일곱 축으로 가르는 것을 `compose/blueprints.ts` 는 **30 축**으로 가른다.
// 축이 많은 것 자체는 자랑이 아니지만, **계단마다 다른 축을 쓸 수 있다**는 뜻이라서
// 시장이 못 하는 일이 된다 — 종이책은 한 권에 축을 네댓 개밖에 못 싣는다.
//
// ⚠️ **축을 늘리는 것으로 우위를 주장하지 않는다.** 우위는 `market-benchmark` 가
//    같은 자로 재서 나온 비율로만 말한다(`scripts/vocab/market-benchmark.mjs`).

import { SERIES_SPINE } from '../textbook/series'

/** 시리즈 이름. 바꾸려면 이 상수 하나만 고친다 — 화면·리포트가 전부 여기서 읽는다. */
export const VOCAB_SERIES_BRAND = 'Vocaflow Vocabulary' as const

/**
 * `compose/blueprints.ts` 의 청사진 id.
 *
 * ⚠️ 문자열 union 으로 **박아 둔다.** 독해 쪽에서 유형을 union 에 안 넣었다가
 *   9,887행이 적재되고도 계단이 0 으로 세어진 사고가 있었다(`textbook/series.ts` 주석).
 *   여기서도 청사진을 늘릴 때 이 union 에 넣지 않으면 그 계단이 조용히 비어 보인다.
 */
export type VocabBlueprintId =
  // list — 외부 목록이 무엇을 넣을지 정한다
  | 'freq-tier' | 'exam-list' | 'curriculum-grade' | 'academic-awl'
  | 'level-band' | 'domain-specialty' | 'exam-items'
  // structure — 낱말 사이의 관계가 목차가 된다
  | 'root-etymology' | 'word-family' | 'pos-focus' | 'topic-field'
  | 'synonym-cluster' | 'antonym-pair' | 'confusable' | 'collocation'
  | 'phrasal-idiom' | 'polysemy' | 'rhyme-phonics'
  // corpus — 읽을 콘텐츠가 표제어를 정한다
  | 'book-companion' | 'chapter-companion' | 'news-article' | 'script-media'
  // delivery — 같은 어휘를 어떤 형태로 주느냐
  | 'day-pacing' | 'mnemonic-story' | 'picture-dict' | 'audio-only'
  // unique — 학습 이력이 있어야 성립하는 것
  | 'unlock' | 'recycle' | 'facet-ladder' | 'confusion-log'

export interface VocabRung {
  /** 계단 번호 — `SERIES_SPINE` 과 **같은 번호**다. 두 시리즈가 한 사다리를 탄다. */
  step: number
  /** 이 계단이 덮는 `vocaflow_levels.level`. `SERIES_SPINE` 에서 읽어 온다. */
  vLevels: number[]
  /** 학령. `SERIES_SPINE` 에서 읽어 온다 — 여기서 새로 짓지 않는다. */
  schoolBand: string
  /** 이 계단의 권 이름. */
  volumeTitle: string
  /** 이 계단이 쓰는 묶음 원리. **계단이 다르면 구성도 다르다.** */
  blueprints: VocabBlueprintId[]
  /** 하루치 표제어 수 — 시장의 `DAY` 관례를 따르되 계단마다 다르다. */
  wordsPerDay: number
  /** 왜 이 구성인가. */
  rationale: string
}

/**
 * 계단별로 **더해지는** 청사진.
 *
 * 아래 계단이 쓰던 것은 위 계단에서도 쓸 수 있다 — 어휘는 독해와 달리 유형이 은퇴하지
 * 않는다(초등에서 배운 '주제별' 은 고3에서도 유효하다). 그래서 누적으로 쌓고,
 * **이 표에는 그 계단에서 처음 열리는 것만 적는다.** 전체 목록은 `vocabRungs()` 가 만든다.
 */
const OPENS_AT: ReadonlyArray<{
  step: number
  volumeTitle: string
  wordsPerDay: number
  opens: VocabBlueprintId[]
  rationale: string
}> = [
  {
    step: 1,
    volumeTitle: `${VOCAB_SERIES_BRAND} Starter`,
    wordsPerDay: 10,
    opens: ['rhyme-phonics', 'picture-dict', 'topic-field', 'day-pacing', 'audio-only'],
    rationale:
      '소리와 그림. **뜻을 글로 읽지 않는다** — 이 계단의 학습자는 한국어 뜻풀이를 읽는 것이 '
      + '영어를 읽는 것보다 어렵다. 어원·유의어는 추상이라 여기 넣으면 안 된다.',
  },
  {
    step: 2,
    volumeTitle: `${VOCAB_SERIES_BRAND} 1`,
    wordsPerDay: 15,
    opens: ['curriculum-grade', 'word-family', 'freq-tier', 'book-companion', 'mnemonic-story'],
    rationale:
      '학교가 정한 목록이 처음 들어온다(2022 개정 교육과정). 파생어도 여기서 열린다 — '
      + '규칙적인 접미사(-er·-ly)는 초등 고학년이 이미 쓰는 말이다.',
  },
  {
    step: 3,
    volumeTitle: `${VOCAB_SERIES_BRAND} 2`,
    wordsPerDay: 20,
    opens: [
      'root-etymology', 'collocation', 'confusable', 'pos-focus',
      'chapter-companion', 'unlock', 'recycle',
    ],
    rationale:
      '어원이 열린다 — 시장이 중등부터 어원편을 따로 파는 자리와 같다. **연어도 여기서 연다**: '
      + '중학 서술형이 낱말이 아니라 덩어리를 요구하기 시작한다. 학습 이력이 쌓여 '
      + '`unlock`·`recycle` 이 성립하는 첫 계단이기도 하다.',
  },
  {
    step: 4,
    volumeTitle: `${VOCAB_SERIES_BRAND} 3`,
    wordsPerDay: 25,
    opens: ['synonym-cluster', 'antonym-pair', 'phrasal-idiom', 'polysemy', 'confusion-log'],
    rationale:
      '뜻이 겹치고 갈리는 자리. 시장의 `반의어/혼동어/다의어` PART 가 여기 대응한다. '
      + '오답 로그(`confusion-log`)는 헷갈린 짝이 실제로 쌓여야 쓸 수 있어 이 계단부터다.',
  },
  {
    step: 5,
    volumeTitle: `${VOCAB_SERIES_BRAND} 4`,
    wordsPerDay: 30,
    opens: ['exam-list', 'level-band', 'academic-awl', 'news-article'],
    rationale:
      '학평 대응. 출제 기관 빈출 목록이 처음 들어온다 — 이 계단부터 학습자의 목적이 '
      + '"많이 아는 것" 에서 "시험에 나오는 것" 으로 바뀐다.',
  },
  {
    step: 6,
    volumeTitle: `${VOCAB_SERIES_BRAND} 5`,
    wordsPerDay: 35,
    opens: ['exam-items', 'domain-specialty', 'script-media', 'facet-ladder'],
    rationale:
      '기출에서 역산한 어휘가 열린다. 분야별(`domain-specialty`)도 여기서 여는데, '
      + '수능 지문이 과학·경제·예술로 갈리기 시작하는 자리이기 때문이다.',
  },
  {
    step: 7,
    volumeTitle: `${VOCAB_SERIES_BRAND} 6`,
    wordsPerDay: 40,
    opens: [],
    rationale:
      '수능 대응. **새로 여는 축이 없다 — 어휘 수준과 하루치가 다르다.** 시장의 최상단도 '
      + '같은 구조다(능률VOCA 수능 필수 → 수능 고난도: PART 구성은 같고 표제어가 어렵다). '
      + '하루 40 낱말은 시장 실측값이다(능률VOCA 고등 기본 STUDY PLAN `DAY 01–40`).',
  },
] as const

/**
 * 사다리를 만든다 — 계단 경계는 `SERIES_SPINE` 에서, 구성은 `OPENS_AT` 에서.
 *
 * 누적이라 계단 N 의 청사진 = 1..N 의 `opens` 합집합이다. 순서는 **처음 열린 순서**를
 * 지킨다(Set 이 삽입 순서를 보존한다) — 화면이 "이 계단에서 새로 열린 것" 을 뒤에서부터
 * 셀 수 있어야 하기 때문이다.
 */
export function vocabRungs(): VocabRung[] {
  const acc: VocabBlueprintId[] = []
  return OPENS_AT.map((o) => {
    const base = SERIES_SPINE.find((r) => r.step === o.step)
    if (!base) throw new Error(`사다리에 ${o.step}단이 없다 — SERIES_SPINE 과 어긋났다`)
    acc.push(...o.opens)
    return {
      step: o.step,
      vLevels: [...base.vLevels],
      schoolBand: base.schoolBand,
      volumeTitle: o.volumeTitle,
      blueprints: [...acc],
      wordsPerDay: o.wordsPerDay,
      rationale: o.rationale,
    }
  })
}

/** 그 계단에서 **처음 열리는** 청사진. 화면이 "새로 생긴 것" 을 표시할 때 쓴다. */
export function opensAtStep(step: number): VocabBlueprintId[] {
  return [...(OPENS_AT.find((o) => o.step === step)?.opens ?? [])]
}

/** V-Level → 계단. 사다리 밖(V0 유치원 · V8+ 성인)이면 null. */
export function rungForVLevel(vLevel: number): VocabRung | null {
  return vocabRungs().find((r) => r.vLevels.includes(vLevel)) ?? null
}

export const VOCAB_SPINE: readonly VocabRung[] = vocabRungs()
