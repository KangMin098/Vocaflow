// apps/web/src/lib/csat/map/home-progress.ts
//
// **지도 홈 첫 제안의 「지도에서 하던 일」** (v3 M1 후속) — 지도 화면과 같은 순수 계산(composeV4 · applySaved)에서 고르기만 한다.
//   check: 확인 문항을 풀기 시작했지만 아직 확인 판정(verifiedAt)이 없는 과제 — 지도 순서(목표 요구 우선순위)대로 첫 하나
//   plan:  저장한 학습계획 중 계획 진행이 계획량에 못 미친 학습 묶음 — 대표 묶음 먼저
// 추정하지 않는다: 지도 계산 재료가 없거나(옛 응답) · 과거 기준 보기 · 목표 미설정(To-Be 없음) · 확인 시도를 못 읽음 ·
//   계획 저장소가 없거나 읽기 실패면 해당 항목은 null. 「열었지만 안 푼」 상태는 기록이 없어 다루지 않는다.

import type { MapPageData } from './load'
import { composeV4 } from './v4/compose'
import { taskOf, templateOf, type TaskId } from './v4/definition'
import { applySaved } from './v4/plan-commit'

export interface MapProgress {
  check: { task: string; name: string; ws: string | null } | null
  /**
   * planned · done — 묶음의 기존 계획 진행(applySaved progress · 정본상 중심 TASK 집계). 배정 없음 = null(0 아님)
   * resume — 이어갈 실제 미완료 TASK 행(T-0081 · 보조 TASK 일 수 있다 · 그 행의 계획량 · 수행량 · 단위 그대로). 묶음 집계와 섞지 않는다
   */
  plan: { ws: string; name: string; planned: number | null; done: number | null; task: string; resume: { name: string; planned: number; done: number; unit: string } } | null
}

export function mapProgressOf(data: MapPageData): MapProgress {
  const none: MapProgress = { check: null, plan: null }
  if (!data.model.goalSet) return none
  const v = composeV4(data, { score: data.model.goal, set: true })
  if (!v || v.asIs.mode !== 'current') return none
  const ids = [v.plan.primary?.id, ...v.plan.others.map((w) => w.id)].filter((id): id is string => !!id && !!v.plans[id])
  const homeOf = (task: string) => ids.find((id) => v.plans[id].core.includes(task)) ?? ids.find((id) => v.plans[id].tasks.some((t) => t.task === task)) ?? null

  let check: MapProgress['check'] = null
  if (data.findAttempts) {
    // 목표 요구 순서가 있으면 그 순서, 나머지는 과제 id 순(결정적)
    const order = [...(v.toBe?.needs.map((n) => n.task) ?? []), ...Object.keys(v.asIs.tasks).sort()]
    const task = order.find((id) => {
      const c = v.asIs.tasks[id as keyof typeof v.asIs.tasks]?.check
      return !!c && c.attemptedItems > 0 && !c.verifiedAt
    })
    if (task) check = { task, name: taskOf(task as TaskId).name, ws: homeOf(task) }
  }

  let plan: MapProgress['plan'] = null
  const saved = data.v4?.saved
  // 수행 기록을 못 읽었으면(undefined) 진행을 0 으로 세게 된다 — 다 한 계획을 미완료로 제안하지 않게 판정하지 않는다
  if (data.lifecycleActivity && saved && saved.status === 'installed' && !saved.error) {
    for (const id of ids) {
      const sw = saved.byTemplate[id]
      if (!sw) continue
      const applied = applySaved(v.plans[id], sw.latest)
      // T-0081(P1-1) — 이어갈 행은 중심 집계(progress)와 무관하게 실제 TASK 행에서: 계획량이 있고 수행량이 못 미친 첫 행(저장 계획 순서).
      //   중심이 다 됐거나 배정이 없어도 보조 행이 남았으면 이어간다. 남은 행이 없으면 추정하지 않고 이 묶음은 제안하지 않는다
      const row = applied.tasks.find((t) => t.quantity.planned !== null && t.quantity.planned > 0 && t.quantity.done < t.quantity.planned)
      if (!row || row.quantity.planned === null) continue
      const p = applied.progress
      plan = {
        ws: id, name: templateOf(id)?.name ?? '학습계획', planned: p?.planned ?? null, done: p?.done ?? null, task: row.task,
        resume: { name: taskOf(row.task as TaskId).name, planned: row.quantity.planned, done: row.quantity.done, unit: row.quantity.unit ?? '문항' },
      }
      break
    }
  }
  return { check, plan }
}
