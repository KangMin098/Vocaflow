// apps/web/src/components/csat/diagnosis/map/TaskInspector.tsx
//
// 학습지도 v6.2 §9.2 ③ TASK Inspector — 위에 「TASK 이름 + 다음 한 가지 행동」을 고정하고, 아래에
//   현재와 목표 / 기출과 출제 논리 / 교재 · 학습 · 계획 / 결과와 개선(지원 공백 — 접힘).
// 값은 taskInspector(DTO) · composeV4 결과 그대로 — 여기서 판정하지 않는다. 같은 정보를 다른 탭 · 아래 대시보드에 반복하지 않는다.
// 기존 단계 시트(StepSheet — 원리 결정 decideStep · 확인 과제 · 상세 근거)는 「기출 근거 자세히」로 그대로 연다(같은 판정 출처).

'use client'

import { ArrowRight, BookOpenCheck, ChevronDown, FileSearch, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { learnerPath, type StepView } from '@/lib/csat/map/learner-path'
import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import { BEHAVIORS, BEHAVIOR_STATUS_LABEL, researchFor } from '@/lib/csat/map/v62/research'
import { studyItemsFor } from '@/lib/csat/map/v62/study-items'
import { buildDemand } from '@/lib/csat/map/v62/demand'
import { canonicalDemand } from '@/lib/csat/map/v62/canonical-json'
import { ROLE_LABEL_KO, supplyFor } from '@/lib/csat/map/v62/supply'
import { FQ_READER_LABEL } from '@/lib/csat/map/v62/assessment-exposure'
import { ledgerNote, SUPPLY_STEP_LABEL, supplyStep, type SupplyLedger } from '@/lib/csat/map/v62/supply-ledger'
import { confirmLinksOf } from '@/lib/csat/map/v4/compose'
import { checkKeysOfTask } from '@/lib/csat/map/v4/definition'
import { toItemSlug } from '@/lib/csat/item-slug'

/** 코드북 설계 문구(conditions · evidence) 중 영어 내부 용어 조각(facet · Anchor 등)을 뺀 학습자 문구 — 「·」 로 나뉜 조각 단위 */
function learnerText(s: string | null | undefined): string {
  // 괄호 속 영어 설명(「(Evidence Anchor 결속)」)은 괄호째 빼고, 남은 조각에 영어 용어가 있으면 그 조각을 뺀다
  return (s ?? '').replace(/\s*\([^)]*[A-Za-z]{4,}[^)]*\)/g, '').split('·').map((x) => x.trim()).filter((x) => x && !/[A-Za-z]{4,}/.test(x)).join(' · ')
}

const REL_LABEL: Record<string, string> = { direct: '직접 관련', indirect: '간접 관련', not_applicable: '관련 없음', unknown: '판단 보류' }
const ROLE_LABEL: Record<string, string> = { model_explanation: '모델 설명', guided_practice: '지도 연습', independent_check: '독립 확인', transfer: '전이', delayed_check: '지연 확인', source_analysis: '원문 분석' }
// 문항 유형 코드 → 학습자 말(연구 원장 코드 그대로 보이지 않게)
const TYPE_LABEL: Record<string, string> = {
  'R-TOPIC': '주제', 'R-TITLE': '제목', 'R-CLAIM': '주장', 'R-GIST': '요지', 'R-PURPOSE': '목적', 'R-MOOD': '심경', 'R-FACT': '내용 일치', 'R-CHART': '도표',
  'R-BLANK': '빈칸', 'R-BLANK2': '빈칸', 'R-ORDER': '순서', 'R-INSERT': '삽입', 'R-GRAMMAR': '어법', 'R-VOCAB': '어휘', 'R-SUMMARY': '요약', 'R-IRRELEVANT': '무관한 문장',
}
import type { V4View } from '@/lib/csat/map/v4/compose'
import { DOMAIN_NAME, linesOfTask, taskOf, templateOf } from '@/lib/csat/map/v4/definition'
import { NEED_LABEL } from '@/lib/csat/map/v4/to-be'
import { STAGE_BLOCKED_LABEL, STAGE_LABEL, type StageKey } from '@/lib/csat/map/v4/workspace'
import { GAP_LABEL, type LedgerKey } from '@/lib/csat/map/v62/coverage'
import { DOMAIN_QUESTION, type InspectorEvidence, type ResearchFlag, type TaskInspectorDTO } from '@/lib/csat/map/v62/graph'
import type { SupportStatus } from '@/lib/csat/map/v62/inventory'
import type { NotActionableReason } from '@/lib/csat/map/v62/rank'

