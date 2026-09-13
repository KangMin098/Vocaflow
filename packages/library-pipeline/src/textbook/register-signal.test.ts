// packages/library-pipeline/src/textbook/register-signal.test.ts
//
// **논증 표지 자 — 길이를 재지 않고, 낱말 안에서 잡히지 않고, 짧은 글을 0 으로 속이지 않는다.**
//
// ── 이 자가 틀리면 무엇이 되는가 ──────────────────────────────────────
// 이 점수로 「어느 지문을 논증 문항에 쓸지」를 고른다. 틀려도 **아무것도 깨지지 않는다** —
// 조판은 돌고 문항도 나온다. 다만 설명문으로 빈칸추론을 만들게 된다.
//
// 실제로 만들면서 자가 세 번 틀렸다(2026-09-13):
//   ① 길이 정규화를 안 하면 긴 글이 자동으로 높은 점수를 받는다 → 장르가 아니라 길이를 잰다
//   ② 낱말 경계가 없으면 `claims` 가 `proclaims` 에서, `thus` 가 `enthusiasm` 에서 잡힌다
//   ③ 임계값을 기출 **p25** 로 뒀더니 0 이었다(기출은 평균 189어라 표지 없는 지문이 41%) →
//      모든 소스가 100% 통과해 **자가 아무것도 가르지 않았다**. 중앙값으로 바꿨다.

import { describe, expect, it } from 'vitest'

import {
  CSAT_MARKER_DENSITY_MEDIAN,
  CSAT_MARKER_PRESENCE_RATE,
  MARKER_GROUPS,
  MARKER_GROUP_IDS,
  MIN_MEASURABLE_WORDS,
  countWords,
  measureRegisterSignal,
} from './register-signal'

/** 같은 문장을 n 번 이어 길이만 늘린다 — 밀도는 그대로여야 한다. */
const repeat = (s: string, n: number) => Array.from({ length: n }, () => s).join(' ')

const SENT = 'However the study argues that the effect is small although the sample is large.'

describe('길이를 재지 않는다', () => {
  it('같은 문장을 몇 번 이어도 밀도가 같다', () => {
    const a = measureRegisterSignal(repeat(SENT, 4))!
    const b = measureRegisterSignal(repeat(SENT, 16))!
    expect(a.density).toBeCloseTo(b.density, 1)
    // 길이는 달라야 한다 — 같으면 이 검사가 아무것도 안 본 것이다
    expect(b.words).toBeGreaterThan(a.words * 3)
  })

  it('묶음별 값도 길이에 흔들리지 않는다', () => {
    // 변이 검사에서 드러난 구멍: density 만 보면 per[g] 의 정규화가 사라져도 통과한다.
    const a = measureRegisterSignal(repeat(SENT, 4))!
    const b = measureRegisterSignal(repeat(SENT, 16))!
    for (const g of MARKER_GROUP_IDS) {
      expect(a.per[g], `${g} 묶음이 길이에 따라 달라진다`).toBeCloseTo(b.per[g], 1)
    }
  })
})

describe('낱말 안에서 잡히지 않는다', () => {
  it('proclaims 는 claims 로 세지 않는다', () => {
    const bad = measureRegisterSignal(repeat('The king proclaims a holiday for everyone today.', 8))!
    expect(bad.per.stance).toBe(0)
  })

  it('enthusiasm 은 thus 로 세지 않는다', () => {
    const bad = measureRegisterSignal(repeat('Her enthusiasm for the subject was obvious today.', 8))!
    expect(bad.per.causal).toBe(0)
  })

  it('그래도 진짜 표지는 잡는다', () => {
    const good = measureRegisterSignal(repeat('The author claims one thing. Thus we disagree.', 8))!
    expect(good.per.stance).toBeGreaterThan(0)
    expect(good.per.causal).toBeGreaterThan(0)
  })

  it('구 표지는 줄바꿈이 끼어도 잡는다', () => {
    const text = repeat('On the\nother hand the result is weak and unclear here.', 8)
    expect(measureRegisterSignal(text)!.per.contrast).toBeGreaterThan(0)
  })

  it('대소문자를 가리지 않는다', () => {
    const lower = measureRegisterSignal(repeat('however this is true and that is false.', 10))!
    const upper = measureRegisterSignal(repeat('However this is true and that is false.', 10))!
    expect(lower.density).toBeCloseTo(upper.density, 2)
  })
})

describe('잴 수 없는 것을 0 으로 속이지 않는다', () => {
  it('너무 짧으면 null — 0 이 아니다', () => {
    expect(measureRegisterSignal('However short.')).toBeNull()
    expect(measureRegisterSignal('')).toBeNull()
    // 0 을 돌려주면 "표지 없음" 과 "잴 수 없음" 이 같은 값이 된다
    const long = measureRegisterSignal(repeat('This sentence has no discourse markers at all here.', 10))!
    expect(long.density).toBe(0)
    expect(long.present).toBe(false)
  })

  it('하한이 기출 평균 길이보다 짧다 — 기출을 못 재면 눈금을 못 만든다', () => {
    // 기출 지문 평균 189어. 하한이 그보다 크면 기준선 자체를 잴 수 없다.
    expect(MIN_MEASURABLE_WORDS).toBeLessThan(189)
  })
})

describe('눈금은 기출에서 나왔고 0 이 아니다', () => {
  it('임계값이 0 이 아니다 — 0 이면 모든 소스가 100% 통과한다', () => {
    // 첫 판에 p25(=0)를 썼고, 그 결과 21개 소스가 전부 100% 통과로 나왔다.
    expect(CSAT_MARKER_DENSITY_MEDIAN).toBeGreaterThan(0)
  })

  it('보유율은 비율이다 — 1 을 넘지 않는다', () => {
    expect(CSAT_MARKER_PRESENCE_RATE).toBeGreaterThan(0)
    expect(CSAT_MARKER_PRESENCE_RATE).toBeLessThanOrEqual(1)
  })

  it('임계값 판정이 밀도와 어긋나지 않는다', () => {
    const hi = measureRegisterSignal(repeat(SENT, 6))!
    expect(hi.atOrAboveCsatMedian).toBe(hi.density >= CSAT_MARKER_DENSITY_MEDIAN)
    const lo = measureRegisterSignal(repeat('Plain factual sentence with nothing notable inside.', 10))!
    expect(lo.atOrAboveCsatMedian).toBe(false)
  })
})

describe('묶음 표 — 비어 있거나 겹치지 않는다', () => {
  it('다섯 묶음이 모두 표지를 갖는다', () => {
    expect(MARKER_GROUP_IDS).toHaveLength(5)
    for (const g of MARKER_GROUP_IDS) {
      expect(MARKER_GROUPS[g].length, `${g} 묶음이 비었다`).toBeGreaterThan(0)
    }
  })

  it('같은 표지가 두 묶음에 들어 있지 않다 — 들어가면 두 번 세어진다', () => {
    const seen = new Map<string, string>()
    for (const g of MARKER_GROUP_IDS) {
      for (const w of MARKER_GROUPS[g]) {
        expect(seen.has(w), `'${w}' 가 ${seen.get(w)} 와 ${g} 에 모두 있다`).toBe(false)
        seen.set(w, g)
      }
    }
  })

  it('어수 세기가 공백을 기준으로 한다', () => {
    expect(countWords('one  two\nthree')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})
