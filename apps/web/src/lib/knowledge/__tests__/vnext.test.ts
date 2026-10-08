// apps/web/src/lib/knowledge/__tests__/vnext.test.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  DESIGN_STATUSES,
  DESIGN_TRANSITIONS,
  checkDeployReadiness,
  evaluateProtocol,
  judgeCapability,
  parseProcedure,
  parseThresholds,
  type RunRecord,
} from '../vnext'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 9, 1)

function learner(id: string, hits: boolean[], opts: { gapAfter?: number; transfer?: boolean[]; version?: number } = {}): RunRecord[] {
  const out: RunRecord[] = []
  let at = T0
  hits.forEach((h, i) => {
    at += opts.gapAfter !== undefined && i === opts.gapAfter + 1 ? 8 * DAY : 60_000
    out.push({ userId: id, phase: 'train', claimHit: h, optionCorrect: h, at, designVersion: opts.version ?? 1 })
  })
  for (const h of opts.transfer ?? []) {
    at += 60_000
    out.push({ userId: id, phase: 'transfer', claimHit: h, optionCorrect: h, at, designVersion: opts.version ?? 1 })
  }
  return out
}

describe('checkDeployReadiness', () => {
  it('역량·방법론이 없으면 막는다', () => {
    const r = checkDeployReadiness([{ role: 'learning_mechanism', layer: 'principle', status: 'adopted', slug: 'p' }])
    expect(r.ok).toBe(false)
    expect(r.blockers[0]).toContain('역량 또는 방법론')
  })
  it('채택 안 된 항목을 이름으로 알린다', () => {
    const r = checkDeployReadiness([
      { role: 'capability', layer: 'essence', status: 'adopted', slug: 'c' },
      { role: 'method', layer: 'method', status: 'in_review', slug: 'm' },
    ])
    expect(r.ok).toBe(false)
    expect(r.blockers.join()).toContain('m')
  })
  it('역할과 층이 어긋나면 막는다', () => {
    const r = checkDeployReadiness([{ role: 'capability', layer: 'method', status: 'adopted', slug: 'x' }])
    expect(r.blockers.join()).toContain('역할과 층')
  })
  it('모두 채택이면 통과', () => {
    expect(
      checkDeployReadiness([
        { role: 'capability', layer: 'essence', status: 'applied', slug: 'c' },
        { role: 'method', layer: 'method', status: 'adopted', slug: 'm' },
      ]).ok,
    ).toBe(true)
  })
})

describe('DESIGN_TRANSITIONS', () => {
  it('모든 상태가 정의돼 있고 종료는 막다른 길', () => {
    for (const s of DESIGN_STATUSES) expect(DESIGN_TRANSITIONS[s]).toBeDefined()
    expect(DESIGN_TRANSITIONS.retired).toEqual([])
  })
  it('배포 중에서 바로 초안으로 못 간다(먼저 중단)', () => {
    expect(DESIGN_TRANSITIONS.deployed).not.toContain('draft')
  })
})

describe('parseProcedure · parseThresholds', () => {
  it('제목 없는 단계는 버린다', () => {
    expect(parseProcedure([{ title: 'a', detail: 'd' }, { detail: 'x' }, 3])).toEqual([{ title: 'a', detail: 'd' }])
  })
  it('비정상 문턱은 기본값', () => {
    expect(parseThresholds({ thresholds: { minLearners: -1, preCount: 4 } })).toEqual({ ...DEFAULT_THRESHOLDS, preCount: 4 })
    expect(parseThresholds(null)).toEqual(DEFAULT_THRESHOLDS)
  })
})

