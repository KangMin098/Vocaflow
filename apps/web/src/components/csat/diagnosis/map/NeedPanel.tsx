// apps/web/src/components/csat/diagnosis/map/NeedPanel.tsx
//
// 학습 지도 rev4.0 「목표까지 필요한 학습」 — 읽기 전용 섹션(기존 LearnerMap 아래 · 교체하지 않는다).
//   ① 분석 기준 시험 · 시점  ② 시험 기록 · 목표  ③ 영역별 근거와 TASK 상태  ④ 목표와 관련된 추가 확인 TASK
//   ⑤ 우선 추천 Workspace(단계별 실행 가능 여부 · 실제 학습량)  ⑥ 지금 할 수 있는 다음 행동  ⑦ 아직 계산할 수 없는 학습 요구
// 계산은 lib/csat/map/v4(compose) 한 곳 — 이 화면은 결과만 읽는다. 목표를 바꾸면(useGoal) 같은 함수로 바로 다시 계산한다.
// 문구 규칙: 미측정 · 근거 부족 · 측정 불가 · 분석 준비 중을 서로 다른 말로. 콘텐츠 미준비를 학생의 실패로 쓰지 않는다. 학습량은 개수 글자로만(막대 없음).

'use client'

import { ArrowRight, CalendarClock, CircleDashed, Compass, Layers, ListChecks, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'
import { TASK_EVIDENCE_LABEL, ms, type AsIsMap, type TaskEvidence } from '@/lib/csat/map/v4/as-is'
import { composeV4 } from '@/lib/csat/map/v4/compose'
import { CANON_EFFECTIVE_FROM, DOMAIN_NAME, taskOf, templateOf, type Domain } from '@/lib/csat/map/v4/definition'
import { NEED_LABEL, type Need } from '@/lib/csat/map/v4/to-be'
import { STAGE_BLOCKED_LABEL, STAGE_LABEL, type StageKey, type WorkspacePlan, type WorkspaceView } from '@/lib/csat/map/v4/workspace'

import n from './needs.module.css'
import { PlanSection } from './PlanSection'

const READ_DOMAINS: Domain[] = ['V', 'S', 'R', 'E']
const SHOW_NEEDS = 6

const DOMAIN_STATE_LABEL: Record<AsIsMap['domains'][Domain]['state'], string> = {
  deferred: '측정 방법을 정하는 중',
  no_records: '기록 없음',
  analysis_pending: '분석 준비 중인 시험만 있음',
  proxy_unavailable: '이 시점의 영역 관찰은 다시 만들 수 없음',
  proxy_pending: '새 기록을 분석에 반영하는 중',
  none: '기록 없음',
  pending: '분석 준비 중',
  insufficient: '기록 더 필요',
  observed: '기출에서 관찰됨',
  check_first: '먼저 확인할 후보',
}

const REASON_LABEL: Record<NonNullable<WorkspacePlan['reason']>, string> = {
  goal_need: '목표와 관련된 확인 · 학습 순서에서 가장 앞에 있어요.',
  verified_need: '직접 확인에서 연습이 필요하다고 나온 원리예요.',
  checking: '확인을 시작한 원리예요. 이어서 확인해요.',
  axis_check_first: '기출 기록에서 먼저 확인할 후보로 보인 영역이에요. 약점으로 정한 것은 아니에요.',
  available: '지금 바로 확인할 수 있는 묶음이에요. 결과를 보고 다음을 정해요.',
}

const NEED_REASON: Record<string, string> = {
  verified_need: '직접 확인에서 같은 곳이 두 번 막혔어요',
  resolved_not_transferred: '다시 확인은 통과했어요 · 다른 글에 아직 적용하지 않았어요',
  resolved_transferred: '다시 확인 · 적용을 했어요 · 간격을 두고 다시 확인해요',
  parts_resolved: '구성 원리를 모두 다시 확인했어요',
}
const needReason = (x: Need) => NEED_REASON[x.reason] ?? `${TASK_EVIDENCE_LABEL[x.evidence]} — 확인해야 알 수 있어요`

const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

type WsId = 'central-meaning' | 'option-match' | 'evidence-locate' | 'cohesion'
const wsSlug = (id: string): WsId | null => {
  const s = id.replace(/^ws\./, '')
  return s === 'central-meaning' || s === 'option-match' || s === 'evidence-locate' || s === 'cohesion' ? s : null
}

export function NeedPanel({ data, goal, goalSet, recordHref, asOf }: { data: MapPageData; goal: number; goalSet: boolean; recordHref: string; asOf?: string }) {
  const v = useMemo(() => composeV4(data, { score: goal, set: goalSet }, asOf), [data, goal, goalSet, asOf])
  const primaryId = v?.plan.primary ? wsSlug(v.plan.primary.id) : null
  const reason = v?.plan.reason ?? null
  const shown = v !== null
  // 열린 학습계획 — 기본은 대표 묶음. TASK 를 누르면 그 TASK 를 중심으로 하는 묶음(없으면 처음 연결된 묶음)
  const [wsSel, setWsSel] = useState<string | null>(null)
  // 보인 묶음 · 이유가 바뀔 때만 — 목표를 바꿔 같은 묶음이 다시 계산될 때마다 세지 않는다
  useEffect(() => {
    if (!shown) return
    track({ name: 'csat_workspace_opened', props: { workspace: primaryId ?? 'none', reason: reason ?? 'none', goal_set: goalSet } })
  }, [shown, primaryId, reason, goalSet])
  if (!v) return null
  const { asIs, toBe, plan } = v
  const used = asIs.sessions.filter((s) => s.used)
  // 과거 기준 보기에서는 「지금」 할 행동 링크를 내밀지 않는다 — 그 시점의 분석이지 지금의 할 일이 아니다
  const past = asIs.mode === 'past_reanalysis'
  const inWindow = asIs.sessions.filter((s) => s.excluded !== 'after_as_of')
  const planIds = Object.keys(v.plans)
  const openWs = wsSel && v.plans[wsSel] ? wsSel : plan.primary?.id ?? planIds[0] ?? null
  const homeOf = (task: string) => planIds.find((id) => v.plans[id].core.includes(task)) ?? planIds.find((id) => v.plans[id].tasks.some((t) => t.task === task)) ?? null
  const openPlan = (id: string | null) => {
    if (!id) return
    setWsSel(id)
    requestAnimationFrame(() => document.getElementById('plan-h')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }

  return (
    <section className={n.panel} aria-labelledby="need-h" data-testid="need-panel" data-mode={asIs.mode} data-goal-set={goalSet}>
      <header className={n.head}>
        <h2 id="need-h" className={n.title}>
          <Compass size={17} strokeWidth={1.9} aria-hidden="true" />
          목표까지 필요한 학습
        </h2>
        <p className={n.meta} data-testid="need-basis">
          <CalendarClock size={13} strokeWidth={1.9} aria-hidden="true" />
          {fmtDate(asIs.asOf)} 기준 · 근거로 쓴 시험 {used.length}회{inWindow.length > used.length ? ` (기록 ${inWindow.length}회 중)` : ''} · 정의 {asIs.canonVersion}
        </p>
        {!asIs.exact && (
          <p className={n.notice} data-testid="need-replay">
            {asIs.mode === 'past_reanalysis'
              ? '이 지도는 그 시점의 기록을 지금의 기준으로 다시 분석한 것이에요. 당시 화면을 그대로 되살린 것은 아니에요.'
              : '지금의 기준(정의)이 기록보다 나중에 만들어졌어요. 기록은 그대로이고, 분석 기준만 지금 것이에요.'}
          </p>
        )}
      </header>

      <div className={n.grid}>
        {/* ② 시험 기록 · 목표 */}
        <div className={n.cell} data-testid="need-records">
          <h3 className={n.label}>시험 기록 · 목표</h3>
          {inWindow.length === 0 ? (
            <>
              <p className={n.big}>시험 기록 없음</p>
              <p className={n.sub}>기출 시험 한 회를 기록하면 영역별 근거부터 보여 드려요.</p>
              <Link href={recordHref} className={n.ghost} data-testid="need-record-cta">
                시험 기록하기
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <ul className={n.records}>
              {inWindow.slice(-4).reverse().map((s) => (
                <li key={s.id} data-used={s.used}>
                  <span className={n.recName}>{s.examLabel}</span>
                  <span className={n.recMeta}>
                    {fmtDate(s.takenAt)} 시행 · {fmtDate(s.enteredAt)} 입력{s.raw !== null ? ` · ${s.raw}점` : ''}
                  </span>
                  <span className={n.chip} data-tone={s.used ? 'ok' : 'wait'}>
                    {s.used ? '근거에 사용' : s.excluded === 'exam_not_ready' ? '이 시험은 분석 준비 중' : '입력 확인 필요'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={n.sub} data-testid="need-goal">
            {goalSet ? `목표 ${goal}점 — 목표는 확인 · 학습 순서를 정하는 데만 써요. 점수를 영역별로 나누지 않아요.` : '목표를 아직 정하지 않았어요. 아래 영역 근거는 목표 없이도 보여요.'}
          </p>
          {inWindow.length > 1 && <p className={n.sub}>서로 다른 시험의 점수는 난도가 달라 합치거나 평균하지 않아요.</p>}
          {used.some((s) => ms(s.takenAt) < ms(CANON_EFFECTIVE_FROM)) && (
            <p className={n.fine} data-testid="need-reanalyzed">지난 시험 기록도 지금의 분석 기준({asIs.canonVersion})으로 다시 읽었어요. 그때 보던 화면을 되살린 것은 아니에요.</p>
          )}
        </div>

        {/* ③ 영역별 근거와 TASK 상태 */}
        <div className={n.cell} data-testid="need-domains">
          <h3 className={n.label}>영역별 근거와 세부 상태</h3>
          <ul className={n.domains}>
            {READ_DOMAINS.map((d) => (
              <li key={d} data-domain={d}>
                <span className={n.domName}>{DOMAIN_NAME[d]}</span>
                <span className={n.domState}>{DOMAIN_STATE_LABEL[asIs.domains[d].state]}</span>
                <TaskStates asIs={asIs} domain={d} />
              </li>
            ))}
            <li data-domain="LX" className={n.deferred}>
              <span className={n.domName}>듣기 · 실전</span>
              <span className={n.domState}>측정 방법을 정하는 중 — 진단 · 학습 요구를 만들지 않아요</span>
            </li>
          </ul>
          <p className={n.sub}>세부 상태는 직접 확인한 것만 「직접 확인」이에요. 나머지는 기출 기록에서 영역 단위로 보인 모습이라 실력 판정이 아니에요.</p>
        </div>

        {/* ⑤ 우선 추천 Workspace · ⑥ 다음 행동 */}
        <div className={`${n.cell} ${n.wsCell}`} data-testid="need-workspace" data-ws={plan.primary?.id ?? 'none'}>
          <h3 className={n.label}>
            <Layers size={13} strokeWidth={1.9} aria-hidden="true" />
            우선 추천 학습 묶음
          </h3>
          {plan.primary ? <PrimaryWorkspace w={plan.primary} reason={plan.reason} past={past} /> : (
            <p className={n.sub}>지금 바로 실행할 수 있는 학습 묶음이 없어요. 확인 문항 연결을 준비하고 있어요.</p>
          )}
        </div>
      </div>

      {/* ④ 목표와 관련된 추가 확인 TASK */}
      <div className={n.needs} data-testid="need-list" data-count={toBe?.needs.length ?? 0}>
        <h3 className={n.label}>
          <ListChecks size={13} strokeWidth={1.9} aria-hidden="true" />
          {toBe ? `목표 ${toBe.goal.score}점과 관련된 확인 · 학습 순서` : '목표와 관련된 확인 · 학습 순서'}
        </h3>
        {!toBe ? (
          <p className={n.sub} data-testid="need-no-goal">목표를 정하면 목표 점수에 걸린 문항과 이어진 세부 항목부터 순서를 정해 드려요.</p>
        ) : toBe.needs.length === 0 ? (
          <p className={n.sub}>지금 근거로 목표와 이어진 학습 요구가 없어요.</p>
        ) : (
          <ol className={n.needList}>
            {toBe.needs.slice(0, SHOW_NEEDS).map((x) => (
              <li key={x.task} className={n.need} data-task={x.task} data-type={x.type}>
                <span className={n.prio}>{x.priority}</span>
                <span className={n.needBody}>
                  <span className={n.needName}>
                    {homeOf(x.task) ? (
                      <button type="button" className={n.taskLink} onClick={() => openPlan(homeOf(x.task))} data-testid="need-task-plan" aria-label={`${taskOf(x.task).name} 학습계획 보기`}>
                        {taskOf(x.task).name}
                      </button>
                    ) : taskOf(x.task).name}
                    <span className={n.needType}>{NEED_LABEL[x.type]}</span>
                  </span>
                  <span className={n.needWhy}>
                    {needReason(x)} · 목표 점수에 꼭 필요한 기출 문항 중 이 항목과 이어진 문항 {x.relevance.items}개(목표 계산 기준 시험 {toBe.exams}회)
                  </span>
                </span>
                {x.executable && !past ? (
                  <Link href={x.executable.href} className={n.go} data-testid="need-go">
                    확인하기
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className={n.waiting}>{x.content === 'live' && x.workspaces[0] ? `「${templateOf(x.workspaces[0])?.name}」에서 함께` : '확인 콘텐츠 준비 중'}</span>
                )}
              </li>
            ))}
          </ol>
        )}
        {toBe && toBe.needs.length > SHOW_NEEDS && <p className={n.sub}>나머지 {toBe.needs.length - SHOW_NEEDS}개는 앞의 확인 결과를 보고 다시 정해요.</p>}
      </div>

      {/* ⑤-2 학습 묶음별 학습계획 — TASK 를 누르거나 묶음을 골라 연다 */}
      {openWs && v.plans[openWs] && (
        <>
          {planIds.length > 1 && (
            <div className={n.wsTabs} role="group" aria-label="학습 묶음 고르기">
              {planIds.map((id) => (
                <button key={id} type="button" className={n.wsTab} aria-pressed={id === openWs} onClick={() => setWsSel(id)} data-testid="plan-tab" data-ws={id}>
                  {templateOf(id)?.name ?? id}{id === plan.primary?.id ? ' · 추천' : ''}
                </button>
              ))}
            </div>
          )}
          <PlanSection view={v.plans[openWs]} reason={openWs === plan.primary?.id && plan.reason ? REASON_LABEL[plan.reason] : null} past={past} />
        </>
      )}

      {/* ⑦ 아직 계산할 수 없는 학습 요구 */}
      <div className={n.notYet} data-testid="need-not-computable">
        <CircleDashed size={14} strokeWidth={1.9} aria-hidden="true" />
        <p>
          <strong>아직 계산하지 않는 것</strong> — 듣기 · 실전(시간 운영) 학습 요구와 실전 연습 처방은 측정 방법이 정해진 뒤에 계산해요.
          어휘 · 문장 · 어법 · 추론은 확인 콘텐츠를 준비하고 있어요({plan.preparing.filter((p) => p.readiness === 'content_needed').map((p) => p.name).join(' · ')}). 준비되지 않은 것은 학생의 부족이 아니에요.
        </p>
      </div>
    </section>
  )
}

const TONE: Partial<Record<TaskEvidence, 'need' | 'ok' | 'look'>> = { verified_need: 'need', resolved: 'ok', check_first: 'look', checking: 'look', expired: 'look' }

function TaskStates({ asIs, domain }: { asIs: AsIsMap; domain: Domain }) {
  const list = Object.values(asIs.tasks).filter((t) => t.axis === domain && taskOf(t.id).kind === 'atomic')
  // 같은 상태는 묶어서 보인다 — 영역 proxy 를 TASK 별 점수처럼 늘어놓지 않는다
  const direct = list.filter((t) => t.basis === 'direct_check')
  const rest = list.filter((t) => t.basis !== 'direct_check')
  const restState = rest[0]?.status
  return (
    <span className={n.taskStates}>
      {direct.map((t) => (
        <span key={t.id} className={n.taskChip} data-tone={TONE[t.status] ?? 'plain'} data-task={t.id}>
          {taskOf(t.id).name} · {TASK_EVIDENCE_LABEL[t.status]}
        </span>
      ))}
      {rest.length > 0 && restState && (
        <span className={n.taskRest}>
          {direct.length > 0 ? '나머지 ' : ''}{rest.length}개 세부 항목 · {rest.every((t) => t.status === restState) ? TASK_EVIDENCE_LABEL[restState] : '기록에 따라 다름'}
        </span>
      )}
    </span>
  )
}

function PrimaryWorkspace({ w, reason, past }: { w: WorkspaceView; reason: WorkspacePlan['reason']; past: boolean }) {
  const slug = wsSlug(w.id)
  const t = templateOf(w.id)
  const nextStage: 'check' | 'recheck' = w.stages.check.ready ? 'check' : 'recheck'
  return (
    <>
      <p className={n.wsName} data-testid="need-ws-name">{w.name}</p>
      <p className={n.sub}>{w.goal}</p>
      {reason && <p className={n.sub} data-testid="need-ws-reason">{REASON_LABEL[reason]}</p>}
      <ol className={n.stages} aria-label="학습 단계">
        {(['check', 'repair', 'transfer', 'recheck'] as StageKey[]).map((k) => {
          const s = w.stages[k]
          const done = !s.ready && s.blocked === null
          return (
            <li key={k} className={n.stage} data-stage={k} data-ready={s.ready} data-done={done}>
              <span className={n.stageName}>{STAGE_LABEL[k]}</span>
              <span className={n.stageNote}>
                {s.ready ? (s.count !== null ? `지금 할 수 있어요 · ${s.count}문항` : '지금 할 수 있어요') : done ? '마쳤어요' : STAGE_BLOCKED_LABEL[s.blocked!]}
              </span>
            </li>
          )
        })}
      </ol>
      {t && w.relations.proposed.length > 0 && (
        <p className={n.fine}>묶음 안 항목 사이의 연결은 아직 제안 단계예요 — 순서 참고용이고, 결과를 바꾸지 않아요.</p>
      )}
      {past ? (
        <Link href="/csat/diagnosis?tab=map" className={n.ghost} data-testid="need-now">
          지금 기준으로 보기
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ) : w.next && slug ? (
        <Link
          href={w.next.href}
          className={n.cta}
          data-testid="need-next"
          onClick={() => track({ name: 'csat_workspace_suggestion_applied', props: { workspace: slug, stage: nextStage } })}
        >
          <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
          {nextStage === 'check' ? '확인 문항 풀기' : '새 문항으로 다시 확인'}
        </Link>
      ) : (
        <p className={n.sub}>다음 단계는 위 표시처럼 열리면 여기서 바로 시작할 수 있어요. 바로잡기 · 적용은 지도에서 그 단계를 눌러 이어 가요.</p>
      )}
    </>
  )
}
