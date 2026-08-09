// apps/web/src/components/echo/PitchVisualizer.tsx
// Canvas 2D — 원어민 vs 사용자 피치 곡선 overlay.

'use client'

import { useEffect, useMemo, useRef } from 'react'

import { divergenceRegions } from '@/lib/echo/dtw-comparator'
import type { PitchContour } from '@/lib/echo/pitch-extractor'

interface Props {
  reference: PitchContour
  user: PitchContour
  height?: number
}

const REF_COLOR = '#3B82F6' // var(--p)
const USER_COLOR = '#22C55E' // var(--success)
// 억양이 벌어진 구간 음영 — 경고색 아님(차분한 amber), 색만으로 정보 전달 X (범례 텍스트 병기)
const DIVERGE_FILL = 'rgba(217, 119, 6, 0.13)'

export function PitchVisualizer({ reference, user, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 억양이 벌어진 시간 구간(0..1) — "어디서 달라졌는지" 지목 (#3 행동 가능 피드백)
  const regions = useMemo(() => divergenceRegions(reference, user), [reference, user])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    // 고해상도 (devicePixelRatio)
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = height
    c.width = w * dpr
    c.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    // 억양이 벌어진 구간 음영 (그리드·곡선 뒤 배경)
    ctx.fillStyle = DIVERGE_FILL
    for (const r of regions) {
      const x = r.startPct * w
      const bw = Math.max(2, (r.endPct - r.startPct) * w)
      ctx.fillRect(x, 0, bw, h)
    }

    // 배경 그리드
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)'
    ctx.lineWidth = 1
    for (let y = h / 4; y < h; y += h / 4) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // 정규화 범위
    const allHz = [...reference.frequencies, ...user.frequencies].filter((f) => f > 50)
    if (allHz.length < 2) return
    const min = Math.min(...allHz) * 0.9
    const max = Math.max(...allHz) * 1.1
    const maxDuration = Math.max(reference.durationMs, user.durationMs)

    function drawContour(contour: PitchContour, color: string) {
      ctx!.strokeStyle = color
      ctx!.lineWidth = 2.2
      ctx!.lineJoin = 'round'
      ctx!.beginPath()
      let started = false
      for (let i = 0; i < contour.frequencies.length; i++) {
        const f = contour.frequencies[i]!
        if (f <= 50) {
          started = false
          continue
        }
        const x = (contour.timestamps[i]! / maxDuration) * w
        const y = h - ((f - min) / (max - min)) * h * 0.85 - h * 0.075
        if (!started) {
          ctx!.moveTo(x, y)
          started = true
        } else {
          ctx!.lineTo(x, y)
        }
      }
      ctx!.stroke()
    }

    drawContour(reference, REF_COLOR)
    drawContour(user, USER_COLOR)
  }, [reference, user, height, regions])

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t2)]">
          피치 비교
        </h3>
        <div className="flex items-center gap-3 font-body text-[10px] text-[var(--t2)]">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-0.5 w-3" style={{ backgroundColor: REF_COLOR }} /> 원어민
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-0.5 w-3" style={{ backgroundColor: USER_COLOR }} /> 내 음성
          </span>
          {regions.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="h-2.5 w-3 rounded-[2px]" style={{ backgroundColor: DIVERGE_FILL }} /> 달라진 구간
            </span>
          )}
        </div>
      </header>
      <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px` }} />
      {regions.length > 0 && (
        <p className="mt-2 font-body text-[11px] text-[var(--t2)]">
          음영 구간에서 억양이 원어민과 달라졌어요 — 그 부분을 다시 들어보고 따라해봐요.
        </p>
      )}
    </section>
  )
}
