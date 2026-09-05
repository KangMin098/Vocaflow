// packages/library-pipeline/src/textbook/readability.ts
//
// **학년 난이도 눈금 — 이 저장소의 정본.**
//
// ── 왜 패키지가 소유하는가 ───────────────────────────────────────────
// 같은 공식이 세 군데에 흩어져 있었다 — `textbook-corpus/analyze.mjs`(시중 79종을 잰 쪽) ·
// `grade-level-bench.mjs` · `kid-source-probe.mjs`. 세 벌 중 하나만 손대면 **시중 값과
// 우리 값이 조용히 다른 자로 재어지고**, 그러면 "중1 교재는 7.60인데 우리 지문은 6.6" 같은
// 비교가 전부 무의미해진다. 눈금은 한 곳에 둔다.
//
// (`analyze.mjs` 는 저장소 밖 코퍼스를 다루는 독립 도구라 자기 사본을 유지한다 —
//  대신 `readability-parity.test.ts` 가 두 구현이 같은 답을 내는지 못 박는다.)
//
// ── 왜 FK 인가, 그리고 무엇을 못 보는가 ──────────────────────────────
// 시중 코퍼스가 79종을 Flesch-Kincaid 로 재 놓았고 학년대와 단조 증가한다.
// 그래서 우리 지문을 같은 자로 재면 "그 학년 교재인가" 를 물을 수 있다.
//
// ⚠️ **FK 는 어휘 친숙도를 모른다** — `photosynthesis` 와 `unhappiness` 를 같은 5음절로 센다.
//   NASA 사진 설명글은 문장이 길어 FK 가 높게 나왔지만, 정작 더 결정적인 사실은
//   **내용어의 64%가 2022 개정 교육과정 별표 밖**이라는 것이었다. FK 는 그걸 못 본다.
//   그래서 판정은 늘 CEFR·교육과정 별표와 **함께** 한다.

/**
 * 음절 근사 — 모음군 개수. 끝의 묵음 e 와 -le 예외를 다룬다.
 *
 * `textbook-corpus/analyze.mjs` 의 구현과 **글자 하나까지 같아야 한다.**
 * 시중 79종이 그 구현으로 재어졌기 때문이다.
 */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return 0
  if (w.length <= 3) return 1
  const s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = s.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

export interface Readability {
  /** Flesch-Kincaid 학년. 시중 사다리와 같은 눈금. */
  fk: number
  /** 평균 문장 길이(낱말). 시중 중1 교재가 13.9어다. */
  sentenceLength: number
  syllablesPerWord: number
  words: number
  sentences: number
}

/**
 * 글의 가독성. 문장이나 낱말이 없으면 `null` — **0 을 돌려주지 않는다.**
 * 0 은 "아주 쉽다" 로 읽히고, 그러면 잴 수 없는 글이 초등 칸에 들어간다.
 */
