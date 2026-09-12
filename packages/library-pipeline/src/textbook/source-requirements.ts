// packages/library-pipeline/src/textbook/source-requirements.ts
//
// **연령 × 유형별로 원문이 갖춰야 하는 것 — 한 표로 편다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// "이 지문을 왜 이 학년 이 유형에 썼나" 에 답하려면 **그 자리가 요구하는 규격**을
// 먼저 말할 수 있어야 한다. 규격은 이미 코드에 다 있다 — 다만 세 군데에 흩어져 있고
// 함수 안에서만 계산돼서, **화면에서 물어볼 방법이 없었다**:
//
//   유형이 정하는 창    `CSAT_ITEM_WORDS`(90~200) · `CSAT_LONG_ITEM_WORDS`(260~400) ·
//                      `SCHOOL_PARAGRAPH_WORDS`(40~200) · `SCHOOL_SENTENCE_WORDS`(6~40) ·
//                      `NO_PASSAGE_WORDS`(초등 3종 — 잴 지문이 없다)
//   학년이 좁히는 창    `market-spec.json` 의 그 학년대 p10~p90 (시중 79종 실측)
//   어느 학년에 어느 유형  `SERIES_SPINE` 7단
//
// 이 파일은 **새 규격을 만들지 않는다.** 셋을 곱해 한 줄씩 펼치기만 한다 —
// 자를 두 벌 두면 화면과 조판이 다른 답을 하는 날이 온다.
//
// ⚠️ **교차 결과가 비면 유형 창을 그대로 쓴다**(`itemWordSpec` 의 규칙). 좁히려다
//   재료를 0 으로 만들지 않기 위해서다. 그 경우 `narrowed` 가 `false` 이고,
//   화면은 "학년으로 좁히지 못했다" 를 그대로 보여야 한다 — 좁혀진 척하면 근거가 거짓이 된다.

import {
  CSAT_ITEM_WORDS,
  CSAT_LONG_ITEM_WORDS,
  ELEMENTARY_ITEM_TYPES,
  LONG_ITEM_TYPES,
  SCHOOL_PARAGRAPH_TYPES,
  SCHOOL_PARAGRAPH_WORDS,
  SCHOOL_SENTENCE_TYPES,
  SCHOOL_SENTENCE_WORDS,
  itemWordSpec,
} from './compose-unit'
import { V_TO_MARKET_BUCKET } from './level-chart'
import { SERIES_SPINE, SERIES_TYPE_LABEL_KO, type SeriesItemType } from './series'

/** 자의 계열 — **어느 창에서 왔는가**. 화면이 근거를 이 이름으로 말한다. */
export type RequirementFamily =
  | 'csat-short'
  | 'csat-long'
  | 'school-paragraph'
  | 'school-sentence'
  | 'no-passage'

export const FAMILY_LABEL: Record<RequirementFamily, string> = {
  'csat-short': '수능 짧은 지문',
  'csat-long': '수능 장문',
  'school-paragraph': '학교 시험 — 문단',
  'school-sentence': '학교 시험 — 문장',
  'no-passage': '지문 없음',
}

/** 계열별 기본 창의 출처 — 짐작이 아니라는 것을 화면에서 보이려고 함께 나른다. */
export const FAMILY_SOURCE: Record<RequirementFamily, string> = {
  'csat-short': 'compose-unit.CSAT_ITEM_WORDS — 수능 지문 상단(약 130어)에 여유를 둔 90~200',
  'csat-long': 'compose-unit.CSAT_LONG_ITEM_WORDS — 장문 집필 규격 300~340어 앞뒤로 260~400',
  'school-paragraph': 'compose-unit.SCHOOL_PARAGRAPH_WORDS — middle-choice 생성 규격 40~120어에 여유',
  'school-sentence': 'compose-unit.SCHOOL_SENTENCE_WORDS — middle-short 의 6~25어에 여유',
  'no-passage': '초등 3종은 사전 낱말 하나가 문항 하나다 — 잴 지문이 없다',
}

export function familyOf(type: string): RequirementFamily {
  if (ELEMENTARY_ITEM_TYPES.has(type)) return 'no-passage'
  if (LONG_ITEM_TYPES.has(type)) return 'csat-long'
  if (SCHOOL_SENTENCE_TYPES.has(type)) return 'school-sentence'
  if (SCHOOL_PARAGRAPH_TYPES.has(type)) return 'school-paragraph'
  return 'csat-short'
}

const BASE_WINDOW: Record<RequirementFamily, { min: number; max: number } | null> = {
  'csat-short': CSAT_ITEM_WORDS,
  'csat-long': CSAT_LONG_ITEM_WORDS,
  'school-paragraph': SCHOOL_PARAGRAPH_WORDS,
  'school-sentence': SCHOOL_SENTENCE_WORDS,
  'no-passage': null,
}

export interface TypeRequirement {
  type: SeriesItemType
  label: string
  family: RequirementFamily
  familyLabel: string
  /** 계열 기본 창. `no-passage` 면 `null`. */
  base: { min: number; max: number } | null
  /** 학년까지 반영한 최종 창 — 조판이 실제로 쓰는 값(`itemWordSpec`). */
  window: { min: number; max: number } | null
  /** 학년이 실제로 창을 좁혔는가. `false` 면 시중 표본이 없거나 교차가 비었다. */
  narrowed: boolean
  /** 좁힐 때 쓴 시중 학년대 버킷(`초6`·`중1`·`고1`…). 없으면 `null`. */
  marketBucket: string | null
}

export interface BandRequirements {
  step: number
  vLevel: number
  schoolBand: string
  volumeTitle: string
  marketBucket: string | null
  types: TypeRequirement[]
}

const same = (a: { min: number; max: number } | null, b: { min: number; max: number } | null) =>
  !!a && !!b && a.min === b.min && a.max === b.max

/**
 * 학령 사다리 7단을 유형별 요건으로 편다.
 *
 * **정본은 `SERIES_SPINE`** — 어느 학년에 어느 유형이 열리는지는 거기서만 정한다.
 * 창은 `itemWordSpec` 이 정한다. 이 함수는 둘을 곱해 화면이 읽을 모양으로 바꿀 뿐이다.
 */
export function buildSourceRequirements(): BandRequirements[] {
  return SERIES_SPINE.map((rung) => {
    const vLevel = rung.vLevels[0]!
    const bucket = V_TO_MARKET_BUCKET[vLevel] ?? null
    return {
      step: rung.step,
      vLevel,
      schoolBand: rung.schoolBand,
      volumeTitle: rung.volumeTitle,
      marketBucket: bucket,
      types: rung.types.map((type) => {
        const family = familyOf(type)
        const base = BASE_WINDOW[family]
        const spec = family === 'no-passage' ? null : itemWordSpec(type, vLevel)
        return {
          type,
          label: SERIES_TYPE_LABEL_KO[type],
          family,
          familyLabel: FAMILY_LABEL[family],
          base,
          window: spec,
          // 좁혀졌다 = 학년 버킷이 있고, 최종 창이 계열 기본 창과 다르다.
          narrowed: !!bucket && !!spec && !same(spec, base),
          marketBucket: bucket,
        }
      }),
    }
  })
}
