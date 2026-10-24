// apps/web/src/lib/csat/listening/fixtures/__tests__/redact.test.ts
// 서버가 클라이언트로 넘기는 props 직렬화에 정답 민감 정보가 없는지(T-0157 P1-b).
import { describe, expect, it } from 'vitest'

import { TRACE_FIXTURES, redactForClient } from '..'

describe('redactForClient', () => {
  for (const reveal of ['embargo', 'failure', null] as const) {
    it(`reveal=${String(reveal)}: 정답 번호 · 기대 판정 · 핵심 발화 · 해설 · 근거 역할이 직렬화에 없다`, () => {
      for (const fx of TRACE_FIXTURES) {
        const out = redactForClient(fx, reveal)
        const json = JSON.stringify(out)
        expect(out.answerRedacted).toBe(true)
        expect(out.officialAnswer).toBeNull()
        expect(out.evidence).toEqual([])
        for (const k of ['officialAnswer":{', '"expected"', '"keyUtteranceIds"', '"evidenceIds"', '"note"', 'decisive', 'supporting', 'contrast', '"choice":', '"role"']) {
          expect(json).not.toContain(k)
        }
        for (const c of fx.candidates) expect(json).not.toContain(c.note)
        // 학습자가 판단할 재료(발화 · 후보 이름 · 표 값)는 남는다
        expect(out.utterances).toEqual(fx.utterances)
        expect(out.candidates.map((c) => c.label)).toEqual(fx.candidates.map((c) => c.label))
      }
    })
  }

  it("reveal='open': 그대로 보낸다(제출 전 숨김은 클라이언트 exposure.ts)", () => {
    for (const fx of TRACE_FIXTURES) expect(redactForClient(fx, 'open')).toBe(fx)
  })
})
