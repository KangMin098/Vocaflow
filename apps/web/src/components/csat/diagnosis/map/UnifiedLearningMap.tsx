// apps/web/src/components/csat/diagnosis/map/UnifiedLearningMap.tsx
//
// 학습지도 v6.2 단일 지도(§9) — `/csat` 홈 · `?tab=map` · `?tab=map&view=full` 이 모두 이 화면 하나를 쓴다(교육 그래프 · 판정 출처 하나).
//   ① 상단 목표 · 기록   ② 관계도 캔버스(6영역 열 · TASK 30 · 관계선)   ③ TASK Inspector(오른쪽 · 다음 한 행동 고정)
// 판정은 하지 않는다 — composeV4(As-Is · To-Be · Workspace · 계획) → v62 ranksOf · goalCoverageLedger · taskInspector 결과만 그린다.
// 기하: 참조 3B Access map 의 「종류별 열」(spec.json — 노드 206×46 · 피치 272)을 영역 열로. 1440 에서 6열 × 272 + Inspector 를
// 억지로 누르지 않는다 — 개요는 6열을 균등 압축(이름만), 고른 영역 열만 노드 폭 206 으로 넓힌다(같은 캔버스의 상태). view=full 은
// 모든 열을 206 으로 펼치고 캔버스 안에서만 가로로 스크롤한다(페이지 가로 넘침 없음).
// 문구: 근거 부족 · 미측정 · 보류 · 콘텐츠 준비 중을 서로 다른 말로. 지원 공백은 학생의 실패가 아니다. 퍼센트 · 숙달 막대 없음.

'use client'

import { Headphones, Search, Timer } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'
import type { MapReturnCtx } from '@/lib/csat/map-return'
import { composeV4, confirmLinksOf } from '@/lib/csat/map/v4/compose'
import { taskOf, type Domain, type TaskId } from '@/lib/csat/map/v4/definition'
import { goalCoverageLedger } from '@/lib/csat/map/v62/coverage'
import { domainTaskGraph, taskInspector, type GraphTask } from '@/lib/csat/map/v62/graph'
import type { WorkspacePlan } from '@/lib/csat/map/v4/workspace'
import { ranksOf } from '@/lib/csat/map/v62/rank'

import { useGoal } from './GoalBar'
import { GoalRecordBar } from './GoalRecordBar'
import { PlanSection } from './PlanSection'
import { EVIDENCE_V62_LABEL, NEED_V62_LABEL, TaskInspector, homeWsOf } from './TaskInspector'
import u from './unified.module.css'

export type UnifiedMode = 'core' | 'full'

