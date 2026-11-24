// apps/web/src/components/csat/diagnosis/map/LearningDetailDialog.tsx
// One persistent dialog for map TASKs, linked workspaces, evidence and editable plans.
'use client'

import { ArrowRight, ClipboardList, FileSearch, LayoutList, PlayCircle, Info, Target } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { track } from '@/lib/analytics/client'

import type { MapPageData } from '@/lib/csat/map/load'
import { DOMAIN_NAME, taskOf, type TaskId } from '@/lib/csat/map/v4/definition'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskInspectorDTO } from '@/lib/csat/map/v62/graph'
import { outgoingCtx, type ReturnNote } from '@/lib/csat/map/v62/return-ctx'
import { wsOfTask, type WsRow } from '@/lib/csat/map/v62/workspace-list'
import { withMapReturn } from '@/lib/csat/map-return'

import { MapDialog } from './MapDialog'
import { BLOCKED_LABEL, EVIDENCE_V62_LABEL, NEED_V62_LABEL, TaskInspector, type ReturnRef } from './TaskInspector'
import { WorkspaceContent } from './WorkspaceModal'
import { Amount, StageTrack, wsIcon, WS_STATE_LABEL } from './WorkspaceList'
import d from './detail.module.css'
import p from './popup.module.css'

export type DetailTab = 'overview' | 'evidence' | 'plan'
export type DetailState = { id: string | null; task: TaskId | null; tab: DetailTab }

