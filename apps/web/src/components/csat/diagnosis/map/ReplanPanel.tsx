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
          {/* T-0110 — 비교표: TASK 행 × (단계 변화 · 지금 배정 · 저장 계획대로 · 수정안). 확정 전이라 지금 배정은 0 일 수 있다 */}
          {p.shifts.length > 0 || p.weekRows.length > 0 ? (
            <table className={u.rpTable} data-testid="replan-table">
              <caption className={u.rpCaption}>이번 주 배정 비교 — 지금 · 저장 계획대로 · 수정안(분)</caption>
              <thead>
                <tr><th scope="col">TASK</th><th scope="col">단계(저장 → 지금)</th><th scope="col" className={u.rpNum}>지금 배정</th><th scope="col" className={u.rpNum}>저장 계획대로</th><th scope="col" className={u.rpNum}>수정안</th></tr>
              </thead>
              <tbody data-testid="replan-shifts">
                {[...new Set([...p.shifts.map((s) => s.task), ...p.weekRows.map((w) => w.task)])].map((task) => {
                  const s = p.shifts.find((x) => x.task === task)
                  const w = p.weekRows.find((x) => x.task === task)
                  return (
                    <tr key={task} data-task={task}>
                      <th scope="row">{taskOf(task).name}{s?.evidence === 'verified_need' ? ' · 연습 필요 확인' : ''}</th>
                      <td>{s ? `${stage(s.from.stage)}${s.from.planned !== null ? ` ${s.from.planned}` : ''} → ${stage(s.to.stage)}${s.to.remaining !== null ? ` ${s.to.remaining}` : ''}` : '같음'}</td>
                      <td className={u.rpNum}>{w ? `${w.current}분` : '—'}</td>
                      <td className={u.rpNum}>{w ? `${w.before}분` : '—'}</td>
                      <td className={u.rpNum}>{w ? `${w.after}분` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              {/* T-0110 rework — 합계는 표의 행과 같은 TASK 집합(소계). 이번 주 전체(다른 TASK 포함)는 값이 다를 때만 따로 구분해 보인다 */}
              {p.weekRows.length > 0 && (() => {
                const sub = p.weekRows.reduce((a, w) => ({ current: a.current + w.current, before: a.before + w.before, after: a.after + w.after }), { current: 0, before: 0, after: 0 })
                const all = p.thisWeek
                const differs = !!all && (all.current !== sub.current || all.before !== sub.before || all.after !== sub.after)
                return (
                  <tfoot data-testid="replan-week">
                    <tr data-testid="replan-subtotal"><td colSpan={2}>수정안 대상 소계</td><td className={u.rpNum}>{sub.current}분</td><td className={u.rpNum}>{sub.before}분</td><td className={u.rpNum}>{sub.after}분</td></tr>
                    {differs && <tr data-testid="replan-week-all"><td colSpan={2}>이번 주 전체(다른 TASK 포함)</td><td className={u.rpNum}>{all!.current}분</td><td className={u.rpNum}>{all!.before}분</td><td className={u.rpNum}>{all!.after}분</td></tr>}
                  </tfoot>
                )
              })()}
            </table>
          ) : null}
          {p.thisWeek && <p className={u.gpNote} data-testid="replan-week-note">다시 확정하기 전이라 이 TASK 는 「오늘의 학습」에 아직 배정되지 않아요(지금 배정). 확정하면 수정안대로 배정돼요.</p>}
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
      <div className={u.gpFoot}>
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
