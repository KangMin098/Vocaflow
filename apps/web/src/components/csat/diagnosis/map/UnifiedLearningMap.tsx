// apps/web/src/components/csat/diagnosis/map/UnifiedLearningMap.tsx
//
// 학습지도 v6.2 단일 지도 — `/csat` 홈 · `?tab=map` · `?tab=map&view=full` 이 모두 이 화면 하나를 쓴다(교육 그래프 · 판정 출처 하나).
// LM-W1(2026-10-15) 학습지도 × Workspace 통합 — 위에서 아래로 한 줄기:
//   ① 상단 컴팩트 띠(목표 · 기록 · 지금 상태 · 다음 한 행동)   ② 관계도 캔버스(6영역 열 · TASK 30 · 관계선 — 화면 폭 전체)
//   ③ 캔버스 바로 아래 Workspace 리스트   ④ TASK 빠른 팝업 · Workspace 상세 모달 · 자세한 근거 드로어   ⑤ PLAN 편집 = Workspace 모달의 계획 탭
// 선택(TASK · Workspace)과 열린 팝업은 **여기 한 곳**이 갖는다 — 리스트 · 지도 · 팝업은 값을 받고 요청만 올린다(서로 상태를 되먹이지 않는다).
// TASK 를 고르면 그 TASK 를 담은 Workspace 로(지금 Workspace 가 이미 담으면 그대로), Workspace 를 고르면 그 중심 TASK 로(지금 TASK 가 담기면 그대로).
// 고른 문맥은 주소(map_task · ws)에 replaceState 로 실어 새로 고침 · 뒤로가기 · 학습 후 복귀에서 같은 문맥으로 돌아온다(정본 TASK id · 묶음 id).
// 판정은 하지 않는다 — composeV4 → ranksOf · goalCoverageLedger · taskInspector · workspaceRows 결과만 그린다. 퍼센트 · 숙달 막대 없음.
// 기하: 참조 3B Access map 의 「종류별 열」(spec.json — 노드 206×46 · 피치 272). 개요는 고른 영역 열만 노드 폭, view=full 은 모든 열 노드 폭 + 캔버스 안 가로 스크롤.

'use client'

