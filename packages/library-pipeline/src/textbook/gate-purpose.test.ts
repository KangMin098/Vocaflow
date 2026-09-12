// packages/library-pipeline/src/textbook/gate-purpose.test.ts
//
// 게시 게이트의 목적별 규칙 회귀. 지키려는 것은 **실을 수 있는 글을 버리지 않는가** 다.
//
// ── 무엇이 있었나 (실측 2026-09-06) ─────────────────────────────────
// `csat` 목적이 `use` 하나만 받아 **서사를 통째로 막고 있었다.** 주석에는 "서사는 추론
// 유형에 못 쓴다" 고 적혀 있었고 그 말은 절반만 맞다 — 수능에는 **서사여야만 서는
// 유형**이 있다(19번 심경, 43~45번 장문 지칭).
//
// 시장 실측이 그것을 요구한다(고등 쪽당 등장률): mood 0.0113 · long_reference 0.0073.
// 그런데 Gutenberg 36,480편 중 조합 풀에 드는 것이 **19편**이었고,
// `narrative/biography` 1,134편 · `narrative/history` 909편이 이 게이트에 내려가 있었다.
// V7 권의 그 두 유형이 늘 0 이던 이유다.

import { describe, expect, it } from 'vitest'
// 정본은 스크립트 쪽에 있다 — 사본을 두면 둘이 갈린다.
import { decide, PURPOSE_RULE } from '../../../../scripts/csat/gate-rules.mjs'

const csat = (verdict: string) => decide({ purpose: 'csat', verdict, genre: '', codes: [] })

describe('게시 게이트 — 수능 지문 목적', () => {
  it('서사를 받는다 — 심경과 장문 지칭이 그 위에서만 선다', () => {
    expect(PURPOSE_RULE.csat.verdicts.has('narrative')).toBe(true)
    expect(csat('narrative').publishable).toBe(true)
  })

  it('설명문도 그대로 받는다', () => {
    expect(csat('use').publishable).toBe(true)
  })

  it('운문과 참고 항목은 여전히 막는다 — 넓힌 것은 서사 한 갈래뿐이다', () => {
    expect(csat('poetry').publishable).toBe(false)
    expect(csat('reference').publishable).toBe(false)
  })

  it('해로운 판정은 목적과 무관하게 막힌다', () => {
    for (const bad of ['bias', 'doctrine', 'pseudoscience', 'polemic']) {
      expect(csat(bad).publishable).toBe(false)
    }
  })

  it('초·중 교재와 도서관 읽기는 원래대로 서사를 받는다', () => {
    expect(PURPOSE_RULE.kids.verdicts.has('narrative')).toBe(true)
    expect(PURPOSE_RULE.library.verdicts.has('narrative')).toBe(true)
  })

  it('미절단 원본은 무엇도 게시하지 않는다', () => {
    expect(PURPOSE_RULE.raw.verdicts.size).toBe(0)
  })
})
