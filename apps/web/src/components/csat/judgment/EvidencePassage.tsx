// apps/web/src/components/csat/judgment/EvidencePassage.tsx
// D7 공통 근거 앵커 — 원문 단위를 고를 수 있는 근거로 그리고, 판단면이 가리킨 단위를 표시한다.
// 자동 스크롤하지 않는다: 가리킨 단위가 화면 밖이면 「n번 문장 · 위/아래」 칩을 띄우고 학습자가 눌러 이동한다.
// 가리킨 단위가 여럿(예: 이음매의 두 문장)이면 각각 따로 검사해 화면 밖인 것마다 칩을 띄운다(T-0253).
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EvidenceUnit } from '@/lib/csat/judgment/types'
import styles from './judgment.module.css'

export type UnitState = 'focus' | 'pinned' | 'dim' | undefined

export type LocateEdge = 'top' | 'bottom'
export interface LocateTarget { id: string; edge: LocateEdge }

/**
 * 위치 칩 대상 — 가리킨 단위 각각에서 화면 밖(edgeOf 가 위/아래를 준) 것만, 원문 순서대로 · 중복 없이.
 * 원문에 없는 id(잘못된 id)는 건너뛴다. 화면 안이면 칩이 없다.
 */
export function locateTargets(focus: readonly string[], order: readonly string[], edgeOf: (id: string) => LocateEdge | null): LocateTarget[] {
  const wanted = new Set(focus)
  const out: LocateTarget[] = []
  for (const id of order) {
    if (!wanted.has(id)) continue
    const edge = edgeOf(id)
    if (edge) out.push({ id, edge })
  }
  return out
}

/** 단위 사각형이 보는 창 위 · 아래 밖인가(8px 여유) — 안이면 null. */
export function edgeOutside(r: { top: number; bottom: number }, pane: { top: number; bottom: number }): LocateEdge | null {
  return r.bottom < pane.top + 8 ? 'top' : r.top > pane.bottom - 8 ? 'bottom' : null
}

export function EvidencePassage(props: {
  units: EvidenceUnit[]
  /** 지금 판단면이 가리키는 단위 — 강조 + 위치 칩 */
  focus?: string[]
  /** 학습자가 근거로 고정한 단위 */
  pinned?: string[]
  /** 흐리게 둘 단위(예: 비교에서 빠진 문장) */
  dimmed?: string[]
  /** 단위를 누르거나 Enter/Space — 근거 고르기 */
  onPick?: (unitId: string) => void
  /** 단위 옆 작은 표지(예: ③, (A)) */
  marks?: Record<string, ReactNode>
  label?: string
  scrollRoot?: React.RefObject<HTMLElement>
}) {
  const { units, focus = [], pinned = [], dimmed = [], onPick, marks = {}, label = '원문', scrollRoot } = props
  const [offscreen, setOffscreen] = useState<LocateTarget[]>([])
  const self = useRef<HTMLDivElement>(null)

  // 가리킨 단위 묶음이 바뀔 때만 다시 건다(같은 묶음의 부모 재렌더는 그대로)
  const focusKey = focus.join('|')
  const orderKey = units.map((u) => u.id).join('|')
  useEffect(() => {
    const root = scrollRoot?.current ?? self.current?.closest<HTMLElement>('[data-scroll-pane]') ?? null
    const ids = focusKey ? focusKey.split('|') : []
    if (ids.length === 0 || !root) { setOffscreen([]); return }
    const order = orderKey.split('|')
    const check = () => {
      const p = root.getBoundingClientRect()
      const next = locateTargets(ids, order, (id) => {
        const el = root.querySelector<HTMLElement>(`[data-unit="${id}"]`)
        return el ? edgeOutside(el.getBoundingClientRect(), p) : null
      })
      setOffscreen((prev) => (prev.length === next.length && prev.every((x, i) => x.id === next[i].id && x.edge === next[i].edge) ? prev : next))
    }
    check()
    root.addEventListener('scroll', check, { passive: true })
    return () => root.removeEventListener('scroll', check)
  }, [focusKey, orderKey, scrollRoot])
  const above = offscreen.filter((x) => x.edge === 'top')
  const below = offscreen.filter((x) => x.edge === 'bottom')

  const stateOf = (id: string): UnitState => (focus.includes(id) ? 'focus' : pinned.includes(id) ? 'pinned' : dimmed.includes(id) ? 'dim' : undefined)
  const go = (id: string) => {
    const el = (self.current ?? document).querySelector<HTMLElement>(`[data-unit="${id}"]`)
    el?.scrollIntoView({ block: 'center' })
    el?.focus({ preventScroll: true })
  }
  const nOf = (id: string) => units.find((u) => u.id === id)?.n

  if (units.length === 0) return <p className={styles.empty}>이 문항은 원문 단위 자료가 없어 근거를 연결할 수 없다.</p>

  return (
    <div ref={self} aria-label={label} role="group">
      {above.length > 0 && <Locate edge="top" targets={above.map((x) => ({ id: x.id, n: nOf(x.id) }))} onGo={go} />}
      <div className={styles.passage}>
        {units.map((u) => {
          const st = stateOf(u.id)
          const isPinned = pinned.includes(u.id)
          return (
            <span key={u.id}>
              <span
                data-unit={u.id}
                data-state={st}
                data-role={u.kind === 'line' ? 'line' : undefined}
                className={styles.unit}
                role={onPick ? 'button' : undefined}
                tabIndex={onPick ? 0 : -1}
                aria-pressed={onPick ? isPinned : undefined}
                onClick={onPick ? () => onPick(u.id) : undefined}
                onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(u.id) } } : undefined}
              >
                {/* 접근성 이름 = 번호 · 상태 + 실제 문장(aria-label 로 덮어쓰지 않는다 — T-0151 P1-03) */}
                <span className={styles.srInline}>{`${u.n}번 문장${st === 'focus' ? ' (지금 가리킴)' : ''}: `}</span>
                <span className={styles.unitNo} aria-hidden>{u.n}</span>
                <span>{u.text}</span>
                {marks[u.id] && <span className={styles.unitMark}>{marks[u.id]}</span>}
              </span>{' '}
            </span>
          )
        })}
      </div>
      {below.length > 0 && <Locate edge="bottom" targets={below.map((x) => ({ id: x.id, n: nOf(x.id) }))} onGo={go} />}
    </div>
  )
}

function Locate({ edge, targets, onGo }: { edge: LocateEdge; targets: { id: string; n?: number }[]; onGo: (id: string) => void }) {
  return (
    <div className={styles.locate} data-edge={edge}>
      {targets.map((t) => (
        <button key={t.id} type="button" data-locate={edge} data-locate-unit={t.id} onClick={() => onGo(t.id)}>
          {t.n ? `${t.n}번 문장` : '가리킨 문장'} · {edge === 'top' ? '위' : '아래'}로 가기
        </button>
      ))}
    </div>
  )
}