export function readability(text: string): Readability | null {
  const t = String(text ?? '')
  const sentences = (t.match(/[.!?]["')\]]*(\s|$)/g) || []).length
  const words = t.match(/[A-Za-z][A-Za-z'-]*/g) || []
  if (!sentences || !words.length) return null
  let syl = 0
  for (const w of words) syl += syllables(w)
  const sentenceLength = words.length / sentences
  const syllablesPerWord = syl / words.length
  return {
    fk: +(0.39 * sentenceLength + 11.8 * syllablesPerWord - 15.59).toFixed(2),
    sentenceLength: +sentenceLength.toFixed(1),
    syllablesPerWord: +syllablesPerWord.toFixed(3),
    words: words.length,
    sentences,
  }
}

/** 편의 — FK 만 필요한 자리. */
export const fkGrade = (text: string): number | null => readability(text)?.fk ?? null

/**
 * ⚠️ **`compose/spine.ts` 의 `GRADE_BANDS` 와 다른 것이다.** 이름이 비슷해 반드시 헷갈리므로 갈라 둔다:
 *
 *     `compose/spine.GRADE_BANDS`   재저작을 **쓸 때** 쓰는 학령 지시문(elementary/middle/high).
 *                                  "한 문장에 한 가지만" 같은 지침과 목표 문장길이를 담는다.
 *     `textbook/READING_LEVEL_BANDS` 이미 있는 글을 **골라낼 때** 쓰는 FK 창.
 *
 * 둘은 독립적으로 만들어졌는데 문장 길이가 서로 들어맞는다 —
 * spine 의 초등 9어 · 중등 14어 는 이 사다리의 시중 실측(초5~6 9.3어 · 중1 13.9어)과 거의 같다.
 * 다만 **어수는 갈린다** — spine 은 중등을 180~320어로 보고 교재 지문 창은 42~173어다.
 * 쓰는 곳이 다르기 때문이지만(재저작문 ≠ 교재 지문), 몰라서 섞으면 틀린 길이를 만든다.
 */
export interface ReadingLevelBand {
  id: string
  /** FK 창. 시중 학년대 실측을 이웃까지 걸쳐 넓힌 값이다. */
  fkMin: number
  fkMax: number
  /** 지문 어수 창 — **모든 칸이 같다**(`PASSAGE_WORDS` 참조). */
  wordsMin: number
  wordsMax: number
  /** 시중 실측 FK 중앙 — 창을 왜 그렇게 잡았는지의 근거. */
  marketFk: number
  /**
   * 어휘 자를 어느 쪽으로 대는가(`curriculumFit` · `marketPercentile` 의 인자).
   *
   * ⚠️ **여기 있는 이유**: 이 표를 쓰는 쪽이 학교급을 따로 적고 있었다
   * (`grade-level-bench.mjs` 에 사본 하나). 두 곳이 갈리면 **같은 지문의 판정이 갈린다** —
   * 초등 자와 중등 자는 문턱도 분포도 다르다. 그래서 밴드가 스스로 들고 있게 한다.
   */
  school: 'elementary' | 'middle'
}

/**
 * 지문 어수 창 — **학년마다 다르게 두지 않는다.**
 *
 * ── 근거: 교재가 스스로 인쇄한 어수 (실측 2026-09-03 · n=59 · 6시리즈) ──────
 * 시중 초·중 독해 교재 131쪽에 `129 words` 처럼 그 지문의 어수가 박혀 있다.
 * 추정이 아니라 출판사가 밝힌 값이고, 모아 보면:
 *
 *     최소 97 · p10 107 · p25 118 · 중앙 132 · p75 150 · p90 177 · 최대 198
 *
 * **97어 미만이 한 건도 없다.** 초등 계열도 초6 118어 · 초6~중1 117어다.
 *
 * ── 그런데 더 중요한 것 — **어수는 학년을 가르지 못한다** ──────────────
 * 학년대별로 갈라 보면 `중1~중3` 한 밴드(n=46)가 **97~198어**로 전체 범위와 같다.
 * 즉 같은 학년 교재 안에서 지문 길이가 두 배로 흔들린다.
 *
 *     중1~중3  n=46  97~198   ← 전체 범위와 동일
 *     초6~중3  n= 4  132~155
 *     초6      n= 1  118
 *
 * 그러니 학년마다 다른 길이 창을 두는 것은 **없는 신호를 있다고 하는 것**이다.
 * 길이는 하나로 두고 **학년은 난이도(FK)가 가른다.**
 *
 * ⚠️ `market-spec.json` 은 학년마다 다른 창을 갖고 있고(초6 44~121 · 중1 46~154)
 *   하한이 40어대다. 그쪽은 **쪽에서 영문 덩어리를 찾아내는 검출기** 추정이라
 *   직독직해·구문분석 조각이 섞였다(실측: 40~96어 블록의 36~91%가 조각 꼴).
 *   그 파일은 **건드리지 않았다** — 다른 곳에서도 쓰는 규격이고, 고치는 것은
 *   측정과 별개의 결정이다. 자세한 근거는 `docs/reports/passage-length-recheck-20260903.md`.
 *
 * ⚠️ 초등 표본이 n=1 이다. 이 창이 초등에도 맞는지는 **아직 모른다** —
 *   초등 교재에 표식이 더 있는 자료를 넣고 `passage-ruler.mjs` 를 다시 돌려야 한다.
 */
export const PASSAGE_WORDS = { min: 100, max: 200 } as const

/** 칸마다 퍼지는 값 — 다섯 칸이 **같은 창**을 쓴다는 것을 한 군데서 보이게 둔다. */
const SPREAD = { wordsMin: PASSAGE_WORDS.min, wordsMax: PASSAGE_WORDS.max }

/**
 * 학년 칸 — **시중 79종 실측에서 나온 값**이지 정한 값이 아니다.
 *
 *     초3~4 3.33 · 초5~6 4.42 · 초6 4.57 · 초6~중1 5.34 · 중1 7.60 · 중2 7.47 · 중3 10.67
 *
 * 한 점이 아니라 창으로 두는 이유: 같은 학년대 안에서도 교재마다 흔들린다
 * (중1 7.17~7.60 · 중3 7.74~10.67). 점으로 판정하면 멀쩡한 지문이 전부 부적합이 된다.
 *
 * ⚠️ 이 사다리는 **2개 출판사 8시리즈**에 기대고 있고 본책은 3종뿐이다(미리보기 17 · 정답해설 16).
 *   **순서는 믿을 만하고 절대값은 아직 얇다** — 출판사를 넓히면 값이 움직인다.
 */
export const READING_LEVEL_BANDS: readonly ReadingLevelBand[] = [
  { id: '초3~4', fkMin: 1.5, fkMax: 4.0, ...SPREAD, marketFk: 3.33, school: 'elementary' },
  { id: '초5~6', fkMin: 3.5, fkMax: 5.5, ...SPREAD, marketFk: 4.42, school: 'elementary' },
  { id: '초6~중1', fkMin: 4.5, fkMax: 7.0, ...SPREAD, marketFk: 5.34, school: 'elementary' },
  { id: '중1~2', fkMin: 6.5, fkMax: 9.0, ...SPREAD, marketFk: 7.6, school: 'middle' },
  { id: '중3', fkMin: 8.5, fkMax: 12.0, ...SPREAD, marketFk: 10.67, school: 'middle' },
] as const

export const gradeBand = (id: string): ReadingLevelBand | undefined =>
  READING_LEVEL_BANDS.find((b) => b.id === id)

/** FK 가 어느 칸인가. 창 밖이면 위/아래를 구분해 말한다 — "미달" 과 "초과" 는 처방이 다르다. */
export function bandOf(fk: number | null): string {
  if (fk == null) return '알 수 없음'
  return (
    READING_LEVEL_BANDS.find((b) => fk >= b.fkMin && fk <= b.fkMax)?.id ??
    (fk < READING_LEVEL_BANDS[0]!.fkMin ? '초3 미만' : '중3 초과')
  )
}