import { Headphones, MoreVertical, Search, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'
import type { MapReturnCtx } from '@/lib/csat/map-return'
import { composeV4, confirmLinksOf } from '@/lib/csat/map/v4/compose'
import { taskOf, type Domain, type TaskId } from '@/lib/csat/map/v4/definition'
import { goalCoverageLedger } from '@/lib/csat/map/v62/coverage'
import { domainTaskGraph, taskInspector, type GraphTask } from '@/lib/csat/map/v62/graph'
import type { WorkspacePlan } from '@/lib/csat/map/v4/workspace'
import { ranksOf } from '@/lib/csat/map/v62/rank'
import { RETURN_NOTE_LABEL, returnNotes } from '@/lib/csat/map/v62/return-ctx'
import { taskForWs, workspaceRows, wsForTask, wsLinkOf, type WsLink } from '@/lib/csat/map/v62/workspace-list'

import { useGoal } from './GoalBar'
import { GoalRecordBar } from './GoalRecordBar'
import { MapDialog } from './MapDialog'
import { EVIDENCE_V62_LABEL, NEED_V62_LABEL, returnLinesFor, TaskInspector } from './TaskInspector'
import { TaskPopup } from './TaskPopup'
import u from './unified.module.css'
import { WorkspaceList } from './WorkspaceList'
import { WorkspaceModal, type WsTab } from './WorkspaceModal'

export type UnifiedMode = 'core' | 'full'

const FALLBACK_TASK: TaskId = 'r.central_meaning'

/**
 * 이 탭(브라우저 문서) 동안만 남는 지도 문맥 — 계획 저장 뒤 라우터 새로 고침으로 지도가 다시 올라올 때 열린 계획 모달을 잇는 데만 쓴다.
 * 고른 TASK · Workspace 는 주소(map_task · ws)가 정본이다.
 */
const SESSION_CTX: { selected: TaskId | null; ws: string | null; modal: { id: string; tab: WsTab } | null } = { selected: null, ws: null, modal: null }

/** 대표 학습 묶음을 고른 이유(계획 머리에 한 줄) — 약점 확정 문구가 아니다 */
const REASON_LABEL: Record<NonNullable<WorkspacePlan['reason']>, string> = {
  goal_need: '목표와 관련된 확인 · 학습 순서에서 가장 앞에 있어요.',
  verified_need: '직접 확인에서 연습이 필요하다고 나온 원리예요.',
  checking: '확인을 시작한 원리예요. 이어서 확인해요.',
  axis_check_first: '기출 기록에서 먼저 확인할 후보로 보인 영역이에요. 약점으로 정한 것은 아니에요.',
  available: '지금 바로 확인할 수 있는 묶음이에요. 결과를 보고 다음을 정해요.',
}

type WsSlug = 'central-meaning' | 'option-match' | 'evidence-locate' | 'cohesion'
/** 학습 묶음 id → 분석 이벤트의 닫힌 열거형(D3) */
export function wsSlug(id: string | null): WsSlug | null {
  const s = id?.replace(/^ws\./, '') ?? null
  return s === 'central-meaning' || s === 'option-match' || s === 'evidence-locate' || s === 'cohesion' ? s : null
}

export function UnifiedLearningMap({ data, mode, recordHref, asOf, restore = null, viewToggle = null }: { data: MapPageData; mode: UnifiedMode; recordHref: string; asOf?: string; restore?: MapReturnCtx | null; viewToggle?: ReactNode }) {
  const g = useGoal(data)
  const goalSet = data.model.goalSet || g.saved
  const view = useMemo(() => composeV4(data, { score: g.goal, set: goalSet }, asOf), [data, g.goal, goalSet, asOf])
  const graph = useMemo(() => domainTaskGraph(), [])
  const ranks = useMemo(() => (view ? ranksOf(view) : null), [view])
  const rows = useMemo(() => (view ? workspaceRows(view) : []), [view])
  const ledger = useMemo(() => {
    if (!view) return null
    const confirmItems = Object.fromEntries(Object.entries(confirmLinksOf(data)).map(([k, l]) => [k, l.length]))
    // 시험 카탈로그 대조는 서버 실측(scripts/csat/map/v62/product-availability)에서 — 화면은 대조 전이면 unknown 으로 둔다(0 · 100 아님)
    return goalCoverageLedger({ view, exams: [], confirmItems, transferItems: data.v4?.transferItems ?? {} })
  }, [view, data])

  // 처음 고를 TASK — 복귀한 TASK(정의에 있을 때만) → 이 탭에서 방금 보던 TASK → 지금 할 수 있는 첫 행동 → 첫 학습 요구 → 글의 핵심
  const known = (id: string | null | undefined) => (id && graph.tasks.some((t) => t.id === id) ? (id as TaskId) : null)
  const initial = useMemo<TaskId>(
    () => known(restore?.mapTask) ?? known(SESSION_CTX.selected) ?? ranks?.actionRank[0]?.task ?? ranks?.needRank[0]?.task ?? FALLBACK_TASK,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restore?.mapTask, graph.tasks, ranks],
  )
  const [selected, setSelected] = useState<TaskId>(initial)
  // 처음 Workspace — 복귀 문맥의 묶음(리스트에 있고 고른 TASK 를 담을 때) → 탭 기억 → 고른 TASK 의 묶음
  const [ws, setWs] = useState<string | null>(() => {
    const has = (id: string | null | undefined) => (id && rows.some((r) => r.id === id) ? id : null)
    return wsForTask(rows, initial, has(restore?.ws) ?? (restore?.mapTask ? null : has(SESSION_CTX.ws)))
  })
  const [focus, setFocus] = useState<Domain | null>(() => (mode === 'full' ? null : taskOf(initial).axis))
  const [query, setQuery] = useState('')
  const [pop, setPop] = useState(false)
  const [drawer, setDrawer] = useState(false)
  // 초점(3B Access map 「Click to focus」) — 처음엔 꺼져 지도 전체가 선명하다. 노드 · Workspace 를 고르면 켜지고(관련만 선명 · 나머지 흐림) Esc 로 끈다.
  // 복귀 문맥(map_task · ws)으로 들어오면 켠 채로 시작한다(떠날 때 보던 초점)
  const [lit, setLit] = useState<boolean>(() => !!(restore?.mapTask || restore?.ws))
  // 열린 계획 모달 — ① 학습 뒤 복귀(저장 계획 문맥 ws + map_plan)면 그 묶음의 계획 탭을 다시 연다(옛 「계획 열림」 복귀 계약)
  //   ② 계획 저장 뒤 서버가 화면을 다시 그리면 열려 있던 모달을 잇는다. 주소의 map_task · ws 만으로는(새로 고침) 열지 않는다
  const [modal, setModal] = useState<{ id: string; tab: WsTab } | null>(() => {
    if (restore?.ws && restore.mapPlan && view?.plans[restore.ws]) return { id: restore.ws, tab: 'plan' }
    return !restore?.mapPlan && SESSION_CTX.modal && view?.plans[SESSION_CTX.modal.id] ? SESSION_CTX.modal : null
  })
  const opener = useRef<HTMLElement | null>(null)

  const rank = new Map(ranks?.actionRank.slice(0, 3).map((e, i) => [e.task, i + 1]) ?? [])
  const needOf = new Map(ranks?.needRank.map((e) => [e.task, e]) ?? [])
  const row = ws ? rows.find((r) => r.id === ws) ?? null : null

  // 고른 문맥 → 탭 기억 · 주소(replaceState — 새로 고침 · 뒤로가기에서 같은 문맥). 다른 쿼리(tab · view · asof)는 그대로 둔다
  useEffect(() => {
    SESSION_CTX.selected = selected
    SESSION_CTX.ws = ws
    SESSION_CTX.modal = modal
    const url = new URL(window.location.href)
    // 복귀 링크의 일회성 문맥(저장 계획 · 목표 버전 · 학습자 묶음 UUID)은 처음 그릴 때 한 번 쓰고 지운다 — 새로 고침마다 계획 모달 · 알림이 다시 뜨지 않게
    for (const k of ['map_ws', 'map_plan', 'map_goal']) url.searchParams.delete(k)
    // 초점이 있을 때만 주소에 싣는다 — 고르지 않은 처음 화면을 새로 고쳐도 초점이 저절로 켜지지 않게
    if (lit) url.searchParams.set('map_task', selected)
    else url.searchParams.delete('map_task')
    if (lit && ws) url.searchParams.set('ws', ws)
    else url.searchParams.delete('ws')
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.href)
  }, [selected, ws, modal, lit])
  // 지도 진입(목표 점수만 — 숫자) · TASK 열기(닫힌 열거형). 옛 지도가 보내던 계측을 그대로 잇는다(D2 · D3)
  useEffect(() => {
    track({ name: 'csat_map_viewed', props: { goal: goalSet ? g.goal : 0 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** TASK 고르기 — 초점을 켠다(팝업은 openPop 일 때만). Workspace 는 이 TASK 를 담는 것으로(지금 것이 담으면 그대로 — 튀지 않게) */
  const chooseTask = (id: TaskId, openPop = false) => {
    if (id !== selected) track({ name: 'csat_map_node_opened', props: { kind: 'task' } })
    setLit(true)
    setSelected(id)
    setWs((cur) => wsForTask(rows, id, cur))
    if (mode !== 'full') setFocus(taskOf(id).axis)
    setPop(openPop)
  }
  /** Workspace 고르기 — 지도에 중심 · 지원 TASK 를 강조. TASK 는 지금 것이 담기면 그대로, 아니면 첫 중심 TASK(팝업은 닫는다) */
  const chooseWs = (id: string) => {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    setLit(true)
    setWs(id)
    const t = taskForWs(r, selected)
    if (t && t !== selected) {
      setSelected(t)
      if (mode !== 'full') setFocus(taskOf(t).axis)
    }
    setPop(false)
  }
  const openWs = (id: string, from: HTMLElement | null, tab: WsTab = 'overview') => {
    opener.current = from
    chooseWs(id)
    setModal({ id, tab })
  }
  const closePop = useCallback((restoreFocus: boolean) => {
    setPop(false)
    if (restoreFocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-node="${CSS.escape(selected)}"]`)?.focus())
  }, [selected])
  const closeModal = useCallback(() => {
    setModal(null)
    const back = opener.current
    requestAnimationFrame(() => back?.isConnected && back.focus())
  }, [])
  // Esc — 열린 팝업 · 모달 · 드로어가 없을 때 초점을 끈다(3B 와 같은 해제)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pop || drawer || modal || document.querySelector('[aria-modal="true"], [data-testid="goal-popover"]')) return
      setLit(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pop, drawer, modal])
  const closeDrawer = useCallback(() => {
    setDrawer(false)
    const back = opener.current
    requestAnimationFrame(() => back?.isConnected && back.focus())
  }, [])

  // 대표 학습 묶음 노출 — 묶음 · 이유가 바뀔 때만(기존 NeedPanel 과 같은 이벤트)
  const primaryWs = wsSlug(view?.plan.primary?.id ?? null)
  const primaryReason = view?.plan.reason ?? null
  useEffect(() => {
    if (!view) return
    track({ name: 'csat_workspace_opened', props: { workspace: primaryWs ?? 'none', reason: primaryReason ?? 'none', goal_set: goalSet } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWs, primaryReason, goalSet, view !== null])

  const q = query.trim()
  const matches = q ? new Set(graph.tasks.filter((t) => t.name.includes(q) || t.id.includes(q.toLowerCase()) || t.display.toLowerCase() === q.toLowerCase()).map((t) => t.id)) : null

  // 관계선 — 노드 중심 좌표를 재서 그린다. 평소엔 승인 관계만 희미하게. 진하게: 고른 TASK 의 관계 + 고른 Workspace 안의 TASK 끼리 관계
  const canvasRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<{ id: string; d: string; approval: 'approved' | 'proposed'; active: boolean }[]>([])
  const wsSet = useMemo(() => new Set<string>(lit && row ? [...row.core, ...row.support] : []), [row, lit])
  // 초점일 때 선명하게 남길 TASK — 고른 TASK · 그와 관계선으로 이어진 TASK · 고른 Workspace 의 TASK(나머지는 흐림 · 숨기지 않음)
  const related = useMemo(() => {
    if (!lit) return null
    const out = new Set<string>([selected, ...wsSet])
    for (const e of graph.edges) {
      if (e.from === selected) out.add(e.to)
      if (e.to === selected) out.add(e.from)
    }
    return out
  }, [lit, selected, wsSet, graph.edges])
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const draw = () => {
      const box = el.getBoundingClientRect()
      const at = (id: string) => {
        const n = el.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)
        if (!n) return null
        const r = n.getBoundingClientRect()
        return { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height / 2 }
      }
      const out: typeof lines = []
      for (const e of graph.edges) {
        const active = lit && (e.from === selected || e.to === selected || (wsSet.has(e.from) && wsSet.has(e.to)))
        if (!active && e.approval !== 'approved') continue
        const a = at(e.from)
        const b = at(e.to)
        if (!a || !b) continue
        // 같은 열 안의 연결은 열 오른쪽으로 둥글게, 다른 열은 가까운 변끼리
        const same = Math.abs(a.l - b.l) < 4
        const d = same
          ? `M ${a.r} ${a.y} C ${a.r + 22} ${a.y}, ${b.r + 22} ${b.y}, ${b.r} ${b.y}`
          : a.l < b.l
            ? `M ${a.r} ${a.y} C ${(a.r + b.l) / 2} ${a.y}, ${(a.r + b.l) / 2} ${b.y}, ${b.l} ${b.y}`
            : `M ${a.l} ${a.y} C ${(a.l + b.r) / 2} ${a.y}, ${(a.l + b.r) / 2} ${b.y}, ${b.r} ${b.y}`
        out.push({ id: e.id, d, approval: e.approval, active })
      }
      setLines(out)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [graph.edges, selected, wsSet, lit, focus, mode, q])

  if (!view || !ranks) return null
  const ins = taskInspector(selected, view, ranks, ledger)
  // 돌아온 문맥 vs 지금 저장 상태 — 바뀐 점만 알린다(옛 계획 · Workspace 를 되살리지 않는다)
  const notes = returnNotes(data.v4?.saved, restore)
  const past = view.asIs.mode === 'past_reanalysis'
  const modalRow = modal ? rows.find((r) => r.id === modal.id) ?? null : null
  const anchor = pop && typeof document !== 'undefined' ? document.querySelector<HTMLElement>(`[data-node="${CSS.escape(selected)}"]`) : null

  return (
    <div className={u.wrap} data-testid="unified-map" data-mode={mode} data-selected={selected} data-ws={ws ?? ''} data-lit={lit} data-goal-set={goalSet}>
      <GoalRecordBar data={data} g={g} goalSet={goalSet} asIs={view.asIs} view={view} ranks={ranks} recordHref={recordHref} past={past} currentHref={`${recordHref.split('?')[0]}?tab=map${mode === 'full' ? '&view=full' : ''}`} onSelect={(id) => chooseTask(id, false)} selected={selected} onOpenWs={(id, tab) => openWs(id, null, tab)} />

      <section className={u.canvasCard} aria-labelledby="umap-h">
        <div className={u.canvasHead}>
          <h2 id="umap-h" className={u.h}>학습지도</h2>
          <p className={u.headNote}>
            영역 6 · TASK {graph.counts.tasks}(측정 중 {graph.counts.nonHold} · 보류 {graph.counts.hold}) · 번호 = 먼저 볼 순서
            <a href="#ws-h" className={u.wsJump} data-testid="umap-ws-jump" onClick={(e) => {
              e.preventDefault()
              const heading = document.getElementById('ws-h')
              heading?.scrollIntoView({ block: 'center' })
              heading?.focus({ preventScroll: true })
            }}>Workspace {rows.length}개 ↓</a>
          </p>
          <label className={u.search}>
            <Search size={14} strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">TASK 찾기</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="TASK 이름 · 기호(R5)" aria-label="TASK 찾기" data-testid="umap-search" />
          </label>
          {viewToggle}
        </div>
        {notes.length > 0 && (
          <ul className={u.returnNote} data-testid="umap-return-note" role="status">
            {notes.map((n) => <li key={n.kind} data-kind={n.kind}>{RETURN_NOTE_LABEL[n.kind]}</li>)}
          </ul>
        )}
        {past && <p className={u.pastNote} data-testid="umap-past">과거 기준({view.asIs.asOf.slice(0, 10)})으로 다시 분석한 지도예요 — 보기 전용이고 학습 활동은 지금 기준에서 해요.</p>}

        <div className={u.mapStage}>
        <div className={u.canvas} data-focus={focus ?? 'all'} data-mode={mode} data-lit={lit} data-testid="umap-canvas">
         <div ref={canvasRef} className={u.inner}>
          <svg className={u.lines} aria-hidden="true">
            {lines.map((l) => (
              <path key={l.id} d={l.d} className={u.line} data-approval={l.approval} data-active={l.active} />
            ))}
          </svg>
          <div className={u.cols} data-mode={mode}>
            {graph.domains.map((d) => {
              const wide = mode === 'full' || focus === d.id
              return (
                <section key={d.id} className={u.col} data-domain={d.id} data-wide={wide} data-hold={d.hold} aria-label={`${d.id} ${d.name}`}>
                  <button type="button" className={u.colHead} onClick={() => setFocus(focus === d.id && mode !== 'full' ? null : d.id)} aria-pressed={wide} data-testid="umap-domain" title={`${d.id} ${d.name} — ${d.question}`}>
                    <span className={u.colCode}>{d.id}</span>
                    <span className={u.colName}>{d.name}</span>
                    {d.hold ? (
                      <span className={u.colTag}>
                        {d.id === 'L' ? <Headphones size={12} aria-hidden="true" /> : <Timer size={12} aria-hidden="true" />}
                        보류
                      </span>
                    ) : (
                      <span className={u.colTag}>{d.tasks.length}</span>
                    )}
                  </button>
                  <ul className={u.nodes}>
                    {d.tasks.map((id) => (
                      <li key={id}>
                        <Node
                          t={graph.tasks.find((x) => x.id === id)!}
                          wide={wide}
                          selected={lit && selected === id}
                          order={rank.get(id) ?? null}
                          link={lit && row ? wsLinkOf(row, id) : null}
                          faded={related !== null && !related.has(id)}
                          dim={matches !== null && !matches.has(id)}
                          need={needOf.get(id)?.need ?? null}
                          evidence={EVIDENCE_V62_LABEL[taskInspector(id, view, ranks, null).now.evidence]}
                          // 3B 와 같이 첫 누름 = 초점, 초점 잡힌 TASK 를 다시 누르면 빠른 팝업(여닫기)
                          onClick={() => (lit && selected === id ? (pop ? closePop(false) : setPop(true)) : chooseTask(id))}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
         </div>
        </div>
        {/* 3B Access map 의 떠 있는 알약 — 왼쪽 아래: 안내(초점 없음) / 고른 TASK 요약(초점) · 오른쪽 아래: 범례 */}
        {lit ? (
          <div className={u.dockL} data-testid="umap-dock" data-task={selected}>
            <span className={u.dockCode}>{ins.task.display}</span>
            <span className={u.dockName}>{ins.task.name.replace(/\(통합 관찰\)$/, '')}</span>
            <span className={u.dockSub}>{EVIDENCE_V62_LABEL[ins.now.evidence]}{row ? ` · ${row.name}` : ''}</span>
            <button type="button" className={u.dockBtn} onClick={() => setPop((v) => !v)} aria-expanded={pop} aria-haspopup="dialog" data-testid="umap-dock-more" aria-label="이 TASK 자세히" title="자세히">
              <MoreVertical size={14} aria-hidden="true" />
            </button>
            <button type="button" className={u.dockBtn} onClick={() => { setPop(false); setLit(false) }} data-testid="umap-dock-clear" aria-label="초점 해제" title="초점 해제(Esc)">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className={u.dockL} data-testid="umap-dock-help">TASK 를 누르면 초점 · 다시 누르면 자세히 · Esc 해제</p>
        )}
        <p className={u.dockR} data-testid="umap-legend">
          <span className={u.lgItem}><span className={u.lgOrder} aria-hidden="true">1</span>먼저 볼 순서</span>
          <span className={u.lgItem}><span className={u.lgCore} aria-hidden="true" />중심</span>
          <span className={u.lgItem}><span className={u.lgSupport} aria-hidden="true" />지원</span>
          <span className={u.lgItem}><span className={u.lgSolid} aria-hidden="true" />구성 연결</span>
          <span className={u.lgItem}><span className={u.lgDash} aria-hidden="true" />연구 중</span>
          <span className={u.lgItem}><span className={u.lgInt} aria-hidden="true" />통합 관찰</span>
        </p>
        </div>
      </section>

      <WorkspaceList
        rows={rows}
        ranks={ranks}
        data={data}
        past={past}
        selectedTask={lit ? selected : null}
        selectedWs={lit ? ws : null}
        onSelectWs={(id) => {
          const chosen = rows.find((r) => r.id === id)
          const target = chosen ? taskForWs(chosen, selected) : null
          chooseWs(id)
          if (target) requestAnimationFrame(() => {
            const node = document.querySelector<HTMLElement>(`[data-node="${CSS.escape(target)}"]`)
            node?.scrollIntoView({ block: 'center', inline: 'nearest' })
            node?.focus({ preventScroll: true })
          })
        }}
        onOpenWs={(id, el) => openWs(id, el)}
        onSelectTask={(id) => chooseTask(id, true)}
      />

      {pop && anchor && (
        <TaskPopup
          ins={ins}
          anchor={anchor}
          rows={rows}
          selectedWs={ws}
          data={data}
          past={past}
          goalSet={!!view.toBe}
          evidence={view.evidence?.[ins.task.id]}
          onClose={closePop}
          onSelectWs={(id) => {
            chooseWs(id)
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="ws-row"][data-ws="${CSS.escape(id)}"] [data-testid="ws-select"]`)?.focus())
          }}
          onDetail={() => {
            opener.current = anchor
            setPop(false)
            setDrawer(true)
          }}
        />
      )}

      {drawer && (
        <MapDialog kind="drawer" labelledBy="ins-h" testId="ins-drawer" onClose={closeDrawer} head={<span className={u.drawerHead}>자세한 근거 · 학습 경로</span>}>
          <TaskInspector
            ins={ins}
            view={view}
            data={data}
            past={past}
            restoreWs={ws}
            planOpen={false}
            returned={restore?.mapTask === selected ? notes : null}
            onTogglePlan={(id) => {
              setDrawer(false)
              openWs(id, opener.current, 'plan')
            }}
          />
        </MapDialog>
      )}

      {modal && modalRow && (
        <WorkspaceModal
          row={modalRow}
          view={view}
          data={data}
          past={past}
          goal={g.goal}
          reason={modalRow.id === view.plan.primary?.id && view.plan.reason ? REASON_LABEL[view.plan.reason] : null}
          tab={modal.tab}
          onTab={(tab) => setModal({ id: modalRow.id, tab })}
          returned={restore?.mapTask && (modalRow.core.includes(restore.mapTask as TaskId) || modalRow.support.includes(restore.mapTask as TaskId)) ? { task: restore.mapTask as TaskId, lines: returnLinesFor(restore.mapTask as TaskId, view, data, modalRow.id, notes) } : null}
          onClose={closeModal}
          onPickTask={(id) => {
            setModal(null)
            chooseTask(id)
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
          }}
        />
      )}
    </div>
  )
}

