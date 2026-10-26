// apps/web/src/components/csat/diagnosis/map/GoalPlanSummary.tsx
//
// T-0070 — 목표 → 내 근거 → 필요한 TASK · 이번 학습량 · 도달 조건 → 지금 할 행동 → 같은 Workspace 계획 · 자료를 한 접기 목록으로.
// 상단 GoalRecordBar(목표 · 기록 · 다음 한 행동)는 그대로 두고, 그 아래 접힌 요약만 더한다 — 지도 · 하단 Workspace 를 밀어내지 않게 처음엔 한 줄.
// 순서 두 개를 섞지 않는다: 행 순서 = NeedRank(교육적으로 먼저 볼 것), 「지금 할 수 있어요 n」 = ActionRank(지금 열리는 활동 순서).
// 숫자는 goalPlanRows(V4View · 저장 계획) 그대로 — 총 학습량 · 기간 · 점수 상승 · 숙달률은 만들지 않는다.

'use client'

import { ClipboardList, ListChecks, PackageOpen, PlayCircle, Target } from 'lucide-react'
import Link from 'next/link'

import { withMapReturn } from '@/lib/csat/map-return'
import { DOMAIN_NAME, taskOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { ACHIEVEMENT_LABEL } from '@/lib/csat/map/v4/plan'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import type { SavedPlans } from '@/lib/csat/map/v4/plan-store'
import type { GoalPlanRow, GoalPlanSummaryData } from '@/lib/csat/map/v62/goal-plan'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'

import type { EvidenceView } from '@/lib/csat/map/v62/evidence-claims'

import { EvidenceChips } from './EvidenceClaims'
import { BLOCKED_LABEL, NEED_V62_LABEL } from './TaskInspector'
import u from './unified.module.css'
import { taskLabel } from './WorkspaceList'

const EVIDENCE_LABEL: Record<GoalPlanRow['evidence'], string> = {
  unmeasurable: '측정 방법을 정하는 중',
  unmeasured: '아직 근거 없음',
  analysis_pending: '분석할 수 있는 기록 전',
  insufficient: '근거가 아직 적어요',
  observed: '기출 기록에서 관찰(간접)',
  check_first: '기출 기록에서 관찰(간접) · 확인 먼저',
  checking: '직접 확인 진행 중',
  verified_need: '직접 확인 — 보완 필요',
  resolved: '직접 확인 — 다시 확인 통과',
  expired: '다시 확인할 때',
}

const UNRESOLVED_LABEL: Record<GoalPlanRow['unresolved'][number], string> = {
  transfer_shortage: '기본 적용 계획보다 자료가 부족해요',
  no_content: '이 TASK 자료를 준비하고 있어요',
  stage_locked: '앞 단계를 마치면 열려요',
  material_needed: '이 단계 새 자료가 필요해요',
  repair_material_needed: '바로잡기 자료가 필요해요',
  canon_hold: '측정 방법을 정하는 중(보류)',
  needs_direct_check: '직접 확인 전',
  not_goal_related: '목표와 직접 관련이 적어요',
}

function amount(r: GoalPlanRow): string {
  const q = r.quantity
  if (q.source === 'unknown') return '저장한 계획을 불러오지 못했어요'
  // T-0082 — 지금 확인 통과 · 유지: 「앞 단계를 마치면」 · 「자료 없음」으로 말하지 않는다(다른 날 유지 확인 기준 미정)
  if (r.blocked === 'maintain_pending') return '지금 확인 통과 — 다른 날 유지 확인은 기준이 정해지지 않아 이번 학습량이 없어요'
  if (q.planned === null) return r.unresolved.map((x) => UNRESOLVED_LABEL[x]).join(' · ') || '지금 계획할 수 있는 자료가 없어요'
  return `${q.source === 'saved' ? '저장한 계획' : '제안(저장 전)'} ${q.planned}${q.unit} · 수행 ${q.done} · 남음 ${q.remaining ?? '—'}`
}

export function GoalPlanSummary({ data, goalSet, saved = null, past = false, evidence = null, onSelect, onOpenWs }: {
  data: GoalPlanSummaryData
  /** T-0074 — TASK 별 증거 범위(view.evidence · 지금 확인 · 다른 글 적용 · 시간 지나 다시 확인). 없으면 직접 확인 행에 「범위 확인 불가」 */
  evidence?: Partial<Record<TaskId, EvidenceView>> | null
  /** 지난 기준으로 보는 중 — 보기 전용(실행 링크 · 계획/자료 조작 없음). 학습은 지금 기준에서 */
  past?: boolean
  /** 상단 CTA 와 같은 지도 복귀 문맥(outgoingCtx)을 실행 링크에 싣는다 */
  saved?: SavedPlans | null
  goalSet: boolean
  onSelect: (id: TaskId) => void
  onOpenWs: (ws: string, tab: 'overview' | 'plan') => void
}) {
  if (!goalSet || data.rows.length === 0) return null
  const evidenceLine = `시험 기록 ${data.examSessions}회 · 직접 확인 근거가 있는 TASK ${data.directTasks}개`
  return (
    <details className={u.gp} data-testid="goal-plan">
      <summary className={u.gpSum}>
        <Target size={15} strokeWidth={1.9} aria-hidden="true" />
        <span className={u.gpSumText}>
          {data.required > 0 && <strong>목표에 필요한 TASK {data.required}개</strong>}
          {data.relevanceUnknown > 0 && <>{data.required > 0 ? ' · ' : ''}<strong>목표와의 관련성 확인 전 {data.relevanceUnknown}개</strong></>}
          {past ? ' · 지난 기준 보기 전용' : <> · 지금 할 수 있는 것 {data.actionable}개</>}
          <span className={u.gpSumNote}>{evidenceLine}</span>
        </span>
        <span className={u.gpOpen}>계획 펼치기</span>
      </summary>
      {past && <p className={u.gpNote} data-testid="goal-plan-past">지난 기준으로 계산한 요약이에요 — 여기서는 보기만 하고, 학습 · 계획은 지금 기준 지도에서 해요.</p>}
      <p className={u.gpNote}>
        순서는 목표에 비춰 먼저 볼 TASK 예요. 「지금 할 수 있어요」 번호는 지금 열리는 활동 순서예요. TASK 의 도달 조건을 통과해도 목표 점수 달성은 아니에요 — 점수 · 기간 예측은 하지 않아요.
      </p>
      <ol className={u.gpList} data-testid="goal-plan-list">
        {data.rows.map((r) => {
          const tl = taskLabel(r.task)
          return (
            <li key={r.task} className={u.gpRow} data-task={r.task} data-action={r.action ? r.action.rank : ''} data-quantity={r.quantity.source} data-stage={r.stage ?? ''} data-evidence={r.evidence} data-planned={r.quantity.planned ?? ''} data-done={r.quantity.done}>
              <div className={u.gpHead}>
                <span className={u.gpRank} aria-label={`먼저 볼 순서 ${r.needRank}`}>{r.needRank}</span>
                <button type="button" className={u.gpTask} onClick={() => onSelect(r.task)} data-testid="goal-plan-task">
                  <span className={u.nodeCode}>{tl.code}</span> {tl.name}
                </button>
                <span className={u.gpDomain}>{DOMAIN_NAME[taskOf(r.task).axis]}</span>
              </div>
              <dl className={u.gpFacts}>
                <div><dt>목표와의 관계</dt><dd>{NEED_V62_LABEL[r.need]}{r.relevance ? ` · 관련 문항 ${r.relevance.items} · ${r.relevance.pointsPerExam}점` : ''}</dd></div>
                <div><dt>내 근거</dt><dd data-basis={r.basis ?? ''}>{EVIDENCE_LABEL[r.evidence]}{r.basis === 'direct_check' && r.independentItems !== null ? ` · 독립 문항 ${r.independentItems}` : ''}</dd></div>
                <div><dt>이번 학습</dt><dd data-testid="goal-plan-amount">{r.stage ? `${STAGE_LABEL[r.stage]} — ` : ''}{amount(r)}</dd></div>
                {r.criterion && <div><dt>도달 조건</dt><dd>{r.achievement ? `${ACHIEVEMENT_LABEL[r.achievement]} · ` : ''}{r.criterion}</dd></div>}
              </dl>
              {/* T-0074 — 지금 확인한 범위와 아직 확인하지 못한 것(시간 지나 다시 확인)을 기존 칩으로. 직접 확인 근거가 있는 행만 · 모든 행에 반복하지 않는다 */}
              {r.basis === 'direct_check' && (evidence?.[r.task] ? (
                <div className={u.gpScope} data-testid="goal-plan-scope">
                  <EvidenceChips e={evidence[r.task]!} testId="goal-plan-evidence" />
                  {r.achievement === 'resolved' && <p className={u.gpNote} data-testid="goal-plan-scope-note">지금 정책의 다시 확인은 통과했어요 — 도달 조건의 「다른 날」 유지는 아직 확인하지 않았어요.</p>}
                  {evidence[r.task]!.ledger === 'unknown' && <p className={u.gpNote}>수행 기록을 다 읽지 못해 범위를 확인할 수 없어요.</p>}
                </div>
              ) : (
                <p className={u.gpNote} data-testid="goal-plan-scope-unknown">근거 범위를 지금 확인할 수 없어요 — 확인한 것이 0개라는 뜻은 아니에요.</p>
              ))}
              <div className={u.gpActs}>
                {past ? null : r.planGate ? (
                  <span className={u.gpBlocked} data-testid="goal-plan-gate" data-gate={r.planGate} data-why={r.replanWhy ?? ''}>{r.planGate === 'replan' ? (r.replanWhy === 'goal' ? '목표가 바뀌었어요 — 지금 목표로 계획을 다시 확정한 뒤 시작해요' : '자료 · 단계가 바뀌었어요 — 계획을 다시 확정한 뒤 시작해요') : '이 묶음 계획을 먼저 확정해요'}</span>
                ) : r.action ? (
                  <Link className={u.ghost} href={withMapReturn(r.action.href, outgoingCtx(saved, r.task, r.workspace))} data-testid="goal-plan-do" onClick={() => onSelect(r.task)}>
                    <PlayCircle size={14} strokeWidth={1.9} aria-hidden="true" />지금 할 수 있어요 {r.action.rank} · {r.action.label}
                  </Link>
                ) : (
                  <span className={u.gpBlocked} data-testid="goal-plan-blocked">{r.blocked ? BLOCKED_LABEL[r.blocked] : '지금 바로 할 활동은 없어요'}</span>
                )}
                {!past && r.workspace && (
                  <>
                    <button type="button" className={u.ghost} onClick={() => onOpenWs(r.workspace!, 'plan')} data-testid="goal-plan-open-plan">
                      <ClipboardList size={14} strokeWidth={1.9} aria-hidden="true" />계획 보기
                    </button>
                    <button type="button" className={u.ghost} onClick={() => onOpenWs(r.workspace!, 'overview')} data-testid="goal-plan-open-material">
                      <PackageOpen size={14} strokeWidth={1.9} aria-hidden="true" />자료 · 활동
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <p className={u.gpNote}><ListChecks size={13} strokeWidth={1.9} aria-hidden="true" /> 수행하면 근거 · 계획이 다시 계산돼요. 계획 버전이 바뀐 것 자체는 실력 향상이 아니에요.</p>
    </details>
  )
}
