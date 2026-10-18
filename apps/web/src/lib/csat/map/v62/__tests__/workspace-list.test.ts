// apps/web/src/lib/csat/map/v62/__tests__/workspace-list.test.ts
//
// LM-W1 — 지도 아래 Workspace 리스트 행 모델 · TASK ↔ Workspace 연결. 판정 없이 composeV4 결과(plan · plans)만 엮는지,
// 자료 준비 중을 「학습 가능」으로 올리지 않는지, 선택이 다른 묶음으로 튀지 않는지(양방향 선택 규칙)를 본다.
import { describe, expect, it } from 'vitest'

import type { V4View } from '../../v4/compose'
import type { StageKey, WorkspaceView } from '../../v4/workspace'
import { taskForWs, workspaceRows, wsForTask, wsLinkOf, wsOfTask } from '../workspace-list'

const stages = (ready: Partial<Record<StageKey, number>>): WorkspaceView['stages'] =>
  Object.fromEntries((['check', 'repair', 'transfer', 'recheck'] as StageKey[]).map((k) => [k, k in ready ? { ready: true, count: ready[k]!, blocked: null } : { ready: false, count: null, blocked: 'after_check' }])) as WorkspaceView['stages']
const ws = (id: string, core: string[], support: string[], next: boolean, readiness: WorkspaceView['readiness'] = 'live'): WorkspaceView => ({
  id, name: id.replace('ws.', ''), goal: `${id} 목적`, core, support, readiness, stages: stages({ check: 5 }), next: next ? { href: `/csat/practice/${id}?item=a`, label: `${id} 확인`, target: 'a' } : null, stageItems: { repair: [], transfer: [] }, relations: { structural: [], proposed: [] },
} as unknown as WorkspaceView)
const tp = (task: string, stage: StageKey | null, next: string | null, done = 0, planned: number | null = 5) => ({ task, stage, next: next ? { href: next, label: 'L' } : null, quantity: { done, planned } })

function view(): V4View {
  const A = ws('ws.central-meaning', ['r.central_meaning'], ['e.evidence_locate'], true)
  const B = ws('ws.evidence-locate', ['e.evidence_locate'], ['r.central_meaning'], false)
  const C = ws('ws.cohesion', ['s.cohesion'], [], true, 'content_needed')
  return {
    plan: { primary: A, reason: 'goal_need', others: [B, C], preparing: [{ id: 'ws.cohesion', name: 'cohesion', readiness: 'content_needed' }, { id: 'ws.listen', name: 'listen', readiness: 'blocked' }] },
    plans: {
      'ws.central-meaning': { workspace: A.id, core: A.core, tasks: [tp('r.central_meaning', 'repair', '/repair?item=x', 2, 4), tp('e.evidence_locate', 'check', null)], progress: { planned: 4, done: 2 } },
      'ws.evidence-locate': { workspace: B.id, core: B.core, tasks: [tp('e.evidence_locate', 'check', null)], progress: null },
      'ws.cohesion': { workspace: C.id, core: C.core, tasks: [tp('s.cohesion', 'check', '/c')], progress: null },
    },
  } as unknown as V4View
}

describe('workspaceRows — plan 순서 그대로 · 판정 없음', () => {
  const rows = workspaceRows(view())
  it('대표 → 나머지 → 자료 준비 중(뒤) · 중복 없음', () => {
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['ws.central-meaning', 'primary'],
      ['ws.evidence-locate', 'other'],
      ['ws.cohesion', 'preparing'],
      ['ws.listen', 'preparing'],
    ])
  })
  it('다음 행동 = 중심 TASK 의 taskPlan.next(단계 · 링크는 계획 그대로) · 수행량 = workspacePlan.progress', () => {
    const a = rows[0]
    expect(a.stage).toBe('repair')
    expect(a.next).toEqual({ href: '/repair?item=x', label: 'L', task: 'r.central_meaning' })
    expect(a.progress).toEqual({ planned: 4, done: 2 })
    expect(a.state).toBe('in_progress')
  })
  it('계획 링크가 없고 Workspace 다음 확인도 없으면 「앞 단계 뒤」 — 실행 가능으로 올리지 않음', () => {
    expect(rows[1].next).toBeNull()
    expect(rows[1].state).toBe('locked')
  })
  it('자료 준비 중 Workspace 는 다음 행동이 있어도 학습 가능 아님(next null · 단계 null)', () => {
    const c = rows.find((r) => r.id === 'ws.cohesion')!
    expect(c.state).toBe('preparing')
    expect(c.next).toBeNull()
    expect(c.stages).toBeNull()
    expect(rows.find((r) => r.id === 'ws.listen')!.readiness).toBe('blocked')
  })
})

