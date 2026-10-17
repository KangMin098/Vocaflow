// apps/web/src/lib/csat/map/v62/__tests__/v2-support-boundary.test.ts
//
// LM-G1.5a — V2 지원 경계: 합의 주석 · 출시가 없는 지금, 지도 정의는 content_needed 그대로이고 확인 키가 없다.
// 그래서 V2 증거 · 실행 링크가 생기지 않고, V2 과제 키가 R5 · S5 확인 키에 섞이지 않는다(V18 · V21).

import { describe, expect, it } from 'vitest'

import { checkKeysOfTask, taskOf } from '../../v4/definition'
import { evidenceView } from '../evidence-claims'

describe('V2 지원 경계', () => {
  it('V18 · direct_check 는 content_needed 그대로 · 확인 키 없음', () => {
    expect(taskOf('v.contextual_sense').direct_check).toBe('content_needed')
    expect(checkKeysOfTask('v.contextual_sense')).toEqual([])
  })
  it('V21 · contextual-sense 키는 다른 TASK 의 확인 키가 아니다', () => {
    for (const id of ['r.central_meaning', 's.form_scope', 'v.semantic_relation', 'e.option_correspondence'] as const) expect(checkKeysOfTask(id)).not.toContain('contextual-sense')
  })
  it('V21 · V2 수행 기록이 있어도 R5 증거 시도에 섞이지 않음', () => {
    const v = evidenceView({
      task: 'r.central_meaning', check: null, firsts: [], hashes: {}, transfer: { done: 0, planned: null },
      activity: [{ itemRef: 'M2609#30', taskKey: 'contextual-sense', phase: 'practice', isCorrect: true, answeredAt: '2026-10-17T00:00:00Z' }],
    })
    expect(v.attempts).toEqual([])
  })
})
