// apps/web/src/lib/csat/map/v62/__tests__/maintenance-state.test.ts
// T-0082 — 지금 확인 통과 + 유지(MAINTAIN): 실제 asIs → toBe → planWorkspaces → allTaskPlans/workspacePlan → ranksOf → nextActionOf.
//   Codex T-0045 dg-demand probe 의 투영 그대로(관찰: 「앞 단계를 마치면 열려요」 오안내) + 대조. 새 판정 · 간격 · 수량 없음
import { describe, expect, it } from 'vitest'

import { asIsMap } from '../../v4/as-is'
import { DOMAINS } from '../../v4/definition'
import { allTaskPlans, workspacePlan } from '../../v4/plan'
import { toBeMap } from '../../v4/to-be'
import { planWorkspaces } from '../../v4/workspace'
import { buildDemand } from '../demand'
import { maintainPassed } from '../maintenance-state'
import { nextActionOf, WAIT_LABEL } from '../next-action'
import { ranksOf } from '../rank'
import { workspaceRows } from '../workspace-list'

const task = 'r.central_meaning', key = 'claim-support', template = 'ws.central-meaning'
const items = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links = { [key]: items.map((target) => ({ target, href: `/csat/item/${target}`, label: target })) }
const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function view(resolved: boolean, unseen: string[] = items.slice(2)): any {
  const asIs = asIsMap({ asOf: '2026-10-21T00:00:00Z', sessions: [], axisProxy: { state: Object.fromEntries(DOMAINS.map((d) => [d, 'check_first'])), contributions: Object.fromEntries(DOMAINS.map((d) => [d, 0])) }, checks: [{ taskKey: key, items }], attempts: [] } as never)
  asIs.tasks[task] = { ...asIs.tasks[task], status: resolved ? 'resolved' : 'verified_need', basis: 'direct_check', check: { status: resolved ? 'resolved' : 'verified', independentItems: 2, verifiedAt: '2026-10-10T00:00:00Z', verifiedItems: ['i1', 'i2'], wrongItems: ['i1', 'i2'], lastWrongAt: null, unseen } } as never
  let toBe = toBeMap({ asIs, goal: { score: 80, set: true }, refItems: refs, lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) }, confirmLinks: links, transferredKeys: resolved ? [key] : [] } as never)
  if (unseen.length === 0) toBe = { ...toBe, needs: toBe!.needs.filter((n) => n.task === task).map((n) => ({ ...n, executable: null })), relevanceUnknown: [] } as never
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [key]: 0 }, transferTargets: {} } as never)
  const activity = resolved ? [] : [{ itemRef: 'i1', taskKey: key, phase: 'practice', answeredAt: '2026-10-11T00:00:00Z', isCorrect: true }]
  const taskPlans = allTaskPlans(asIs, toBe, plan, activity as never)
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter(Boolean).map((w) => [w!.id, workspacePlan(w!, asIs, toBe, plan, activity as never)]))
  return { asIs, toBe, plan, plans, taskPlans }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const savedOf = (v: any, goalVersionId = 1) => {
  const rows = v.plans[template].tasks.map((t: { task: string; stage: string | null; quantity: { planned: number | null; available: number | null } }) => ({ task: t.task, stage: t.stage, planned: t.quantity.planned, available: t.quantity.available }))
  return { status: 'installed', goalVersionId: 1, byTemplate: { [template]: { latest: { version: 1, goalVersionId, plan: { order: rows.map((r: { task: string }) => r.task), tasks: rows } } } } } as never
}