function Node({ t, wide, selected, order, link, faded, dim, need, evidence, onClick }: { t: GraphTask; wide: boolean; selected: boolean; order: number | null; link: WsLink | null; faded: boolean; dim: boolean; need: string | null; evidence: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={u.node}
      data-node={t.id}
      data-kind={t.kind}
      data-hold={t.hold}
      data-check={t.directCheck}
      data-selected={selected}
      data-priority={order !== null}
      data-link={link ?? 'none'}
      data-faded={faded}
      data-dim={dim}
      data-testid="umap-node"
      aria-pressed={selected}
      aria-haspopup="dialog"
      aria-label={`${t.display} ${t.name} — ${evidence}${need ? ` · ${NEED_V62_LABEL[need as keyof typeof NEED_V62_LABEL] ?? ''}` : ''}${order ? ` · 먼저 볼 순서 ${order}` : ''}${link ? ` · 고른 Workspace 의 ${link === 'core' ? '중심' : '지원'} TASK` : ''} · ${selected ? '다시 누르면 자세히 · Esc 초점 해제' : '누르면 초점 · 다시 누르면 자세히'}`}
      onClick={onClick}
    >
      <span className={u.nodeName}>
        <span className={u.nodeCode}>{t.display}</span>{' '}{t.name.replace(/\(통합 관찰\)$/, '')}</span>
      {wide && <span className={u.nodeState}>{t.hold ? '보류 · 측정 방법 정하는 중' : evidence}</span>}
      {order !== null && <span className={u.nodeOrder} aria-hidden="true">{order}</span>}
      {selected && <span className={u.nodeMore} data-testid="node-more" aria-hidden="true"><MoreVertical size={12} /></span>}
    </button>
  )
}
