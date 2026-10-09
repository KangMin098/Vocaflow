// apps/web/src/lib/knowledge/__tests__/effect-signals.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_MIN_N, computeSignals, isEligible, type FirstAttempt } from '../effect-signals'

const base: Omit<FirstAttempt, 'userId' | 'phase' | 'isCorrect'> = { synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false }
const learners = (n: number, phase: FirstAttempt['phase'], correctShare: number, extra: Partial<FirstAttempt> = {}): FirstAttempt[] =>
  Array.from({ length: n }, (_, i) => ({ ...base, userId: `${phase}-${i}`, phase, isCorrect: i < Math.round(n * correctShare), ...extra }))
const run = (attempts: FirstAttempt[], trialMinN: number[] = []) => computeSignals({ applicationId: 'a', status: 'active', trialMinN, attempts })

describe('isEligible', () => {
  it('합성 · 해설 먼저 · 해설 뒤 · 시각 불확실 · 도움 받음은 효과 표본이 아니다', () => {
    const ok = { ...base, userId: 'u', phase: 'practice' as const, isCorrect: true }
    expect(isEligible(ok)).toBe(true)
    expect(isEligible({ ...ok, synthetic: true })).toBe(false)
    expect(isEligible({ ...ok, helpLevel: 'viewed_first' })).toBe(false)
    expect(isEligible({ ...ok, helpLevel: 'hint' })).toBe(false)
    expect(isEligible({ ...ok, afterExplanation: true })).toBe(false)
    expect(isEligible({ ...ok, timingUncertain: true })).toBe(false)
    // 도움 수준 미기록(옛 기록)은 독립 수행인지 알 수 없다 — 근거에서 뺀다(Codex P2)
    expect(isEligible({ ...ok, helpLevel: null })).toBe(false)
  })
})

describe('computeSignals', () => {
  it('기록이 없으면 표본 부족만(성과에 대해 말하지 않는다)', () => {
    const r = run([])
    expect(r.signals.map((s) => s.kind)).toEqual(['insufficient_evidence'])
    expect(r.level).toBe('info')
    expect(r.minN).toBe(DEFAULT_MIN_N)
  })

  it('합성뿐이면 합성 표시 + 표본 부족 — 성과 신호 없음', () => {
    const r = run(learners(50, 'practice', 0.1, { synthetic: true }))
    expect(r.signals.map((s) => s.kind).sort()).toEqual(['insufficient_evidence', 'synthetic_only'])
    expect(r.counts).toMatchObject({ real: 0, synthetic: 50 })
  })

  it('문턱 미만이면 정답률이 낮아도 검토 신호를 내지 않는다', () => {
    const r = run(learners(29, 'practice', 0.1))
    expect(r.signals.some((s) => s.kind === 'performance_shortfall')).toBe(false)
    expect(r.level).toBe('info')
  })

  it('문턱 이상 · 정답률 50% 미만 → 성과 부족 검토 신호(방법 반박이라고 쓰지 않는다)', () => {
    const r = run(learners(30, 'practice', 0.4))
    const s = r.signals.find((x) => x.kind === 'performance_shortfall')
    expect(s?.level).toBe('review')
    expect(s?.message).toContain('방법이 틀렸다는 뜻은 아니다')
    expect(r.level).toBe('review')
  })

  it('검증 계획의 min_n 이 더 크면 그것을 문턱으로 쓴다', () => {
    const r = run(learners(40, 'practice', 0.2), [60])
    expect(r.minN).toBe(60)
    expect(r.signals.map((s) => s.kind)).toEqual(['insufficient_evidence'])
  })

  it('연습과 새 지문의 차이가 20%p 이상이면 결과 상충 검토 신호', () => {
    const r = run([...learners(30, 'practice', 0.9), ...learners(30, 'transfer', 0.6)])
    expect(r.signals.some((s) => s.kind === 'transfer_gap' && s.level === 'review')).toBe(true)
    expect(r.signals.some((s) => s.kind === 'performance_shortfall')).toBe(false)
  })

  it('전이 표본이 문턱 미만이면 결과 상충을 말하지 않는다', () => {
    const r = run([...learners(30, 'practice', 0.9), ...learners(5, 'transfer', 0.0)])
    expect(r.signals.some((s) => s.kind === 'transfer_gap')).toBe(false)
  })

  it('실제 기록의 절반 이상이 제외되면 데이터 품질 경고 — 제외분은 성과 계산에 안 들어간다', () => {
    const r = run([...learners(10, 'practice', 1, { helpLevel: 'viewed_first' }), ...learners(8, 'practice', 0)])
    expect(r.signals.some((s) => s.kind === 'data_quality' && s.level === 'watch')).toBe(true)
    expect(r.eligible.practice.attempts).toBe(8)
    expect(r.counts.excluded).toBe(10)
  })

  it('정오 미기록은 정답률 분모에서 뺀다 · 분모 0 이면 null', () => {
    const r = run(learners(3, 'practice', 0, { isCorrect: null }))
    expect(r.eligible.practice.accuracy).toBeNull()
  })
})

describe('Codex P2 회귀', () => {
  it('정오 미기록 학습자는 표본 문턱을 채우지 않는다', () => {
    const rows = Array.from({ length: 29 }, (_, i) => ({ ...base, userId: `n${i}`, phase: 'practice' as const, isCorrect: null }))
    const r = computeSignals({ applicationId: 'a', status: 'active', trialMinN: [], attempts: [...rows, { ...base, userId: 'x', phase: 'practice', isCorrect: false }] })
    expect(r.signals.some((s) => s.kind === 'performance_shortfall')).toBe(false)
    expect(r.signals.some((s) => s.kind === 'insufficient_evidence')).toBe(true)
  })
  it('연습 70% · 전이 50% 는 정확히 20%p 차이로 결과 상충', () => {
    const mk = (n: number, phase: 'practice' | 'transfer', right: number) =>
      Array.from({ length: n }, (_, i) => ({ ...base, userId: `${phase}${i}`, phase, isCorrect: i < right }))
    const r = computeSignals({ applicationId: 'a', status: 'active', trialMinN: [], attempts: [...mk(30, 'practice', 21), ...mk(30, 'transfer', 15)] })
    expect(r.signals.some((s) => s.kind === 'transfer_gap')).toBe(true)
  })
})
