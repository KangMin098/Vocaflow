// apps/web/src/lib/csat/map/v62/plan-change.ts
//
// T-0077 — 저장한 계획(버전)과 다른 계획(지금 제안 · 다른 저장 버전)의 차이를 **사실 그대로** 나열한다. 판정 · 수량 · 순위를 새로 만들지 않는다.
//   TASK 마다 단계 · 계획량 · 가용량의 old → new. 단위는 각 쪽 단계의 단위(적용 = 지문 · 그 밖 = 문항) — 서로 빼거나 합하지 않는다.
//   값이 없으면(null) 「미정」 — 0 이나 다른 쪽 값으로 채우지 않는다. 순서만 바뀌면 순서 변화로만 말한다.

export interface PlanSide { task: string; stage: string | null; planned: number | null; available: number | null }

export type Unit = '문항' | '지문'
export const unitOf = (stage: string | null): Unit => (stage === 'transfer' ? '지문' : '문항')

export interface TaskChange {
  task: string
  /** 비교 쪽 둘 중 한쪽에만 있는 TASK */
  presence: 'both' | 'added' | 'removed'
  stage: { from: string | null; to: string | null } | null
  planned: { from: number | null; fromUnit: Unit; to: number | null; toUnit: Unit } | null
  available: { from: number | null; fromUnit: Unit; to: number | null; toUnit: Unit } | null
}

export interface PlanChange {
  /** same = 단계 · 계획량 · 가용량 · 순서 모두 같다 */
  status: 'same' | 'changed'
  /** TASK 순서만 다르다(집합은 같음) */
  orderChanged: boolean
  tasks: TaskChange[]
}

/** from(저장본) → to(제안 또는 다음 저장 버전). 비교할 저장본이 없으면 호출하지 않는다(화면이 「비교할 저장본 없음」을 말한다) */
export function planChange(from: readonly PlanSide[], to: readonly PlanSide[]): PlanChange {
  const a = new Map(from.map((x) => [x.task, x]))
  const b = new Map(to.map((x) => [x.task, x]))
  const tasks: TaskChange[] = []
  for (const task of [...new Set([...from.map((x) => x.task), ...to.map((x) => x.task)])]) {
    const f = a.get(task), t = b.get(task)
    if (!f || !t) {
      tasks.push({ task, presence: f ? 'removed' : 'added', stage: null, planned: null, available: null })
      continue
    }
    const fu = unitOf(f.stage), tu = unitOf(t.stage)
    const stage = f.stage !== t.stage ? { from: f.stage, to: t.stage } : null
    const planned = f.planned !== t.planned || fu !== tu ? { from: f.planned, fromUnit: fu, to: t.planned, toUnit: tu } : null
    const available = f.available !== t.available || fu !== tu ? { from: f.available, fromUnit: fu, to: t.available, toUnit: tu } : null
    if (stage || planned || available) tasks.push({ task, presence: 'both', stage, planned, available })
  }
  const sameSet = from.length === to.length && from.every((x) => b.has(x.task))
  const orderChanged = sameSet && from.map((x) => x.task).join() !== to.map((x) => x.task).join()
  return { status: tasks.length || orderChanged ? 'changed' : 'same', orderChanged, tasks }
}

/** 저장 이력에서 최신과 바로 앞 버전(version - 1)을 찾는다. 잘려서 없으면 null(비교 불가) */
export function previousOf<V extends { version: number }>(history: readonly V[], latest: V): V | null {
  return history.find((h) => h.version === latest.version - 1) ?? null
}
