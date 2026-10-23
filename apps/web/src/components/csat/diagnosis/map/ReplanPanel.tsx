// apps/web/src/components/csat/diagnosis/map/ReplanPanel.tsx
//
// GOAL-ACHIEVEMENT 재처방 — 새 수행 · 시험 기록으로 계획을 다시 확정해야 할 때 「저장 계획 → 수정안」을 같은 자리에서 비교한다.
// replanProposal 결과만 그린다. 확정은 Workspace 계획 탭의 기존 명시적 확정(버전 보존) — 여기서 저장하지 않는다.

'use client'

import { RefreshCw } from 'lucide-react'

import { taskOf } from '@/lib/csat/map/v4/definition'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import { REPLAN_REASON_LABEL, type ReplanProposal } from '@/lib/csat/map/v62/replan'

import u from './unified.module.css'

const stage = (s: keyof typeof STAGE_LABEL | null) => (s ? STAGE_LABEL[s] : '계획 없음')

export function ReplanPanel({ p, onOpenWs }: { p: ReplanProposal; onOpenWs: (ws: string, tab: 'overview' | 'plan') => void }) {
  if (p.none) return null
  return (
    <section className={u.gp} aria-label="계획 다시 세우기" data-testid="replan" data-unchanged={p.unchanged} data-reasons={p.reasons.join(' ')}>
      <div className={u.gpSum}>
        <RefreshCw size={16} aria-hidden="true" />
        <span className={u.gpSumText}>
          계획 다시 세우기
          <span className={u.gpSumNote}>{p.reasons.map((r) => REPLAN_REASON_LABEL[r]).join(' · ')}</span>
        </span>
      </div>
      {p.unchanged ? (
        <p className={u.gpNote} data-testid="replan-unchanged">다시 확정이 필요하지만 단계 · 수량 · 일정은 저장한 계획과 같아요 — 바뀐 것이 없어요.</p>
      ) : (
        <>
          {p.shifts.length > 0 && (
            <ul className={u.gpList} data-testid="replan-shifts">
              {p.shifts.map((s) => (
                <li key={s.task} className={u.gpRow} data-task={s.task}>
                  <div className={u.gpHead}>
                    <span className={u.gpTask}>{taskOf(s.task).name}</span>
                    <span className={u.gpDomain}>{stage(s.from.stage)}{s.from.planned !== null ? ` ${s.from.planned}` : ''} → {stage(s.to.stage)}{s.to.remaining !== null ? ` ${s.to.remaining}` : ''}</span>
                  </div>
                  {s.evidence === 'verified_need' && <p className={u.gpNote}>직접 확인에서 연습이 필요하다고 나왔어요.</p>}
                </li>
              ))}
            </ul>
          )}
          {p.thisWeek && <p className={u.gpNote} data-testid="replan-week">이번 주 배정 {p.thisWeek.before}분 → {p.thisWeek.after}분</p>}
          {!p.before && <p className={u.gpNote}>저장 계획의 목표 · 예산을 확인하지 못해 이전 일정은 비교하지 않아요.</p>}
          {p.changes.length > 0 && (
            <p className={u.gpNote} data-testid="replan-changes">
              목표일까지 배정 수량: {p.changes.map((c) => `${taskOf(c.task).name} ${c.before} → ${c.after}`).join(' · ')}
            </p>
          )}
          {p.nextWeek.length > 0 && <p className={u.gpNote} data-testid="replan-next-week">다음 주 먼저: {p.nextWeek.map((t) => taskOf(t).name).join(' → ')}</p>}
          {p.nextCheck && <p className={u.gpNote} data-testid="replan-next-check">다음 확인 배정일 {p.nextCheck}</p>}
          {!p.after && <p className={u.gpNote}>목표 · 예산이 없어 일정 비교는 하지 않았어요 — 단계 변화만 보여요.</p>}
        </>
      )}
      <div className={u.gpActs}>
        {p.workspaces.map((ws) => (
          <button key={ws} type="button" className={u.ghost} onClick={() => onOpenWs(ws, 'plan')} data-testid="replan-confirm">수정안 확인하고 확정하기</button>
        ))}
      </div>
      <p className={u.gpNote}>확정하기 전에는 저장한 계획이 그대로 남아요. 확정하면 새 버전으로 저장되고 이전 버전도 보존돼요.</p>
      <p className={u.gpNote}>같은 오늘 날짜에서 저장 PLAN과 수정안을 투영한 제안이에요. 과거 달력 이력이나 전체 필요 학습량은 아니에요.</p>
      {p.shifts.some(s => s.from.stage !== s.to.stage) && <p className={u.gpNote}>이전 단계는 저장한 계획량을 배분한 비교예요. 그 단계에서 지금 남은 양을 뜻하지는 않아요.</p>}
    </section>
  )
}
