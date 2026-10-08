// apps/web/src/lib/csat/map/__tests__/prescription.test.ts
//
// 처방 모델 회귀 — 관찰 → 진단 필요 → 처방 순서(건너뛰기 금지) · verified_diagnosis 전에는 처방이 아님 ·
// 과제 162 의 FIND/REPAIR/TRANSFER/CHECK 대응표가 빠짐없이 · 대응표에 없는 과제도 화면에서 사라지지 않음.
import fs from 'node:fs'
import path from 'node:path'

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
  it('진단 전 학습 활동 — 원인 확인 전 · 지금 여는 단계는 확인하기뿐', () => {
    for (const b of ['rule_proxy', 'item_tagged'] as const) {
      const f = activityFrame(b)
      expect(f.phase).toBe('diagnostic_need')
      expect(f.open).toEqual(['FIND'])
      // 학생 말(2026-10-07): 원인 확인 전임을 말하고 「처방」이라는 낱말은 쓰지 않는다
      expect(f.note).toMatch(/원인을 확인하기 전/)
      expect(f.note).not.toMatch(/처방/)
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

describe('과제 183 → 단계 대응표', () => {
  const ids = Object.keys(TASK_STAGE)
  it('라인 54 × ord 1–3 = 162 + FIND 보강 ord 4 × 20 + S 직접 확인 A2-4 = 183, 빠짐 · 중복 없음', () => {
    expect(ids).toHaveLength(183)
    const lines = new Set(ids.map((id) => id.split('-')[0]))
    expect(lines.size).toBe(54)
    for (const l of lines) for (const o of [1, 2, 3]) expect(TASK_STAGE[`${l}-${o}`]).toBeDefined()
    const ord4 = ids.filter((id) => id.endsWith('-4'))
    expect(ord4).toHaveLength(21) // FIND 보강 20(2026-10-07) + A2-4 S 직접 확인(2026-10-08)
    for (const id of ord4) expect(TASK_STAGE[id]).toBe('FIND')
  })
  it('네 단계가 모두 쓰인다 — 분포(2026-10-07 판정 v1)', () => {
    const n = Object.fromEntries(STAGE_ORDER.map((s) => [s, Object.values(TASK_STAGE).filter((v) => v === s).length]))
    expect(n).toEqual({ FIND: 59, REPAIR: 72, TRANSFER: 32, CHECK: 20 })
  })
  it('모든 라인에 찾기 과제가 있다 — 진단 전에도 「지금 해 볼」 확인 활동이 하나는 있다(2026-10-07 FIND 보강 20 → 0)', () => {
    const lines = [...new Set(ids.map((id) => id.split('-')[0]))]
    const noFind = lines.filter((l) => ![1, 2, 3, 4].some((o) => TASK_STAGE[`${l}-${o}`] === 'FIND'))
    expect(noFind).toEqual([])
  })
  it('FIND 보강 정본 — 라인당 하나 · 목적 · 관찰 신호 · 다음 단계 두 갈래 이상(실제 과제 id) · 대응표와 같은 id', () => {
    const src = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../../../scripts/csat/map/source/find-tasks-20261007.json'), 'utf8')) as {
      ord: number
      tasks: { line: string; purpose: string; signal: string; next: Record<string, string> }[]
    }
    expect(src.tasks.map((t) => `${t.line}-${src.ord}`).sort()).toEqual(ids.filter((id) => id.endsWith('-4') && id !== 'A2-4').sort()) // A2-4 는 S 직접 확인(별도 승인)
    for (const t of src.tasks) {
      expect(t.purpose.trim()).not.toBe('')
      expect(t.signal.trim()).not.toBe('')
      const nx = Object.values(t.next)
      expect(nx.length).toBeGreaterThanOrEqual(2)
      for (const id of nx) expect(TASK_STAGE[id]).toBeDefined()
    }
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
