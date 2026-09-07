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

// `Abstract` 는 나중에 붙였다 — 첫 규칙을 넣고 드레인을 다시 뽑아 보니 그 표제어가
// 그대로 남은 몫이 있었다(V7 문항 20/94 · V6 14/137 · V5 이하 0). 오탐도 그때 다시 쟀다.
describe('Abstract 표제어', () => {
  it('문장 자리의 Abstract 를 잡는다', () => {
    expect(
      hasAcademicApparatus(
        'Our study provides supporting evidence for the mechanism. Abstract Oviposition holds crucial significance for insect reproduction.',
      ),
    ).toBe(true)
  })

  it('문장 안의 abstract 는 잡지 않는다', () => {
    expect(hasAcademicApparatus('The painter moved from portraits to abstract shapes late in life.')).toBe(false)
    expect(hasAcademicApparatus('It is an abstract Idea that few readers grasp at once.')).toBe(false)
  })
})

// 표제어가 둘 붙어 오는 꼴도 나중에 찾았다 — 드레인 몫을 고르다 발견했다.
// 앞 낱말만 보면 뒤가 소문자라 안 걸린다(`Background and objectives Severe …`).
describe('붙어 있는 표제어', () => {
  it('두 표제어가 이어진 꼴을 잡는다', () => {
    expect(
      hasAcademicApparatus('Background and objectives Severe community-acquired pneumonia remains a major cause.'),
    ).toBe(true)
    expect(hasAcademicApparatus('Methods and results We compared two antibiotic regimens.')).toBe(true)
  })

  it('같은 낱말이 산문으로 쓰이면 잡지 않는다', () => {
    expect(hasAcademicApparatus('She had a background and objectives of her own to pursue.')).toBe(false)
    expect(hasAcademicApparatus('Our aims were modest, and the methods were simple ones.')).toBe(false)
  })
})

// 문장 끝과 콜론도 나중에 찾았다 — 둘 다 드레인 몫에서 실물로 만났다.
describe('표제어의 다른 꼴', () => {
  it('물음표 뒤의 표제어를 잡는다', () => {
    expect(
      hasAcademicApparatus(
        'And how is the function maintained without the algal nucleus? Abstract Kleptoplasty is common in protists.',
      ),
    ).toBe(true)
  })

  it('콜론이 붙은 표제어를 잡는다', () => {
    expect(hasAcademicApparatus('Objective: In this study, we analyzed the impact of exposure.')).toBe(true)
    expect(hasAcademicApparatus('Methods: A total of 349 women were included in the study.')).toBe(true)
  })

  it('넓혀도 산문은 그대로 통과한다', () => {
    expect(hasAcademicApparatus('Was it worth it? He never answered that question aloud.')).toBe(false)
    expect(hasAcademicApparatus('The results were clear: the older walls rested on sand.')).toBe(false)
  })
})
