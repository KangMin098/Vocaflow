// apps/web/src/components/csat/judgment/EvidencePassage.tsx
// D7 공통 근거 앵커 — 원문 단위를 고를 수 있는 근거로 그리고, 판단면이 가리킨 단위를 표시한다.
// 자동 스크롤하지 않는다: 가리킨 단위가 화면 밖이면 「n번 문장 · 위/아래」 칩을 띄우고 학습자가 눌러 이동한다.
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EvidenceUnit } from '@/lib/csat/judgment/types'
import styles from './judgment.module.css'

export type UnitState = 'focus' | 'pinned' | 'dim' | undefined

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
  const [offscreen, setOffscreen] = useState<{ id: string; edge: 'top' | 'bottom' } | null>(null)
  const self = useRef<HTMLDivElement>(null)

  const firstFocus = focus[0]
  useEffect(() => {
    const root = scrollRoot?.current ?? self.current?.closest<HTMLElement>('[data-scroll-pane]') ?? null
    if (!firstFocus || !root) { setOffscreen(null); return }
    const check = () => {
      const el = root.querySelector<HTMLElement>(`[data-unit="${firstFocus}"]`)
      if (!el) return setOffscreen(null)
      const r = el.getBoundingClientRect(), p = root.getBoundingClientRect()
      setOffscreen(r.bottom < p.top + 8 ? { id: firstFocus, edge: 'top' } : r.top > p.bottom - 8 ? { id: firstFocus, edge: 'bottom' } : null)
    }
    check()
    root.addEventListener('scroll', check, { passive: true })
    return () => root.removeEventListener('scroll', check)
  }, [firstFocus, scrollRoot])

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
      {offscreen?.edge === 'top' && <Locate edge="top" n={nOf(offscreen.id)} onGo={() => go(offscreen.id)} />}
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
      {offscreen?.edge === 'bottom' && <Locate edge="bottom" n={nOf(offscreen.id)} onGo={() => go(offscreen.id)} />}
    </div>
  )
}

function Locate({ edge, n, onGo }: { edge: 'top' | 'bottom'; n?: number; onGo: () => void }) {
  return (
    <div className={styles.locate} data-edge={edge}>
      <button type="button" data-locate={edge} onClick={onGo}>{n ? `${n}번 문장` : '가리킨 문장'} · {edge === 'top' ? '위' : '아래'}로 가기</button>
    </div>
  )
}
