// packages/library-pipeline/src/textbook/rung-mix.ts
//
// **사다리 단수별 문항 구성 — 시장 밀도에서 유도한다.**
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// V3(중1-2) 권 120문항 중 **80문항이 수능 순서·삽입**이었다. 재고에 그것밖에 없어서였지
// 그 학년 교재라서가 아니었다. 시중 79종을 재 보면 유형은 난이도가 아니라
// **학년의 신분증**이다 (쪽당 등장률 ‰, `market-spec.json` `typeDensity`):
//
//              초등    중등    고등
//   word_order  36.7   19.9    7.3   ← 초등에서 가장 흔하고 고등에서 사라진다
//   unit_vocab   6.9   19.9    0.0
//   blank_word  12.6    0.9    2.0
//   order        0.0    3.8   30.4   ← 초등 0. 중등은 고등의 1/8
//   insert       0.0   10.4   31.2
//   blank        3.4    2.8   64.5   ← 고등에서 가장 흔하다
//   title        0.0   17.1   38.5
//
// 그래서 단수별 구성을 손으로 정하지 않고 **이 표에서 유도한다.** 손으로 정하면
// 다음 사람이 왜 그 숫자인지 알 수 없고, 시장이 바뀌어도 따라가지 못한다.

import spec from './market-spec.json'
import { SERIES_SPINE } from './series'

/** 밴드(V-Level) → 시장 규격의 학교급. `series.ts` 의 사다리를 따른다. */
export function schoolOfBand(band: number): '초등' | '중등' | '고등' {
  if (band <= 2) return '초등'
  if (band <= 4) return '중등'
  return '고등'
}

/**
 * 이 등장률 미만이면 그 학년 교재에 **실리지 않는 유형**으로 본다.
 *
 * 문턱을 2‰ 로 두는 근거: 표에서 값이 뚝 떨어지는 자리가 거기다
 * (중등 main_point 1.9 · blank_word 0.9 · grammar_fix 0.9 vs 그 위는 2.8 이상).
 * 0 으로 두면 오탐 한 번에 유형이 열리고, 5 로 두면 중등의 절반이 닫힌다.
 */
export const RUNG_TYPE_FLOOR_PER_MILLE = 2

export interface RungMix {
  school: '초등' | '중등' | '고등'
  /** 이 단수가 쓸 수 있는 유형. 시장에서 그 학년에 실제로 실리는 것만. */
  allowedTypes: string[]
  /** 유형별 목표 비중(합 1). 조합기가 이 비율을 겨냥한다. */
  targetShare: Record<string, number>
  /** 뼈대(순서·삽입) 칸 수. 시장 비중에 맞춰 줄인다. */
  slots: { order: number; insert: number }
  /** 단원당 덧붙임 문항 수. 뼈대가 줄면 그만큼 늘어 단원 크기를 지킨다. */
  extraPerUnit: number
  /** 목표 비중을 무엇에서 유도했나 — 시장 실측인가, 사다리 설계 의도인가. */
  derivedFrom: 'market' | 'ladder'
}

/** 한 단원의 문항 수 — 시중 교재 한 단원도 대개 5~8문항이다. */
export const ITEMS_PER_UNIT = 6

/**
 * 밴드의 문항 구성을 시장 밀도에서 유도한다.
 *
 * @param band V-Level (1~7)
 * @param available 우리가 실제로 가진 유형. 주면 그 안에서만 고른다 —
 *   시장에 있어도 재고가 없으면 비중을 0 으로 두어야 다른 유형이 그 자리를 메운다.
 *
 * ⚠️ **유형을 새로 열면 적합도가 먼저 떨어진다.** 목표는 `available` 안에서 다시
 *    정규화되므로, 없던 유형이 하나 생기면 그 유형이 곧바로 큰 목표 비중을 갖는다.
 *    조금만 넣으면 미달분이 그대로 감점된다 — 실측(V7 · 20단원 120문항):
 *
 *      topic 0건   적합도 69.4%   (7유형으로 정규화)
 *      topic 10건  적합도 68.8%   ← **내려갔다.** 8유형이 되며 topic 목표가 17.5%(21문항)
 *      topic 20건  적합도 77.1%   (16.7% 로 목표에 근접)
 *
 *    그래서 새 유형은 **목표 비중을 채울 만큼 한 번에** 넣어야 한다. 한 청크만 넣고
 *    "효과가 없다" 고 판단하면 정반대로 읽는 것이다.
 */
