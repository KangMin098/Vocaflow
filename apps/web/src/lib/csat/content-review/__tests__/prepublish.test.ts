// apps/web/src/lib/csat/content-review/__tests__/prepublish.test.ts
//
// **F6 발행 전 검증기 계약** — 실제 2015#25 강의(공식 복수정답 {4,5})로 c9 · c1 · c4 와 분석 ⑤ 가 걸리는지,
// 정답 「모름」이 BLOCK 인지, 사람 승인 없는 후보가 발행 게이트를 못 지나는지 본다.

import { describe, expect, it } from 'vitest'

import exam2015 from '../../lecture-data/2015.json'
import type { Lecture } from '../../lecture/types'
import { publishAllowed, validatePrepublish } from '../prepublish'
import { bindingHash, transition } from '../state'
import type { Evidence, LedgerEntry, ReviewCandidate, Reviewer, RevisionBinding } from '../types'

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
    // 전이 함수로 만든 정상 승인 원장(판본에 묶인 필수 증거 포함) — 수제 원장은 무결성 검사가 막는다
    const h = bindingHash(binding)
    const ev = (kinds: Evidence['kind'][]): Evidence[] => kinds.map((kind) => ({ kind, ref: kind, boundHash: h }))
    const led: LedgerEntry[] = []
    const step = (track: LedgerEntry['track'], to: LedgerEntry['to'], evidence: Evidence[] = []) => {
      const r = transition(led, { candidate: cand, track, to, by: human, currentBinding: binding, evidence, reason: 'r', at: '2026-10-24T00:00:00Z' })
      if (!r.ok) throw new Error(r.message)
      led.push(r.entry)
    }
    step('official_answer', 'in_review')
    step('official_answer', 'content_approved', ev(['official_answer_sheet']))
    step('explanation', 'in_review')
    step('explanation', 'content_approved', ev(['official_pdf_text', 'analysis_revision']))
    expect(publishAllowed(led, cand, blocked).allowed).toBe(false)
    expect(publishAllowed(led, cand, null).allowed).toBe(false)
    expect(publishAllowed(led, cand, clean).allowed).toBe(true)
  })
})

// ── T-0158 Codex 독립 검증 반례(P1-4) 회귀 ───────────────────────────
describe('T-0158 반례 — 일반적인 정답·오답 표현', () => {
  const cue = (text: string, target = 'answer') => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: target },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it('「정답은 ⑤입니다」 — 공식 정답 {4} 와 충돌', () => {
    expect(run([4], '정답은 ⑤입니다.').blocked).toBe(true)
  })
  it('「⑤는 오답입니다」 — 공식 복수정답 {4,5} 의 소거', () => {
    expect(run([4, 5], '⑤는 오답입니다.').findings.map((f) => f.code)).toContain('CUE_ELIMINATES_OFFICIAL')
  })
  it('「오 번은 … 답이 아닙니다」 — 문장 중간 번호도 잡는다', () => {
    expect(run([4, 5], '그래서 오 번은 맞는 진술이고, 답이 아닙니다.').blocked).toBe(true)
  })
  it('「⑤가 정답」 · 「정답은 사 번」 — 맞는 번호는 통과', () => {
    expect(run([4, 5], '④와 ⑤가 정답입니다. 정답은 사 번과 오 번이에요.').blocked).toBe(false)
  })
  it('「다섯 번째 문장」 같은 서수는 선지로 읽지 않는다', () => {
    expect(run([4], '다섯 번째 문장을 짚어 보세요. 이 문장은 답이 아닙니다.').blocked).toBe(false)
  })
})

describe('T-0158 2차 반례', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it('P1 「①도 정답입니다」 — 공식 정답 {4} 밖', () => {
    expect(run([4], '①도 정답입니다.').findings.map((f) => f.code)).toContain('CUE_WRONG_ANSWER')
  })
  it('P2 「④가 정답이고 ⑤는 오답입니다」 — 정상 대조 설명은 통과', () => {
    expect(run([4], '④가 정답이고 ⑤는 오답입니다.').findings).toEqual([])
  })
  it('같은 문장이라도 공식 정답을 오답이라 하면 잡는다', () => {
    expect(run([4, 5], '④가 정답이고 ⑤는 오답입니다.').blocked).toBe(true)
  })
})

describe('T-0158 3차 반례', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it('P1 「④만 정답입니다」 — 복수정답 {4,5} 축소', () => {
    expect(run([4, 5], '④만 정답입니다.').findings.map((f) => f.code)).toContain('CUE_PARTIAL_ANSWER')
    expect(run([4, 5], '사 번만이 정답이에요.').blocked).toBe(true)
  })
  it('단일 정답 {4} 에서 「④만 정답」은 통과', () => {
    expect(run([4], '④만 정답입니다.').findings).toEqual([])
  })
})

