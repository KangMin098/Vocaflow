// apps/web/src/components/csat/diagnosis/map/WorkspaceList.tsx
//
// 학습지도 × Workspace 통합(LM-W1) — 지도 캔버스 **바로 아래** 상시 Workspace 리스트.
// 행 = 아이콘 타일 · 이름 · 중심/지원 TASK 칩 · 단계 흐름(4점) · 이번 계획 수행량(작은 막대 — 숙달률 아님) · 상태 · 다음 행동 하나.
// 순서와 값은 workspaceRows(composeV4 결과)를 그대로 쓴다 — 여기서 판정하지 않는다. 선택 상태는 상위(UnifiedLearningMap)가 갖는다.
// 처음엔 실행 가능한 행만 보이고, 자료 준비 중 행은 접힌 묶음 안에(실제 학습 가능으로 보이지 않게). 리스트는 최대 높이 안에서만 스크롤.

'use client'

import { ArrowRight, BookOpenText, Boxes, ChevronDown, Crosshair, LayoutGrid, Link2, ListChecks, List, Map, Maximize2, PlayCircle, Target, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { track } from '@/lib/analytics/client'

import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import { taskOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { STAGE_LABEL, type StageKey } from '@/lib/csat/map/v4/workspace'
import { domainTaskGraph } from '@/lib/csat/map/v62/graph'
import type { NotActionableReason, Ranks } from '@/lib/csat/map/v62/rank'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import { wsLinkOf, type WsRow, type WsRowState } from '@/lib/csat/map/v62/workspace-list'

import u from './unified.module.css'
import d from './detail.module.css'

export const STAGES: StageKey[] = ['check', 'repair', 'transfer', 'recheck']

const WS_ICON: Record<string, LucideIcon> = {
  'ws.central-meaning': BookOpenText,
  'ws.option-match': ListChecks,
  'ws.evidence-locate': Crosshair,
  'ws.cohesion': Link2,
}
export const wsIcon = (id: string): LucideIcon => WS_ICON[id] ?? Boxes

export const WS_STATE_LABEL: Record<WsRowState, string> = {
  runnable: '바로 할 수 있어요',
  in_progress: '진행 중',
  locked: '앞 단계 뒤에 열려요',
  maintain: '지금 확인 통과 · 다른 날 유지 확인 기준 미정',
  preparing: '자료 준비 중',
}
export const READINESS_LABEL: Record<string, string> = {
  content_needed: '확인 콘텐츠를 준비하고 있어요',
  blocked: '확인 문항 연결을 준비하고 있어요',
  ready: '공개 승인을 기다리고 있어요',
  live: '준비됨',
}
const WHY_NOT: Record<NotActionableReason, string> = {
  content_gap: '확인 자료 준비 중',
  stage_locked: '앞 단계 뒤에 열림',
  repair_material_needed: '바로잡기 자료 필요',
  material_needed: '새 자료 필요',
  canon_hold: '측정 방법 정하는 중',
  relevance_unknown: '목표 시험과의 연결 확인 전',
  no_next_activity: '지금 이어 할 활동 없음',
  maintain_pending: '지금 확인 통과 · 다른 날 유지 확인 기준 미정',
}

export const taskLabel = (id: TaskId) => {
  const g = domainTaskGraph().tasks.find((x) => x.id === id)
  return { code: g?.display ?? id, name: (g?.name ?? taskOf(id).name).replace(/\(통합 관찰\)$/, '') }
}

/** 단계 흐름 — 지금 단계 · 마친 단계 · 열린 단계 · 닫힌 단계(점 4개 + 지금 단계 이름) */
export function StageTrack({ row, compact = false }: { row: WsRow; compact?: boolean }) {
  return (
    <span className={u.track} data-compact={compact} aria-label={row.stage ? `지금 단계 ${STAGE_LABEL[row.stage]}` : '단계 정보 없음'}>
      {STAGES.map((k) => {
        const s = row.stages?.[k]
        const st = row.stage === k ? 'now' : s ? (s.ready ? 'open' : s.blocked === null ? 'done' : 'closed') : 'closed'
        return <span key={k} className={u.trackDot} data-st={st} title={`${STAGE_LABEL[k]} · ${st === 'now' ? '지금' : st === 'done' ? '마침' : st === 'open' ? '열림' : '닫힘'}`} />
      })}
      {!compact && <span className={u.trackName}>{row.stage ? STAGE_LABEL[row.stage] : '—'}</span>}
    </span>
  )
}

/** 수행량 — 「수행 n / 계획 m 문항」 작은 막대(실력 점수 아님) */
export function Amount({ row }: { row: WsRow }) {
  if (!row.progress) return <span className={u.amount} data-none="true">계획량 없음</span>
  const { planned, done } = row.progress
  const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0
  return (
    <span className={u.amount} title="이번 계획에서 푼 문항 수 — 실력 점수가 아니에요">
      <span className={u.amountBar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      <span className={u.amountTxt}>{done} / {planned}문항</span>
    </span>
  )
}

export function WorkspaceList({ rows, ranks, data, past, selectedTask, selectedWs, onSelectWs, onOpenWs, onSelectTask }: {
  rows: WsRow[]
  ranks: Ranks | null
  data: MapPageData
  past: boolean
  selectedTask: TaskId | null
  selectedWs: string | null
  onSelectWs: (id: string) => void
  onOpenWs: (id: string, opener: HTMLElement) => void
  onSelectTask: (id: TaskId) => void
}) {
  const [display, setDisplay] = useState<'board' | 'list'>('board')
  const chooseDisplay = (view: 'board' | 'list') => {
    if (display === view) return
    setDisplay(view)
    track({ name: 'csat_path_chosen', props: { axis: 'workspace_view', need: 'none', action: 'apply', view } })
  }
  const live = rows.filter((r) => r.kind !== 'preparing')
  const prep = rows.filter((r) => r.kind === 'preparing')
  const blocked = ranks?.notActionable ?? []
  const linkedPrep = selectedTask ? prep.some((r) => wsLinkOf(r, selectedTask)) : false
  const selectedHasWs = selectedTask ? rows.some((r) => wsLinkOf(r, selectedTask)) : true

  const row = (r: WsRow, i: number) => {
    const Icon = wsIcon(r.id)
    const link = selectedTask ? wsLinkOf(r, selectedTask) : null
    const on = selectedWs === r.id
    return (
      <li key={r.id} className={u.wsRow} data-testid="ws-row" data-ws={r.id} data-kind={r.kind} data-state={r.state} data-link={link ?? 'none'} data-selected={on}>
        <button type="button" className={u.wsMain} onClick={(e) => onOpenWs(r.id, e.currentTarget)} aria-haspopup="dialog" data-testid="ws-select" aria-label={`${r.name} — 상세 보기`}>
          <span className={u.wsTile} data-kind={r.kind} aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
          <span className={u.wsName}>
            <span className={u.wsTitle}>
              {r.name}
              {r.kind === 'primary' && i === 0 && <span className={u.wsBadge}>대표</span>}
              {link && <span className={u.wsLinkTag} data-link={link}>{link === 'core' ? '중심 연결' : '지원 연결'}</span>}
            </span>
            <span className={u.wsTasks}>
              {r.core.map((t) => <span key={t} className={u.tChip} data-role="core" data-on={t === selectedTask}>{taskLabel(t).code}</span>)}
              {r.support.map((t) => <span key={t} className={u.tChip} data-role="support" data-on={t === selectedTask}>{taskLabel(t).code}</span>)}
              {r.core.length + r.support.length === 0 && <span className={u.fine}>{READINESS_LABEL[r.readiness ?? ''] ?? '준비 중'}</span>}
            </span>
          </span>
        </button>
        {display === 'board' && <details className={d.fold}><summary><Target size={14} aria-hidden="true" />학습 목표</summary><p className="break-keep">{r.goal ?? READINESS_LABEL[r.readiness ?? ''] ?? '학습 자료를 준비하고 있어요.'}</p></details>}
        <span className={u.wsStage}>{display === 'board' && <span className={u.cardLabel}>지금 단계</span>}{r.stages ? <StageTrack row={r} /> : <span className={u.fine}>—</span>}</span>
        <span className={u.wsAmt}>{display === 'board' && <span className={u.cardLabel}>이번 계획 수행</span>}<Amount row={r} /></span>
        <span className={u.wsState} data-state={r.state}>{WS_STATE_LABEL[r.state]}</span>
        <span className={u.wsActs}>
          <button type="button" className={u.iconBtn} onClick={() => onSelectWs(r.id)} aria-label={`${r.name} — 지도에서 관련 TASK 보기`} title="지도에서 보기"><Map size={14} aria-hidden="true" /></button>
          {r.next && !past ? (
            <Link href={withMapReturn(r.next.href, outgoingCtx(data.v4?.saved, r.next.task, r.id))} className={u.wsGo2} data-testid="ws-next" title={r.next.label}>
              <PlayCircle size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className={u.ctaText}>{r.next.label}</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ) : (
            <span className={u.wsNoGo}>{past ? '보기 전용' : r.kind === 'preparing' ? '준비되면 열려요' : '단계 대기'}</span>
          )}
          <button type="button" className={u.iconBtn} onClick={(e) => onOpenWs(r.id, e.currentTarget)} data-testid="ws-open" aria-label={`${r.name} 자세히 · 계획`} title="자세히 · 계획">
            <Maximize2 size={14} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </span>
      </li>
    )
  }

  return (
    <section className={u.wsList} aria-labelledby="ws-h" data-testid="ws-list" data-count={rows.length} data-view={display}>
      <header className={u.wsHead}>
        <h2 id="ws-h" className={u.h} tabIndex={-1}>학습 Workspace</h2>
        <span className={u.wsCount}>{live.length}개 · 준비 중 {prep.length}</span>
        <div className={u.viewSwitch} role="group" aria-label="Workspace 표시 방식">
          <button type="button" aria-pressed={display === 'board'} onClick={() => chooseDisplay('board')} data-testid="ws-view-board"><LayoutGrid size={14} aria-hidden="true" />보드</button>
          <button type="button" aria-pressed={display === 'list'} onClick={() => chooseDisplay('list')} data-testid="ws-view-list"><List size={14} aria-hidden="true" />목록</button>
        </div>
        {selectedTask && (
          <span className={u.wsFocus} data-testid="ws-focus-note">
            <span className={u.tChip} data-role="core" data-on="true">{taskLabel(selectedTask).code}</span>
            {selectedHasWs ? '와 연결된 Workspace 를 강조했어요' : '를 다루는 Workspace 는 아직 없어요 — 자료가 준비되면 생겨요'}
          </span>
        )}
        <span className={u.wsLegend} aria-hidden="true">
          <span className={u.trackDot} data-st="done" /> 마침 <span className={u.trackDot} data-st="now" /> 지금 <span className={u.trackDot} data-st="open" /> 열림 <span className={u.trackDot} data-st="closed" /> 닫힘
        </span>
      </header>
      <div className={u.wsScroll}>
        {live.length > 0 && (
          <div className={u.wsCols} aria-hidden="true">
            <span>Workspace · 연결 TASK</span><span>지금 단계</span><span>이번 계획 수행</span><span>상태</span><span>다음 행동</span>
          </div>
        )}
        {live.length > 0 ? <ol className={u.wsRows}>{live.map(row)}</ol> : <p className={u.fine}>지금 실행할 수 있는 Workspace 가 없어요. 아래 준비 상태를 확인해요.</p>}
        {prep.length > 0 && (
          <details className={u.wsPrep} data-testid="ws-preparing" open={linkedPrep || undefined}>
            <summary><ChevronDown size={14} aria-hidden="true" className={u.chev} />자료 준비 중 {prep.length}개</summary>
            <ol className={u.wsRows}>{prep.map((r) => row(r, -1))}</ol>
          </details>
        )}
        {blocked.length > 0 && (
          <details className={u.wsPrep} data-testid="focus-blocked">
            <summary><ChevronDown size={14} aria-hidden="true" className={u.chev} />학습 자료 대기 {blocked.length}개</summary>
            <ul className={u.blockedChips}>
              {blocked.map((b) => (
                <li key={b.task}>
                  <button type="button" className={u.chipBtn} onClick={() => onSelectTask(b.task)} data-reason={b.reason}>
                    <span className={u.nodeCode}>{taskLabel(b.task).code}</span> {taskLabel(b.task).name} · {WHY_NOT[b.reason]}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