const FALLBACK_TASK: TaskId = 'r.central_meaning'

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
  const ledger = useMemo(() => {
    if (!view) return null
    const confirmItems = Object.fromEntries(Object.entries(confirmLinksOf(data)).map(([k, l]) => [k, l.length]))
    // 시험 카탈로그 대조는 서버 실측(scripts/csat/map/v62/product-availability)에서 — 화면은 대조 전이면 unknown 으로 둔다(0 · 100 아님)
    return goalCoverageLedger({ view, exams: [], confirmItems, transferItems: data.v4?.transferItems ?? {} })
  }, [view, data])

  // 처음 고를 TASK — 복귀한 TASK(정의에 있을 때만) → 지금 할 수 있는 첫 행동 → 첫 학습 요구 → 글의 핵심
  const initial = useMemo<TaskId>(() => {
    const back = restore?.mapTask && graph.tasks.some((t) => t.id === restore.mapTask) ? restore.mapTask : null
    return back ?? ranks?.actionRank[0]?.task ?? ranks?.needRank[0]?.task ?? FALLBACK_TASK
  }, [restore?.mapTask, graph.tasks, ranks])
  const [selected, setSelected] = useState<TaskId>(initial)
  const [focus, setFocus] = useState<Domain | null>(() => (mode === 'full' ? null : taskOf(initial).axis))
  const [query, setQuery] = useState('')
  // 열린 학습계획 — 문항에서 돌아오면(복귀 문맥 ws) 그 묶음 계획을 다시 연다
  const [planWs, setPlanWs] = useState<string | null>(() => (restore?.ws && view?.plans[restore.ws] ? restore.ws : null))

  const priority = new Set(ranks?.actionRank.slice(0, 3).map((e) => e.task) ?? [])
  const needOf = new Map(ranks?.needRank.map((e) => [e.task, e]) ?? [])
  // 지도 진입(목표 점수만 — 숫자) · TASK 열기(닫힌 열거형). 옛 지도가 보내던 계측을 그대로 잇는다(D2 · D3)
  useEffect(() => {
    track({ name: 'csat_map_viewed', props: { goal: goalSet ? g.goal : 0 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const choose = (id: TaskId) => {
    if (id !== selected) track({ name: 'csat_map_node_opened', props: { kind: 'task' } })
    setSelected(id)
    if (mode !== 'full') setFocus(taskOf(id).axis)
  }
  // 대표 학습 묶음 노출 — 묶음 · 이유가 바뀔 때만(목표를 바꿔 같은 묶음이 다시 계산될 때마다 세지 않는다 · 기존 NeedPanel 과 같은 이벤트)
  const primaryWs = wsSlug(view?.plan.primary?.id ?? null)
  const primaryReason = view?.plan.reason ?? null
  useEffect(() => {
    if (!view) return
    track({ name: 'csat_workspace_opened', props: { workspace: primaryWs ?? 'none', reason: primaryReason ?? 'none', goal_set: goalSet } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWs, primaryReason, goalSet, view !== null])

  const q = query.trim()
  const matches = q ? new Set(graph.tasks.filter((t) => t.name.includes(q) || t.id.includes(q.toLowerCase()) || t.display.toLowerCase() === q.toLowerCase()).map((t) => t.id)) : null

  // 관계선 — 노드 중심 좌표를 재서 그린다. 평소엔 승인 관계만 희미하게, 고른 TASK 의 관계(승인 실선 · 제안 점선)만 진하게
  const canvasRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<{ id: string; d: string; approval: 'approved' | 'proposed'; active: boolean }[]>([])
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
        const active = e.from === selected || e.to === selected
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
  }, [graph.edges, selected, focus, mode, q])

  if (!view || !ranks) return null
  const ins = taskInspector(selected, view, ranks, ledger)
  const past = view.asIs.mode === 'past_reanalysis'

  return (
    <div className={u.wrap} data-testid="unified-map" data-mode={mode} data-selected={selected} data-goal-set={goalSet}>
      <GoalRecordBar data={data} g={g} goalSet={goalSet} asIs={view.asIs} recordHref={recordHref} />

      <div className={u.body}>
        <section className={u.canvasCard} aria-labelledby="umap-h">
          <div className={u.canvasHead}>
            <h2 id="umap-h" className={u.h}>영역과 TASK 관계도</h2>
            <p className={u.headNote}>
              영역 6 · TASK {graph.counts.tasks}(측정 중 {graph.counts.nonHold} · 보류 {graph.counts.hold}). 칸을 누르면 오른쪽에 그 TASK 의 근거 · 기출 · 학습 계획이 열려요.
            </p>
            <label className={u.search}>
              <Search size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className="sr-only">TASK 찾기</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="TASK 이름 · 기호(R5)" aria-label="TASK 찾기" data-testid="umap-search" />
            </label>
            {viewToggle}
          </div>
          {past && <p className={u.pastNote} data-testid="umap-past">과거 기준({view.asIs.asOf.slice(0, 10)})으로 다시 분석한 지도예요 — 보기 전용이고 학습 활동은 지금 기준에서 해요.</p>}

          <div className={u.canvas} data-focus={focus ?? 'all'} data-mode={mode} data-testid="umap-canvas">
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
                    <button type="button" className={u.colHead} onClick={() => setFocus(focus === d.id && mode !== 'full' ? null : d.id)} aria-pressed={wide} data-testid="umap-domain" title={d.question}>
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
                          <Node t={graph.tasks.find((x) => x.id === id)!} wide={wide} selected={selected === id} priority={priority.has(id)} dim={matches !== null && !matches.has(id)} need={needOf.get(id)?.need ?? null} evidence={EVIDENCE_V62_LABEL[taskInspector(id, view, ranks, null).now.evidence]} onClick={() => choose(id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
           </div>
          </div>
          <p className={u.legend}>
            <span className={u.lgSolid} aria-hidden="true" /> 구성 연결(승인) <span className={u.lgDash} aria-hidden="true" /> 연결 연구 중(제안 · 순서 강제 아님) <span className={u.lgInt} aria-hidden="true" /> 통합 관찰(점수 평균 없음)
          </p>
          {planWs && view.plans[planWs] && (
            <div id="umap-plan" className={u.planBox} data-testid="umap-plan" data-ws={planWs}>
              <PlanSection view={view.plans[planWs]} reason={planWs === view.plan.primary?.id && view.plan.reason ? REASON_LABEL[view.plan.reason] : null} past={past} saved={data.v4?.saved ?? null} viewer={data.v4?.viewer ?? 'anon'} goal={g.goal} />
            </div>
          )}
        </section>

        <TaskInspector
          ins={ins}
          view={view}
          data={data}
          past={past}
          restoreWs={restore?.ws ?? null}
          planOpen={planWs !== null && planWs === homeWsOf(selected, view, restore?.ws ?? null)}
          onTogglePlan={(ws) => {
            setPlanWs((cur) => (cur === ws ? null : ws))
            // 열면 편집 칸으로 — 관계도 아래(같은 열)
            requestAnimationFrame(() => document.getElementById('umap-plan')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
          }}
        />
      </div>
    </div>
  )
}

function Node({ t, wide, selected, priority, dim, need, evidence, onClick }: { t: GraphTask; wide: boolean; selected: boolean; priority: boolean; dim: boolean; need: string | null; evidence: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={u.node}
      data-node={t.id}
      data-kind={t.kind}
      data-hold={t.hold}
      data-check={t.directCheck}
      data-selected={selected}
      data-priority={priority}
      data-dim={dim}
      data-testid="umap-node"
      aria-pressed={selected}
      aria-label={`${t.display} ${t.name} — ${evidence}${need ? ` · ${NEED_V62_LABEL[need as keyof typeof NEED_V62_LABEL] ?? ''}` : ''}`}
      onClick={onClick}
    >
      <span className={u.nodeName}>
        <span className={u.nodeCode}>{t.display}</span>{' '}{t.name.replace(/\(통합 관찰\)$/, '')}</span>
      {wide && <span className={u.nodeState}>{t.hold ? '보류 · 측정 방법 정하는 중' : evidence}</span>}
      {priority && <span className={u.nodeDot} aria-hidden="true" />}
    </button>
  )
}
