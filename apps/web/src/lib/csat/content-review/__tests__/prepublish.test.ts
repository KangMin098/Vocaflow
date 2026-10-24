// apps/web/src/lib/csat/content-review/__tests__/prepublish.test.ts
//
// **F6 발행 전 검증기 계약** — 실제 2015#25 강의(공식 복수정답 {4,5})로 c9 · c1 · c4 와 분석 ⑤ 가 걸리는지,
// 정답 「모름」이 BLOCK 인지, 사람 승인 없는 후보가 발행 게이트를 못 지나는지 본다.

import { describe, expect, it } from 'vitest'

import exam2015 from '../../lecture-data/2015.json'
import type { Lecture } from '../../lecture/types'
import { publishAllowed, validatePrepublish } from '../prepublish'
import type { LedgerEntry, ReviewCandidate, Reviewer, RevisionBinding } from '../types'

const lecture = (exam2015 as unknown as { lectures: Record<string, Lecture> }).lectures["2015#25"]!

// 분석 v5(2026-10-11) 선지 판정 — F3_2015_25_MULTI_ANSWER.md §2: ⑤ verdict distractor
const verdictsV5 = [
  { choice: 1, verdict: 'distractor' },
  { choice: 2, verdict: 'distractor' },
  { choice: 3, verdict: 'distractor' },
  { choice: 4, verdict: 'answer' },
  { choice: 5, verdict: 'distractor' },
]

const codes = (r: ReturnType<typeof validatePrepublish>, where?: string) =>
  r.findings.filter((f) => !where || f.where === where).map((f) => f.code)

describe('2015#25 복수정답', () => {
  const r = validatePrepublish({ itemId: '2015#25', officialAnswers: [4, 5], choiceVerdicts: verdictsV5, cues: lecture.cues })

  it('실제 강의 fixture 를 읽었다', () => {
    expect(lecture.cues.map((c) => c.id)).toContain('c9')
  })
  it('분석이 공식 정답 ⑤ 를 오답으로 둔 것을 잡는다', () => {
    expect(codes(r, 'analysis:choice:5')).toContain('ANALYSIS_REJECTS_OFFICIAL')
    expect(codes(r)).toContain('ANALYSIS_SINGLE_ANSWER')
  })
  it('c9(⑤ 소거)를 잡는다', () => {
    expect(codes(r, 'cue:c9')).toContain('CUE_ELIMINATES_OFFICIAL')
  })
  it('c1 「답이 아닌 네 선지」 · c4 「사 번이 정답」(⑤ 누락)을 잡는다', () => {
    expect(codes(r, 'cue:c1')).toContain('CUE_ASSUMES_SINGLE_ANSWER')
    expect(codes(r, 'cue:c4')).toContain('CUE_PARTIAL_ANSWER')
  })
  it('정답 아닌 ①②③ 소거 cue 는 걸지 않는다', () => {
    for (const id of ['c6', 'c7', 'c8']) expect(codes(r, `cue:${id}`)).toEqual([])
  })
  it('BLOCK 이다', () => expect(r.blocked).toBe(true))

  it('단일 정답 {4} 로 줄이면 c9 는 걸리지 않는다 — 집합이 판정을 바꾼다', () => {
    const single = validatePrepublish({ itemId: '2015#25', officialAnswers: [4], choiceVerdicts: verdictsV5, cues: lecture.cues })
    expect(codes(single, 'cue:c9')).toEqual([])
  })

  it('문안만 고치고 하이라이트가 reject:5 그대로면 여전히 걸린다 — 대상도 옮겨야 한다', () => {
    const proposed = '오 번도 정답으로 인정됐어요. 퍼센트와 퍼센트 포인트는 다릅니다.'
    const textOnly = validatePrepublish({
      itemId: '2015#25', officialAnswers: [4, 5], choiceVerdicts: verdictsV5, cues: lecture.cues,
      changes: [{ target: 'cue:c9', current: '', proposed, draftRef: null }],
    })
    expect(codes(textOnly, 'cue:c9')).toContain('CUE_ELIMINATES_OFFICIAL')
    const moved = lecture.cues.map((c) => (c.id === 'c9' ? { ...c, target: { kind: 'analysis' as const, id: 'answer' } } : c))
    const fixed = validatePrepublish({
      itemId: '2015#25', officialAnswers: [4, 5], choiceVerdicts: verdictsV5, cues: moved,
      changes: [{ target: 'cue:c9', current: '', proposed, draftRef: null }],
    })
    expect(codes(fixed, 'cue:c9')).toEqual([])
  })
})

