// apps/web/src/lib/csat/map/v62/__tests__/instructional-supplement.test.ts
// T-0083 — 학습 전용 보조 진입: 닫힌 표(ws.sentence-core × s.attachment · 교수 2역할) · 실제 composeV4 → buildDemand
import { describe, expect, it } from 'vitest'

import { DEFAULT_MAP_SETTINGS, type MapPageData } from '../../load'
import { composeV4 } from '../../v4/compose'
import { templateOf } from '../../v4/definition'
import { buildDemand } from '../demand'
import { INSTRUCTIONAL_SUPPLEMENTS, supplementOf, supplementsOfTemplate } from '../instructional-supplement'

const data = { now: '2026-10-21T00:00:00Z', settings: DEFAULT_MAP_SETTINGS, practiceLinks: [], findAttempts: [], lifecycleActivity: [], instrumentHashes: {}, model: { goal: 80, goalSet: true, lineRefItems: {}, nodes: {} }, v4: { sessions: [], proxyCovers: [], refItems: [], transferItems: {}, transferTargets: {}, repairTargets: {}, saved: { byTemplate: {} } } } as unknown as MapPageData
const ctx = { workspaceId: null, planVersion: 1, goalVersion: 1 }
const EVAL = ['independent_check', 'transfer', 'delayed_check']

describe('학습 전용 보조 진입(T-0083)', () => {
  it('닫힌 표 — 한 조합 · 교수 2역할 · 정본 core/support 에는 없음(정본 불변)', () => {
    expect(INSTRUCTIONAL_SUPPLEMENTS).toEqual([{ template: 'ws.sentence-core', task: 's.attachment', roles: ['model_explanation', 'guided_practice'] }])
    const tpl = templateOf('ws.sentence-core')!
    expect([...tpl.core, ...tpl.support]).not.toContain('s.attachment')
    expect(supplementOf('ws.sentence-core', 's.attachment')).toBeTruthy()
    expect(supplementOf('ws.central-meaning', 's.attachment')).toBeNull()
    expect(supplementOf('ws.sentence-core', 's.sentence_core')).toBeNull()
    expect(supplementsOfTemplate('ws.central-meaning')).toEqual([])
  })
  it('실제 composeV4 → buildDemand: 보조 진입 = 원리 설명 · 안내 연습만(평가 역할 0) · 기존 이유 need_without_stage', () => {
    const v = composeV4(data, { score: 80, set: true })!
    const d = buildDemand(v, 's.attachment' as never, 'ws.sentence-core', ctx)
    expect(d.lines.map((l) => l.role)).toEqual(['model_explanation', 'guided_practice'])
    expect(d.lines.every((l) => l.reason === 'need_without_stage')).toBe(true)
    expect(d.lines.some((l) => EVAL.includes(l.role))).toBe(false)
  })
  it('대조 — 같은 TASK 를 다른 묶음 · 묶음 없이 계산하면 기존 규칙 그대로(보조 진입 아님) · 중심 TASK 수요 불변', () => {
    const v = composeV4(data, { score: 80, set: true })!
    const other = buildDemand(v, 's.attachment' as never, 'ws.central-meaning', ctx).lines.map((l) => l.role)
    expect(other).not.toEqual(['model_explanation', 'guided_practice'])
    const core = buildDemand(v, 's.sentence_core' as never, 'ws.sentence-core', ctx).lines.map((l) => l.role)
    expect(core).not.toContain('guided_practice')
  })
})