export function LearningDetailDialog({ state, ins, row, rows, view, data, past, goal, reason, notes, returnRef, returned, onTab, onClose, onPickTask, onPickWorkspace }: {
  state: DetailState; ins: TaskInspectorDTO; row: WsRow | null; rows: WsRow[]; view: V4View; data: MapPageData; past: boolean; goal: number; reason: string | null
  notes: readonly ReturnNote[] | null; returnRef: ReturnRef; returned: { task: TaskId; lines: string[] } | null
  onTab: (tab: DetailTab) => void; onClose: () => void; onPickTask: (task: TaskId) => void; onPickWorkspace: (id: string, tab?: DetailTab) => void
}) {
  const taskMode = state.task !== null
  const title = taskMode ? taskOf(ins.task.id).name : row?.name ?? '학습 상세'
  const Icon = wsIcon(row?.id ?? '')
  const hasPlan = !!row && !!view.plans[row.id]
  const tab = state.tab === 'plan' && !hasPlan ? 'overview' : state.tab
  const selectTab = (next: DetailTab) => {
    if (next === tab) return
    track({ name: 'csat_path_chosen', props: { axis: 'map_detail', need: 'none', action: 'go', tab: next, source: taskMode ? 'task' : 'workspace' } })
    onTab(next)
  }
  const tabs = [{ id: 'overview', label: '개요', Icon: LayoutList }, { id: 'evidence', label: '근거 · 학습 경로', Icon: FileSearch }, { id: 'plan', label: '학습계획', Icon: ClipboardList }] as const
  const next = taskMode ? ins.next : row?.next
  const links = wsOfTask(rows, ins.task.id)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // One persistent dialog keeps its identity; each selected view starts at its heading.
    if (panelRef.current?.parentElement) panelRef.current.parentElement.scrollTop = 0
  }, [tab, state.task, row?.id])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const enabled = tabs.filter(t => t.id !== 'plan' || hasPlan)
    const index = enabled.findIndex(t => t.id === tab)
    const at = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
    selectTab(enabled[at].id)
    document.getElementById(`detail-tab-${enabled[at].id}`)?.focus()
  }
  return <MapDialog wide labelledBy="learning-detail-title" testId={taskMode ? 'task-detail' : 'ws-modal'} dataWs={row?.id} onClose={onClose}
    head={<>
      <span className={d.identityIcon} aria-hidden="true">{taskMode ? ins.task.display : <Icon size={18} />}</span>
      <div className={d.identity}><span className={d.eyebrow}>{taskMode ? `${DOMAIN_NAME[ins.task.domain]} · 학습지도` : '학습 Workspace'}</span><h2 id="learning-detail-title" className={d.title}>{title}</h2></div>
      {row && <span className={d.state}>{WS_STATE_LABEL[row.state]}</span>}
    </>}
    navigation={<div className={d.tabs} role="tablist" aria-label="학습 상세 보기">{tabs.map(t => <button key={t.id} id={`detail-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="learning-detail-panel" tabIndex={tab === t.id ? 0 : -1} disabled={t.id === 'plan' && !hasPlan} className={d.tab} onClick={() => selectTab(t.id)} onKeyDown={onKey} data-testid={t.id === 'plan' ? 'ws-tab-plan' : t.id === 'overview' ? 'ws-tab-overview' : 'detail-tab-evidence'}><t.Icon size={15} aria-hidden="true" />{t.label}</button>)}</div>}
    foot={<><span className={d.footNote}>{past ? '과거 기준 · 보기 전용' : '실제 수행 기록 기준'}</span>{next && !past ? <Link className={p.pillBtn} data-testid="ws-modal-next" href={withMapReturn(next.href, outgoingCtx(data.v4?.saved, state.task ?? row?.next?.task ?? ins.task.id, row?.id ?? null))}><PlayCircle size={14} aria-hidden="true" />{next.label}<ArrowRight size={14} aria-hidden="true" /></Link> : <button type="button" className={p.pillBtn} onClick={onClose}>닫기</button>}</>}
  >
    <div ref={panelRef} id="learning-detail-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`} className={d.panel} data-tab={tab}>
      {tab === 'evidence' ? <div className={d.evidence}><TaskInspector key={ins.task.id} embedded ins={ins} view={view} data={data} past={past} restoreWs={row?.id ?? null} planOpen={false} onTogglePlan={id => onPickWorkspace(id, 'plan')} returned={notes} returnRef={returnRef} /></div> : <>
        {tab === 'overview' && taskMode && <div className={d.taskOverview}>
          <section className={d.summary} aria-labelledby="detail-task-summary"><h3 id="detail-task-summary" className={d.sectionTitle}><Target size={18} aria-hidden="true" />{title}</h3><dl className={d.facts}><div><dt>지금 근거</dt><dd data-testid="pop-evidence">{EVIDENCE_V62_LABEL[ins.now.evidence]}</dd></div><div><dt>목표까지</dt><dd>{ins.now.need ? NEED_V62_LABEL[ins.now.need] : view.toBe ? '이 목표에서 지금 요구 없음' : '목표를 정하면 보여요'}</dd></div></dl><details className={d.fold}><summary><Info size={14} aria-hidden="true" />무엇을 확인하나요?</summary><p className="break-keep">{taskOf(ins.task.id).learner_criterion}</p></details><button type="button" className={d.textButton} onClick={() => selectTab('evidence')} data-testid="pop-detail"><FileSearch size={15} aria-hidden="true" />기출 근거와 학습 경로<ArrowRight size={14} aria-hidden="true" /></button></section>
          <section className={d.connections} aria-labelledby="detail-workspaces"><h3 id="detail-workspaces">연결 Workspace</h3>{links.length ? links.map(link => { const target = rows.find(r => r.id === link.id)!; const WsIcon = wsIcon(target.id); return <button key={link.id} type="button" className={d.connection} onClick={() => onPickWorkspace(link.id)} data-testid="detail-workspace-link"><WsIcon size={19} aria-hidden="true" /><span><strong>{target.name}</strong><small>{link.link === 'core' ? '중심 TASK' : '지원 TASK'} · {WS_STATE_LABEL[target.state]}</small></span><ArrowRight size={14} aria-hidden="true" /></button> }) : <p data-testid="pop-no-ws">{ins.task.hold ? '측정 방법이 정해지면 Workspace가 생겨요.' : '이 TASK를 다루는 자료를 준비하고 있어요. 부족하다는 뜻은 아니에요.'}</p>}</section>
        </div>}
        {row ? <>
          {tab === 'overview' && <div className={d.workspaceStrip}><strong>{row.name}</strong><StageTrack row={row} /><Amount row={row} /></div>}
          <div className={tab === 'overview' ? d.workspaceOverview : d.plan}><WorkspaceContent row={row} view={view} data={data} past={past} goal={goal} reason={reason} tab={tab === 'plan' ? 'plan' : 'overview'} onPickTask={onPickTask} returned={returned} /></div>
        </> : <section className={d.empty}><h3>학습 자료 준비 상태</h3><p>{BLOCKED_LABEL[ins.blocked ?? 'no_next_activity']}</p></section>}
      </>}
    </div>
  </MapDialog>
}
