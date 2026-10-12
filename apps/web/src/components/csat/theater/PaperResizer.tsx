// apps/web/src/components/csat/theater/PaperResizer.tsx
'use client'
//
// **기출 원문 열 폭 조절 — 끌거나 ←/→ 로.** (2026-10-12 사용자 요청)
//
// 왼쪽 「기출문제 원본」 열과 분석 판 사이의 세로 손잡이. 폭은 CSS 변수 `--paper-w` 로 부모 격자에 넘기고,
// 고른 폭은 이 기기에 남긴다. 키보드: ←/→ 32px · Home 최소 · End 최대 — 극장 전역 ←/→(강의 차례 이동)로 새지 않게 막는다.
// 좁은 화면(1000px 이하)에서는 열이 위아래로 쌓여 손잡이를 감춘다(CSS).

import { useEffect, useRef, useState, type RefObject } from 'react'

import styles from './theater.module.css'

const KEY = 'csat-paper-w'
const MIN = 256
const STEP = 32
const DEFAULT = 384

/** 최대 폭 — 분석 판이 최소 520px 은 남게, 그리고 본문 폭의 70% 이하 */
function maxFor(body: HTMLElement | null): number {
  const w = body?.clientWidth ?? 1200
  return Math.max(MIN, Math.min(w - 520, Math.round(w * 0.7)))
}

export function PaperResizer({ bodyRef }: { bodyRef: RefObject<HTMLDivElement | null> }) {
  const [width, setWidth] = useState(DEFAULT)
  const drag = useRef<{ x: number; w: number } | null>(null)

  const apply = (w: number, save = false) => {
    const next = Math.round(Math.min(maxFor(bodyRef.current), Math.max(MIN, w)))
    setWidth(next)
    bodyRef.current?.style.setProperty('--paper-w', `${next}px`)
    if (save) {
      try {
        localStorage.setItem(KEY, String(next))
      } catch {
        // 저장 실패는 조절에 영향 없음
      }
    }
  }

  useEffect(() => {
    let saved = DEFAULT
    try {
      const v = Number(localStorage.getItem(KEY))
      if (Number.isFinite(v) && v > 0) saved = v
    } catch {
      // 저장소를 못 쓰는 환경 — 기본 폭
    }
    apply(saved)
    const onResize = () => apply(Number(bodyRef.current?.style.getPropertyValue('--paper-w').replace('px', '')) || saved)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="기출 원문 폭 조절"
      aria-valuemin={MIN}
      aria-valuemax={maxFor(bodyRef.current)}
      aria-valuenow={width}
      tabIndex={0}
      className={styles.paperResizer}
      data-testid="paper-resizer"
      onPointerDown={(e) => {
        e.preventDefault()
        drag.current = { x: e.clientX, w: width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (drag.current) apply(drag.current.w + e.clientX - drag.current.x)
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        apply(drag.current.w + e.clientX - drag.current.x, true)
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={() => apply(DEFAULT, true)}
      onKeyDown={(e) => {
        const to = e.key === 'ArrowLeft' ? width - STEP : e.key === 'ArrowRight' ? width + STEP : e.key === 'Home' ? MIN : e.key === 'End' ? maxFor(bodyRef.current) : null
        if (to == null) return
        // 극장 전역 ←/→ 는 강의 차례를 옮긴다 — 손잡이 위에서는 폭만 바꾼다
        e.preventDefault()
        e.stopPropagation()
        apply(to, true)
      }}
    />
  )
}