export function rungMix(band: number, available?: Iterable<string>): RungMix {
  const school = schoolOfBand(band)
  const density = (spec as {
    typeDensity: { bySchool: Record<string, { densityPerPage: Record<string, number> }> }
  }).typeDensity.bySchool[school]?.densityPerPage ?? {}

  let have = available ? new Set(available) : null

  // ⚠️ **시장 표가 이 단수를 아예 모를 수 있다.**
  //   코퍼스의 "초등" 은 달곰한 Literacy·리딩튜터 스타터 같은 **초3~초6 독해서**다.
  //   저학년 파닉스 교재 표본이 없어 `rhyme`·`word_meaning`·`spell_blank` 는 밀도 0 이다.
  //   그런데 V1 풀에 다른 유형이 몇 개라도 섞여 있으면 그쪽이 목표를 독차지하고
  //   **정작 그 단수가 쓰는 유형이 0 몫**이 된다 — 실측 2026-08-30: V1 조합 0단원.
  //
  //   그래서 **그 단수의 사다리 유형 중 밀도가 있는 것이 하나도 없을 때만**
  //   사다리(`series.ts`)로 좁힌다. 중·고등은 밀도가 말해 주므로 그대로 시장을 따른다
  //   (여기를 넓히면 시장 실측으로 얻은 V3 93.4% · V4 95.0% 가 후퇴한다).
  const rungTypes = SERIES_SPINE.find((r) => r.vLevels.includes(band))?.types ?? []
  const rungHasDensity = rungTypes.some((t) => (density[t] ?? 0) * 1000 >= RUNG_TYPE_FLOOR_PER_MILLE)
  if (rungTypes.length > 0 && !rungHasDensity) {
    const rung = new Set<string>(rungTypes)
    have = have ? new Set([...have].filter((t) => rung.has(t))) : rung
  }

  const kept: Array<[string, number]> = Object.entries(density)
    .filter(([type, d]) => d * 1000 >= RUNG_TYPE_FLOOR_PER_MILLE && (!have || have.has(type)))

  const total = kept.reduce((a, [, d]) => a + d, 0)
  const targetShare: Record<string, number> = {}
  for (const [type, d] of kept) targetShare[type] = total ? d / total : 0

  // ⚠️ **시장 표가 말할 수 없는 자리가 있다.** 코퍼스의 "초등" 은 초3~초6 독해서라
  //   저학년 파닉스 교재 표본이 없다. 그래서 `rhyme`·`word_meaning`·`spell_blank` 는
  //   밀도 0 이고, 그대로 두면 그 유형만 가진 밴드의 목표가 **통째로 비어** 권이 안 나온다
  //   (실측 2026-08-30: V1 조합 0단원).
  //   그 경우에만 사다리(`series.ts`)의 설계 의도를 따라 **가진 유형에 고르게** 나눈다.
  //   근거가 다르므로 `derivedFrom` 으로 구분해 둔다 — 시장 실측인 척하지 않는다.
  const derivedFrom: 'market' | 'ladder' = kept.length > 0 ? 'market' : 'ladder'
  if (derivedFrom === 'ladder' && have && have.size > 0) {
    const each = 1 / have.size
    for (const t of have) targetShare[t] = each
  }

  // 뼈대는 순서·삽입이다. 시장 비중만큼만 준다 — 재고가 많다고 더 싣지 않는다.
  const skeletonShare = (targetShare.order ?? 0) + (targetShare.insert ?? 0)
  const skeleton = Math.round(ITEMS_PER_UNIT * skeletonShare)
  const orderShare = skeletonShare ? (targetShare.order ?? 0) / skeletonShare : 0
  const order = Math.round(skeleton * orderShare)
  const insert = skeleton - order

  return {
    school,
    allowedTypes: Object.keys(targetShare).sort(),
    derivedFrom,
    targetShare,
    slots: { order, insert },
    extraPerUnit: Math.max(0, ITEMS_PER_UNIT - order - insert),
  }
}

/**
 * 만들어진 권의 유형 구성이 시장과 얼마나 맞는가 — 0~1.
 *
 * **총변이거리**를 쓴다: 두 분포의 차이 절댓값 합의 절반. 1 에서 빼면 겹치는 비율이 된다.
 * 코사인 유사도는 한쪽이 0 인 유형을 벌하지 않아 "시장에 없는 유형만 잔뜩" 을 못 잡는다.
 */
export function typeMixFit(
  actual: Record<string, number>,
  target: Record<string, number>,
): number {
  const totalA = Object.values(actual).reduce((a, b) => a + b, 0)
  if (totalA === 0) return 0
  const types = new Set([...Object.keys(actual), ...Object.keys(target)])
  let diff = 0
  for (const t of types) {
    diff += Math.abs((actual[t] ?? 0) / totalA - (target[t] ?? 0))
  }
  return Number(Math.max(0, 1 - diff / 2).toFixed(4))
}
