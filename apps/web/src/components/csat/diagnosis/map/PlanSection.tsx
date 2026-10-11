// apps/web/src/components/csat/diagnosis/map/PlanSection.tsx
//
// 학습 지도 rev4.0 3차 — Workspace 학습계획(TASK 별). NeedPanel 안에서 열린다(관리 도구처럼 따로 떼지 않는다).
//   추천 이유 · 중심/보조 TASK · TASK 학습목표 · 계획량(출처 · 규칙) · 수행/남음 · 성취 조건 · 확인 상태 · 다음 활동 · 조정(순서 · 계획량).
// 정량(계획 진행)과 정성(확인된 성취)은 다른 줄 · 다른 말로 보인다 — 진행을 퍼센트 · 막대로 그리지 않는다.
// 조정은 이 기기의 초안(localStorage)뿐이다. 저장(계획 버전 · 사유)은 DB 승인 대기 — 화면에 그 사실을 쓴다.
// 조정은 계획 칸만 바꾼다(plan.ts applyDraft) — 근거 · 직접 확인 · 요구 칸은 읽기만 한다.

'use client'

import { ArrowDown, ArrowUp, CircleCheck, Minus, Plus, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { templateOf } from '@/lib/csat/map/v4/definition'
import { ACHIEVEMENT_LABEL, RULE_LABEL, applyDraft, type PlanDraft, type TaskPlan, type WorkspacePlanView } from '@/lib/csat/map/v4/plan'
import { NEED_LABEL } from '@/lib/csat/map/v4/to-be'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'

import n from './needs.module.css'

const KEY = (ws: string) => `map-v4-plan-draft:${ws}`
const UNRESOLVED_LABEL: Record<TaskPlan['unresolved'][number], string> = {
  no_content: '확인 콘텐츠를 준비하고 있어요',
  stage_locked: '앞 단계를 마치면 열려요',
  canon_hold: '측정 방법을 정하는 중이에요',
  needs_direct_check: '아직 직접 확인 전 — 기출 기록으로만 보였어요',
  not_goal_related: '지금 목표 점수와 이어진 문항이 없어요',
}

function readDraft(ws: string): PlanDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY(ws))
    if (!raw) return null
    const d = JSON.parse(raw) as PlanDraft
    return Array.isArray(d.order) && d.planned && typeof d.planned === 'object' ? d : null
  } catch {
    return null
  }
}
function writeDraft(ws: string, d: PlanDraft | null) {
  try {
    if (d) window.localStorage.setItem(KEY(ws), JSON.stringify(d))
    else window.localStorage.removeItem(KEY(ws))
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 유지된다(초안이라 잃어도 근거 · 기록은 그대로)
  }
}