describe('T-0158 4차 반례 — 선지 집합 읽기', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  const CASES: [number[], string, boolean][] = [
    [[4], '정답은 ④와 ①입니다.', true], // 잘못 추가한 ①
    [[4], '④와 ⑤는 오답입니다.', true], // 공식 정답 ④ 소거
    [[4, 5], '정답은 오직 ④입니다.', true], // 복수정답 축소
    [[4, 5], '정답은 ④와 ⑤입니다.', false], // 옳은 나열
    [[4, 5], '사 번과 오 번이 정답이에요.', false],
    [[4, 5], '④와 ⑤ 모두 정답입니다.', false],
    [[4], '④가 정답이고 ⑤는 오답입니다.', false],
    [[4], '정답은 ④ 하나뿐입니다.', false],
    [[4, 5], '④가 정답이고 ⑤도 정답으로 인정됐어요.', false],
  ]
  it.each(CASES)('%j · %s → blocked=%s', (answers, text, blocked) => {
    expect(run(answers, text).blocked).toBe(blocked)
  })
  it('해석 못 하는 꼴(「④는 물론 정답인데」)은 오진단 없이 사람 확인으로만 막는다', () => {
    const codes = run([4, 5], '④는 물론 정답인데 ⑤도 정답으로 인정됐어요.').findings.map((f) => f.code)
    expect(codes).toEqual(['CUE_ANSWER_UNPARSED'])
  })
})

describe('T-0158 5차 반례 — 부분 해석 금지(fail-closed) · 부정 범위 · cue 합집합', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  // P1: 일부만 해석된 문장 — 모두 차단(통과 금지)
  it.each([
    '정답은 ④가 아니라 ①입니다.',
    '④가 정답이며 ① 역시 정답입니다.',
    '④는 정답이고 정답에 ①도 포함됩니다.',
    '① 또는 ④가 정답입니다.',
    '①도 ④도 정답입니다.',
    '④가 정답이고, 정답으로 ①을 고릅니다.',
  ])('{4} · %s → 차단', (text) => {
    expect(run([4], text).blocked).toBe(true)
  })
  // P2: 부정·연결 — 오진단하지 않는다(해석 못 하면 「사람 확인」으로만)
  it('「④는 오답이 아닙니다」 — 공식 정답 소거로 오진단하지 않는다', () => {
    const codes = run([4], '④는 오답이 아닙니다.').findings.map((f) => f.code)
    expect(codes).not.toContain('CUE_ELIMINATES_OFFICIAL')
  })
  it('「정답은 ①이 아닙니다」 — ①을 정답 주장으로 읽지 않는다', () => {
    const codes = run([4], '정답은 ①이 아닙니다.').findings.map((f) => f.code)
    expect(codes).not.toContain('CUE_WRONG_ANSWER')
  })
  it('{4,5} · 「④가 정답이고 ⑤도 정답입니다」 — 통과', () => {
    expect(run([4, 5], '④가 정답이고 ⑤도 정답입니다.').findings).toEqual([])
  })
  it('{4,5} · 문장을 나눠도 cue 합집합으로 본다', () => {
    expect(run([4, 5], '사 번이 정답입니다. 오 번도 정답이에요.').findings).toEqual([])
  })
})

describe('T-0158 6차 반례 — 진술 뒤 뒤집기', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it.each([
    [[4], '④가 정답이 될 수 없습니다.'],
    [[4], '④가 정답일 리 없습니다.'],
    [[4], '④가 정답이라는 말은 틀렸습니다.'],
    [[4], '④가 정답은커녕 오답입니다.'],
    [[4, 5], '④가 정답이고 ⑤가 정답은커녕 오답입니다.'],
    [[4], '④가 정답이고 그 반대로 읽으면 안 됩니다.'],
    [[4], '정답은 ④, 하지만 틀린 설명입니다.'],
  ] as [number[], string][])('%j · %s → 차단', (answers, text) => {
    expect(run(answers, text).blocked).toBe(true)
  })
  it('정상 연결은 그대로 통과', () => {
    expect(run([4], '④가 정답이고, ⑤는 오답입니다.').findings).toEqual([])
    expect(run([4], '정답은 사 번입니다.').findings).toEqual([])
  })
})

describe('T-0158 6차 자체 반례 — 물음·문장 밖 부정 응답', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it.each([
    '④가 정답이죠? 아니요, ①입니다.',
    '④가 정답이죠? 아뇨.',
    '사 번이 정답일까요?',
  ])('{4} · %s → 차단(사람 확인)', (text) => {
    expect(run([4], text).blocked).toBe(true)
  })
})

