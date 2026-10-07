// apps/web/src/lib/csat/map/__tests__/prescription.test.ts
//
// 처방 모델 회귀 — 관찰 → 진단 필요 → 처방 순서(건너뛰기 금지) · verified_diagnosis 전에는 처방이 아님 ·
// 과제 162 의 FIND/REPAIR/TRANSFER/CHECK 대응표가 빠짐없이 · 대응표에 없는 과제도 화면에서 사라지지 않음.
import { describe, expect, it } from 'vitest'

import { FORBIDDEN_WORDS, type DiagnosisBasis } from '../core'
import {
  LINKS, PHASE_ORDER, STAGE_DESC, STAGE_LABEL, STAGE_ORDER, TASK_STAGE, activityFrame, groupByStage, nextPhase, reachablePhase, stageOf,
} from '../prescription'

const BASES: DiagnosisBasis[] = ['rule_proxy', 'item_tagged', 'verified_diagnosis']

describe('관찰 → 진단 필요 → 처방', () => {
  it('관찰에서 처방으로 바로 가지 않는다 — 한 칸씩만', () => {
    for (const b of BASES) {
      expect(nextPhase('observation', b)).toBe('diagnostic_need')
      const from = PHASE_ORDER.indexOf('observation')
      expect(PHASE_ORDER.indexOf(nextPhase('observation', b)) - from).toBe(1)
    }
  })
  it('verified_diagnosis 전에는 진단 필요에 머문다', () => {
    expect(reachablePhase('rule_proxy')).toBe('diagnostic_need')
    expect(reachablePhase('item_tagged')).toBe('diagnostic_need')
    expect(nextPhase('diagnostic_need', 'item_tagged')).toBe('diagnostic_need')
    expect(reachablePhase('verified_diagnosis')).toBe('prescription')
  })
  it('진단 전 학습 활동 — 「처방이 아니에요」, 지금 여는 단계는 찾기뿐', () => {
    for (const b of ['rule_proxy', 'item_tagged'] as const) {
      const f = activityFrame(b)
      expect(f.phase).toBe('diagnostic_need')
      expect(f.open).toEqual(['FIND'])
      expect(f.note).toMatch(/처방이 아니에요/)
      expect(f.title).not.toMatch(/처방/)
    }
    const v = activityFrame('verified_diagnosis')
    expect(v.phase).toBe('prescription')
    expect(v.open).toEqual(STAGE_ORDER)
  })
  it('문구에 판정 금지어가 없다', () => {
    const texts = [...Object.values(STAGE_LABEL), ...Object.values(STAGE_DESC), ...BASES.flatMap((b) => [activityFrame(b).title, activityFrame(b).note])]
    for (const t of texts) expect(t).not.toMatch(FORBIDDEN_WORDS)
  })
})

describe('과제 162 → 단계 대응표', () => {
  const ids = Object.keys(TASK_STAGE)
  it('라인 54 × ord 1–3 = 162, 빠짐 · 중복 없음', () => {
    expect(ids).toHaveLength(162)
    const lines = new Set(ids.map((id) => id.split('-')[0]))
    expect(lines.size).toBe(54)
    for (const l of lines) for (const o of [1, 2, 3]) expect(TASK_STAGE[`${l}-${o}`]).toBeDefined()
  })
  it('네 단계가 모두 쓰인다 — 분포(2026-10-07 판정 v1)', () => {
    const n = Object.fromEntries(STAGE_ORDER.map((s) => [s, Object.values(TASK_STAGE).filter((v) => v === s).length]))
    expect(n).toEqual({ FIND: 38, REPAIR: 72, TRANSFER: 32, CHECK: 20 })
  })
  it('찾기 과제가 없는 라인 수를 고정한다 — 진단 전에 「지금 해 볼」 활동이 없는 라인(콘텐츠 공백, 과제 추가는 시드 변경)', () => {
    const lines = [...new Set(ids.map((id) => id.split('-')[0]))]
    const noFind = lines.filter((l) => ![1, 2, 3].some((o) => TASK_STAGE[`${l}-${o}`] === 'FIND'))
    expect(noFind).toHaveLength(20)
  })
  it('연결 과제는 대응표 안에 있고, 연결 대상은 실제 라인이거나 「원인에 맞는 라인」(null)', () => {
    const lines = new Set(ids.map((id) => id.split('-')[0]))
    for (const [id, to] of Object.entries(LINKS)) {
      expect(TASK_STAGE[id]).toBeDefined()
      if (to !== null) expect(lines.has(to)).toBe(true)
    }
  })
})

describe('묶기', () => {
  it('단계 순서로 묶고, 대응표에 없는 과제는 「단계 미정」으로 남긴다(숨기지 않는다)', () => {
    const tasks = [{ id: 'A2-3', ord: 3 }, { id: 'A2-1', ord: 1 }, { id: 'A2-2', ord: 2 }, { id: 'Z9-1', ord: 1 }]
    const g = groupByStage(tasks, activityFrame('rule_proxy'))
    expect(g.map((x) => x.stage)).toEqual(['FIND', 'REPAIR', 'TRANSFER', null])
    expect(g.map((x) => x.open)).toEqual([true, false, false, false])
    expect(g.flatMap((x) => x.tasks).length).toBe(tasks.length)
    expect(stageOf('Z9-1')).toBeNull()
  })
})