describe('TASK ↔ Workspace 연결 · 양방향 선택(튀지 않음)', () => {
  const rows = workspaceRows(view())
  it('연결은 정본 TASK id 의 core / support', () => {
    expect(wsLinkOf(rows[0], 'r.central_meaning')).toBe('core')
    expect(wsLinkOf(rows[0], 'e.evidence_locate')).toBe('support')
    expect(wsLinkOf(rows[0], 's.cohesion')).toBeNull()
    expect(wsOfTask(rows, 'e.evidence_locate')).toEqual([{ id: 'ws.evidence-locate', link: 'core' }, { id: 'ws.central-meaning', link: 'support' }])
  })
  it('TASK 선택: 지금 Workspace 가 그 TASK 를 담으면 그대로, 아니면 중심 Workspace', () => {
    expect(wsForTask(rows, 'e.evidence_locate', 'ws.central-meaning')).toBe('ws.central-meaning')
    expect(wsForTask(rows, 'e.evidence_locate', null)).toBe('ws.evidence-locate')
    expect(wsForTask(rows, 'v.unknown', 'ws.central-meaning')).toBeNull()
  })
  it('Workspace 선택: 지금 TASK 가 담기면 그대로, 아니면 첫 중심 TASK — 왕복해도 고정점(무한 반복 없음)', () => {
    expect(taskForWs(rows[0], 'e.evidence_locate')).toBe('e.evidence_locate')
    expect(taskForWs(rows[1], 's.cohesion')).toBe('e.evidence_locate')
    // 왕복: ws → task → ws 가 같은 ws 로 돌아온다
    for (const r of rows.filter((x) => x.core.length)) {
      const t = taskForWs(r, null)!
      expect(wsForTask(rows, t, r.id)).toBe(r.id)
    }
  })
})

describe('LM-G1.1 — 막힌 계획 단계를 Workspace 확인 문항으로 대체하지 않는다(T16 · T17)', () => {
  const W = ws('ws.central-meaning', ['r.central_meaning'], [], true) // Workspace 자체는 확인 문항 링크(next)가 있다
  const mk = (stage: StageKey | null, next: string | null) => workspaceRows({
    plan: { primary: W, reason: 'verified_need', others: [], preparing: [] },
    plans: { 'ws.central-meaning': { workspace: W.id, core: W.core, tasks: [tp('r.central_meaning', stage, next, 2, 2)], progress: { planned: 2, done: 2 } } },
  } as unknown as V4View)[0]
  it('바로잡기 단계 · 링크 없음(실제 막힘) → 행 다음 행동 없음 · 「앞 단계 뒤」 — 확인 문항으로 열지 않는다', () => {
    const r = mk('repair', null)
    expect(r.stage).toBe('repair')
    expect(r.next).toBeNull()
    expect(r.state).toBe('locked')
  })
  it('바로잡기 재시도 링크가 있으면 그 링크 그대로(수행 2 · 진행 중)', () => {
    const r = mk('repair', '/csat/item/i1')
    expect(r.next?.href).toBe('/csat/item/i1')
    expect(r.state).toBe('in_progress')
  })
  it('적용 단계 · 링크 없음 → 대체 없음', () => {
    expect(mk('transfer', null).next).toBeNull()
  })
  it('확인 단계는 같은 출처(확인 문항)라 Workspace 다음 확인으로 이어도 된다', () => {
    expect(mk('check', null).next?.href).toMatch(/ws\.central-meaning/)
  })
})
