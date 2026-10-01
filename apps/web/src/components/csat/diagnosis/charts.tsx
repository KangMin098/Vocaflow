// apps/web/src/components/csat/diagnosis/charts.tsx
//
// 진단 보드의 작은 시각 요소 — 도넛 · 세로 막대 · 레이더 · 스파크라인. 모두 SVG, 정지(모션 0).
// 색은 스킨 토큰(--p 강조 · --t1 잉크 · --bd 선 · --bg3 빈 칸). 숫자는 글자로도 함께 적는다(색만으로 전하지 않음).

const PALETTE = ['var(--p)', 'var(--t1)', '#22a06b', '#e5487d', '#3b82f6', '#f59e0b', '#8a8278', '#14b8a6', '#a855f7']

export function seriesColor(i: number) {
  return PALETTE[i % PALETTE.length]
}

export function Donut({ parts, center, sub, size = 150 }: { parts: { value: number; color: string; label: string }[]; center: string; sub: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg3)" strokeWidth={8} />
      {parts.map((p) => {
        const len = (p.value / total) * c
        const el = (
          <circle
            key={p.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={8}
            strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
            strokeDashoffset={-acc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="round"
          />
        )
        acc += len
        return el
      })}
      <text x="50%" y="48%" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--t1)" style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>{center}</text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="var(--t2)">{sub}</text>
    </svg>
  )
}

/** 세로 막대 — 회차별 점수 · 유형별 정답률. hollow = 다시 푼 기출 */
export function Bars({ bars, max = 100, height = 180, unit = '' }: { bars: { key: string; value: number; label: string; hollow?: boolean; focus?: boolean }[]; max?: number; height?: number; unit?: string }) {
  const w = Math.max(320, bars.length * 56)
  const bw = 6
  const top = 18
  const bottom = 40
  const step = w / Math.max(1, bars.length)
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={bars.map((b) => `${b.label} ${b.value}${unit}`).join(', ')}>
      {bars.map((b, i) => {
        const x = step * i + step / 2
        const h = ((height - top - bottom) * Math.max(0, Math.min(max, b.value))) / max
        const y = height - bottom - h
        return (
          <g key={b.key}>
            <rect x={x - bw / 2} y={top} width={bw} height={height - top - bottom} rx={3} fill="var(--bg3)" />
            <rect x={x - bw / 2} y={y} width={bw} height={h} rx={3} fill={b.focus ? 'var(--t1)' : b.hollow ? 'var(--bg)' : 'var(--p)'} stroke={b.focus ? 'var(--t1)' : 'var(--p)'} strokeWidth={b.hollow ? 1.5 : 0} />
            {b.focus && <text x={x} y={y - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--t1)">이 시험</text>}
            <text x={x} y={height - 22} textAnchor="middle" fontSize="11" fontWeight={b.focus ? 700 : 400} fill={b.focus ? 'var(--t1)' : 'var(--t2)'}>{b.label}</text>
            <text x={x} y={height - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--t1)" style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>{b.value}{unit}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** 레이더 — 축마다 0~1 값. 바깥 원 = 100% */
export function Radar({ axes, size = 220 }: { axes: { label: string; value: number }[]; size?: number }) {
  if (axes.length < 3) return null
  const c = size / 2
  const R = size / 2 - 44
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v] as const
  }
  const poly = axes.map((a, i) => pt(i, a.value).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={axes.map((a) => `${a.label} ${Math.round(a.value * 100)}%`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <circle key={k} cx={c} cy={c} r={R * k} fill="none" stroke="var(--bd)" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1)
        const [lx, ly] = pt(i, 1.28)
        return (
          <g key={a.label}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="var(--bd)" />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10.5" fill="var(--t2)">{a.label}</text>
          </g>
        )
      })}
      <polygon points={poly} fill="var(--p)" fillOpacity={0.14} stroke="var(--p)" strokeWidth={1.5} />
      {axes.map((a, i) => {
        const [x, y] = pt(i, a.value)
        return <circle key={a.label} cx={x} cy={y} r={2.5} fill="var(--t1)" />
      })}
    </svg>
  )
}

export function Sparkline({ values, width = 110, height = 34 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const x = (i: number) => (i * width) / (values.length - 1)
  const y = (v: number) => height - 3 - ((v - min) * (height - 6)) / Math.max(1, max - min)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke="var(--t2)" strokeWidth={1.3} />
    </svg>
  )
}