describe('지금 확인 통과 + 유지(T-0082)', () => {
  it('반례 — 새 확인 링크 0: 「앞 단계를 마치면」(stage_locked)이 아니라 maintain_pending · 지금 통과 · 유지 확인 기준 미정', () => {
    const v = view(true, [])
    const p = v.taskPlans.find((x: { task: string }) => x.task === task)
    expect(p).toMatchObject({ need: 'MAINTAIN', achievement: 'resolved' })
    expect(maintainPassed(p)).toBe(true)
    const r = ranksOf(v)
    expect(r.notActionable.find((n) => n.task === task)?.reason).toBe('maintain_pending')
    const next = nextActionOf(v, r, savedOf(v))!
    expect(next).toMatchObject({ task, kind: 'wait', blocked: 'maintain_pending', href: null })
    expect(WAIT_LABEL[next.blocked!]).toContain('지금 확인은 통과했어요')
    expect(WAIT_LABEL[next.blocked!]).not.toMatch(/앞 단계|숙달했|목표 달성했/)
  })
  it('남은 혼자 확인 링크가 있어도 실행 순위에 올리지 않는다(같은 회차는 해소 뒤 다시 판정되지 않는다) · 자료 받기도 내밀지 않음', () => {
    const v = view(true)
    const p = v.taskPlans.find((x: { task: string }) => x.task === task)
    expect(maintainPassed(p)).toBe(true)
    const r = ranksOf(v)
    expect(r.actionRank.some((a) => a.task === task)).toBe(false)
    const next = nextActionOf(v, r, savedOf(v))!
    // 유지 TASK 를 다음 필수 풀이로 내밀지 않는다 — 같은 화면의 다른 TASK(계획 확정 등)가 기존 순서로 먼저
    expect(next.task).not.toBe(task)
    expect(next.href).toBeNull()
    // 수요 · 역할 · 수량은 그대로(demand 무변경)
    expect(buildDemand(v, task, template, { workspaceId: null, planVersion: 1, goalVersion: 1 }).lines.map((l) => l.role)).toEqual(['independent_check'])
  })
  it('다른 TASK 에 실제 실행이 있으면 그 TASK 를 기존 순서로 추천', () => {
    const v = view(true)
    const r = ranksOf(v)
    const other = { ...r, actionRank: [{ rank: 1, task: 'e.evidence_location' as never, href: '/csat/learn/x', label: 'x', needRank: 2 }] }
    const next = nextActionOf(v, other, savedOf(v))!
    expect(next.task).toBe('e.evidence_location')
    expect(next.kind).not.toBe('wait')
  })
  it('기존 보호 유지 — 저장 전 = 계획 확정 한 번 · 목표 변경 = 재확정(그 뒤에만 유지 대기)', () => {
    const v = view(true, [])
    const r = ranksOf(v)
    expect(nextActionOf(v, r, { status: 'installed', goalVersionId: 1, byTemplate: {} } as never)).toMatchObject({ kind: 'plan', blocked: 'maintain_pending' })
    expect(nextActionOf(v, r, savedOf(v, 99))).toMatchObject({ kind: 'plan', replan: true, replanWhy: 'goal' })
  })
  it('대조 — 실제 REPAIR(바로잡기 성공 · 전이 재고 0) = 기존 transfer · material_needed(유지 아님)', () => {
    const v = view(false)
    const p = v.taskPlans.find((x: { task: string }) => x.task === task)
    expect(maintainPassed(p)).toBe(false)
    expect(p.stage).toBe('transfer')
    expect(ranksOf(v).notActionable.find((n) => n.task === task)?.reason).toBe('material_needed')
  })
  it('P1-1 — Workspace 목록 행도 같은 판정: 남은 확인 링크(cm-ind-5 류)가 있어도 다음 링크 없음 · 상태 maintain(앞 단계 잠김 아님) · 대조 REPAIR 는 기존', () => {
    for (const unseen of [items.slice(2), []]) {
      const v = view(true, unseen)
      const row = workspaceRows({ ...v, plan: { ...v.plan, preparing: v.plan.preparing ?? [] } }).find((r) => r.id === template)!
      expect(row.next, `unseen=${unseen.length}`).toBeNull()
      expect(row.state).toBe('maintain')
    }
    const r = workspaceRows(view(false)).find((x) => x.id === template)!
    expect(r.state).not.toBe('maintain')
  })
})
