// apps/web/src/components/csat/diagnosis/map/GoalOutcome.tsx
//
// GOAL-ACHIEVEMENT 3차 — 「목표 대비 지금」. goalOutcome(목표 · 실제 시험 기록 · TASK 계획) 결과만 그린다(판정 없음).
// 시험 기록 판정과 TASK 활동 결과를 다른 줄로 둔다 — 활동 완료로 목표 도달을 말하지 않는다. 퍼센트 · 예측 없음.

'use client'

import { Flag } from 'lucide-react'
import type { CSSProperties } from 'react'

import { MET_LIMIT, VERDICT_LABEL, NEXT_LABEL, SCORE_STATUS_LABEL, type GoalOutcome as Outcome } from '@/lib/csat/map/v62/goal-outcome'
import { GOAL_EXAM_LABEL } from '@/lib/csat/map/v62/target-goal'

import u from './unified.module.css'

export function GoalOutcome({ outcome: o, past }: { outcome: Outcome | null; past: boolean }) {
  if (past || !o) return null
  const f = o.followup
  return (
    <details className={u.gp} data-testid="goal-outcome" data-verdict={o.verdict} data-score={o.score.status} data-grade={o.grade.status} data-change={o.change.status} data-next={o.next}>
      <summary className={u.gpSum}>
        <Flag size={16} aria-hidden="true" />
        <span className={u.gpSumText}>
          목표 대비 지금
          <span className={u.gpSumNote}>
            {VERDICT_LABEL[o.verdict]} · {' '}
            {o.score.status === 'below' || o.score.status === 'reached'
              ? `${f!.examLabel} ${f!.raw}점 · 목표 ${o.target.score}점 (${o.score.gap! >= 0 ? '+' : ''}${o.score.gap}점)`
              : '미확인'}
          </span>
        </span>
        <span className={u.gpOpen}>펼치기</span>
      </summary>
      {/* T-0110 — 점수 축: 목표 표식과 이 기록 표식을 한 축에(퍼센트 · 예측 없음). 같은 종류 시험의 원점수가 있을 때만 */}
      {(o.score.status === 'below' || o.score.status === 'reached') && f?.raw != null && (
        <div className={u.goScale} role="img" aria-label={`0~100점 축 — 목표 ${o.target.score}점, ${f.examLabel} 기록 ${f.raw}점`} data-testid="goal-outcome-scale">
          <span className={u.goScaleEnd} data-end="min">0</span>
          <span className={u.goScaleEnd} data-end="max">100</span>
          <span className={u.goMark} data-kind="target" style={{ '--at': o.target.score / 100 } as CSSProperties}><span className={u.goMarkLabel}>목표 {o.target.score}</span></span>
          <span className={u.goMark} data-kind="record" style={{ '--at': f.raw / 100 } as CSSProperties}><span className={u.goMarkLabel}>기록 {f.raw}</span></span>
        </div>
      )}
      {/* 대조 — 시험 기록이 말하는 것 | TASK 활동이 말하는 것(활동 완료로 목표 도달을 말하지 않는다) */}
      <div className={u.goCols}>
        <section className={u.goCol} aria-label="시험 기록이 말하는 것">
          <h3>시험 기록이 말하는 것</h3>
          <p className={u.goVerdict}>{VERDICT_LABEL[o.verdict]}</p>
          <p data-testid="goal-outcome-score">{SCORE_STATUS_LABEL[o.score.status]}</p>
          <p>목표 {o.target.exam ? GOAL_EXAM_LABEL[o.target.exam] : '시험 미정'} {o.target.score}점{o.target.grade !== null ? ` · ${o.target.grade}등급` : ''}</p>
          {o.target.grade !== null && <p>{o.grade.status === 'reached' ? `기록된 등급 ${f?.grade}등급 — 목표 등급 이상` : o.grade.status === 'below' ? `기록된 등급 ${f?.grade}등급 — 목표 등급보다 낮아요` : o.grade.status === 'no_record_grade' ? '기록에 등급이 없어요 — 점수로 등급을 만들지 않아요' : '등급 미확인'}</p>}
          <p>{o.change.status === 'repeat_observation' ? `같은 시험지 재풀이 ${o.change.before!.raw} → ${o.change.after!.raw}점 — 독립 평가 · 학습 효과의 증거는 아니에요` : o.change.status === 'different_paper' ? `목표 전 ${o.change.before!.examLabel} · 이후 ${o.change.after!.examLabel} — 다른 시험지라 점수 차이를 계산하지 않아요` : '비교할 이전 · 이후 기록이 아직 없어요'}</p>
        </section>
        <section className={u.goCol} aria-label="TASK 활동이 말하는 것">
          <h3>TASK 활동이 말하는 것</h3>
          <p className={u.goVerdict}>다시 확인 통과 {o.activity.resolved} / 목표 관련 {o.activity.needs}</p>
          <p data-testid="goal-outcome-activity">활동 결과예요 — 목표 점수 도달 근거는 아니에요</p>
          <p data-testid="goal-attainment">이 카드로는 최종 목표 달성을 판정하지 않아요(미확인) — 최종 달성은 「최종 평가」로 정한 날의 기록으로만 판정해요</p>
        </section>
      </div>
      {o.verdict === 'met' && <p className={u.gpNote} data-testid="goal-outcome-limit">{MET_LIMIT}</p>}
      <p className={u.gpNote} data-testid="goal-outcome-next">다음: {NEXT_LABEL[o.next]}</p>
    </details>
  )
}
