// packages/library-pipeline/src/textbook/academic-apparatus.test.ts
//
// 논문 서식 회귀. 지키려는 것은 **교재에 인쇄할 수 없는 것을 인쇄하지 않는가** 다.
//
// ── 무엇이 있었나 (실측 2026-09-06) ─────────────────────────────────
// V7 드레인 몫을 손으로 채우다 뽑은 것의 **절반을 버렸다** — 눈으로 거르고 있었다.
// 재고를 세니 `Citation: ` 줄을 가진 원글이 V6 89% · V7 98% 였고, 이미 만들어진 문항
// 중에도 구조 초록 표제어(V7 13/94)와 통계 잔해(V7 13/94)가 남아 있었다.
//
// ⚠️ **오탐을 먼저 쟀다.** 학술 소스가 없는 V2~V4 지문 653개에 이 규칙을 걸어 0건이
//    걸렸다. 아래 "멀쩡한 산문" 은 그 성질을 잠근다 — 규칙을 넓히다 보면 반드시
//    본문 속 "the results showed" 같은 말을 잡게 된다.

import { describe, expect, it } from 'vitest'
import { hasAcademicApparatus, isPrintablePassage } from './csat-format'

describe('논문 서식', () => {
  it('서지 줄을 잡는다', () => {
    expect(
      hasAcademicApparatus(
        'The discovery links the pathogen to the plague. Citation: Ma Z, Wu P, Abulizi A, et al. (2026) PLoS One 21(3): e0340496.',
      ),
    ).toBe(true)
  })

  it('구조 초록 표제어를 잡는다 — 실물 그대로', () => {
    expect(
      hasAcademicApparatus(
        'Objective This study aimed to comprehensively analyze differentially expressed genes in chondrocytes.',
      ),
    ).toBe(true)
    expect(
      hasAcademicApparatus(
        'Aims We aimed to assess whether using the digital intervention was associated with improvements.',
      ),
    ).toBe(true)
    expect(
      hasAcademicApparatus(
        'Background Attention Deficit Hyperactivity Disorder is a major neurodevelopmental disorder.',
      ),
    ).toBe(true)
  })

  it('문장 가운데의 표제어는 잡지 않는다 — 오탐의 첫 자리다', () => {
    expect(hasAcademicApparatus('The results showed that the treatment worked well in mice.')).toBe(false)
    expect(hasAcademicApparatus('Our aims were modest, and the methods were simple ones.')).toBe(false)
    expect(hasAcademicApparatus('She had a background in music before she turned to law.')).toBe(false)
  })

  it('통계 서식을 잡는다', () => {
    expect(hasAcademicApparatus('with ROR values of 73.4 (95% CI: 71.16–75.7) in the sample')).toBe(true)
    expect(hasAcademicApparatus('growth was significantly enhanced (P < 0.05) by the supplement')).toBe(true)
    expect(hasAcademicApparatus('a regression equation of y = 0.982x + 0.084 was obtained')).toBe(true)
    expect(hasAcademicApparatus('biases below 0.15 lg IU/mL were recorded in serum')).toBe(true)
  })

  it('멀쩡한 산문은 통과시킨다', () => {
    const prose =
      'Coastal towns along the northern shore rebuilt their harbour walls after the storm. ' +
      'Engineers found that the older walls rested on shifting sand, and the new ones reach ' +
      'three metres deeper into the seabed. Fishing crews returned within a single season.'
    expect(hasAcademicApparatus(prose)).toBe(false)
    expect(isPrintablePassage(prose)).toBe(true)
  })

  it('인쇄 판정이 이 규칙을 실제로 쓴다 — 한 자리에 모아 두는 이유다', () => {
    // 규칙을 더해 놓고 `isPrintablePassage` 에 배선하지 않으면 아무것도 막지 못한다.
    expect(isPrintablePassage('Methods The nucleic acid extraction module was evaluated.')).toBe(false)
  })
})
