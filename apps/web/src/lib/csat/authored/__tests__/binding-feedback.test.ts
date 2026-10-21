// apps/web/src/lib/csat/authored/__tests__/binding-feedback.test.ts
// T-0075 — 연결됨 ≠ 근거로 셈. 서버의 닫힌 비근거 사유만 말하고, 누락 · 미지 사유는 「확인하지 못함」(도움을 받았다고 추정하지 않음)
//   Codex NEXT-BINDING-RECOVERY 반례(unknown · revoked) 이식 + 정상 대조
import { describe, expect, it } from 'vitest'

import { NON_EVIDENCE_LABEL, attemptIdOf, bindingFeedback } from '../binding-feedback'

const HELP = /연습 · 도움 받은 풀이/

describe('bindingFeedback', () => {
  it('반례 unknown — bound 인데 evidence 누락 = 확인 못 함(도움 추정 없음)', () => {
    const f = bindingFeedback({ status: 'bound' })
    expect(f.kind).toBe('unknown')
    expect(f.kind === 'unknown' && f.text).toMatch(/확인하지 못했어요/)
    expect(JSON.stringify(f)).not.toMatch(HELP)
  })
  it('반례 revoked — 승인 철회 사유를 그대로(연습 · 도움으로 바꾸지 않음)', () => {
    const f = bindingFeedback({ status: 'bound', evidence: false, reason: 'approval_revoked' })
    expect(f).toMatchObject({ kind: 'not_evidence', reason: 'approval_revoked' })
    expect(f.kind === 'not_evidence' && f.text).toMatch(/철회/)
  })
  it('DB CHECK 의 닫힌 값 7개 모두 문구가 있다 · 미지 · null 사유 = 확인 못 함', () => {
    expect(Object.keys(NON_EVIDENCE_LABEL).sort()).toEqual(['approval_revoked', 'delivery_invalid', 'exposure_unverifiable', 'help_state_mismatch', 'not_first_exposure', 'qualification_superseded', 'role_not_evidence'])
    expect(bindingFeedback({ status: 'bound', evidence: false, reason: 'made_up' }).kind).toBe('unknown')
    expect(bindingFeedback({ status: 'bound', evidence: false, reason: null }).kind).toBe('unknown')
  })
  it('정상 대조 — evidence true 만 「혼자 해낸 근거」 · 교수 자료(role_not_evidence)는 연습 기록', () => {
    expect(bindingFeedback({ status: 'bound', evidence: true, reason: null })).toMatchObject({ kind: 'evidence' })
    const t = bindingFeedback({ status: 'bound', evidence: false, reason: 'role_not_evidence' })
    expect(t.kind === 'not_evidence' && t.text).toMatch(/연습 자료/)
    expect(t.kind === 'not_evidence' && t.text).not.toMatch(/혼자 해낸 근거」로 반영/)
  })
  it('결속 안 됨 · 모양 이상 · 응답 누락', () => {
    expect(bindingFeedback({ status: 'no_provenance' })).toEqual({ kind: 'unbound', status: 'no_provenance' })
    expect(bindingFeedback(null).kind).toBe('unknown')
    expect(bindingFeedback({ status: 3 } as never).kind).toBe('unknown')
  })
  it('attemptIdOf — 양의 정수 문자열만', () => {
    expect(attemptIdOf('41')).toBe('41')
    for (const v of [null, undefined, 41, '0', '-1', 'abc', '22222222-2222-4222-8222-222222222222']) expect(attemptIdOf(v)).toBeNull()
  })
})
