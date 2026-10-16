// apps/web/src/components/csat/diagnosis/map/TaskPopup.tsx
//
// 학습지도 × Workspace 통합(LM-W1) — TASK 빠른 팝업. 노드 옆에 떠서(화면 밖으로 잘리지 않게 위치를 맞춘다)
//   TASK 이름 · 영역 / 지금 근거 / 목표까지 / 연결 Workspace(중심 · 지원) / 이번 단계 / 다음 행동 하나 / 자세한 근거 보기.
// 값은 taskInspector(DTO) · workspaceRows 그대로 — 판정하지 않는다. 다음 행동은 Inspector 와 같은 ins.next(같은 출처).
// 비모달: 지도는 계속 조작된다. Esc · 닫기 → 연 노드로 포커스를 돌린다. 바깥(노드 · 리스트 밖)을 누르면 닫힌다.

'use client'

import { ArrowRight, FileSearch, PlayCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import { DOMAIN_NAME } from '@/lib/csat/map/v4/definition'
import { STAGE_LABEL, type StageKey } from '@/lib/csat/map/v4/workspace'
import type { TaskInspectorDTO } from '@/lib/csat/map/v62/graph'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import { wsOfTask, type WsRow } from '@/lib/csat/map/v62/workspace-list'

import { BLOCKED_LABEL, EVIDENCE_V62_LABEL, NEED_V62_LABEL } from './TaskInspector'
import u from './unified.module.css'
import { wsIcon, WS_STATE_LABEL } from './WorkspaceList'

const W = 320
const GAP = 10

export function TaskPopup({ ins, anchor, rows, selectedWs, data, past, goalSet, onClose, onSelectWs, onDetail }: {
  ins: TaskInspectorDTO
  anchor: HTMLElement | null
  rows: WsRow[]
  selectedWs: string | null
  data: MapPageData
  past: boolean
  goalSet: boolean
  onClose: (restoreFocus: boolean) => void
  onSelectWs: (id: string) => void
  onDetail: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const t = ins.task
  const placed = pos !== null

  // 비모달도 열릴 때 대화상자를 알리고 바로 동작에 접근한다. 지도 밖으로 Tab 을 가두지는 않는다.
  useEffect(() => { if (placed) ref.current?.focus({ preventScroll: true }) }, [placed])

  // 노드 오른쪽 → 안 되면 왼쪽 → 위아래는 화면 안으로
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current
      if (!anchor || !el || !anchor.isConnected) return
      const a = anchor.getBoundingClientRect()
      const h = el.offsetHeight
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      let left = a.right + GAP
      if (left + W > vw - 8) left = a.left - GAP - W
      if (left < 8) left = Math.max(8, Math.min(vw - W - 8, a.left))
      const top = Math.max(8, Math.min(vh - h - 8, a.top - 8))
      setPos({ left: Math.round(left), top: Math.round(top) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const ro = new ResizeObserver(place)
    if (ref.current) ro.observe(ref.current)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      ro.disconnect()
    }
  }, [anchor, t.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) onClose(true)
    }
    const onDown = (e: MouseEvent) => {
      const x = e.target as HTMLElement
      if (ref.current?.contains(x) || x.closest('[data-testid="umap-node"], [data-testid="ws-list"], [aria-modal="true"]')) return
      onClose(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const links = wsOfTask(rows, t.id)
  const home = links[0]?.id ?? null

  return (
    <div
      ref={ref}
      className={u.pop}
      role="dialog"
      tabIndex={-1}
      aria-modal="false"
      aria-labelledby="pop-h"
      data-testid="task-pop"
      data-task={t.id}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
    >
      <header className={u.popHead}>
        <span className={u.popCode} aria-hidden="true">{t.display}</span>
        <div className={u.popTitleWrap}>
          <p className={u.popEyebrow}>{DOMAIN_NAME[t.domain]}{t.hold ? ' · 보류' : ''}</p>
          <h2 id="pop-h" className={u.popTitle}>{t.name.replace(/\(통합 관찰\)$/, '')}</h2>
        </div>
        <button type="button" className={u.iconBtn} onClick={() => onClose(true)} aria-label="닫기"><X size={15} aria-hidden="true" /></button>
      </header>
      <dl className={u.popKv}>
        <dt>지금 근거</dt>
        <dd data-testid="pop-evidence" data-evidence={ins.now.evidence}>
          {EVIDENCE_V62_LABEL[ins.now.evidence]}
          {ins.now.timingHeld > 0 && <span className={u.fine} data-testid="pop-timing-held"> · 보류 {ins.now.timingHeld}개(제출 · 해설 순서 확인 불가 — 실패 아님)</span>}
        </dd>
        <dt>목표까지</dt>
        <dd>{ins.now.need ? `${NEED_V62_LABEL[ins.now.need]}${ins.now.needRank ? ` · 순서 ${ins.now.needRank}` : ''}` : goalSet ? '이 목표에서 지금 요구 없음' : '목표를 정하면 보여요'}</dd>
        <dt>이번 단계</dt>
        <dd>{ins.plan?.stage ? `${STAGE_LABEL[ins.plan.stage as StageKey] ?? ins.plan.stage}${ins.plan.planned !== null ? ` · 수행 ${ins.plan.done} / ${ins.plan.planned}` : ''}` : '—'}</dd>
      </dl>
      <div className={u.popWs}>
        <p className={u.popSub}>연결 Workspace</p>
        {links.length > 0 ? (
          <ul>
            {links.map((l) => {
              const r = rows.find((x) => x.id === l.id)!
              const Icon = wsIcon(r.id)
              return (
                <li key={l.id}>
                  <button type="button" className={u.popWsBtn} data-link={l.link} aria-pressed={selectedWs === l.id} onClick={() => onSelectWs(l.id)} data-testid="pop-ws">
                    <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                    <span className={u.popWsName}>{r.name}</span>
                    <span className={u.wsLinkTag} data-link={l.link}>{l.link === 'core' ? '중심' : '지원'}</span>
                    <span className={u.popWsState} data-state={r.state}>{WS_STATE_LABEL[r.state]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={u.fine} data-testid="pop-no-ws">{t.hold ? '측정 방법이 정해지면 Workspace 가 생겨요.' : '이 TASK 를 다루는 Workspace 의 자료를 준비하고 있어요 — 부족하다는 뜻은 아니에요.'}</p>
        )}
      </div>
      <footer className={u.popFoot}>
        {past ? (
          <p className={u.fine}>과거 기준 보기에서는 학습을 시작하지 않아요.</p>
        ) : ins.next ? (
          <Link href={withMapReturn(ins.next.href, outgoingCtx(data.v4?.saved, t.id, home))} className={u.cta} data-testid="pop-next">
            <PlayCircle size={15} strokeWidth={1.9} aria-hidden="true" />
            <span className={u.ctaText}>{ins.next.label}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <p className={u.insBlocked} data-testid="pop-blocked" data-reason={ins.blocked ?? 'none'}>{BLOCKED_LABEL[ins.blocked ?? 'no_next_activity']}</p>
        )}
        <button type="button" className={u.ghost} onClick={onDetail} data-testid="pop-detail">
          <FileSearch size={14} aria-hidden="true" />
          자세한 근거 보기
        </button>
      </footer>
    </div>
  )
}
