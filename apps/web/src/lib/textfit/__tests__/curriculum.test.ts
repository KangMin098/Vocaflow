// apps/web/src/lib/textfit/__tests__/curriculum.test.ts
//
// 교사에게 보이는 **숫자가 조용히 틀리는 것**을 막는다.
//
// 두 가지가 특히 위험하다:
//   1. 태그 이름의 숫자(`kcurr2022_0/1/2`)는 **난이도 순서가 아니다** — `_1` 이 초등이고
//      `_0` 이 가장 어렵다. 그대로 쓰면 화면에서 초등이 3단계로 보인다.
//   2. RPC 는 태그가 없는 낱말을 **아예 돌려주지 않는다.** 없는 것을 "모른다" 로 두면
//      "교육과정 밖 N개" 가 조용히 줄어든다 — 교사가 행동하는 바로 그 숫자다.

import { describe, expect, it } from 'vitest'

import {
  CURRICULUM_BAND_LABEL,
  CURRICULUM_BAND_MARK,
  CURRICULUM_OFFICIAL_COUNT,
  CURRICULUM_TOTAL,
  summarizeCurriculum,
  type CurriculumMark,
} from '../curriculum'

type MarkInput = Omit<CurriculumMark, 'viaDerived'> & { viaDerived?: boolean }

function marks(entries: Record<string, MarkInput>): Map<string, CurriculumMark> {
  return new Map(
    Object.entries(entries).map(([w, m]) => [w, { viaDerived: false, ...m }]),
  )
}

describe('교육과정 기본 어휘 요약', () => {
  it('밴드 순서가 학습 순서다 — 1 초등 · 2 중고 공통 · 3 그 외', () => {
    expect(CURRICULUM_BAND_LABEL[1]).toBe('초등 권장')
    expect(CURRICULUM_BAND_LABEL[2]).toBe('중·고 공통')
    expect(CURRICULUM_BAND_LABEL[3]).toBe('그 외 과목')
    // 고시 원문 표시 — 교사가 목록에서 보는 그대로
    expect(CURRICULUM_BAND_MARK[1]).toBe('*')
    expect(CURRICULUM_BAND_MARK[2]).toBe('**')
  })

  it('화면에 쓰는 개수는 고시의 것이다 — 800 + 1,200 + 1,000 = 3,000', () => {
    const sum =
      CURRICULUM_OFFICIAL_COUNT[1] + CURRICULUM_OFFICIAL_COUNT[2] + CURRICULUM_OFFICIAL_COUNT[3]
    expect(sum).toBe(CURRICULUM_TOTAL)
  })

  it('표에 없는 낱말은 **밖**으로 센다 — RPC 가 무태그 낱말을 안 돌려주기 때문이다', () => {
    const s = summarizeCurriculum(
      ['have', 'other', 'apparent', 'photosynthesis', 'intricate'],
      marks({
        have: { band: 1, csat: true },
        other: { band: 2, csat: false },
        apparent: { band: 3, csat: true },
        // photosynthesis · intricate 는 RPC 응답에 없다 = 교육과정 밖
      }),
    )
    expect(s.inBand).toEqual({ 1: 1, 2: 1, 3: 1 })
    expect(s.outside).toBe(2)
    expect(s.considered).toBe(5)
  })

  it('원형에서 물려받은 것을 따로 센다 — 대조 방식을 화면이 밝힐 수 있어야 한다', () => {
    // 고시 목록은 원형만 싣는다(`teach` 있고 `teacher` 없다). 그대로 대조하면
    // teacher·computer·different 가 전부 "밖" 이 되어 숫자가 부풀려진다(2026-08-26 실측).
    const s = summarizeCurriculum(
      ['teach', 'teacher', 'photosynthesis'],
      marks({
        teach: { band: 1, csat: true },
        teacher: { band: 1, csat: true, viaDerived: true },
      }),
    )
    expect(s.inBand[1]).toBe(2)
    expect(s.viaDerived).toBe(1)
    expect(s.outside).toBe(1)
  })

  it('수능 표시는 파생형으로 늘리지 않는다 — 출제는 분류가 아니라 일어난 일이다', () => {
    // 밴드는 물려받아도 csat 은 그 낱말 자신이 나왔을 때만 참이다.
    const s = summarizeCurriculum(
      ['nuance'],
      marks({ nuance: { band: null, csat: true } }),
    )
    expect(s.outsideButCsat).toBe(1)
  })

  it('교육과정 밖인데 수능에는 나온 낱말을 따로 센다 — 교사가 가장 먼저 보는 칸이다', () => {
    // 실측: 수능 13년치 5,254개 중 3,108개가 교육과정 기본 어휘 밖이다.
    const s = summarizeCurriculum(
      ['nuance', 'photosynthesis'],
      marks({ nuance: { band: null, csat: true } }),
    )
    expect(s.outside).toBe(2)
    expect(s.outsideButCsat).toBe(1)
  })

  it('빈 지문에도 답한다 — 0 은 오류가 아니다', () => {
    const s = summarizeCurriculum([], new Map())
    expect(s).toEqual({
      considered: 0,
      inBand: { 1: 0, 2: 0, 3: 0 },
      outside: 0,
      outsideButCsat: 0,
      viaDerived: 0,
    })
  })
})
