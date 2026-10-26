// apps/web/src/components/csat/diagnosis/map/WorkspaceModal.tsx
//
// 학습지도 × Workspace 통합(LM-W1) — Workspace 상세 팝업(3B 모달 · 탭 2개: 개요 / 학습계획).
//   개요: 학습 목적 · 관련 TASK 관계(중심 → 지원) · 4단계 흐름(확인 · 바로잡기 · 다른 글에 적용 · 다시 확인) 단계별 준비 · 수행량 ·
//         필요한 자료(단계별 준비된 문항 수) · 학습 실행 · 상세 PLAN 열기.
//   학습계획: 기존 PlanSection 그대로(저장 · 버전 · 초안 · 충돌 처리 재사용 — 새 저장 기능 없음).
// 값은 workspaceRows · composeV4(plans) 그대로. Workspace 를 열거나 탭을 바꿔도 목표 · 진단 상태는 바뀌지 않는다.

'use client'

import { ArrowRight, ClipboardList, LayoutList, PlayCircle, Target, Network, Route, FolderOpen, Search, Wrench, Repeat2, CircleCheck, Info } from 'lucide-react'
import Link from 'next/link'

import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskId } from '@/lib/csat/map/v4/definition'
import { STAGE_BLOCKED_LABEL, STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import type { WsRow } from '@/lib/csat/map/v62/workspace-list'

import { AUTHORED_TASKS } from '@/lib/knowledge/authored/tasks'

import { AuthoredSupplyCard } from './AuthoredSupplyCard'
import { FactoryDcpCard } from './FactoryDcpCard'
import { supplementsOfTemplate } from '@/lib/csat/map/v62/instructional-supplement'
import { EvidenceChips } from './EvidenceClaims'
import { MapDialog } from './MapDialog'
import { PlanSection } from './PlanSection'
import { VocabLearningCard } from './VocabLearningCard'
import p from './popup.module.css'
import u from './unified.module.css'
import d from './detail.module.css'
import { Amount, READINESS_LABEL, STAGES, taskLabel, wsIcon, WS_STATE_LABEL } from './WorkspaceList'

export type WsTab = 'overview' | 'plan'
const STAGE_ICON = { check: Search, repair: Wrench, transfer: Repeat2, recheck: CircleCheck }

export function WorkspaceModal({ row, view, data, past, goal, reason, tab, onTab, onClose, onPickTask, returned = null }: {
  row: WsRow
  view: V4View
  data: MapPageData
  past: boolean
  goal: number
  reason: string | null
  tab: WsTab
  onTab: (t: WsTab) => void
  onClose: () => void
  onPickTask: (id: TaskId) => void
  /** T-0062 — 학습 후 이 묶음으로 돌아왔을 때의 정리(TASK 서랍과 같은 계산) · 돌아온 게 아니면 null */
  returned?: { task: TaskId; lines: string[] } | null
}) {
  const Icon = wsIcon(row.id)
  const plan = view.plans[row.id] ?? null
  const tabBtn = (k: WsTab, label: string, I: typeof LayoutList, disabled = false) => (
    <button type="button" role="tab" aria-selected={tab === k} className={p.tab} onClick={() => onTab(k)} disabled={disabled} data-testid={k === 'plan' ? 'ws-tab-plan' : 'ws-tab-overview'}>
      <span className={`${p.tabIn} ${tab === k ? p.tabOn : ''}`}><I size={14} strokeWidth={1.9} aria-hidden="true" />{label}</span>
    </button>
  )
  return (
    <MapDialog
      labelledBy="ws-modal-h"
      testId="ws-modal"
      dataWs={row.id}
      onClose={onClose}
      head={
        <>
          <span className={p.headTile} data-kind={row.kind} aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
          <h2 id="ws-modal-h" className={p.title}>{row.name}</h2>
          <span className={u.wsState} data-state={row.state}>{WS_STATE_LABEL[row.state]}</span>
          <span className={u.flex1} />
          <div className={p.tabs} role="tablist" aria-label="Workspace 보기">
            {tabBtn('overview', '개요', LayoutList)}
            {tabBtn('plan', '학습계획', ClipboardList, !plan)}
          </div>
        </>
      }
      foot={
        <>
          {tab === 'overview' && plan && (
            <button type="button" className={p.whitePill} onClick={() => onTab('plan')} data-testid="ws-plan-open">
              <ClipboardList size={14} strokeWidth={1.9} aria-hidden="true" />
              상세 PLAN 열기
            </button>
          )}
          {row.next && !past ? (
            <Link href={withMapReturn(row.next.href, outgoingCtx(data.v4?.saved, row.next.task, row.id))} className={p.pillBtn} data-testid="ws-modal-next" title={row.next.label}>
              <PlayCircle size={14} strokeWidth={1.9} aria-hidden="true" />
              학습 실행 · {row.next.label}
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" className={p.pillBtn} onClick={onClose}>닫기</button>
          )}
        </>
      }
    >
      <WorkspaceContent row={row} view={view} data={data} past={past} goal={goal} reason={reason} tab={tab} onPickTask={onPickTask} returned={returned} />
    </MapDialog>
  )
}

/** Embedded content: its parent owns the only dialog, tabs and focus boundary. */
export function WorkspaceContent({ row, view, data, past, goal, reason, tab, onPickTask, returned = null }: {
  row: WsRow; view: V4View; data: MapPageData; past: boolean; goal: number; reason: string | null; tab: WsTab; onPickTask: (id: TaskId) => void; returned?: { task: TaskId; lines: string[] } | null
}) {
  const plan = view.plans[row.id] ?? null
  const coreTp = row.core[0] ? plan?.tasks.find(t => t.task === row.core[0]) ?? null : null
  return <>
      {returned && returned.lines.length > 0 && (
        <section className={p.card} aria-labelledby="ws-return-h" data-testid="ws-return-summary" data-task={returned.task} role="status">
          <h3 id="ws-return-h" className={p.cardTitle}>돌아온 뒤 — {taskLabel(returned.task).name} 에 무엇이 기록됐나</h3>
          <ul className={u.ledger}>{returned.lines.map((x) => <li key={x} className="break-keep">{x}</li>)}</ul>
        </section>
      )}
      {tab === 'plan' && plan ? (
        <div id="umap-plan" className={u.planInModal} data-testid="umap-plan" data-ws={row.id}>
          {/* 묶음마다 다른 인스턴스 — 다른 묶음 저장의 늦은 응답 · 초안이 지금 묶음을 덮지 않는다 */}
          <PlanSection key={row.id} view={plan} reason={reason} past={past} saved={data.v4?.saved ?? null} viewer={data.v4?.viewer ?? 'anon'} goal={goal} />
        </div>
      ) : (
        <>
          <section className={p.card} aria-labelledby="ws-purpose">
            <h3 id="ws-purpose" className={`${p.cardTitle} ${d.sectionTitle}`}><Target size={17} aria-hidden="true" />학습 목표</h3>
            <p className={p.cardDesc}>{row.goal ?? READINESS_LABEL[row.readiness ?? ''] ?? '자료를 준비하고 있어요.'}</p>
            {reason && <details className={d.fold}><summary><Info size={14} aria-hidden="true" />현재 준비 상태</summary><p className="break-keep">{reason}</p></details>}
            {row.core[0] && view.evidence?.[row.core[0]] && <EvidenceChips e={view.evidence[row.core[0]]!} testId="ws-evidence-claims" />}
          </section>

          <section className={p.card} aria-labelledby="ws-rel">
            <h3 id="ws-rel" className={`${p.cardTitle} ${d.sectionTitle}`}><Network size={17} aria-hidden="true" />연결된 학습</h3>
            {row.core.length + row.support.length > 0 ? (
              <div className={u.relMap} data-testid="ws-rel">
                <ul className={u.relCol} aria-label="중심 TASK">
                  <li className={d.caption}>중심</li>{row.core.map((t) => (
                    <li key={t}><button type="button" className={u.relNode} data-role="core" onClick={() => onPickTask(t)}><span className={u.nodeCode}>{taskLabel(t).code}</span> {taskLabel(t).name}</button></li>
                  ))}
                </ul>
                {row.support.length > 0 && (
                  <>
                    <span className={u.relEdge} aria-hidden="true" />
                    <ul className={u.relCol} aria-label="지원 TASK">
                      <li className={d.caption}>함께 쓰는 힘</li>{row.support.map((t) => (
                        <li key={t}><button type="button" className={u.relNode} data-role="support" onClick={() => onPickTask(t)}><span className={u.nodeCode}>{taskLabel(t).code}</span> {taskLabel(t).name}</button></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <p className={p.cardDesc}>준비가 끝나면 연결된 TASK 가 보여요.</p>
            )}
          </section>

          <section className={p.card} aria-labelledby="ws-stages">
            <div className={p.cardHead}>
              <div>
                <h3 id="ws-stages" className={`${p.cardTitle} ${d.sectionTitle}`}><Route size={17} aria-hidden="true" />학습 흐름</h3>
              </div>
              <Amount row={row} />
            </div>
            <ol className={u.flow}>
              {STAGES.map((k) => {
                const s = row.stages?.[k] ?? null
                const now = row.stage === k
                const done = !!s && !s.ready && s.blocked === null
                const StageIcon = STAGE_ICON[k]
                return (
                  <li key={k} className={u.flowStep} data-testid="ws-stage" data-stage={k} data-now={now} data-ready={s?.ready ?? false} data-done={done}>
                    <span className={d.stageIcon}><StageIcon size={17} aria-hidden="true" /></span>
                    <span className={u.flowName}>{STAGE_LABEL[k]}</span>
                    <span className={u.flowNote}>
                      {!s ? '준비 중' : now && coreTp?.quantity.planned != null ? `지금 · 수행 ${coreTp.quantity.done} / ${coreTp.quantity.planned}` : s.ready ? (s.count !== null ? `할 수 있어요 · ${s.count}문항` : '할 수 있어요') : done ? '마쳤어요' : STAGE_BLOCKED_LABEL[s.blocked!]}
                    </span>
                  </li>
                )
              })}
            </ol>
            <details className={d.fold}><summary><Info size={14} aria-hidden="true" />단계가 열리는 기준</summary><p className="break-keep">확인 결과에 따라 다음 단계가 열려요. 모든 단계를 꼭 거치지는 않아요.</p></details>
          </section>

          <section className={p.card} aria-labelledby="ws-need">
            <h3 id="ws-need" className={`${p.cardTitle} ${d.sectionTitle}`}><FolderOpen size={17} aria-hidden="true" />준비된 문항</h3>
            {row.stages ? (
              <ul className={d.resources}>
                <li><Search size={17} aria-hidden="true" /><span>확인</span><strong>{row.stages.check.count ?? '—'}</strong><small>안 본 문항</small></li>
                <li><Wrench size={17} aria-hidden="true" /><span>바로잡기</span><strong>{row.stages.repair.count ?? '—'}</strong><small>문항</small></li>
                <li><Repeat2 size={17} aria-hidden="true" /><span>다른 글 적용</span><strong>{row.stages.transfer.count ?? '—'}</strong><small>문항</small></li>
              </ul>
            ) : (
              <p className={p.cardDesc}>{READINESS_LABEL[row.readiness ?? ''] ?? '자료를 준비하고 있어요'} — 준비 전에는 학습 가능으로 보이지 않아요.</p>
            )}
            <details className={d.fold}><summary><Info size={14} aria-hidden="true" />문항 수의 의미</summary><p className="break-keep">문항 수는 자료 준비 상태이며 실력 점수가 아니에요. TASK별 상태는 「근거 · 학습 경로」 탭에서 볼 수 있어요.</p></details>
          </section>

          {row.core[0] && AUTHORED_TASKS.includes(row.core[0]) && (
            <AuthoredSupplyCard viewer={data.v4?.viewer ?? null} task={row.core[0]} template={row.id} planSaved={!!data.v4?.saved?.byTemplate[row.id]} past={past} ctx={outgoingCtx(data.v4?.saved, row.core[0], row.id)} />
          )}
          {/* 1D — 공장 DCP 지도 연습(r.central_meaning)은 창작 자료와 별개 카드 · 납품이 없거나 미설치면 그리지 않는다 */}
          {row.core.includes('r.central_meaning') && !past && (
            <FactoryDcpCard template={row.id} ctx={outgoingCtx(data.v4?.saved, 'r.central_meaning', row.id)} />
          )}
          {/* T-0056 — 이 Workspace 의 보조 TASK 자료(창작 세트가 있는 것만). 핵심/보조 표기 그대로 · 서버가 TASK 소속을 다시 확인한다 */}
          {row.support.filter((t) => AUTHORED_TASKS.includes(t)).map((t) => (
            <AuthoredSupplyCard viewer={data.v4?.viewer ?? null} key={t} kind="support" task={t} taskName={taskLabel(t).name} template={row.id} planSaved={!!data.v4?.saved?.byTemplate[row.id]} past={past} ctx={outgoingCtx(data.v4?.saved, t, row.id)} />
          ))}
          {/* T-0083 — 학습 전용 보조 진입(정본 core/support 밖 · 닫힌 표) — 교수 자료만 · 같은 묶음 복귀 문맥 */}
          {supplementsOfTemplate(row.id).filter((s) => AUTHORED_TASKS.includes(s.task)).map((s) => (
            <AuthoredSupplyCard viewer={data.v4?.viewer ?? null} key={`learn-${s.task}`} kind="instructional" task={s.task} taskName={taskLabel(s.task).name} template={row.id} planSaved={!!data.v4?.saved?.byTemplate[row.id]} past={past} ctx={outgoingCtx(data.v4?.saved, row.core[0] ?? s.task, row.id)} />
          ))}
          {/* T-0069 — V1 기본 의미는 창작 세트가 아니라 기존 WordVault 복습이 정본 자산이다 · 같은 지도 복귀 문맥(outgoingCtx)을 싣는다 */}
          {(['core', 'support'] as const).flatMap((k) => (k === 'core' ? row.core.slice(0, 1) : row.support).filter((t) => t === 'v.core_meaning').map((t) => (
            <VocabLearningCard key={t} kind={k} taskName={taskLabel(t).name} ctx={outgoingCtx(data.v4?.saved, t, row.id)} />
          )))}
        </>
      )}
  </>
}
