// apps/web/src/components/csat/diagnosis/map/__tests__/map-state-direct.test.ts
// T-0070 — 시험 기록 없음 ≠ TASK 근거 없음(Codex probe 이식): 유효 직접 확인 근거가 있으면 기록 0 이어도 다음 행동을 숨기지 않는다
import { describe, expect, it } from 'vitest'

import { asIsMap } from '@/lib/csat/map/v4/as-is'
import { AUTHORED_TASK_KEYS } from '@/lib/knowledge/authored/tasks'

import { mapStateOf } from '../GoalRecordBar'

const AT = '2026-10-21T00:00:00.000Z'
const base = () => asIsMap({ asOf: AT, sessions: [], axisProxy: null, checks: [{ taskKey: AUTHORED_TASK_KEYS['r.inference'], items: ['authored:a', 'authored:b'] }], attempts: [] })
const ranks = (n: number) => ({ actionRank: n ? [{ rank: 1, task: 'r.inference' as never, needRank: 1, href: '/csat/learn/a', label: 'a' }] : [], needRank: [], notActionable: [] })

describe('mapStateOf', () => {
  it('목표 + 직접 확인 근거(시험 기록 0) → ready(다음 TASK 행동 보임)', () => {
    const asIs = base()
    asIs.tasks['r.inference'] = { ...asIs.tasks['r.inference'], status: 'checking', basis: 'direct_check' }
    expect(mapStateOf(true, asIs, ranks(1))).toBe('ready')
  })
  it('대조 — 시험 기록 0 · 직접 근거 0 → no_record · 목표 없음 → no_goal', () => {
    expect(mapStateOf(true, base(), ranks(1))).toBe('no_record')
    expect(mapStateOf(false, base(), null)).toBe('no_goal')
  })
  it('시험 proxy 만 있는 TASK 는 직접 근거로 승격하지 않는다', () => {
    const asIs = base()
    asIs.tasks['r.inference'] = { ...asIs.tasks['r.inference'], status: 'observed', basis: 'axis_proxy' }
    expect(mapStateOf(true, asIs, ranks(1))).toBe('no_record')
  })
})
