// apps/web/src/components/csat/space/PatternBand.tsx
//
// 작업 공간의 머리 무늬 — 참조(Tines 3B) 앱 화면의 띠와 **같은 자리**다.
//
// 다른 점 하나: 참조의 띠는 그림이고 우리 띠는 **표의 그림자**다. 원 하나가 표의 한 줄이고,
// 지름이 그 줄의 양(유형이면 문항 수 · 함정이면 오답 수)이다. 그래서 거르면 무늬가 줄고,
// 탭을 바꾸면 무늬가 바뀐다 — 「보고 있는 것이 달라졌다」를 글자 없이 말한다.
//
// 장식이 아니라 데이터라서 **난수가 없다**(space-model.patternShapes 머리말).

import { PATTERN_VIEWBOX, starPath, type PatternShape, type SpaceTone } from '@/lib/csat/space-model'

/** 옅은 면 · 진한 면 짝 — 둘 다 globals 의 토큰이다(스킨을 끄면 지면 팔레트로 돌아간다). */
const TONE_FILL: Record<SpaceTone, { soft: string; deep: string }> = {
  lavender: { soft: 'var(--tint-lavender)', deep: 'var(--deep-purple)' },
  green: { soft: 'var(--tint-green)', deep: 'var(--deep-green)' },
  peach: { soft: 'var(--tint-peach)', deep: 'var(--deep-orange)' },
  yellow: { soft: 'var(--tint-yellow)', deep: 'var(--active)' },
  pink: { soft: 'var(--tint-pink)', deep: 'var(--deep-magenta)' },
  teal: { soft: 'var(--tint-teal)', deep: 'var(--deep-ink)' },
}

function Shape({ shape, index }: { shape: PatternShape; index: number }) {
  const { kind, cx, cy, r, tone, depth } = shape
  // 큰 도형에만 진한 면을 준다 — 참조 띠도 진한 조각이 몇 개뿐이다.
  const fill = depth >= 0.78 ? TONE_FILL[tone].deep : TONE_FILL[tone].soft
  const opacity = depth >= 0.78 ? 0.74 : 1
  // 위아래로 아주 천천히 뜬다. `vf-float` 는 `prefers-reduced-motion` · 앱 토글에서 아예 정의되지 않는다.
  const style = { '--float-y': `${(index % 4) + 2}%`, '--float-dur': `${16 + (index % 7) * 3}s`, '--float-delay': `${(index % 9) * -1.7}s` } as React.CSSProperties
  if (kind === 'star') {
    return <path className="vf-float" style={style} d={starPath(cx, cy, r)} fill={fill} opacity={opacity} />
  }
  if (kind === 'dome') {
    return (
      <path
        className="vf-float"
        style={style}
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`}
        fill={fill}
        opacity={opacity}
      />
    )
  }
  return <circle className="vf-float" style={style} cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />
}

/**
 * 격자 무늬(기출 메인) — 참조 메인 띠를 그대로 따른다: **같은 크기 원이 격자로 맞붙고**, 바탕 원은
 * 옅은 회색, 데이터 원은 보라 · 분홍 · 초록 덩어리 둘(왼쪽 가운데 · 오른쪽)로 모인다.
 * 원 하나 = 표 한 줄이라는 뜻은 그대로다 — 큰 줄(양이 많은 줄)이 덩어리 한가운데 칸을 먼저 갖고,
 * 진한 면은 큰 줄에만 간다. 명령 상자 뒤(가운데)는 비워 둔다.
 */
const GRID_FILL: Record<SpaceTone, { soft: string; deep: string }> = {
  lavender: { soft: '#ddd6fb', deep: '#8b6cf0' },
  pink: { soft: '#fbc8e2', deep: '#e8499a' },
  green: { soft: '#cfe8da', deep: '#0a9a63' },
  peach: { soft: '#fbc8e2', deep: '#e8499a' },
  yellow: { soft: '#ddd6fb', deep: '#8b6cf0' },
  teal: { soft: '#cfe8da', deep: '#0a9a63' },
}
const GRID_R = 38
const GRID_BASE = ['#ececec', '#f2f2f2', '#e7e7e7']
const CLUSTERS = [
  { x: 0.24, y: 0.8, reach: 0.2 },
  { x: 0.84, y: 0.55, reach: 0.3 },
]

function gridCells() {
  const { w, h } = PATTERN_VIEWBOX
  const step = GRID_R * 2
  const cells: { cx: number; cy: number; score: number; i: number }[] = []
  let i = 0
  for (let cy = 0; cy <= h + GRID_R; cy += step) {
    for (let cx = GRID_R; cx <= w + GRID_R; cx += step) {
      // 덩어리 중심에 가까울수록 점수가 낮다(먼저 칠해진다). 가로는 화면 비율대로 눌러 잰다.
      const score = Math.min(
        ...CLUSTERS.map((c) => Math.hypot((cx / w - c.x) * 2.2, (cy / h - c.y) * 0.9) / c.reach),
      )
      cells.push({ cx, cy, score, i: i++ })
    }
  }
  return cells
}

function GridBand({ shapes }: { shapes: PatternShape[] }) {
  const cells = gridCells()
  const ranked = [...cells].filter((c) => c.score < 1.6).sort((a, b) => a.score - b.score)
  const rows = [...shapes].sort((a, b) => b.r - a.r)
  const paint = new Map<number, string>()
  rows.slice(0, ranked.length).forEach((shape, k) => {
    const fill = GRID_FILL[shape.tone]
    paint.set(ranked[k].i, shape.depth >= 0.8 ? fill.deep : fill.soft)
  })
  return (
    <>
      {cells.map((c) => (
        <circle
          key={c.i}
          className={paint.has(c.i) ? 'vf-float' : undefined}
          style={paint.has(c.i) ? ({ '--float-y': `${(c.i % 3) + 1}%`, '--float-dur': `${18 + (c.i % 5) * 3}s`, '--float-delay': `${(c.i % 7) * -1.9}s` } as React.CSSProperties) : undefined}
          cx={c.cx}
          cy={c.cy}
          r={GRID_R}
          fill={paint.get(c.i) ?? GRID_BASE[(c.i * 7) % GRID_BASE.length]}
        />
      ))}
    </>
  )
}

export function PatternBand({ shapes, className, variant = 'scatter' }: { shapes: PatternShape[]; className?: string; variant?: 'scatter' | 'grid' }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${PATTERN_VIEWBOX.w} ${PATTERN_VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {variant === 'grid' ? (
        <GridBand shapes={shapes} />
      ) : (
        shapes.map((shape, i) => <Shape key={`${shape.kind}-${i}`} shape={shape} index={i} />)
      )}
    </svg>
  )
}