describe('evaluateProtocol', () => {
  it('표본이 문턱 미만이면 판정하지 않는다', () => {
    const runs = learner('a', [false, false, false, true, true, true, true, true])
    const r = evaluateProtocol(runs)
    expect(r.verdict).toBe('insufficient_data')
    expect(r.nQualified).toBe(1)
    expect(r.caveats.join()).toContain('문턱 20명 미만')
  })
  it('사후가 부족한 학습자는 자격에서 빠진다', () => {
    const r = evaluateProtocol(learner('a', [true, false, true, true]))
    expect(r.nQualified).toBe(0)
    expect(r.metrics.gainMean).toBeNull()
  })
  it('20명이 고르게 오르면 향상', () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      learner(`u${i}`, [false, false, i % 2 === 0, true, true, true, true, i % 3 !== 0]),
    ).flat()
    const r = evaluateProtocol(runs)
    expect(r.verdict).toBe('positive')
    expect(r.metrics.gainCiLow!).toBeGreaterThan(0)
  })
  it('20명이 고르게 떨어지면 하락', () => {
    const runs = Array.from({ length: 20 }, (_, i) => learner(`u${i}`, [true, true, true, false, false, false, i % 2 === 0, false])).flat()
    expect(evaluateProtocol(runs).verdict).toBe('negative')
  })
  it('변화가 없으면 차이 없음', () => {
    const runs = Array.from({ length: 20 }, (_, i) => learner(`u${i}`, [true, true, false, true, true, false, true, true])).flat()
    // 사전 2/3, 사후 4/5 → 이득 +0.133 가 모두 같다 → sd 0 → 구간이 한 점 → 향상으로 본다
    expect(evaluateProtocol(runs).verdict).toBe('positive')
    const flat = Array.from({ length: 20 }, (_, i) => learner(`u${i}`, [true, false, true, true, false, true, true, false, true, false, true])).flat()
    // 사전 2/3 = 0.667, 사후 5/8 = 0.625 → 이득 −0.042, sd 0 → 하락으로 본다(같은 값이면 구간이 0 을 안 품는다)
    expect(evaluateProtocol(flat).verdict).toBe('negative')
  })
  it('흩어진 이득은 불확실 또는 차이 없음', () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      learner(`u${i}`, i % 2 === 0 ? [false, false, false, true, true, true, true, true] : [true, true, true, false, false, false, false, false]),
    ).flat()
    expect(['inconclusive', 'no_effect']).toContain(evaluateProtocol(runs).verdict)
  })
  it('지연·전이를 따로 센다', () => {
    const r = evaluateProtocol(learner('a', [false, false, false, true, true, true, true, true], { gapAfter: 5, transfer: [true, false] }))
    expect(r.metrics.nDelayed).toBe(1)
    expect(r.metrics.delayedHit).toBe(1)
    expect(r.metrics.nTransfer).toBe(1)
    expect(r.metrics.transferHit).toBe(0.5)
  })
  it('같은 문항을 다시 낸 응답은 세지 않는다(정답 공개 뒤 재제출)', () => {
    const base = learner('a', [false, false, false, true, true, true, true, true]).map((r, i) => ({ ...r, itemId: `i${i}` }))
    const retries = base.slice(0, 3).map((r) => ({ ...r, claimHit: true, at: r.at + 10 * DAY }))
    const r = evaluateProtocol([...base, ...retries])
    expect(r.nRuns).toBe(8)
    expect(r.metrics.preHit).toBe(0)
  })
  it('설계 버전이 섞이면 거부', () => {
    expect(() => evaluateProtocol([...learner('a', [true], { version: 1 }), ...learner('b', [true], { version: 2 })])).toThrow('버전')
  })
  it('대조군 없음 한계를 언제나 적는다', () => {
    expect(evaluateProtocol([]).caveats[0]).toContain('대조군')
  })
})

describe('judgeCapability', () => {
  it('5회 미만이면 판정하지 않고 직접 확인을 권한다', () => {
    const j = judgeCapability([true, true, true])
    expect(j.state).toBe('unconfirmed')
    expect(j.message).toContain('직접 확인')
  })
  it('최근 10회 중 8회 이상이면 확인됨', () => {
    expect(judgeCapability([false, false, true, true, true, true, true, true, true, true, false, true]).state).toBe('confirmed')
  })
  it('그 아래면 연습 필요', () => {
    expect(judgeCapability([true, false, true, false, true, false]).state).toBe('needs_practice')
  })
  it('null(판정 불가) 기록은 세지 않는다', () => {
    expect(judgeCapability([null, null, null, null, null, true]).n).toBe(1)
  })
})
