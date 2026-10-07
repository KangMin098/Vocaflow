// apps/web/src/components/csat/diagnosis/map/LearningMap.tsx
//
// 내 진단 「학습 지도」 기존 상세 보기(?view=full) — 최종 목표 | 핵심 능력 | 측정 정보 | 문항 특성 | 학습 · 행동 | 실전 · 상황.
// 종류마다 한 열(참조 3B Access map 의 종류별 열 · spec.json layout, 2026-10-07): 영역 노드는 자기 열 묶음의 머리, 라인은 그 아래.
// 같은 열 안의 영역 → 라인 연결은 열 묶음이 대신하므로 선을 그리지 않는다(경로 강조 계산에는 그대로 쓴다).
// 근거 원리(P) · 접근 트랙(T)은 학생 숙달 노드가 아니라 노드로 그리지 않는다 — 팝업 「근거」 탭에만(2026-10-03 결정).
// 막대(관찰값 채움 + 목표율 눈금)는 역량(A) 노드에만 — 문항유형 · 선지 함정 · 행동 · 방법은 역할만 보인다(목표 100% 개념 없음).
// 상태는 글자로도 보인다. 노드를 누르면 연결 경로만 강조하고
// 오른쪽 팝업(NodePopup) 하나가 열린다. 연결선: 직접 근거(실선) · 추론(파선) · 보류(점선).
// 같은 정보를 두 곳에 두지 않는다 — 근거 문장 · 과제 · 출처는 팝업에만.

'use client'

