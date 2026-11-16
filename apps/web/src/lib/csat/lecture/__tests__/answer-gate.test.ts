// apps/web/src/lib/csat/lecture/__tests__/answer-gate.test.ts
//
// 「정답 직접 안내 전까지」 화면 공개 판단 — drain D6 반례(D6-01 초기 정답 노출 · D6-02 move() 경계 우회 · D6-03 건너뛰기)를
// 실제 문항 블록(theaterBlocks)과 실제 경계 데이터로 재현하고 고정한다.
import { describe, expect, it } from 'vitest'

import { answerWithheld, boundaryGate, confirmsAnswer, gateBlocks, gatedLiveKey, type AnswerGateState } from '../answer-gate'
import { lectureDisclosure } from '../disclosure'
import { loadLecture } from '../store'
import { theaterBlocks, type TheaterSource } from '@/lib/csat/theater'

const item = {
  exam_label: '2026 수능',
  no: 34,
  type_id: 'R-BLANK',
  type_name: '빈칸',
  points: 3,
  time_budget_sec: 120,
  answer: 2,
  answer_unknown: false,
  measured_ability: '논지 방향 추론',
  design_intent: '부정어 뒤 빈칸',
  why_correct: '② 가 지문이 거부하는 견해다',
  evidence_reasoning: null,
  evidence_quote: 'the law cannot be',
  evidence_quote_truncated: false,
  distractors: [1, 3, 4, 5].map((n) => ({ n, trap: '반대 방향', why_tempting: `${n} 이 끌리는 이유`, how_to_reject: `${n} 을 지우는 근거` })),
  procedure: [{ step: '부정어 표시' }],
  required_vocab: [],
} as unknown as TheaterSource

const blocks = theaterBlocks(item)
const stopAt = (lectureDisclosure('2026#34', loadLecture('2026#34')) as { stopBefore: number }).stopBefore
const until: AnswerGateState = { path: 'until', stopAt, consented: false }
const dom = (bs: ReturnType<typeof gateBlocks>) => JSON.stringify(bs)

describe('D6-01 — 동의 전 정답을 확정하는 화면 정보', () => {
  it('재현: 감추지 않으면 정답 칩 · 정답 근거 · 오답 번호 4개가 처음부터 실린다', () => {
    const raw = dom(gateBlocks(blocks, { ...until, path: null }))
    expect(raw).toContain('정답 ②')
    expect(raw).toContain('analysis:reject:1')
    expect(blocks.filter((b) => b.kind === 'reject')).toHaveLength(4)
  })

  it('정답 직접 안내 전까지: 정답 칩 · 근거 본문 · 인용 · 오답 번호(키 포함)를 그리지 않는다', () => {
    const shown = gateBlocks(blocks, until)
    const s = dom(shown)
    expect(s).not.toMatch(/정답 [①-⑤]/)
    expect(s).not.toContain('지문이 거부하는 견해')
    expect(s).not.toContain('the law cannot be')
    expect(s).not.toMatch(/analysis:reject:\d|[①③④⑤]가 왜 아닌가|끌리는 이유|지우는 근거/)
    expect(shown.filter((b) => b.withheld)).toHaveLength(5)
    // 재는 능력 · 출제 의도 · 절차는 그대로(F03)
    expect(shown.find((b) => b.key === 'analysis:procedure')?.body).toEqual(['1. 부정어 표시'])
  })

  it('동의 · 전체 경로 · 원문부터에서는 원래 블록 그대로', () => {
    expect(gateBlocks(blocks, { ...until, consented: true })).toBe(blocks)
    expect(gateBlocks(blocks, { ...until, path: 'full' })).toBe(blocks)
    expect(gateBlocks(blocks, { ...until, path: 'self' })).toBe(blocks)
    expect(answerWithheld({ ...until, stopAt: null })).toBe(false)
  })
})

describe('D6-02 — 경계 우회(시작 전 · 일시정지 · 끝남의 ←/→ · 이전/다음 차례 · 직접 선택)', () => {
  it('2026#34 경계는 c3 앞(index 2) — 경계 이상 차례는 모두 경계 안내로', () => {
    expect(stopAt).toBe(2)
    expect(boundaryGate(0, until)).toBe('ok')
    expect(boundaryGate(1, until)).toBe('ok')
    for (const i of [2, 3, 11]) expect(boundaryGate(i, until)).toBe('boundary')
  })

  it('동의 뒤 · 다른 경로에서는 막지 않는다', () => {
    expect(boundaryGate(5, { ...until, consented: true })).toBe('ok')
    expect(boundaryGate(5, { ...until, path: 'full' })).toBe('ok')
    expect(boundaryGate(5, { ...until, path: null })).toBe('ok')
  })

  it('동의 전 정답 근거 · 오답 블록 강조를 끈다', () => {
    expect(gatedLiveKey('analysis:answer', blocks, until)).toBeNull()
    expect(gatedLiveKey('analysis:reject:3', blocks, until)).toBeNull()
    expect(gatedLiveKey('analysis:intent', blocks, until)).toBe('analysis:intent')
    expect(gatedLiveKey('analysis:answer', blocks, { ...until, consented: true })).toBe('analysis:answer')
    expect(confirmsAnswer({ key: 'analysis:reject', kind: 'head' })).toBe(true)
  })
})

describe('r4 R4-02 — 강의 오류로 경로가 풀려도 감춤은 동의 전까지 남는다', () => {
  it('재현: 감춤을 경로로만 정하면 path=null 이 되는 순간 정답이 다시 보인다', () => {
    expect(answerWithheld({ ...until, path: null })).toBe(false)
  })

  it('감춤 선택(hideAnswer)은 경로와 따로 — 오류 뒤에도 정답 칩 · 오답 번호를 그리지 않고, 동의해야 풀린다', () => {
    const afterError: AnswerGateState = { path: null, stopAt, consented: false, hideAnswer: true }
    expect(answerWithheld(afterError)).toBe(true)
    expect(dom(gateBlocks(blocks, afterError))).not.toMatch(/정답 [①-⑤]|analysis:reject:\d/)
    expect(gatedLiveKey('analysis:answer', blocks, afterError)).toBeNull()
    // 경로가 풀린 동안 경계 안내는 없다(받은 cue 가 없다) — 감춤만 남는다
    expect(boundaryGate(stopAt, afterError)).toBe('ok')
    expect(answerWithheld({ ...afterError, consented: true })).toBe(false)
  })
})

describe('D6-03 — 건너뛰기는 공개 동의가 아니다', () => {
  it('건너뛴 뒤(동의 없음)에도 경계 뒤 이동 · 정답 블록은 그대로 막힌다', () => {
    const afterSkip: AnswerGateState = { ...until }
    expect(boundaryGate(stopAt, afterSkip)).toBe('boundary')
    expect(dom(gateBlocks(blocks, afterSkip))).not.toMatch(/정답 [①-⑤]/)
  })
})