import { EvidenceBlock } from './EvidenceClaims'
import { StepSheet } from './StepSheet'
import u from './unified.module.css'
import { useTaskDone } from './useTaskDone'

export const EVIDENCE_V62_LABEL: Record<InspectorEvidence, string> = {
  unmeasurable: '측정 방법을 정하는 중',
  not_measured: '아직 확인 전',
  axis_observation: '기출 기록에서 관찰 · 확정 아님',
  checking: '직접 확인 중',
  need_confirmed: '이 조건에서 보완 필요',
  passed_current_policy: '다시 확인 통과',
  recheck_due: '다시 확인할 때',
}

export const NEED_V62_LABEL = { ...NEED_LABEL, RELEVANCE_UNKNOWN: '목표 시험과의 연결 확인 전' } as const

export const BLOCKED_LABEL: Record<NotActionableReason, string> = {
  content_gap: '확인 콘텐츠를 준비하고 있어요',
  stage_locked: '앞 단계를 마치면 열려요',
  canon_hold: '측정 방법을 정하는 중이에요(보류)',
  relevance_unknown: '목표 시험 문항과의 연결을 아직 검토하지 않았어요',
  no_next_activity: '지금 바로 할 활동은 없어요',
}

const FLAG_LABEL: Record<ResearchFlag, string> = {
  independence_hold: '다른 TASK 와 따로 관찰되는지 연구 중',
  reclassification_candidate: '분류를 다시 검토하는 중',
  definition_split_candidate: '정의를 나누어 볼지 연구 중',
  inference_gate_pending: '추론 분류 연구 게이트 전',
}

const SUPPORT_LABEL: Record<SupportStatus, string> = { supported: '지원', partial: '일부 지원', unsupported: '아직 없음', unknown: '확인 전' }
const LEDGER_LABEL: Record<Exclude<LedgerKey, 'ExamInventoryCoverage'>, string> = {
  ReasoningCoverage: '기출 분석',
  TaskLinkCoverage: '기출 ↔ TASK 연결',
  InstructionCoverage: '학습 방법 · 자료',
  AssessmentCoverage: '직접 확인 과제',
  GoalSupportCoverage: '목표 지원(위의 최솟값)',
}

/** 이 TASK 의 기존 라인과 겹치는 지도 단계(상세 근거 시트) — 없으면 null */
function legacyStepOf(task: string, steps: readonly StepView[]): StepView | null {
  const lines = new Set(linesOfTask(task))
  return steps.find((s) => s.lines.some((l) => lines.has(l))) ?? null
}

/** 이 TASK 의 학습 묶음 — 복귀한 묶음이 이 TASK 를 담으면 그것, 아니면 이 TASK 를 중심으로 하는 묶음, 아니면 처음 담은 묶음 */
export function homeWsOf(task: string, view: V4View, restoreWs: string | null): string | null {
  const planIds = Object.keys(view.plans)
  return (restoreWs && view.plans[restoreWs]?.tasks.some((x) => x.task === task) ? restoreWs : null)
    ?? planIds.find((id) => view.plans[id].core.includes(task))
    ?? planIds.find((id) => view.plans[id].tasks.some((x) => x.task === task))
    ?? null
}

