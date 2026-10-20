// apps/web/src/lib/knowledge/__tests__/authored-responses.test.ts
// T-0068 — 시험 어댑터 자체 검증: 모든 창작 세트 · 모든 문항에서 정답 응답 = 제품 채점 맞음, 오답 응답 = 형식 유효 + 틀림
import { describe, expect, it } from 'vitest'

import { AUTHORED_SETS, setFormat } from '@/lib/knowledge/authored/authored-items'

import { gradedPair } from './authored-responses'

describe('authored-responses 어댑터', () => {
  for (const s of AUTHORED_SETS) {
    it(`${s.taskId} — 문항마다 정답 맞음 · 오답 유효하지만 틀림`, () => {
      for (const it0 of s.items) {
        const g = gradedPair(setFormat(s), it0.body as Record<string, unknown>, it0.gold as Record<string, unknown>)
        expect(g, it0.id).toMatchObject({ rightOk: true, wrongValid: true, wrongOk: false })
      }
    })
  }
})
