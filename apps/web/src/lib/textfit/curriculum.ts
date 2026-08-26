// apps/web/src/lib/textfit/curriculum.ts
//
// **2022 개정 교육과정 기본 어휘** — 한국 교사가 실제로 행동하는 축.
//
// ── 왜 이 축인가 (2026-08-26) ───────────────────────────────────────
// 제품의 난이도 축은 V-Level 이고, `LEVEL_LABEL` 이 그것을 "중1–2 · 고1 · 고2·수능 기본"
// 같은 이름으로 옮긴다. 그런데 그 사다리는 **자기참조**다 — `CATEGORY_VLEVEL` 을 따를 뿐,
// 바깥의 어떤 기준에도 정박해 있지 않다. 교사가 "고1 92%" 를 믿을 근거가 제품 안에만 있다.
//
// 교육과정 기본 어휘는 다르다. 교육부 고시 제2022-33호 [별책 14] pp.254-290 으로 관보에
// 공개돼 있고, **교과서 검정이 이 목록으로 이뤄진다**(KICE Word Lister). 교사·출판사·
// 평가원이 이미 같은 말을 쓴다. "이 지문에 교육과정 밖 낱말이 12개" 는 설명이 필요 없다.
//
// ── 데이터는 처음부터 있었다 ────────────────────────────────────────
// `shared_dictionary.list_tags` 에 3,025개가 계층까지 나뉘어 들어 있었고, **어느 화면도
// 쓰지 않았다.** 새로 받아 올 것이 없었다(2026-08-26 실측).
//
// ⚠️ 태그 이름의 숫자는 **난이도 순서가 아니다** — `kcurr2022_1` 이 초등이고 `_0` 이 가장
//    어렵다. 그대로 화면에 쓰면 순서가 뒤집힌다. 그래서 밴드로 옮기는 자리를 하나만 둔다.

/** 밴드 — 숫자가 클수록 나중에 배운다. RPC `curriculum_bands` 가 이 값을 돌려준다. */
export type CurriculumBand = 1 | 2 | 3

export const CURRICULUM_BAND_LABEL: Record<CurriculumBand, string> = {
  1: '초등 권장',
  2: '중·고 공통',
  3: '그 외 과목',
}

/** 고시 원문의 표시 — 교사가 목록에서 보는 그대로. */
export const CURRICULUM_BAND_MARK: Record<CurriculumBand, string> = {
  1: '*',
  2: '**',
  3: '',
}

/**
 * 고시가 명시한 각 계층의 낱말 수.
 *
 * 사전이 가진 수(808 · 1,211 · 1,006 = 3,025)와 조금 다르다 — 변이형을 별도 표제어로
 * 갖고 있기 때문이다. **화면에는 고시의 수를 쓴다.** 우리 사전의 사정을 교사에게
 * 설명할 이유가 없고, 교사가 아는 숫자는 고시의 것이다.
 */
export const CURRICULUM_OFFICIAL_COUNT: Record<CurriculumBand, number> = {
  1: 800,
  2: 1200,
  3: 1000,
}

export const CURRICULUM_TOTAL = 3000

/** 낱말 하나의 판정. `band === null` 이면 **교육과정 기본 어휘 밖**이다. */
export interface CurriculumMark {
  band: CurriculumBand | null
  /**
   * 수능 기출(2014~ 13년치)에 나온 적이 있는가.
   *
   * ⚠️ 이 값은 **파생형으로 확장하지 않는다.** 밴드와 다르다 — 밴드는 "이 목록에 속하는가"
   *    라는 분류라 원형의 것을 물려받는 게 맞지만, 출제는 **일어난 일**이다.
   *    `teacher` 가 나왔다고 `teach` 가 나온 것이 아니다.
   */
  csat: boolean
  /**
   * 밴드를 **원형에서 물려받았는가**.
   *
   * 고시의 목록은 원형만 싣는다(`teach` 는 있고 `teacher` 는 없다) — 파생어는 규칙으로
   * 인정되는 것이 이 목록의 관행이다. 그대로 대조하면 `teacher`·`computer`·`different` 가
   * 전부 "교육과정 밖" 으로 세어져 **교사가 보는 숫자가 부풀려진다**(2026-08-26 실측).
   * 사전의 `derived_forms` 로만 물려준다 — 접미사를 추측해 만들지 않는다.
   */
  viaDerived: boolean
}

export interface CurriculumSummary {
  /** 판정 대상이 된 내용어 수 (기능어·미해결 제외). */
  considered: number
  /** 밴드별 낱말 수. */
  inBand: Record<CurriculumBand, number>
  /** 교육과정 기본 어휘 **밖** 낱말 수 — 교사가 행동하는 숫자. */
  outside: number
  /** 그중 원형에서 물려받아 **안**으로 센 것 — 대조 방식을 화면이 밝힐 수 있게. */
  viaDerived: number
  /** 그중 수능 기출인 것 — "교육과정 밖이지만 시험에는 나온다". */
  outsideButCsat: number
}

/**
 * 낱말 목록을 요약한다.
 *
 * `marks` 에 없는 낱말은 **밖**으로 센다 — RPC 는 태그가 하나도 없는 낱말을 아예
 * 돌려주지 않기 때문이다(응답을 필요한 것만으로 유지한다). 없는 것을 "모른다" 로 두면
 * 교사가 보는 숫자가 조용히 줄어든다.
 */
export function summarizeCurriculum(
  lemmas: readonly string[],
  marks: ReadonlyMap<string, CurriculumMark>,
): CurriculumSummary {
  const inBand: Record<CurriculumBand, number> = { 1: 0, 2: 0, 3: 0 }
  let outside = 0
  let outsideButCsat = 0
  let viaDerived = 0

  for (const lemma of lemmas) {
    const m = marks.get(lemma)
    if (m?.band) {
      inBand[m.band] += 1
      if (m.viaDerived) viaDerived += 1
      continue
    }
    outside += 1
    if (m?.csat) outsideButCsat += 1
  }

  return { considered: lemmas.length, inBand, outside, outsideButCsat, viaDerived }
}
