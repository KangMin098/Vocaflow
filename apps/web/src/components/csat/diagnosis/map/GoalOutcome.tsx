// apps/web/src/components/csat/diagnosis/map/GoalOutcome.tsx
//
// GOAL-ACHIEVEMENT 3차 — 「목표 대비 지금」. goalOutcome(목표 · 실제 시험 기록 · TASK 계획) 결과만 그린다(판정 없음).
// 시험 기록 판정과 TASK 활동 결과를 다른 줄로 둔다 — 활동 완료로 목표 도달을 말하지 않는다. 퍼센트 · 예측 없음.

'use client'

import { Flag } from 'lucide-react'

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
      <dl className={u.gpFacts}>
        <div><dt>최종 목표</dt><dd data-testid="goal-attainment">평가 대상·시점·조건이 결속되지 않아 최종 목표 달성은 미확인이에요</dd></div>
        <div><dt>목표</dt><dd>{o.target.exam ? GOAL_EXAM_LABEL[o.target.exam] : '시험 미정'} {o.target.score}점{o.target.grade !== null ? ` · ${o.target.grade}등급` : ''}</dd></div>
        <div><dt>시험 기록</dt><dd data-testid="goal-outcome-score">{SCORE_STATUS_LABEL[o.score.status]}</dd></div>
        {o.target.grade !== null && <div><dt>등급</dt><dd>{o.grade.status === 'reached' ? `기록된 등급 ${f?.grade}등급 — 목표 등급 이상` : o.grade.status === 'below' ? `기록된 등급 ${f?.grade}등급 — 목표 등급보다 낮아요` : o.grade.status === 'no_record_grade' ? '기록에 등급이 없어요 — 점수로 등급을 만들지 않아요' : '미확인'}</dd></div>}
        <div><dt>변화</dt><dd>{o.change.status === 'repeat_observation' ? `같은 시험지 재풀이 기록 ${o.change.before!.raw} → ${o.change.after!.raw}점 — 독립 평가나 학습 효과의 증거는 아니에요` : o.change.status === 'different_paper' ? `목표 전 ${o.change.before!.examLabel} · 이후 ${o.change.after!.examLabel} — 다른 시험지라 점수 차이를 계산하지 않아요` : '비교할 이전 · 이후 기록이 아직 없어요'}</dd></div>
        <div><dt>TASK 활동</dt><dd data-testid="goal-outcome-activity">목표 관련 TASK {o.activity.needs}개 · 다시 확인 통과 {o.activity.resolved}개 — 활동 결과이며 목표 점수 도달 근거는 아니에요</dd></div>
      </dl>
      {o.verdict === 'met' && <p className={u.gpNote} data-testid="goal-outcome-limit">{MET_LIMIT}</p>}
      <p className={u.gpNote} data-testid="goal-outcome-next">다음: {NEXT_LABEL[o.next]}</p>
    </details>
  )
}