describe('T-0158 7차 반례 — 나머지 화이트리스트', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string, choices?: string[]) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], choices, cues: [cue(text)] })
  it.each([
    '④가 정답이고 이는 오류입니다.',
    '④가 정답입니다만 이 설명은 허위입니다.',
    '④가 정답이며 이 판단은 오류입니다.',
    '④가 정답이고 그 주장은 철회합니다.',
    '④가 정답이고 무엇이든 덧붙인 서술입니다.',
  ])('{4} · %s → 차단(사람 확인)', (text) => {
    expect(run([4], text).blocked).toBe(true)
  })
  const choices = ['a', 'b', 'c', '역할과 관행을 세워 생산적 활동을 돕는다', 'e']
  it('동격이 그 선지 본문이면 통과, 아니면 사람 확인', () => {
    expect(run([4], '정답은 사 번, 역할과 관행을 세워 생산적 활동을 돕는다.', choices).findings).toEqual([])
    expect(run([4], '정답은 사 번, 이는 오류입니다.', choices).blocked).toBe(true)
    expect(run([4], '정답은 사 번, 역할과 관행을 세워 생산적 활동을 돕는다.').blocked).toBe(true) // 선지 모르면 사람 확인
  })
  it('위치 설명 동격·담화 표지는 통과', () => {
    expect(run([4], '여기 다섯 번째 문장, 사 번이 정답입니다.').findings).toEqual([])
    expect(run([2], '정답은 이 번, 비 밑줄입니다.').findings).toEqual([])
  })
})

describe('T-0158 8차 반례 — 오답 진술 사이 자유 서술 금지', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it.each(['①을 배제하면 오답입니다.', '①을 소거하면 오답입니다.', '①을 빠뜨리면 오답입니다.', '오 번은 맞는 진술이고, 답이 아닙니다.'])(
    '{4} · %s → 오답 진술로 읽지 않고 사람 확인', (text) => {
      const r = run([4], text)
      expect(r.blocked).toBe(true)
      expect(r.findings.map((f) => f.code)).toEqual(['CUE_ANSWER_UNPARSED'])
    })
  it('조사만 낀 오답 진술은 그대로 읽는다', () => {
    expect(run([4], '⑤는 오답입니다.').findings).toEqual([])
    expect(run([4, 5], '⑤는 오답입니다.').findings.map((f) => f.code)).toContain('CUE_ELIMINATES_OFFICIAL')
    expect(run([4], '오 번은 답이 아닙니다.').findings).toEqual([])
  })
})

describe('T-0158 9차 반례 — 동격은 선지 본문과 정확히 같을 때만', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const choices = ['a', 'b', 'c', '역할과 관행을 세워 생산적 활동을 돕는다', 'e']
  const run = (text: string) => validatePrepublish({ itemId: 'X#1', officialAnswers: [4], choiceVerdicts: [], choices, cues: [cue(text)] })
  it.each([
    '정답은 ④, ‘역할과 관행을 세워 생산적 활동을 돕는다’는 오답입니다.',
    '정답은 ④, ‘역할과 관행을 세워 생산적 활동을 돕는다’가 정답이라는 판단은 오류입니다.',
    '정답은 ④, 역할과 관행을 세워 생산적 활동을 돕는다 — 이 주장은 허위입니다.',
  ])('%s → 차단', (text) => {
    expect(run(text).blocked).toBe(true)
  })
  it('본문 그대로의 동격은 통과', () => {
    expect(run('정답은 ④, 역할과 관행을 세워 생산적 활동을 돕는다.').findings).toEqual([])
  })
})

describe('T-0158 10차 반례 — 진입 조건 확대', () => {
  const cue = (text: string) => ({
    id: 'cx', order: 0, role: 'evidence' as const, target: { kind: 'analysis' as const, id: 'answer' },
    segments: [{ lang: 'ko-KR' as const, text }], est_sec: 0, pause_after_ms: 0,
  })
  const run = (answers: number[], text: string) =>
    validatePrepublish({ itemId: 'X#1', officialAnswers: answers, choiceVerdicts: [], cues: [cue(text)] })
  it.each([
    [[5], '①은 답입니다.'],
    [[5], '정답은 1입니다.'],
    [[4, 5], '④만이 답입니다.'],
  ] as [number[], string][])('%j · %s → 차단', (answers, text) => {
    expect(run(answers, text).blocked).toBe(true)
  })
  it('연도·소수의 숫자는 선지 번호가 아니다', () => {
    expect(run([4], '2015년 값은 1.8배라 답을 구하기 쉽습니다.').findings).toEqual([])
  })
})