/** 학습계획 편집(PlanSection)은 Workspace 상세 모달의 계획 탭에서 연다(LM-W1) — 여기서는 열기 요청만 */
export function TaskInspector({ ins, view, data, past, restoreWs, planOpen, onTogglePlan }: { ins: TaskInspectorDTO; view: V4View; data: MapPageData; past: boolean; restoreWs: string | null; planOpen: boolean; onTogglePlan: (ws: string) => void }) {
  const [sheet, setSheet] = useState<StepView | null>(null)
  const tasks = useTaskDone(data.doneTaskIds)
  const t = ins.task
  const def = taskOf(t.id)
  const need = view.toBe?.needs.find((n) => n.task === t.id) ?? null
  const unknownRel = view.toBe?.relevanceUnknown.includes(t.id) ?? false
  const home = homeWsOf(t.id, view, restoreWs)
  const behaviors = BEHAVIORS[t.id] ?? []
  const research = researchFor(t.id)
  // 기출 해부로 열어도 되는 문항(노출 규칙) — 이 TASK 를 직접 확인하는 과제 키의 확인 · 전이 문항을 대조한다
  const keys = checkKeysOfTask(t.id)
  const confirmAll = confirmLinksOf(data)
  const confirmMine = keys.flatMap((k) => confirmAll[k] ?? [])
  const transferMine = keys.flatMap((k) => data.v4?.transferTargets?.[k] ?? [])
  const check = view.asIs.tasks[t.id]?.check ?? null
  const study = studyItemsFor(t.id, check, confirmMine, transferMine)
  // P-F1 · P-F2 — 이 TASK · 묶음의 자료 수요와 기존 자산 공급 상태(판정 · 생산 없음). 공장 재고는 이 화면에서 조회하지 않는다(null)
  const savedWs = home && data.v4?.saved?.status === 'installed' ? data.v4.saved.byTemplate[home] ?? null : null
  const demand = buildDemand(view, t.id, home, { workspaceId: savedWs?.workspaceId ?? null, planVersion: savedWs?.latest.version ?? null, goalVersion: data.v4?.saved?.goalVersionId ?? null })
  const currentDemand = data.v4?.viewer ? canonicalDemand(data.v4.viewer, demand) : ''
  const unseen = new Set(check?.unseen ?? [])
  // P-F8e — 「주문됨 · 공급 완료」는 서버가 읽은 실제 기록에서만(저장 안 한 묶음 · 기록 표 없음 · 못 읽음은 각각 다르게 말한다)
  const ledger: SupplyLedger = savedWs ? data.v4?.supplyLedger?.[savedWs.workspaceId] ?? { status: 'not_installed' } : { status: 'no_workspace' }
  const fq = data.v4?.fqReader ?? { status: 'error' as const }
  const supply = supplyFor(demand, {
    unseenCheckItems: confirmMine.map((l) => l.target).filter((x) => unseen.has(x)),
    transferItems: transferMine.map((l) => l.target),
    transferDrafts: 0,
    study,
    factoryStock: null,
    // #281 E01 · E04 — 모든 원장 노출로 다시 거르고, 정식 자격 reader 상태를 그대로 쓴다(없으면 모름 — 미노출 · 적격으로 보지 않는다)
    exposure: data.v4?.assessmentExposure ?? { status: 'error', failed: [] },
    fq,
  })
  const ws = home ? [view.plan.primary, ...view.plan.others].find((w) => w?.id === home) ?? null : null
  const path = learnerPath(data.model, data.settings)
  const step = legacyStepOf(t.id, [...path.read, ...path.listen])

  return (
    <aside className={u.inspector} aria-labelledby="ins-h" data-testid="task-inspector" data-task={t.id}>
      <header className={u.insHead}>
        <p className={u.insEyebrow}>
          {t.display} · {DOMAIN_NAME[t.domain]}
          {t.kind === 'integrated' && <span className={u.chip}>통합 관찰</span>}
          {t.hold && <span className={u.chip}>보류</span>}
        </p>
        <h2 id="ins-h" className={u.insTitle}>{def.name}</h2>
        <p className={u.fine}>{DOMAIN_QUESTION[t.domain]}</p>
        {past ? (
          <p className={u.insBlocked}>과거 기준 보기에서는 학습 활동을 시작하지 않아요.</p>
        ) : ins.next ? (
          <Link
            href={withMapReturn(ins.next.href, outgoingCtx(data.v4?.saved, t.id, home))}
            className={u.cta}
            data-testid="inspector-next"
            onClick={() => {
              const slug = home?.replace(/^ws\./, '')
              if (slug === 'central-meaning' || slug === 'option-match' || slug === 'evidence-locate' || slug === 'cohesion') track({ name: 'csat_workspace_suggestion_applied', props: { workspace: slug, stage: ins.plan?.stage === 'recheck' ? 'recheck' : 'check' } })
            }}
          >
            <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
            {ins.next.label}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <p className={u.insBlocked} data-testid="inspector-blocked" data-reason={ins.blocked ?? 'none'}>{BLOCKED_LABEL[ins.blocked ?? 'no_next_activity']}</p>
        )}
      </header>

      <div className={u.insBody}>
        <section className={u.insSec} aria-labelledby="ins-now">
          <h3 id="ins-now" className={u.insH}>현재와 목표</h3>
          <dl className={u.kv}>
            <dt>지금 근거</dt>
            <dd data-testid="inspector-evidence" data-evidence={ins.now.evidence}>{EVIDENCE_V62_LABEL[ins.now.evidence]}</dd>
            {ins.now.observed && ins.now.observed.independent > 0 && (
              <>
                <dt>확인에 쓴 문항</dt>
                <dd>서로 다른 문항 {ins.now.observed.independent}개(혼자 처음 푼 것만)</dd>
              </>
            )}
            <dt>목표까지</dt>
            <dd data-testid="inspector-need">
              {ins.now.need ? `${NEED_V62_LABEL[ins.now.need]}${ins.now.needRank ? ` · 순서 ${ins.now.needRank}` : ''}` : view.toBe ? '이 목표에서 지금 요구 없음' : '목표를 정하면 보여요'}
            </dd>
            <dt>다 했다고 보는 기준</dt>
            <dd>{def.learner_criterion}</dd>
          </dl>
          {t.researchFlag && <p className={u.fine}>{FLAG_LABEL[t.researchFlag]} — 표시 순서만 바뀔 수 있고 기록은 그대로예요.</p>}
          {ins.now.timingHeld > 0 && <p className={u.fine} data-testid="inspector-timing-held" data-n={ins.now.timingHeld}>확인 문항 {ins.now.timingHeld}개는 해설 열람 시각과 제출 순서를 확인할 수 없어 이번 독립 확인에 반영하지 않았어요 — 틀렸다는 뜻이 아니에요.</p>}
          <p className={u.fine}>근거 상태는 실력 점수가 아니에요. 확인 전 · 보류는 부족하다는 뜻이 아니에요.</p>
        </section>

        {view.evidence?.[t.id] && (
          <section className={u.insSec} aria-labelledby="ins-claims">
            <h3 id="ins-claims" className={u.insH}>기록으로 말할 수 있는 것</h3>
            <EvidenceBlock e={view.evidence[t.id]!} />
          </section>
        )}

        <section className={u.insSec} aria-labelledby="ins-plan">
          <h3 id="ins-plan" className={u.insH}>학습 경로 · 필요한 자료</h3>
          {ws && home ? (
            <>
              <p className={u.p}><strong>{templateOf(home)?.name ?? ws.name}</strong> — {ws.goal}</p>
              <ol className={u.stages} aria-label="학습 단계">
                {(['check', 'repair', 'transfer', 'recheck'] as StageKey[]).map((k) => {
                  const s = ws.stages[k]
                  const done = !s.ready && s.blocked === null
                  return (
                    <li key={k} className={u.stage} data-stage={k} data-ready={s.ready} data-blocked={s.blocked ?? ''} data-current={ins.plan?.stage === k}>
                      <span className={u.stageName}>{STAGE_LABEL[k]}</span>
                      <span className={u.stageNote}>{s.ready ? (s.count !== null ? `할 수 있어요 · ${s.count}문항` : '할 수 있어요') : done ? '마쳤어요' : STAGE_BLOCKED_LABEL[s.blocked!]}</span>
                    </li>
                  )
                })}
              </ol>
              {ins.plan && <p className={u.fine}>이번 계획 수행 {ins.plan.done}{ins.plan.planned !== null ? ` / ${ins.plan.planned}` : ''} — 수행량은 실력 점수가 아니에요.</p>}
              {view.plans[home] && (
                <button type="button" className={u.ghost} aria-haspopup="dialog" aria-expanded={planOpen} onClick={() => onTogglePlan(home)} data-testid="inspector-plan-toggle">
                  <ChevronDown size={14} aria-hidden="true" className={u.chev} data-open={planOpen} />
                  학습계획 열기 · 조정
                </button>
              )}
            </>
          ) : (
            <p className={u.p} data-testid="inspector-no-ws">{t.hold ? '측정 방법이 정해지면 학습 묶음이 생겨요.' : '이 TASK 를 다루는 학습 묶음의 확인 콘텐츠를 준비하고 있어요. 준비 전이라도 부족하다는 뜻은 아니에요.'}</p>
          )}
          {supply.lines.length > 0 && (
            <div className={u.sub} data-testid="inspector-supply" data-demand={supply.demandKey}>
              <p className={u.subH}>이 TASK 에 필요한 자료 · 준비 상태</p>
              <ul className={u.ledger}>
                {supply.lines.map((l) => (
                  <li key={l.role} data-role={l.role} data-state={l.state} data-step={supplyStep(l, t.id, ledger, currentDemand)} title={l.reason}>
                    <span>{ROLE_LABEL_KO[l.role]}{l.delivered.length > 0 ? ` · ${l.delivered.length}개` : ''}</span>
                    <span className={u.ledgerVal}>{SUPPLY_STEP_LABEL[supplyStep(l, t.id, ledger, currentDemand)]}</span>
                  </li>
                ))}
              </ul>
              <p className={u.fine} data-testid="inspector-fq" data-fq={fq.status}>{FQ_READER_LABEL[fq.status]}{fq.status === 'installed' ? ` · 적격 자료 ${fq.eligible.length}건${fq.eligible.length === 0 ? ' · 자격 검증 대기' : ''}` : ''}</p>
              <p className={u.fine} data-testid="inspector-ledger-note" data-ledger={ledger.status}>{ledgerNote(ledger)}</p>
              <p className={u.fine}>자료가 없거나 검수 전이어도 이 TASK 가 필요 없다는 뜻이 아니에요. 자료 수는 실력 점수가 아니에요.</p>
            </div>
          )}
          {(study.items.length > 0 || study.withheld > 0) && (
            <div className={u.sub} data-testid="inspector-study">
              <p className={u.subH}>기출 해부로 공부하기 — 출제 의도 · 정답 · 오답 설계</p>
              {study.items.length > 0 ? (
                <ul className={u.studyList}>
                  {study.items.map((s) => (
                    <li key={s.item} data-basis={s.basis}>
                      <Link
                        href={past ? `/csat/item/${toItemSlug(s.item)}` : withMapReturn(`/csat/item/${toItemSlug(s.item)}`, outgoingCtx(data.v4?.saved, t.id, home))}
                        className={u.studyLink}
                        data-testid="inspector-study-link"
                      >
                        {s.item.replace('#', ' · ')}번
                        <span className={u.bStatus}>{s.basis === 'attempted_check_item' ? '이미 풀어 본 확인 문항' : `연구 사례(AI 2명 ${s.research === 'direct' ? '직접' : '간접'} 관련 · 사람 검수 전)`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={u.fine}>확인 문항을 하나 풀면 그 문항의 출제 의도와 정답 · 오답 설계를 여기서 볼 수 있어요.</p>
              )}
              {study.withheld > 0 && (
                <p className={u.fine} data-testid="inspector-study-withheld">
                  아직 안 푼 확인 · 다른 글 적용 문항 {study.withheld}개는 해설을 먼저 보면 혼자 푼 기록으로 쓸 수 없어서, 풀기 전에는 여기서 열지 않아요.
                </p>
              )}
            </div>
          )}
        </section>

        {/* P-M4d — 자세한 근거(기출 · 출제 논리 · 판정 범위 · 연구)는 접어 둔다. 기본 화면은 「지금 · 목표 · 다음 행동 · 학습 경로 · 자료」 */}
        <details className={u.insSec} data-testid="inspector-detail" aria-labelledby="ins-exam">
          <summary id="ins-exam" className={u.insH}><FileSearch size={14} aria-hidden="true" />자세한 근거 — 기출 · 출제 논리 · 연구</summary>
          <p className={u.p}>{def.goal}</p>
          <dl className={u.kv}>
            <dt>어떤 기출에서</dt>
            <dd>{learnerText(def.conditions) || '정하는 중'}</dd>
            <dt>무엇을 보면 아나</dt>
            <dd>{learnerText(def.evidence) || '정하는 중'}</dd>
            <dt>목표 시험과의 연결</dt>
            <dd data-testid="inspector-relevance">
              {unknownRel ? '기준 시험 문항과의 연결을 아직 검토하지 않았어요(무관하다는 뜻 아님)' : need ? `목표 점수에 꼭 필요한 기출 문항 중 연결된 문항 ${need.relevance.items}개 · 라인 수준 연결(문항별 검토 전)` : view.toBe ? '연결은 있지만 이 목표에서 먼저 할 문항은 아니에요' : '목표를 정하면 보여요'}
            </dd>
          </dl>
          {step && (
            <button type="button" className={u.ghost} onClick={() => setSheet(step)} data-testid="inspector-evidence-detail" data-step={step.key}>
              <BookOpenCheck size={14} aria-hidden="true" />
              기출 근거 자세히 · 「{step.name}」
            </button>
          )}
          {behaviors.length > 0 && (
            <div className={u.sub} data-testid="inspector-behaviors">
              <p className={u.subH}>이 TASK 에서 하는 일 — 서로 다른 연습이에요</p>
              <ul className={u.behaviors}>
                {behaviors.map((b) => (
                  <li key={b.id} data-behavior={b.id} data-status={b.status}>
                    <span className={u.bName}>{b.name}</span>
                    <span className={u.bDoes}>{b.does}</span>
                    <span className={u.bStatus}>{BEHAVIOR_STATUS_LABEL[b.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {research && (
            <details className={u.sub} data-testid="inspector-research">
              <summary className={u.subH}>연구 근거 v1.4 · 사람 검수 전</summary>
              {research.definition && <p className={u.fine}>연구 정의: {research.definition}</p>}
              {research.reviews.length > 0 && (
                <>
                  <p className={u.fine}>원문을 확인한 AI 두 명이 이 TASK 와 기출의 관련을 따로 판정했어요(사람 검수 · 학생 자료 아님). 갈린 판정은 그대로 둬요.</p>
                  <ul className={u.ledger}>
                    {research.reviews.map((r) => (
                      <li key={r.item} data-agree={r.agree}>
                        <span>{r.item} · {TYPE_LABEL[r.type] ?? r.type}</span>
                        <span className={u.ledgerVal}>{r.agree ? REL_LABEL[r.first] : `${REL_LABEL[r.first]} / ${r.second ? REL_LABEL[r.second] : '?'} · 갈림`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {research.activities.length > 0 && (
                <p className={u.fine}>
                  설계된 학습 활동 {research.activities.length}개({research.activities.map((a) => ROLE_LABEL[a.role] ?? a.role).join(' · ')}) · 채점 기준 {research.activities.reduce((s, a) => s + a.facets, 0)}개 — 콘텐츠 검수(R2) · 채점 독립성(R3) 전이라 아직 학습자에게 내보내지 않아요.
                </p>
              )}
              <p className={u.fine}>출처 {research.source.branch}@{research.source.commit} · 자동 후보는 쓰지 않아요.</p>
            </details>
          )}
        </details>

        <details className={u.insSec} data-testid="inspector-coverage">
          <summary className={u.insH}>결과와 개선 · 지원 상태</summary>
          {ins.coverage ? (
            <>
              <ul className={u.ledger}>
                {(Object.keys(LEDGER_LABEL) as (keyof typeof LEDGER_LABEL)[]).map((k) => (
                  <li key={k} data-status={ins.coverage!.ledgers[k].status}>
                    <span>{LEDGER_LABEL[k]}</span>
                    <span className={u.ledgerVal}>{SUPPORT_LABEL[ins.coverage!.ledgers[k].status]}</span>
                  </li>
                ))}
              </ul>
              <p className={u.fine}>플랫폼이 아직 채우지 못한 것: {ins.coverage.gaps.map((g) => GAP_LABEL[g]).join(' · ')}. 학생의 부족이 아니에요.</p>
            </>
          ) : (
            <p className={u.fine}>지원 상태를 계산하지 않았어요.</p>
          )}
          <p className={u.fine}>정의 {ins.versions.canon} · 지도 {ins.versions.v62} · 기준 {ins.versions.asOf.slice(0, 10)}{ins.versions.mode === 'past_reanalysis' ? ' · 과거 기준 재분석' : ''}</p>
        </details>
      </div>

      {sheet && <StepSheet data={data} step={sheet} tasks={tasks} onClose={() => setSheet(null)} />}
    </aside>
  )
}
