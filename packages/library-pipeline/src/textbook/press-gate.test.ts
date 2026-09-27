// packages/library-pipeline/src/textbook/press-gate.test.ts
//
// 조판 게이트 회귀. 이 판정은 **세 곳**(드레인 · ⑧ 화면 · 발행 승인)이 함께 쓰므로,
// 여기서 틀리면 세 곳이 같은 값으로 함께 틀린다 — 그래서 경계를 촘촘히 잠근다.

import { describe, expect, it } from 'vitest'

import { judgePressGate, summarizePressGate, type PressGateInput } from './press-gate'

/** 막는 것도 못 잰 것도 없는 권. 각 검사는 여기서 한 축만 바꾼다. */
const clean: PressGateInput = {
  series: 'reading',
  band: 6,
  items: 60,
  missingExplanations: 0,
  personaBlocked: 0,
  autoPassed: 10,
  autoTotal: 10,
  brandCurrent: true,
  hasContents: true,
  publishStatus: 'approved',
}

describe('조판 게이트', () => {
  it('깨끗한 권은 승인 대상이다', () => {
    const v = judgePressGate(clean)
    expect(v.blockers).toEqual([])
    expect(v.unmeasured).toEqual([])
    expect(v.approvable).toBe(true)
  })

  it('해설이 빠지면 막는다 — 해설 없는 책이 나간다', () => {
    const v = judgePressGate({ ...clean, missingExplanations: 4 })
    expect(v.blockers).toContain('해설 없는 문항 4')
    expect(v.approvable).toBe(false)
  })

  it('3인 검수에 막힌 문항이 있으면 막는다', () => {
    const v = judgePressGate({ ...clean, personaBlocked: 7 })
    expect(v.blockers).toContain('3인 검수 막힘 7')
    expect(v.approvable).toBe(false)
  })

  // ⚠️ 이 검사가 이 파일의 요점이다. null 을 0 으로 읽으면 **검수를 한 번도 안 돌린 권이
  //    깨끗한 권으로 승인 대상**이 된다 — 실측 2026-09-23 에 19권 중 12권이 그 상태였다.
  it('검수 기록이 없는 것은 **막힌 것이 아니라 안 본 것**이고, 승인 대상도 아니다', () => {
    const v = judgePressGate({ ...clean, personaBlocked: null })
    expect(v.blockers, '못 잰 것을 차단 사유로 세면 안 된다').toEqual([])
    expect(v.unmeasured).toContain('3인 검수 기록 없음')
    expect(v.approvable, '안 본 권을 승인 대상으로 세면 안 된다').toBe(false)
  })

  it('자동 검사가 안 돌았으면 「못 잼」이고, 떨어졌으면 「막힘」이다', () => {
    expect(judgePressGate({ ...clean, autoTotal: 0, autoPassed: 0 }).unmeasured).toContain(
      '자동 검사 안 돎',
    )
    expect(judgePressGate({ ...clean, autoPassed: 8 }).blockers).toContain('자동 검사 8/10')
  })

  it('옛 규격 · 목차 스냅샷 없음 · 내려진 권은 각각 막는다', () => {
    expect(judgePressGate({ ...clean, brandCurrent: false }).blockers).toContain('옛 규격으로 찍힘')
    expect(judgePressGate({ ...clean, hasContents: false }).blockers).toContain('목차 스냅샷 없음')
    expect(judgePressGate({ ...clean, publishStatus: 'withdrawn' }).blockers).toContain(
      '사람이 내린 권',
    )
  })

  it('발행 판정이 없어도 그 자체로는 막지 않는다 — 판정은 이 게이트의 산출이지 입력이 아니다', () => {
    const v = judgePressGate({ ...clean, publishStatus: null })
    expect(v.blockers).toEqual([])
    expect(v.approvable).toBe(true)
  })

  it('여러 권을 접으면 셋이 겹치지 않는다 — 한 권은 한 갈래로만 센다', () => {
    const s = summarizePressGate([
      clean,
      { ...clean, missingExplanations: 1 },
      { ...clean, personaBlocked: null },
      // 막힘과 못 잼이 둘 다 있으면 **막힘**으로 센다(할 일이 더 급하다).
      { ...clean, missingExplanations: 2, personaBlocked: null },
    ])
    expect(s).toEqual({ total: 4, approvable: 1, blocked: 2, unmeasured: 1 })
    expect(s.approvable + s.blocked + s.unmeasured).toBe(s.total)
  })
})
