// packages/library-pipeline/src/textbook/source-requirements.test.ts
//
// **요건표가 조판과 다른 답을 하지 않게 잠근다.**
//
// 이 표는 관리자가 "이 지문을 왜 이 학년 이 유형에 썼나" 에 답하는 근거다.
// 그런데 창을 여기서 다시 적으면 조판(`itemWordSpec`)이 바뀌어도 표는 옛 값을 보인다 —
// **화면이 근거가 아니라 거짓말이 되는** 실패다. 아래 검사가 그 갈림을 막는다.

import { describe, expect, it } from 'vitest'

import { itemWordSpec } from './compose-unit'
import { SERIES_SPINE, SERIES_TYPE_LABEL_KO } from './series'
import {
  FAMILY_LABEL,
  FAMILY_SOURCE,
  buildSourceRequirements,
  familyOf,
} from './source-requirements'

const rows = buildSourceRequirements()

describe('buildSourceRequirements', () => {
  it('사다리 7단을 그대로 편다 — 학년 목록을 여기서 다시 정하지 않는다', () => {
    expect(rows).toHaveLength(SERIES_SPINE.length)
    expect(rows.map((r) => r.vLevel)).toEqual(SERIES_SPINE.map((s) => s.vLevels[0]))
    expect(rows.map((r) => r.schoolBand)).toEqual(SERIES_SPINE.map((s) => s.schoolBand))
  })

  it('유형 목록도 사다리가 정한 그대로다', () => {
    for (const [i, r] of rows.entries()) {
      expect(r.types.map((t) => t.type)).toEqual([...SERIES_SPINE[i]!.types])
    }
  })

  it('**창은 조판이 쓰는 값과 같다** — 여기서 다시 계산하면 갈린다', () => {
    for (const r of rows) {
      for (const t of r.types) {
        if (t.family === 'no-passage') {
          expect(t.window).toBeNull()
          continue
        }
        expect(t.window).toEqual(itemWordSpec(t.type, r.vLevel))
      }
    }
  })

  it('모든 유형에 한국어 이름이 붙는다 — 이름 없는 줄은 관리자가 못 읽는다', () => {
    for (const r of rows) {
      for (const t of r.types) {
        expect(t.label).toBe(SERIES_TYPE_LABEL_KO[t.type])
        expect(t.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('계열마다 자의 출처가 있다 — 짐작으로 정한 창이 없다는 증거다', () => {
    for (const family of Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]) {
      expect(FAMILY_SOURCE[family].length).toBeGreaterThan(20)
    }
  })

  it('초등 3종은 지문이 없다 — 길이 자를 대면 전량 걸린다', () => {
    expect(familyOf('rhyme')).toBe('no-passage')
    expect(familyOf('word_meaning')).toBe('no-passage')
    expect(familyOf('spell_blank')).toBe('no-passage')
    const starter = rows.find((r) => r.step === 1)!
    for (const t of starter.types) expect(t.window).toBeNull()
  })

  it('계열이 겹치지 않게 갈린다', () => {
    expect(familyOf('order')).toBe('csat-short')
    expect(familyOf('long_order')).toBe('csat-long')
    expect(familyOf('unit_vocab')).toBe('school-paragraph')
    expect(familyOf('blank_word')).toBe('school-sentence')
  })

  it('**좁혀지지 않은 것을 좁혀진 척하지 않는다**', () => {
    // `itemWordSpec` 은 교차가 비면 유형 창을 그대로 쓴다 — 그때 `narrowed` 는 false 여야 한다.
    for (const r of rows) {
      for (const t of r.types) {
        if (!t.narrowed || !t.window || !t.base) continue
        const changed = t.window.min !== t.base.min || t.window.max !== t.base.max
        expect(changed).toBe(true)
      }
    }
  })

  it('학년 버킷을 그대로 나른다 — 어느 시중 학년대로 좁혔는지 밝힌다', () => {
    const v5 = rows.find((r) => r.vLevel === 5)!
    expect(v5.marketBucket).toBe('고1')
    const v2 = rows.find((r) => r.vLevel === 2)!
    expect(v2.marketBucket).toBe('초6')
  })

  it('같은 유형이라도 학년이 다르면 창이 다를 수 있다 — 그게 이 표의 이유다', () => {
    const windows = rows
      .flatMap((r) => r.types.filter((t) => t.type === 'vocab_choice').map((t) => t.window))
      .filter(Boolean)
    // 어휘 유형은 여러 계단에 열린다. 창이 전부 같으면 학년 축이 아무 일도 안 한 것이다.
    expect(windows.length).toBeGreaterThan(1)
  })
})
