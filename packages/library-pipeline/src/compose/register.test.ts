// packages/library-pipeline/src/compose/register.test.ts
//
// 문체 하한 — 천장 지표가 못 보는 방향을 못 박는다.

import { describe, expect, it } from 'vitest'

import { REGISTER_FLOOR, checkRegisterFloor, meanWordChars } from './spine'

const EASY =
  'The plant takes water from the river. It has no other way to cool. So the company had to stop it.'
const DENSE =
  'Infrastructure is rarely as independent as it appears, and prolonged environmental stress ' +
  'demonstrates that dependence by withdrawing a condition operators quietly presupposed.'

describe('문체 하한', () => {
  it('평균 낱말 길이가 문체를 가른다 — 쉬운 글이 낮게 나온다', () => {
    expect(meanWordChars(EASY)).toBeLessThan(meanWordChars(DENSE))
    expect(meanWordChars('')).toBe(0)
  })

  it('초등에는 하한을 두지 않는다 — 그 밴드에서 쉬움은 결함이 아니다', () => {
    expect(REGISTER_FLOOR.elementary).toBeUndefined()
    const r = checkRegisterFloor('elementary', EASY)
    expect(r.verdict).toBe('UNCALIBRATED')
    expect(r.detail).toContain('결함이 아니다')
  })

  it('중등·고등은 너무 쉬운 글을 잡는다 — 천장 지표는 이걸 못 본다', () => {
    // 실측: 중등 발주로 쓴 글이 밴드 초과 2.1%(표본 중앙값보다 좋음)를 받고도
    //   평균 낱말 4.25자로 초등 수준 문체였다.
    for (const band of ['middle', 'high'] as const) {
      expect(checkRegisterFloor(band, EASY).verdict).toBe('WARN')
      expect(checkRegisterFloor(band, EASY).detail).toContain('너무 쉽다')
    }
  })

  it('충분히 밀도 있는 글은 통과한다', () => {
    expect(checkRegisterFloor('middle', DENSE).verdict).toBe('PASS')
    expect(checkRegisterFloor('high', DENSE).verdict).toBe('PASS')
  })

  it('하한은 밴드가 올라갈수록 높아진다', () => {
    expect(REGISTER_FLOOR.middle!.minWordChars).toBeLessThan(REGISTER_FLOOR.high!.minWordChars)
  })

  it('모든 하한에 근거가 붙어 있다', () => {
    for (const f of Object.values(REGISTER_FLOOR)) {
      expect(f!.basis.length).toBeGreaterThan(15)
    }
  })
})
