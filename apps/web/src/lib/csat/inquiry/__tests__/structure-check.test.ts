// apps/web/src/lib/csat/inquiry/__tests__/structure-check.test.ts
// FINAL §6 ⑤ — 구조 예측 대조: 허용 대안 인정 · 주제문 자리 · 패턴 · 형식 밖 응답
import { describe, expect, it } from 'vitest'

import type { PassageDesign } from '../../design'
import { gradeStructure, parseStructureResponse } from '../structure-check'

const D: PassageDesign = {
  roles: ['background', 'topic', 'support', 'example', 'conclusion'],
  alternatives: [{ index: 4, role: 'topic' }],
  pattern: 'general_specific', selection: '', transform: 'paraphrase' as PassageDesign['transform'], transform_note: '', cues: [],
}

describe('gradeStructure', () => {
  it('설계와 같으면 정답 · 허용 대안 역할도 같음으로 본다', () => {
    expect(gradeStructure(D, { roles: D.roles, pattern: 'general_specific' }).isCorrect).toBe(true)
    const alt = gradeStructure(D, { roles: ['background', 'topic', 'support', 'example', 'topic'], pattern: 'general_specific' })
    expect(alt).toMatchObject({ isCorrect: true, topicOk: true })
  })
  it('주제문 자리를 놓치면 topicOk=false · 패턴이 다르면 오답', () => {
    const g = gradeStructure(D, { roles: ['topic', 'background', 'support', 'example', 'conclusion'], pattern: 'general_specific' })
    expect(g).toMatchObject({ topicOk: false, isCorrect: false, rolesRight: 3 })
    expect(gradeStructure(D, { roles: D.roles, pattern: 'contrast' })).toMatchObject({ patternOk: false, isCorrect: false })
  })
  it('형식 밖 응답(개수 · 모르는 역할 · 패턴)은 null', () => {
    expect(parseStructureResponse({ roles: D.roles.slice(1), pattern: 'contrast' }, 5)).toBeNull()
    expect(parseStructureResponse({ roles: [...D.roles.slice(1), 'zzz'], pattern: 'contrast' }, 5)).toBeNull()
    expect(parseStructureResponse({ roles: D.roles, pattern: 'zzz' }, 5)).toBeNull()
    expect(parseStructureResponse({ roles: D.roles, pattern: 'contrast' }, 5)).not.toBeNull()
  })
})
