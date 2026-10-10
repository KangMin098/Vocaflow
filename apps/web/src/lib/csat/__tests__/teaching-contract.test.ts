// apps/web/src/lib/csat/__tests__/teaching-contract.test.ts
//
// 유형 교수 계약 — 공개 26유형 모두에 교수 모델이 있고, 유형 성격과 모순되지 않는다(2026-10-11 · M2).
import { describe, expect, it } from 'vitest'

import { TEACHING_MODELS, teachingModelOf } from '../teaching-contract'

// 2026-10-11 DB 실측: 최신 published 분석이 있는 type_id(평가원 802 · 학평 2,606)
const PUBLISHED = [
  'R-BLANK', 'R-BLANK2', 'R-CHART', 'R-CLAIM', 'R-FACT', 'R-GIST', 'R-GRAMMAR', 'R-IMPLY', 'R-INSERT', 'R-IRRELEVANT',
  'R-MOOD', 'R-NOTICE', 'R-ORDER', 'R-PURPOSE', 'R-REFER', 'R-SUMMARY', 'R-TITLE', 'R-TOPIC', 'R-VOCAB',
  'X-BLANK', 'X-BLANK2', 'X-FACT', 'X-ORDER', 'X-REFER', 'X-TITLE', 'X-VOCAB',
]

describe('유형 교수 계약', () => {
  it('공개 유형마다 모델이 있다 — 없는 유형을 같은 그릇에 억지로 담지 않는다', () => {
    expect(PUBLISHED.filter((t) => !teachingModelOf(t))).toEqual([])
    expect(Object.keys(TEACHING_MODELS).sort()).toEqual([...PUBLISHED].sort())
  })

  it('모든 모델이 관계 · 정답 설계 · 오답 설계를 말한다', () => {
    for (const [id, m] of Object.entries(TEACHING_MODELS)) {
      expect(m.relation.length, id).toBeGreaterThan(15)
      expect(m.answerDesign.length, id).toBeGreaterThan(8)
      expect(m.lureDesign.length, id).toBeGreaterThan(8)
      expect(m.units.length, id).toBeGreaterThan(0)
    }
  })

  it('정답 선택 ≠ 내용 참·거짓 유형에는 문장 역할 뼈대(passage_design)를 씌우지 않는다', () => {
    for (const [id, m] of Object.entries(TEACHING_MODELS)) if (m.choiceTruth) expect(m.passageDesign, id).toBe(false)
  })

  it('원본 시각 근거가 필요한 유형은 도표뿐이고, 도표는 문장을 근거 단위로 쓰지 않는다', () => {
    expect(Object.entries(TEACHING_MODELS).filter(([, m]) => m.visual).map(([id]) => id)).toEqual(['R-CHART'])
    expect(TEACHING_MODELS['R-CHART'].units).not.toContain('sentence')
  })

  it('위치 · 번호 분포 같은 찍기 규칙을 담지 않는다', () => {
    const all = JSON.stringify(TEACHING_MODELS)
    expect(all).not.toMatch(/정답 번호 분포|\d+\s*%|번이 가장 많/)
  })
})
