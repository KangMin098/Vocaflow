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

export function PatternBand({ shapes, className }: { shapes: PatternShape[]; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${PATTERN_VIEWBOX.w} ${PATTERN_VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map((shape, i) => (
        <Shape key={`${shape.kind}-${i}`} shape={shape} index={i} />
      ))}
    </svg>
  )
}
