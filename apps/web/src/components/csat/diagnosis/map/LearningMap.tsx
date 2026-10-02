// apps/web/src/components/csat/diagnosis/map/LearningMap.tsx
//
// 내 진단 「학습 지도」 — 최종 목표 → 영역 → 학습 라인 → 근거 원리 → 접근 트랙(왼쪽 → 오른쪽).
// 노드마다 하단 막대 = 현재 성취율(채움) + 목표율(눈금), 상태는 글자로도 보인다. 노드를 누르면 연결 경로만 강조하고
// 오른쪽 팝업(NodePopup) 하나가 열린다. 연결선: 직접 근거(실선) · 추론(파선) · 보류(점선).
// 같은 정보를 두 곳에 두지 않는다 — 근거 문장 · 과제 · 출처는 팝업에만.

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'
import { pathOf } from '@/lib/csat/map/graph'
import type { MapNodeRow, NodeValue } from '@/lib/csat/map/model'

import { BADGE_LABEL, STATUS_LABEL, evidenceBadge, pct, toneOf } from './format'
import s from './map.module.css'
import { NodePopup } from './NodePopup'

const TONE_TEXT = { met: s.sMet, near: s.sNear, short: s.sShort, muted: '' } as const
const FILL = { met: s.fillMet, near: s.fillNear, short: s.fillShort, muted: '' } as const

interface DrawnEdge {
  id: number
  d: string
  basis: 'direct' | 'inferred' | 'pending'
}

