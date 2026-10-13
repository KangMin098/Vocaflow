// apps/web/src/components/csat/theater/PaperResizer.tsx
'use client'
//
// **기출 원문 열 폭 조절 — 끌거나 ←/→ 로.** (2026-10-12 사용자 요청 · 작업공간 W1 보강)
//
// 왼쪽 「기출문제 원본」 열과 메인 프레임 사이의 세로 손잡이. 폭은 CSS 변수 `--paper-w` 로 부모 격자에 넘긴다.
// 선호 폭(학습자가 고른 값)은 이 기기에 남기고, 표시 폭은 메인 프레임이 하단 도크의 최소 폭을 지킬 만큼만이다(lib/csat/paper-width).
//   본문이 좁아지면(창 크기 · 메뉴 레일 펼침) 표시만 줄이고 선호는 덮어쓰지 않는다 — 넓어지면 선호로 돌아간다.
//   레일 접힘/펼침은 window.resize 가 없으므로 본문 컨테이너 크기 변화(ResizeObserver)도 본다.
// 키보드: ←/→ 32px · Home 최소 · End 최대 — 극장 전역 ←/→(강의 차례 이동)로 새지 않게 막는다.
// 좁은 화면(1000px 이하)에서는 열이 위아래로 쌓여 손잡이를 감춘다(CSS).

import { useEffect, useRef, useState, type RefObject } from 'react'

import { PAPER_MIN, defaultPaperWidth, maxPaperWidth, shownPaperWidth } from '@/lib/csat/paper-width'

import styles from './theater.module.css'

const KEY = 'csat-paper-w'
const STEP = 32

export function PaperResizer({ bodyRef }: { bodyRef: RefObject<HTMLDivElement | null> }) {
  const [pref, setPref] = useState<number | null>(null)
  const [width, setWidth] = useState(PAPER_MIN)
  const [max, setMax] = useState(PAPER_MIN)
  const drag = useRef<{ x: number; w: number } | null>(null)
  const prefRef = useRef<number | null>(null)

  const bodyWidth = () => bodyRef.current?.clientWidth ?? 1200
  /** 선호를 표시 폭으로 자른다 — 선호 자체는 바꾸지 않는다 */
  const show = (p: number) => {
    const bw = bodyWidth()
    const next = shownPaperWidth(p, bw)
    setWidth(next)
    setMax(maxPaperWidth(bw))
    bodyRef.current?.style.setProperty('--paper-w', `${next}px`)
    return next
  }
  /** 학습자가 고른 폭 — 지금 범위로 잘라 선호로 삼는다(보이는 폭과 같게) */
  const choose = (w: number, save: boolean) => {
    const next = shownPaperWidth(w, bodyWidth())
    prefRef.current = next
    setPref(next)
    show(next)
    if (save) {
      try {
        localStorage.setItem(KEY, String(next))
      } catch {
        // 저장 실패는 조절에 영향 없음
      }
    }
  }

  useEffect(() => {
    let saved = defaultPaperWidth(window.innerWidth)
    try {
      const v = Number(localStorage.getItem(KEY))
      if (Number.isFinite(v) && v > 0) saved = v
    } catch {
      // 저장소를 못 쓰는 환경 — 기본 폭
    }
    prefRef.current = saved
    setPref(saved)
    show(saved)
    const reflow = () => show(prefRef.current ?? saved)
    window.addEventListener('resize', reflow)
    const ro = typeof ResizeObserver !== 'undefined' && bodyRef.current ? new ResizeObserver(reflow) : null
    if (ro && bodyRef.current) ro.observe(bodyRef.current)
    return () => {
      window.removeEventListener('resize', reflow)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clamped = pref != null && pref > width
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="기출 원문 폭 조절"
        aria-valuemin={PAPER_MIN}
        aria-valuemax={max}
        aria-valuenow={width}
        aria-valuetext={clamped ? `${width}px — 창 폭에 맞춰 줄여 보임(고른 폭 ${pref}px)` : `${width}px`}
        tabIndex={0}
        className={styles.paperResizer}
        data-testid="paper-resizer"
        data-clamped={clamped}
        onPointerDown={(e) => {
          e.preventDefault()
          drag.current = { x: e.clientX, w: width }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current) show(drag.current.w + e.clientX - drag.current.x)
        }}
        onPointerUp={(e) => {
          if (!drag.current) return
          choose(drag.current.w + e.clientX - drag.current.x, true)
          drag.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onDoubleClick={() => choose(defaultPaperWidth(window.innerWidth), true)}
        onKeyDown={(e) => {
          const to = e.key === 'ArrowLeft' ? width - STEP : e.key === 'ArrowRight' ? width + STEP : e.key === 'Home' ? PAPER_MIN : e.key === 'End' ? maxPaperWidth(bodyWidth()) : null
          if (to == null) return
          // 극장 전역 ←/→ 는 강의 차례를 옮긴다 — 손잡이 위에서는 폭만 바꾼다
          e.preventDefault()
          e.stopPropagation()
          choose(to, true)
        }}
      />
      {clamped ? (
        <p className={styles.paperClamp} role="status" data-testid="paper-clamped">
          창 폭에 맞춰 원문 열을 줄여 보여요 · 넓히면 고른 폭으로 돌아가요
        </p>
      ) : null}
    </>
  )
}
