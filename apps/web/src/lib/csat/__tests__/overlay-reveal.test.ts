// apps/web/src/lib/csat/__tests__/overlay-reveal.test.ts
//
// **순차 공개의 계약을 잠근다.** 이 순서가 조용히 뒤집히면 화면은 멀쩡히 돌고
// 학습 설계만 사라진다 — 오답이 근거보다 먼저 열리면 자책이 앞서고(철학 3),
// 빈 카드가 끼면 "다음" 을 눌렀는데 아무것도 안 바뀐 고장처럼 보인다.

import { describe, expect, it } from 'vitest'

import { buildRevealSteps, secondsBucket, stepIndexOfChoice, type RevealSource } from '@/lib/csat/overlay-reveal'

const full: RevealSource = {
  answer: 3,
  answer_quote: 'The measured decline began long before the policy took effect.',
  design_intent: '시점의 선후를 뒤집어 읽게 만드는 문항이다.',
  choice_analysis: [
    { n: 1, trap: '범위 넘김', why_tempting: '첫 문단만 보면 맞다', how_to_reject: '둘째 문단이 범위를 좁힌다' },
    { n: 2, trap: '인과 뒤집기', how_to_reject: '원인과 결과가 바뀌어 있다' },
    { n: 3, why_correct: '두 시점의 선후가 본문과 같다' },
    { n: 4, trap: '과장', how_to_reject: '본문은 정도를 한정한다' },
    { n: 5, trap: '언급 없음', how_to_reject: '본문에 나오지 않는 비교다' },
  ],
  solve_procedure: [{ step: '시점을 먼저 표시한다', on_fail: '연도를 동그라미' }, { step: '선지의 방향을 본다' }],
  required_vocab: ['decline', 'precede', 'decline'],
}

describe('순차 공개 단계', () => {
  it('근거 → 정답 → 오답 → 절차 → 어휘 순서다', () => {
    const kinds = buildRevealSteps(full).map((s) => s.kind)
    expect(kinds).toEqual(['evidence', 'correct', 'reject', 'reject', 'reject', 'reject', 'procedure', 'vocab'])
  })

  it('오답은 번호순이고 정답은 오답 단계에 다시 나오지 않는다', () => {
    const rejects = buildRevealSteps(full).filter((s) => s.kind === 'reject')
    expect(rejects.map((s) => s.choice)).toEqual([1, 2, 4, 5])
  })

  it('단계마다 문제지 위에서 켜는 것이 하나로 좁혀진다 — 두드러지는 것은 하나', () => {
    const steps = buildRevealSteps(full)
    const correct = steps.find((s) => s.kind === 'correct')!
    expect(correct.focus.marks).toEqual([3])
    const reject = steps.find((s) => s.kind === 'reject')!
    // 오답 단계에서 근거 밑줄까지 켜 두면 «지금 보는 것» 이 둘이 된다
    expect(reject.focus.quote).toBe(false)
    expect(reject.focus.marks).toEqual([1])
  })

  it('빈 카드를 만들지 않는다 — 재료가 없는 겹은 아예 없다', () => {
    const steps = buildRevealSteps({
      answer: null,
      answer_quote: '   ',
      design_intent: null,
      choice_analysis: [{ n: 2, trap: '   ' }],
      solve_procedure: [{ step: '  ' }],
      required_vocab: ['', '   '],
    })
    expect(steps).toEqual([])
  })

  it('인용이 없으면 근거 단계는 칠하지 않는다 — 없는 자리를 자신 있게 칠하지 않는다', () => {
    const steps = buildRevealSteps({ ...full, answer_quote: null })
    const ev = steps.find((s) => s.kind === 'evidence')!
    expect(ev.body).toBe(full.design_intent)
    expect(ev.focus.quote).toBe(false)
  })

  it('어휘는 중복을 접는다', () => {
    const vocab = buildRevealSteps(full).find((s) => s.kind === 'vocab')!
    expect(vocab.vocab).toEqual(['decline', 'precede'])
  })

  it('함정 이름은 오답 단계에만 실린다 (L5)', () => {
    const steps = buildRevealSteps(full)
    expect(steps.find((s) => s.choice === 1)!.trap).toBe('범위 넘김')
    expect(steps.find((s) => s.kind === 'correct')!.trap).toBeNull()
  })

  it('선지 번호로 그 단계를 찾는다 · 없으면 -1', () => {
    const steps = buildRevealSteps(full)
    expect(steps[stepIndexOfChoice(steps, 4)]!.choice).toBe(4)
    expect(stepIndexOfChoice(steps, 3)).toBeGreaterThanOrEqual(0) // 정답도 가리킬 수 있다
    expect(stepIndexOfChoice(buildRevealSteps({ ...full, choice_analysis: [] }), 2)).toBe(-1)
  })

  it('걸린 시간은 버킷으로만 나간다 — 초를 그대로 보내지 않는다', () => {
    expect(secondsBucket(0)).toBe(0)
    expect(secondsBucket(29)).toBe(0)
    expect(secondsBucket(59)).toBe(1)
    expect(secondsBucket(119)).toBe(3)
    expect(secondsBucket(600)).toBe(5)
    expect(secondsBucket(Number.NaN)).toBe(0)
  })
})