export function LearningMap({ data }: { data: MapPageData }) {
  const router = useRouter()
  const { model, nodes, edges, settings } = data
  const [selected, setSelected] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(() => new Set(data.doneTaskIds))
  const [goal, setGoal] = useState(model.goal)
  const [draft, setDraft] = useState(String(model.goal))
  const [goalErr, setGoalErr] = useState<string | null>(null)
  const [taskErr, setTaskErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // 서버가 목표를 다시 계산해 내려오면 입력을 맞춘다
  useEffect(() => {
    setGoal(model.goal)
    setDraft(String(model.goal))
  }, [model.goal])
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
    return { goal: pick('goal')[0], axes, lines, principles: pick('principle'), tracks: pick('track'), lineGroups: axes.map((a) => lines.filter((l) => l.axis === a.code)) }
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
  }, [measure, model])
  const register = (code: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(code, el)
    else els.current.delete(code)
  }

  const path = useMemo(() => (selected ? pathOf(selected, edges.map((e) => ({ id: e.id, from: e.from_code, to: e.to_code }))) : null), [selected, edges])

  const choose = (code: string) => {
    setTaskErr(null)
    if (selected === code) {
      setSelected(null)
      return
    }
    setSelected(code)
    const kind = nodes.find((n) => n.code === code)?.kind
    if (kind) track({ name: 'csat_map_node_opened', props: { kind } })
  }

  // ── 목표 ──
  const applyGoal = async (next: number) => {
    setGoalErr(null)
    if (!Number.isInteger(next) || next < 0 || next > 100) {
      setGoalErr('0~100 사이 정수로 적어 주세요')
      return
    }
    const before = goal
    setGoal(next)
    setDraft(String(next))
    try {
      const res = await fetch('/api/csat/diagnosis/map/goal', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: next }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장하지 못했어요')
      track({ name: 'csat_map_goal_set', props: { goal: next } })
      startTransition(() => router.refresh())
    } catch (e) {
      setGoal(before)
      setDraft(String(before))
      setGoalErr(e instanceof Error ? e.message : '저장하지 못했어요')
    }
  }

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

  const goalNode = model.nodes[byKind.goal?.code ?? 'GOAL']
  const gapScore = model.currentScore !== null && goal > model.currentScore ? goal - model.currentScore : null

  return (
    <div className={`${s.root} ${selected ? s.popOpen : ''}`} data-testid="csat-learning-map">
      <div className={s.head}>
        <span className={s.title}>학습 지도</span>
        <span className={s.sub}>
          목표 {goal}점 · 기준 시험 {model.reference.exams.length}회{model.reference.shortfall > 0 ? ` (적격 시험 부족 — 원하는 ${model.reference.wanted}회)` : ''}
        </span>
      </div>

      <div className={s.scroller}>
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

          <div className={s.cols}>
            <div className={s.colHead} style={{ gridRow: 1, gridColumn: 1 }}>최종 목표</div>
            <div className={s.colHead} style={{ gridRow: 1, gridColumn: 2 }}>영역</div>
            <div className={s.colHead} style={{ gridRow: 1, gridColumn: 3 }}>학습 라인</div>
            <div className={s.colHead} style={{ gridRow: 1, gridColumn: 4 }}>근거 원리</div>
            <div className={s.colHead} style={{ gridRow: 1, gridColumn: 5 }}>접근 트랙</div>

            {/* 목표 · 원리 · 트랙은 스크롤을 따라와 긴 라인 열 옆에 계속 보인다 */}
            <div className={s.sticky} style={{ gridRow: `2 / span ${byKind.lineGroups.length}`, gridColumn: 1 }}>
              {byKind.goal && (
                <div ref={register(byKind.goal.code)} className={`${s.goal} ${selected === byKind.goal.code ? s.goalSel : ''}`}>
                  <button type="button" className={s.goalOpen} onClick={() => choose(byKind.goal.code)} aria-pressed={selected === byKind.goal.code}>
                    <span className={s.goalLabel}>목표 점수</span>
                    <span className={s.goalNum}>
                      {goal}
                      <small>점</small>
                    </span>
                    <span className={s.goalNow}>
                      {model.currentScore !== null ? `현재 ${model.currentScore}점${gapScore !== null ? ` · ${gapScore}점 남았어요` : ' · 목표에 닿았어요'}` : '현재 점수 — 시험을 기록하면 보여요'}
                    </span>
                  </button>
                  {goalNode && <Meter value={goalNode} />}
                  <div className={s.presets} role="group" aria-label="목표 점수 고르기">
                    {settings.goal_presets.map((p) => (
                      <button key={p} type="button" className={`${s.chip} ${p === goal ? s.chipOn : ''}`} aria-pressed={p === goal} onClick={() => applyGoal(p)} disabled={pending}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <form
                    className={s.goalForm}
                    onSubmit={(e) => {
                      e.preventDefault()
                      applyGoal(Number(draft))
                    }}
                  >
                    <label htmlFor="map-goal-input">직접 입력</label>
                    <input id="map-goal-input" className={s.input} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <button type="submit" className={s.btn} disabled={pending}>
                      적용
                    </button>
                  </form>
                  {goalErr && <div className={s.err} role="alert">{goalErr}</div>}
                </div>
              )}
            </div>

            {/* 영역은 자기 라인 묶음의 가운데에 — 연결선이 한 점에서 부채꼴로 퍼지지 않게 */}
            {byKind.axes.map((n, gi) => (
              <div key={n.code} className={s.axisCell} style={{ gridRow: gi + 2, gridColumn: 2 }}>
                <MapNode node={n} value={model.nodes[n.code]} selected={selected === n.code} dim={Boolean(path) && !path?.nodes.has(n.code)} register={register(n.code)} onClick={() => choose(n.code)} />
              </div>
            ))}
            {byKind.lineGroups.map((group, gi) => (
              <div key={gi} className={s.groupLines} style={{ gridRow: gi + 2, gridColumn: 3 }}>
                {group.map((n) => (
                  <MapNode key={n.code} node={n} value={model.nodes[n.code]} selected={selected === n.code} dim={Boolean(path) && !path?.nodes.has(n.code)} register={register(n.code)} onClick={() => choose(n.code)} trackCode={n.track} />
                ))}
              </div>
            ))}

            <div className={s.sticky} style={{ gridRow: `2 / span ${byKind.lineGroups.length}`, gridColumn: 4 }}>
              {byKind.principles.map((n) => (
                <MapNode
                  key={n.code}
                  node={n}
                  value={model.nodes[n.code]}
                  selected={selected === n.code}
                  dim={Boolean(path) && !path?.nodes.has(n.code)}
                  register={register(n.code)}
                  onClick={() => choose(n.code)}
                  badge={(() => {
                    const b = evidenceBadge(data.nodeSources[n.code], data.sources)
                    return b === 'sourced' ? null : BADGE_LABEL[b]
                  })()}
                />
              ))}
            </div>
            <div className={s.sticky} style={{ gridRow: `2 / span ${byKind.lineGroups.length}`, gridColumn: 5 }}>
              {byKind.tracks.map((n) => (
                <MapNode key={n.code} node={n} value={model.nodes[n.code]} selected={selected === n.code} dim={Boolean(path) && !path?.nodes.has(n.code)} register={register(n.code)} onClick={() => choose(n.code)} trackCode={n.code} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={s.legend} aria-label="범례">
        <span className={s.legendItem}><i className={s.legendLine} />직접 근거</span>
        <span className={s.legendItem}><i className={`${s.legendLine} ${s.legendDashed}`} />추론</span>
        <span className={s.legendItem}><i className={`${s.legendLine} ${s.legendDotted}`} />보류(출처 없음)</span>
        <span className={s.legendItem}>막대: 채움 = 지금 · 눈금 = 목표</span>
        <span className={s.legendItem}>달성 · 근접 · 미달 · 판정 보류 · 진단 필요</span>
      </div>

      {selected && (
        <NodePopup data={data} code={selected} done={done} taskError={taskErr} onToggle={toggleTask} onClose={() => setSelected(null)} onOpenNode={choose} />
      )}
    </div>
  )
}

function Meter({ value }: { value: NodeValue }) {
  const tone = toneOf(value.status)
  const showTick = value.target !== null
  const rate = value.status === 'tasks_only' ? value.tasks.rate : value.achieved
  return (
    <>
      <div className={s.meter} role="img" aria-label={meterLabel(value)}>
        {rate !== null && <div className={`${s.fill} ${FILL[tone]}`} style={{ width: `${Math.min(100, rate * 100)}%` }} />}
        {showTick && <div className={s.tick} style={{ left: `${Math.min(100, (value.target as number) * 100)}%` }} />}
      </div>
      <div className={s.meterRow}>
        <span className={`${s.statusText} ${TONE_TEXT[tone]}`}>
          {value.status === 'tasks_only' ? (value.tasks.total > 0 ? `과제 ${value.tasks.done}/${value.tasks.total}` : '과제 없음') : STATUS_LABEL[value.status]}
          {value.achieved !== null ? ` ${pct(value.achieved)}` : ''}
        </span>
        {value.target !== null && <span>목표 {pct(value.target)}</span>}
      </div>
    </>
  )
}

function meterLabel(v: NodeValue): string {
  if (v.status === 'tasks_only') return `과제 완료 ${v.tasks.done} / ${v.tasks.total}`
  return `${STATUS_LABEL[v.status]}${v.achieved !== null ? ` · 지금 ${pct(v.achieved)}` : ''}${v.target !== null ? ` · 목표 ${pct(v.target)}` : ''}`
}

function MapNode({
  node,
  value,
  selected,
  dim,
  register,
  onClick,
  trackCode,
  badge,
}: {
  node: MapNodeRow
  value: NodeValue | undefined
  selected: boolean
  dim: boolean
  register: (el: HTMLElement | null) => void
  onClick: () => void
  trackCode?: string | null
  badge?: string | null
}) {
  const dot = trackCode === 'T1' ? s.t1 : trackCode === 'T2' ? s.t2 : trackCode === 'T3' ? s.t3 : null
  return (
    <button
      ref={register}
      type="button"
      className={`${s.node} ${selected ? s.nodeSel : ''} ${dim ? s.nodeDim : ''}`}
      aria-pressed={selected}
      aria-label={`${node.code} ${node.name}${value ? ` — ${STATUS_LABEL[value.status]}` : ''}`}
      onClick={onClick}
    >
      <span className={s.nodeTop}>
        <span className={s.code}>{node.code}</span>
        <span className={s.name}>{node.name}</span>
        {dot && <i className={`${s.trackDot} ${dot}`} aria-hidden="true" />}
      </span>
      {badge && <span className={s.badge}>{badge}</span>}
      {value && value.status !== 'no_items' ? <Meter value={value} /> : <span className={s.meterRow}>{value?.note ?? '연결 문항 없음'}</span>}
    </button>
  )
}
