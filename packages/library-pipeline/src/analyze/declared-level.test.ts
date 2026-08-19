// packages/library-pipeline/src/analyze/declared-level.test.ts
//
// 실측 2026-08-20 의 두 사례를 회귀로 못 박는다.
//   ① Poe 'The Tell-Tale Heart' (VOA Level 3) 가 A2 로 매겨졌다 — 2밴드 쉽게.
//   ② lets-learn-english (VOA Level 1) 5편이 B2 로 매겨졌다 — 2밴드 어렵게.
// 두 방향 모두 잡혀야 한다. 한쪽만 잡으면 반대 방향 오분류가 조용히 남는다.

import { describe, expect, it } from 'vitest'

import {
  CONTRADICTION_BANDS,
  crossCheckDeclaredLevel,
  DECLARED_LEVEL_CEFR,
} from './declared-level'

describe('crossCheckDeclaredLevel', () => {
  it('Poe(Level 3)가 A2 로 나온 실제 사례를 잡는다 — 2밴드 쉽게', () => {
    const r = crossCheckDeclaredLevel(3, 'A2')
    expect(r.contradicts).toBe(true)
    expect(r.gapBands).toBe(2)
    expect(r.note).toContain('쉽게')
    expect(r.note).toContain('Level 3')
  })

  it('Level 1 이 B2 로 나온 실제 사례를 잡는다 — 반대 방향도 잡아야 한다', () => {
    const r = crossCheckDeclaredLevel(1, 'B2')
    expect(r.contradicts).toBe(true)
    expect(r.note).toContain('어렵게')
  })

  it('선언 범위 안이면 조용하다', () => {
    for (const [lvl, band] of [
      [1, 'A1'],
      [1, 'A2'],
      [2, 'B1'],
      [3, 'B2'],
    ] as const) {
      const r = crossCheckDeclaredLevel(lvl, band)
      expect(r.contradicts, `${lvl}/${band}`).toBe(false)
      expect(r.note).toBeNull()
    }
  })

  it('1밴드 차이는 넘어간다 — 추정에 그 정도 폭은 정상이다', () => {
    expect(crossCheckDeclaredLevel(2, 'A2').contradicts).toBe(false)
    expect(crossCheckDeclaredLevel(2, 'B2').contradicts).toBe(false)
    expect(crossCheckDeclaredLevel(2, 'A2').gapBands).toBe(1)
  })

  it('레벨을 안 밝히는 소스는 대조 불가로 표시한다 — 0밴드 일치가 아니다', () => {
    // 이 둘을 뭉개면 "대조했는데 문제없음" 과 "대조 못 함" 이 같아 보인다.
    for (const v of [null, undefined, 0, 9]) {
      const r = crossCheckDeclaredLevel(v, 'B1')
      expect(r.comparable, String(v)).toBe(false)
      expect(r.contradicts).toBe(false)
    }
  })

  it('추정이 없으면 대조하지 않는다', () => {
    expect(crossCheckDeclaredLevel(3, null).comparable).toBe(false)
    expect(crossCheckDeclaredLevel(3, 'X9').comparable).toBe(false)
  })

  it('어느 쪽이 옳다고 단정하지 않는다', () => {
    // 발행사 라벨은 프로그램 단위이고 추정은 이 글의 실측이라, 글마다 답이 다르다.
    const note = crossCheckDeclaredLevel(3, 'A2').note ?? ''
    expect(note).toContain('어느 쪽도 그대로 믿을 수 없다')
  })

  it('임계값과 대응표는 근거가 있는 값이다', () => {
    expect(CONTRADICTION_BANDS).toBe(2)
    expect(DECLARED_LEVEL_CEFR[1]).toEqual(['A1', 'A2'])
    expect(DECLARED_LEVEL_CEFR[3]).toEqual(['B2'])
  })
})