export function PlanSection({ view, reason, past }: { view: WorkspacePlanView; reason: string | null; past: boolean }) {
  const t = templateOf(view.workspace)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  useEffect(() => setDraft(readDraft(view.workspace)), [view.workspace])
  const shown = useMemo(() => applyDraft(view, draft), [view, draft])
  const update = (next: PlanDraft | null) => {
    setDraft(next)
    writeDraft(view.workspace, next)
  }
  const base = (): PlanDraft => draft ?? { order: shown.tasks.map((p) => p.task), planned: {} }
  const move = (id: string, dir: -1 | 1) => {
    const order = shown.tasks.map((p) => p.task)
    const i = order.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    update({ ...base(), order })
  }
  const setPlanned = (p: TaskPlan, v: number) => update({ ...base(), order: shown.tasks.map((x) => x.task), planned: { ...base().planned, [p.task]: v } })

  return (
    <section className={n.plan} aria-labelledby="plan-h" data-testid="plan-section" data-ws={view.workspace} data-draft={draft ? 'yes' : 'no'}>
      <div className={n.planHead}>
        <h3 id="plan-h" className={n.planTitle}>「{t?.name ?? view.workspace}」 학습계획</h3>
        {shown.progress ? (
          <p className={n.planProgress} data-testid="plan-progress">
            계획 진행 <strong>{shown.progress.done} / {shown.progress.planned}문항</strong> · 진행은 한 문항씩 센 양이고 실력 점수가 아니에요
          </p>
        ) : (
          <p className={n.planProgress} data-testid="plan-progress">지금 계획할 수 있는 문항이 없어요 — 아래에 이유가 있어요</p>
        )}
      </div>
      {reason && <p className={n.sub}>{reason}</p>}
      <ol className={n.planList}>
        {shown.tasks.map((p, i) => {
          const isCore = view.core.includes(p.task)
          const q = p.quantity
          return (
            <li key={p.task} className={n.planItem} data-task={p.task} data-core={isCore} data-planned={q.planned ?? ''} data-achievement={p.achievement}>
              <div className={n.planMain}>
                <p className={n.planName}>
                  {p.name}
                  <span className={n.needType}>{isCore ? '중심' : '보조'}{p.need ? ` · ${NEED_LABEL[p.need]}` : ''}{p.stage ? ` · ${STAGE_LABEL[p.stage]}` : ''}</span>
                </p>
                <p className={n.planGoal}>{p.goal}</p>
                {/* 정량 — 계획 · 수행 · 남음(출처 · 규칙) */}
                <p className={n.planQty} data-testid="plan-qty">
                  {q.planned !== null ? (
                    <>계획 <strong>{q.planned}문항</strong>(가능 {q.available}) · 수행 {Math.min(q.done, q.planned)} · 남음 {q.remaining} — 기준: {q.rule ? RULE_LABEL[q.rule] : '—'}</>
                  ) : (
                    <>계획할 수 있는 문항 없음 · {p.unresolved.filter((u) => u !== 'needs_direct_check').map((u) => UNRESOLVED_LABEL[u]).join(' · ') || (isCore ? '확인 결과를 기다려요' : '이 항목은 중심 묶음에서 계획해요')}</>
                  )}
                </p>
                {/* 정성 — 성취 조건과 확인된 상태(계획 진행과 따로) */}
                <p className={n.planCriterion}>
                  <CircleCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                  <span><strong>{ACHIEVEMENT_LABEL[p.achievement]}</strong> · 다 했다고 보는 기준: {p.criterion}</span>
                </p>
              </div>
              <div className={n.planSide}>
                {q.adjustable && !past && (
                  <div className={n.stepper} role="group" aria-label={`${p.name} 계획 문항 수`}>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 문항 줄이기`} disabled={(q.planned ?? 0) <= 0} onClick={() => setPlanned(p, (q.planned ?? 0) - 1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className={n.stepVal} aria-live="polite">{q.planned}</span>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 문항 늘리기`} disabled={(q.planned ?? 0) >= (q.available ?? 0)} onClick={() => setPlanned(p, (q.planned ?? 0) + 1)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {!past && (
                  <div className={n.orderBtns}>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 위로`} disabled={i === 0} onClick={() => move(p.task, -1)}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 아래로`} disabled={i === shown.tasks.length - 1} onClick={() => move(p.task, 1)}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {p.next && !past && (
                  <Link href={p.next.href} className={n.go} data-testid="plan-go">
                    활동 시작
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <div className={n.planFoot}>
        <p className={n.fine} data-testid="plan-not-saved">
          순서 · 계획량 조정은 <strong>이 기기에만</strong> 기억돼요. 계획 확정 · 변경 기록 저장은 곧 열려요. 조정해도 확인 결과와 근거는 바뀌지 않아요.
        </p>
        {draft && (
          <button type="button" className={n.ghost} onClick={() => update(null)} data-testid="plan-reset">
            <RotateCcw size={13} aria-hidden="true" />
            추천 계획으로 되돌리기
          </button>
        )}
      </div>
    </section>
  )
}
