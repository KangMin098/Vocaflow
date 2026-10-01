// apps/web/src/components/csat/diagnosis/ScoreTrend.tsx
//
// 점수 흐름 — 원점수(실선)와 난이도 보정 점수(점선). 다시 푼 기출(retake)은 점을 흐리게.
// 선 모양(실선/점선)과 범례 글자로 구분한다 — 색만으로 가르지 않는다.

import type { SessionMode } from '@/lib/csat/diagnosis/engine/types'

interface Point {
  sessionId: string
  takenAt: string
  mode: SessionMode
  raw: number | null
  adjusted: number | null
}

const W = 640
const H = 200
const PAD = { l: 36, r: 12, t: 12, b: 28 }

export function ScoreTrend({ points }: { points: Point[] }) {
  const ps = points.filter((p) => p.raw !== null)
  if (ps.length === 0) return null
  const x = (i: number) => PAD.l + (ps.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (ps.length - 1))
  const y = (v: number) => PAD.t + ((100 - v) * (H - PAD.t - PAD.b)) / 100
  const path = (key: 'raw' | 'adjusted') =>
    ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key] ?? 0).toFixed(1)}`).join(' ')
  const showAdjusted = ps.some((p) => p.adjusted !== null && p.adjusted !== p.raw)

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`점수 흐름: ${ps.map((p) => `${p.takenAt} ${p.raw}점`).join(', ')}`}>
        {[20, 40, 60, 80, 90, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--bd)" strokeWidth={g === 90 ? 1.5 : 1} />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--t2)">{g}</text>
          </g>
        ))}
        <path d={path('raw')} fill="none" stroke="var(--p)" strokeWidth={2} />
        {showAdjusted && <path d={path('adjusted')} fill="none" stroke="var(--t2)" strokeWidth={2} strokeDasharray="6 4" />}
        {ps.map((p, i) => (
          <g key={p.sessionId} opacity={p.mode === 'retake' ? 0.35 : 1}>
            <circle cx={x(i)} cy={y(p.raw ?? 0)} r={4} fill="var(--p)" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--t2)">{p.takenAt.slice(2, 7).replace('-', '.')}</text>
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-4 font-body text-[12px] text-[var(--t2)]">
        <span>━ 원점수</span>
        {showAdjusted && <span>┅ 난이도 보정 점수</span>}
        <span>흐린 점 = 다시 푼 기출</span>
      </figcaption>
    </figure>
  )
}
