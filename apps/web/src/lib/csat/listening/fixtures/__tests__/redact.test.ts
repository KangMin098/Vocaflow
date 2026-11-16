// apps/web/src/lib/csat/listening/fixtures/__tests__/redact.test.ts
// 첫 렌더 props 직렬화에 정답 민감 정보가 없는지 — Reveal Gate 가 'open' 이어도(T-0157 R2).
import { describe, expect, it } from 'vitest'

import { TRACE_FIXTURES, redactForClient } from '..'

describe('redactForClient', () => {
  it('정답 번호 · 기대 판정 · 핵심 발화 · 해설 · 근거 역할이 직렬화에 없다', () => {
    const json = JSON.stringify(TRACE_FIXTURES.map(redactForClient))
    for (const k of ['officialAnswer":{', '"expected"', '"keyUtteranceIds"', '"evidenceIds"', '"note"', 'decisive', 'supporting', 'contrast', '"choice":', '"role"', '"charStart"']) {
      expect(json).not.toContain(k)
    }
    for (const fx of TRACE_FIXTURES) {
      for (const c of fx.candidates) expect(json).not.toContain(c.note)
      const out = redactForClient(fx)
      expect(out.answerRedacted).toBe(true)
      expect(out.officialAnswer).toBeNull()
      expect(out.evidence).toEqual([])
      // 학습자가 판단할 재료(발화 · 후보 이름 · 표 값)는 남는다
      expect(out.utterances).toEqual(fx.utterances)
      expect(out.candidates.map((c) => c.label)).toEqual(fx.candidates.map((c) => c.label))
    }
  })
})
