// apps/web/src/components/csat/diagnosis/map/PlanChangeSummary.tsx
//
// T-0077 — 계획 변화 한 줄 목록(바뀐 TASK 만). 「무엇을 얼마나」만 말하고 왜 · 실력 변화는 말하지 않는다(사유는 저장된 사유 라벨만).
import { taskOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import type { PlanChange, TaskChange, Unit } from '@/lib/csat/map/v62/plan-change'

import n from './needs.module.css'

const stageText = (s: string | null) => (s ? STAGE_LABEL[s as keyof typeof STAGE_LABEL] ?? s : '단계 미정')
const qty = (v: number | null, u: Unit) => (v === null ? '미정' : `${v}${u}`)

function line(c: TaskChange): string {
  const name = taskOf(c.task as TaskId)?.name ?? c.task
  if (c.presence === 'added') return `${name} — 새로 들어옴`
  if (c.presence === 'removed') return `${name} — 빠짐`
  const parts: string[] = []
  if (c.stage) parts.push(`단계 ${stageText(c.stage.from)} → ${stageText(c.stage.to)}`)
  if (c.planned) parts.push(`계획량 ${qty(c.planned.from, c.planned.fromUnit)} → ${qty(c.planned.to, c.planned.toUnit)}`)
  if (c.available) parts.push(`쓸 수 있는 자료 ${qty(c.available.from, c.available.fromUnit)} → ${qty(c.available.to, c.available.toUnit)}`)
  return `${name} — ${parts.join(' · ')}`
}

/** lead = 무엇과 무엇의 비교인지(「저장본 버전 2 → 지금 제안(아직 저장 안 함)」 등) */
export function PlanChangeSummary({ change, lead, goal, testId }: { change: PlanChange; lead: string; goal?: string | null; testId: string }) {
  return (
    <div className={n.sub} data-testid={testId} data-status={change.status} data-order={change.orderChanged ? 'changed' : 'same'}>
      <p>{lead}</p>
      {goal && <p data-testid={`${testId}-goal`}>{goal}</p>}
      {change.status === 'same' ? (
        <p>단계 · 계획량 · 순서가 같아요.</p>
      ) : (
        <ul>
          {change.tasks.map((c) => <li key={c.task} data-task={c.task}>{line(c)}</li>)}
          {change.orderChanged && <li data-testid={`${testId}-order`}>학습 순서가 바뀌었어요</li>}
        </ul>
      )}
    </div>
  )
}
