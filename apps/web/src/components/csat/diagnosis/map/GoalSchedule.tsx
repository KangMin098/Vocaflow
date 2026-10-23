// apps/web/src/components/csat/diagnosis/map/GoalSchedule.tsx
'use client'

import Link from 'next/link'
import { CalendarDays, PlayCircle } from 'lucide-react'
import { withMapReturn } from '@/lib/csat/map-return'
import { taskOf } from '@/lib/csat/map/v4/definition'
import type { SavedPlans } from '@/lib/csat/map/v4/plan-store'
import type { ActivityRow } from '@/lib/csat/map/lifecycle-evidence'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import type { GoalPlanSummaryData } from '@/lib/csat/map/v62/goal-plan'
import { budgetUsage, goalSchedule, type UnassignedReason } from '@/lib/csat/map/v62/goal-schedule'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import { seoulToday } from '@/lib/csat/map/v62/target-goal'
import u from './unified.module.css'

const WHY: Record<UnassignedReason, string> = {
  time: '가능한 시간보다 많아 미배정', content: '이 단계의 실행 자료 준비 필요', unmeasured: '측정 도구 준비 중', relevance: '목표와의 관련성 확인 전',
  plan: 'Workspace 계획 확정·재확정 필요', unknown: '저장 계획 조회 불가', maintenance: '다른 날 유지 확인 기준 준비 중', deadline: '목표일이 지나 미배정',
}

export function GoalSchedule({ data, saved, now, past, activity = [], onOpenWs }: { data: GoalPlanSummaryData; saved: SavedPlans | null; now: string; past: boolean; activity?: readonly ActivityRow[]; onOpenWs: (ws: string, tab: 'overview' | 'plan') => void }) {
  const goal = saved?.goal ?? null
  if (past || !goal || !now || saved?.error) return null
  const schedule = goalSchedule(goal, data.rows, seoulToday(new Date(now)), budgetUsage(goal.budget, activity, now))
  const today = schedule.allocations.filter(a => a.date === schedule.today)
  const week = schedule.weeks[0]
  const next = schedule.allocations[0]
  const old = saved?.goalHistory?.find(g => g.id !== goal.id)
  return <section className={u.schedule} aria-label="목표일까지 학습 시간 배분" data-testid="goal-schedule" data-status={schedule.status}>
    <div className={u.scheduleHead}><h2 className={u.h}><CalendarDays size={16} aria-hidden="true" /> 오늘의 학습</h2><span className={u.headNote}>{goal.date ? `목표일 ${goal.date}` : '목표일을 정해 주세요'}</span></div>
    {schedule.status === 'missing_goal' || schedule.status === 'missing_budget' ? <p className={u.gpNote}>목표 설정에서 시험·목표일·주간 학습 가능 시간을 저장하면 기간별 배분을 볼 수 있어요.</p> : <>
      <p className={u.gpNote}>목표 v{goal.id} · 주간 상한 {goal.budget!.weeklyMinutes}분 · 1문항·지문당 {goal.budget!.minutesPerUnit}분의 잠정 배분 · 일정 제안</p>
      {!!week?.reserved && <p className={u.gpNote}>이번 주 수행·재시도 기록에서 {week.reserved}분을 잠정 차감했어요. 실제 소요 시간을 측정한 값은 아니에요.</p>}
      {old && <p className={u.gpNote} data-testid="schedule-goal-change">이전 목표 v{old.id}{old.budget ? ` · 주간 ${old.budget.weeklyMinutes}분` : ''}{old.date ? ` · ${old.date}` : ''} → 현재 목표 v{goal.id}. 이전 목표와 PLAN 이력은 보존돼요.</p>}
      {today.length ? <ol className={u.scheduleRows}>{today.map(a => <li key={`${a.task}-${a.date}`} data-task={a.task}>
        <div><strong>{taskOf(a.task).name}</strong><span>{STAGE_LABEL[a.stage]} · {a.amount}{a.unit} · {a.minutes}분 배분</span><span className={u.gpNote}>이번 단계 수행 {data.rows.find(r => r.task === a.task)?.quantity.done ?? 0}{a.unit} · {a.evidence === 'verified_need' ? '직접 확인에서 보완이 필요했어요.' : '현재 목표의 확인·학습 순서에 있어요.'} 완료 조건: {a.criterion ?? 'Workspace에서 이번 활동 조건을 확인해요'}</span></div>
        {a.action && <Link className={u.ghost} href={withMapReturn(a.action.href, outgoingCtx(saved, a.task, a.workspace))} data-testid="schedule-start"><PlayCircle size={14} aria-hidden="true" />{a.action.label}</Link>}
      </li>)}</ol> : <p className={u.gpNote} data-testid="schedule-empty">{schedule.status === 'expired' ? '목표일이 지났어요. 목표일을 바꾸고 계획을 다시 확인해요.' : next ? `오늘 배정은 없어요. 다음 배정: ${next.date} · ${taskOf(next.task).name}` : '지금 편성한 활동이 없어요. 아래 미배정 이유와 Workspace를 확인해요.'}</p>}
      <p className={u.gpNote}>수행 결과를 반영하면 TASK 단계와 다음 제안을 다시 계산해요. 단계·자료·목표가 바뀐 PLAN은 Workspace에서 다시 확정해요.</p>
      <details className={u.scheduleDetails}><summary>이번 주 {week?.minutes ?? 0}분 배분 · 전체 일정과 미배정 보기</summary>
        <p className={u.gpNote}>현재 단계에서 확정한 PLAN 수량만 편성해요. 이후 단계의 자료와 평가 결과는 아직 정해지지 않아 목표일까지의 전체 필요량은 미확인이에요.</p>
        {schedule.weeks.filter(w => w.minutes > 0).map(w => <div key={w.start} className={u.scheduleWeek}><strong>{w.start} 주 · {w.minutes}/{w.capacity}분</strong><ul>{schedule.allocations.filter(a => a.date >= w.start && a.date < new Date(Date.parse(`${w.start}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)).map(a => <li key={`${a.date}-${a.task}`}>{a.date} · {taskOf(a.task).name} · {STAGE_LABEL[a.stage]} {a.amount}{a.unit} · {a.minutes}분</li>)}</ul></div>)}
        {schedule.unassigned.length > 0 && <ul data-testid="schedule-unassigned">{schedule.unassigned.map(a => {
          const row = data.rows.find(r => r.task === a.task)
          return <li key={a.task}>{taskOf(a.task).name}{a.amount !== null ? ` ${a.amount}${a.unit}` : ' 수량 미확인'} — {WHY[a.reason]} {row?.workspace && <button type="button" className={u.ghost} onClick={() => onOpenWs(row.workspace!, a.reason === 'plan' ? 'plan' : 'overview')}>Workspace 보기</button>}</li>
        })}</ul>}
      </details>
    </>}
  </section>
}