import { Layers, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'
import { AXIS_ROLE, LAYER_COLUMNS, layerIndexOf, roleOf } from '@/lib/csat/map/core'
import { pathOf } from '@/lib/csat/map/graph'
import type { MapNodeRow, MapSettings, NodeValue } from '@/lib/csat/map/model'

import { obsLabel, pct } from './format'
import s from './map.module.css'
import { NodePopup, tileClass } from './NodePopup'


interface DrawnEdge {
  id: number
  d: string
  basis: 'direct' | 'inferred' | 'pending'
}

export function LearningMap({ data }: { data: MapPageData }) {
  const router = useRouter()
  const { model, nodes, edges } = data
  const [selected, setSelected] = useState<string | null>(null)
  /** 팝업 열림 — 닫아도 선택(경로 강조)은 남는다 */
  const [open, setOpen] = useState(false)
  /** 접기 — 선택한 경로의 노드만 보인다 */
  const [collapsed, setCollapsed] = useState(false)
  const [done, setDone] = useState<Set<string>>(() => new Set(data.doneTaskIds))
  const [taskErr, setTaskErr] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    track({ name: 'csat_map_viewed', props: { goal: model.goal } })
    // 진입 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 열 구성 ──
  const byKind = useMemo(() => {
    const pick = (k: MapNodeRow['kind']) => nodes.filter((n) => n.kind === k)
    const axes = pick('axis')
    const lines = pick('line')
    // 열마다 [영역 머리 + 그 라인] 묶음 — 영역 순서는 DB sort 그대로
    const layers = LAYER_COLUMNS.map((col, i) => ({
      col,
      groups: axes.filter((a) => layerIndexOf(a.code) === i).map((a) => ({ axis: a, lines: lines.filter((l) => l.axis === a.code) })),
    }))
    return { goal: pick('goal')[0], axes, lines, layers }
  }, [nodes])

  // ── 연결선 위치(노드 실측) ──
  const stageRef = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLElement>())
  const [drawn, setDrawn] = useState<DrawnEdge[]>([])
  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const base = stage.getBoundingClientRect()
    const out: DrawnEdge[] = []
    for (const e of edges) {
      // 같은 열 안의 영역 → 라인(member)은 열 묶음으로 보인다 — 선은 목표 → 영역만
      if (e.kind !== 'goal') continue
      const a = els.current.get(e.from_code)
      const b = els.current.get(e.to_code)
      if (!a || !b) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const x1 = ra.right - base.left
      const y1 = ra.top - base.top + ra.height / 2
      const x2 = rb.left - base.left
      const y2 = rb.top - base.top + rb.height / 2
      const c = (x2 - x1) / 2
      out.push({ id: e.id, basis: e.basis, d: `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}` })
    }
    setDrawn(out)
  }, [edges])
  useLayoutEffect(() => {
    measure()
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, model, collapsed, selected])
  const register = (code: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(code, el)
    else els.current.delete(code)
  }

  const path = useMemo(() => (selected ? pathOf(selected, edges.filter((e) => e.kind === 'goal' || e.kind === 'member').map((e) => ({ id: e.id, from: e.from_code, to: e.to_code }))) : null), [selected, edges])

  const choose = (code: string) => {
    setTaskErr(null)
    if (selected === code && !open) {
      setSelected(null)
      setCollapsed(false)
      return
    }
    setSelected(code)
    setOpen(true)
    const kind = nodes.find((n) => n.code === code)?.kind
    if (kind) track({ name: 'csat_map_node_opened', props: { kind } })
  }
  const clearSelection = () => {
    setSelected(null)
    setOpen(false)
    setCollapsed(false)
  }
  const summary = useMemo(() => {
    if (!selected || !path) return null
    const n = nodes.find((x) => x.code === selected)
    if (!n) return null
    const count = (k: MapNodeRow['kind']) => nodes.filter((x) => x.kind === k && path.nodes.has(x.code) && x.code !== selected).length
    const parts = [`영역 ${count('axis')}`, `라인 ${count('line')}`]
    return { code: n.code, name: n.name, kind: n.kind, track: n.kind === 'track' ? n.code : n.track, counts: parts.join(' · ') }
  }, [selected, path, nodes])
  const isHidden = (code: string) => collapsed && Boolean(path) && !path?.nodes.has(code)

  // ── 과제 체크(낙관적 갱신 · 실패하면 되돌림) ──
  const toggleTask = async (taskId: string, next: boolean) => {
    setTaskErr(null)
    setDone((prev) => {
      const n = new Set(prev)
      if (next) n.add(taskId)
      else n.delete(taskId)
      return n
    })
    try {
      const res = await fetch(`/api/csat/diagnosis/map/tasks/${encodeURIComponent(taskId)}`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장하지 못했어요')
      track({ name: 'csat_map_task_toggled', props: { done: next } })
      startTransition(() => router.refresh())
    } catch (e) {
      setDone((prev) => {
        const n = new Set(prev)
        if (next) n.delete(taskId)
        else n.add(taskId)
        return n
      })
      setTaskErr(e instanceof Error ? e.message : '저장하지 못했어요')
    }
  }

  return (
    <div data-testid="csat-learning-map">
      <div className={s.panel}>
        <div ref={stageRef} className={`${s.stage} ${path ? s.hasSel : ''}`}>
          <svg className={s.edges} width="100%" height="100%" aria-hidden="true">
            {drawn.map((e) => (
              <path
                key={e.id}
                d={e.d}
                className={`${s.edge} ${e.basis === 'inferred' ? s.edgeInferred : e.basis === 'pending' ? s.edgePending : ''} ${path?.edges.has(e.id) ? s.edgeOn : ''}`}
              />
            ))}
          </svg>

          <div className={s.heads} data-map-heads="">
            {['최종 목표', ...LAYER_COLUMNS.map((c) => c.label)].map((h) => (
              <div key={h} className={s.colHead}>{h}</div>
            ))}
          </div>

          <div className={`${s.cols} ${collapsed ? s.colsCollapsed : ''}`} data-map-cols="">
            {/* 목표 · 원리 · 트랙은 스크롤을 따라와 긴 라인 열 옆에 계속 보인다 */}
            <div className={s.sticky} style={{ gridColumn: 1 }}>
              {byKind.goal && (
                <button
                  ref={register(byKind.goal.code)}
                  type="button"
                  data-map-node={byKind.goal.code}
                  className={`${s.goal} ${selected === byKind.goal.code ? s.goalSel : ''} ${path && !path.nodes.has(byKind.goal.code) ? s.nodeDim : ''} ${isHidden(byKind.goal.code) ? s.nodeHidden : ''}`}
                  aria-pressed={selected === byKind.goal.code}
                  aria-label="최종 목표 — 영역 · 학습 라인 경로"
                  onClick={() => choose(byKind.goal.code)}
                >
                  <span className={s.goalLabel}>최종 목표</span>
                  {/* 점수는 위 목표 점수 줄에만 — 같은 숫자를 두 곳에 두지 않는다 */}
                  <span className={s.goalNow}>수능 영어 · 영역 {byKind.axes.length} · 라인 {byKind.lines.length}</span>
                </button>
              )}
            </div>

            {byKind.layers.map(({ col, groups }, ci) => (
              <div key={col.key} className={s.layerCol} style={{ gridColumn: ci + 2 }} data-map-layer={col.key}>
                {groups.map(({ axis, lines }) => (
                  <div key={axis.code} className={s.layerGroup}>
                    <MapNode node={axis} value={model.nodes[axis.code]} roleAxis={axis.code} core={data.settings.core} selected={selected === axis.code} dim={Boolean(path) && !path?.nodes.has(axis.code)} hidden={isHidden(axis.code)} register={register(axis.code)} onClick={() => choose(axis.code)} />
                    {lines.map((n) => (
                      <MapNode key={n.code} node={n} value={model.nodes[n.code]} roleAxis={n.axis} core={data.settings.core} selected={selected === n.code} dim={Boolean(path) && !path?.nodes.has(n.code)} hidden={isHidden(n.code)} register={register(n.code)} onClick={() => choose(n.code)} trackCode={n.track} />
                    ))}
                  </div>
                ))}
              </div>
            ))}

          </div>
          {/* 하단에 떠 있는 알약 — 왼쪽: 선택 요약(자세히 · 해제) / 오른쪽: 범례 + 접기 */}
          <div className={s.dock}>
            <div className={s.dockLeft}>
              {selected && summary && (
                <div className={s.pill} role="status">
                  <span className={`${s.tile} ${tileClass(summary.kind, summary.track)} ${s.pillTile}`} aria-hidden="true">
                    {summary.code === 'GOAL' ? '◎' : summary.code}
                  </span>
                  <span className={s.pillName}>{summary.name}</span>
                  <span className={s.pillMeta}>{summary.counts}</span>
                  <button type="button" className={s.pillBtn} onClick={() => setOpen(true)}>
                    자세히
                  </button>
                  <button type="button" className={s.pillIcon} onClick={clearSelection} aria-label="선택 해제">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div className={s.dockRight}>
              <div className={s.pill} aria-label="범례">
                <button type="button" className={`${s.pillToggle} ${collapsed ? s.pillToggleOn : ''}`} aria-pressed={collapsed} disabled={!selected} title={selected ? '선택한 경로만 보기' : '노드를 먼저 고르세요'} onClick={() => setCollapsed((v) => !v)}>
                  <Layers size={14} strokeWidth={1.8} aria-hidden="true" />
                  접기
                </button>
                <span className={s.legendItem}><i className={s.legendLine} />직접 근거</span>
                <span className={s.legendItem}><i className={`${s.legendLine} ${s.legendDashed}`} />추론</span>
                <span className={s.legendItem}><i className={`${s.legendLine} ${s.legendDotted}`} />보류</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selected && open && (
        <NodePopup
          data={data}
          code={selected}
          done={done}
          taskError={taskErr}
          onToggle={toggleTask}
          onClose={() => setOpen(false)}
          onShowPath={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function meterLabel(v: NodeValue, core: MapSettings['core']): string {
  return `${obsLabel(v, core)}${v.achieved !== null ? ` · 기출 관찰 정답률 ${pct(v.achieved)}` : ''}`
}

/** 노드 보조 줄 — 관찰 수준(글자). 목표율 · 목표 눈금은 지도에 내지 않는다(calibration 전) */
function subline(value: NodeValue | undefined, core: MapSettings['core'], badge?: string | null): string {
  if (!value) return ''
  const base = obsLabel(value, core)
  return badge ? `${base} · ${badge}` : base
}

function MapNode({
  node,
  value,
  selected,
  dim,
  hidden,
  register,
  onClick,
  trackCode,
  badge,
  roleAxis,
  core,
}: {
  node: MapNodeRow
  value: NodeValue | undefined
  selected: boolean
  dim: boolean
  hidden?: boolean
  register: (el: HTMLElement | null) => void
  onClick: () => void
  trackCode?: string | null
  badge?: string | null
  /** 노드가 속한 영역 코드 — 역량(A)만 관찰 막대를 보인다 */
  roleAxis?: string | null
  core: MapSettings['core']
}) {
  const role = roleOf(roleAxis)
  if (role && role !== 'ability_proxy') value = undefined
  const rate = value ? (value.status === 'tasks_only' ? value.tasks.rate : value.achieved) : null
  const showBar = value && value.status !== 'no_items'
  return (
    <button
      ref={register}
      type="button"
      data-map-node={node.code}
      className={`${s.node} ${selected ? s.nodeSel : ''} ${dim ? s.nodeDim : ''} ${hidden ? s.nodeHidden : ''}`}
      aria-pressed={selected}
      aria-label={`${node.code} ${node.name}${value ? ` — ${obsLabel(value, core)}` : ''}`}
      onClick={onClick}
    >
      <span className={`${s.tile} ${tileClass(node.kind, trackCode)}`} aria-hidden="true">
        {node.code}
      </span>
      <span className={s.nodeText}>
        <span className={s.nameRow}>
          <span className={s.name}>{node.name}</span>
        </span>
        <span className={s.sub}>{value ? subline(value, core, badge) : roleAxis ? AXIS_ROLE[roleAxis]?.label ?? '' : ''}</span>
      </span>
      {showBar && value && (
        <span className={s.nodeBar} role="img" aria-label={meterLabel(value, core)}>
          {rate !== null && <span className={s.fill} style={{ width: `${Math.min(100, rate * 100)}%` }} />}
        </span>
      )}
    </button>
  )
}