describe('정답 근거 · 의도', () => {
  it('공식 정답 「모름」(null)은 BLOCK — 빈 배열과 다른 코드', () => {
    expect(codes(validatePrepublish({ itemId: 'x', officialAnswers: null, choiceVerdicts: [], cues: [] }))).toEqual(['OFFICIAL_ANSWER_UNKNOWN'])
    expect(codes(validatePrepublish({ itemId: 'x', officialAnswers: [], choiceVerdicts: [], cues: [] }))).toEqual(['OFFICIAL_ANSWER_EMPTY'])
  })
  it('근거 없는 출제 의도 단정은 HYPOTHESIS, 공식 근거가 있으면 없다', () => {
    const cue = { ...lecture.cues[0]!, id: 'z', segments: [{ lang: 'ko-KR' as const, text: '출제자는 단위 혼동을 노렸어요.' }] }
    const a = validatePrepublish({ itemId: 'x', officialAnswers: [1], choiceVerdicts: [], cues: [cue] })
    expect(a.findings.map((f) => f.severity)).toEqual(['HYPOTHESIS'])
    expect(a.blocked).toBe(false)
    const b = validatePrepublish({ itemId: 'x', officialAnswers: [1], choiceVerdicts: [], cues: [cue], intentOfficiallySourced: true })
    expect(b.findings).toEqual([])
  })
})

describe('발행 게이트', () => {
  const binding: RevisionBinding = { itemId: '2015#25', itemMd5: 'a', analysisVersion: 5, analysisMd5: 'b', lectureVersion: 3, lectureHash: 'c' }
  const cand: ReviewCandidate = {
    id: 'cr_test', itemId: '2015#25', source: 'DRAIN_MULTI_ANSWER', sourceRef: 'F3', defect: 'official_answer_conflict',
    tracks: ['official_answer', 'explanation'], binding, changes: [], officialText: { verdict: 'NOT_CHECKED', note: null },
    officialAnswers: [4, 5], officialAnswerBasis: 'press_verified', aiEvidence: [], note: null,
  }
  const human: Reviewer = { id: 'h1', kind: 'human', roles: ['content_reviewer', 'answer_authority'] }
  const ai: Reviewer = { id: 'claude', kind: 'ai', roles: [] }
  const clean = { itemId: '2015#25', findings: [], blocked: false }
  const entry = (seq: number, track: LedgerEntry['track'], by: Reviewer): LedgerEntry => ({
    seq, candidateId: cand.id, track, from: 'in_review', to: 'content_approved', by, binding, evidence: [], reason: 'r', at: '2026-10-24T00:00:00Z',
  })

  it('승인 0건이면 막힌다', () => {
    const g = publishAllowed([], cand, clean)
    expect(g.allowed).toBe(false)
    expect(g.reasons).toHaveLength(2)
  })
  it('한 트랙만 승인이면 막힌다(정답 승인 ≠ 해설 승인)', () => {
    expect(publishAllowed([entry(1, 'official_answer', human)], cand, clean).allowed).toBe(false)
  })
  it('AI 가 쓴 승인 줄은 승인으로 치지 않는다', () => {
    const g = publishAllowed([entry(1, 'official_answer', ai), entry(2, 'explanation', human)], cand, clean)
    expect(g.allowed).toBe(false)
  })
  it('두 트랙 사람 승인이어도 검증 BLOCK 이 있으면 막힌다', () => {
    const blocked = validatePrepublish({ itemId: '2015#25', officialAnswers: [4, 5], choiceVerdicts: verdictsV5, cues: lecture.cues })
    const led = [entry(1, 'official_answer', human), entry(2, 'explanation', human)]
    expect(publishAllowed(led, cand, blocked).allowed).toBe(false)
    expect(publishAllowed(led, cand, null).allowed).toBe(false)
    expect(publishAllowed(led, cand, clean).allowed).toBe(true)
  })
})
