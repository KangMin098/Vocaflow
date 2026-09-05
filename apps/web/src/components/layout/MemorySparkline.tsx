// apps/web/src/components/layout/MemorySparkline.tsx
//
// **망각을 시간축으로 그린다** — 이 제품이 가진 것 중 경쟁사가 베끼기 가장 어려운 그림.
//
// 지금까지 기억은 늘 *한 점*(오늘의 4색)이었다. 점 하나로는 "왜 내일이 아니라 오늘인가"
// 를 말할 수 없다. R(t) = exp(ln(0.9)·t/S) 를 앞으로 7일에 대해 풀면 그 이유가 선이 된다.
//
// 무엇을 그리나: 날마다 **버티고 있는 단어 수**(stable + shaky). 선이 내려가는 만큼이
// 흐려지는 양이고, 그 사이를 옅게 채워 눈에 보이게 한다.
//
// 왜 게이지가 아니라 선인가 (철학 ④ Implicit Progress):
//   게이지는 "얼마나 했나" 를 말하고 선은 "무엇이 일어나고 있나" 를 말한다. 여기서 필요한
//   것은 후자다. 그리고 이 선은 **가만히 있으면 내려간다** — 성장을 환경 변화로 보여주는
//   가장 정직한 형태다.
//
// 접근성: 색만으로 알리지 않는다. 곡선 옆에 언제나 문장이 함께 서고(`forecastSentence`),
//   SVG 자체도 `role="img"` + 수치가 담긴 `aria-label` 을 갖는다.
// 모션: 없다. 정지 그래픽이다(§5 학습 중 모션 화이트리스트에 그래프 애니메이션은 없다).

import { hasForecastCurve, type MemoryForecast } from '@/lib/learner/memory-forecast'

export interface MemorySparklineProps {
  forecast: MemoryForecast
  /** 그리는 크기 — 셸 패널 기본값 */
  width?: number
  height?: number
}

/** 버티고 있는 수 = stable + shaky. risk 는 이미 흐려진 것이라 뺀다. */
function holding(day: { stable: number; shaky: number }): number {
  return day.stable + day.shaky
}

export function MemorySparkline({ forecast, width = 132, height = 40 }: MemorySparklineProps) {
  const days = forecast.days
  // 움직이지 않는 곡선은 그리지 않는다 — 수평선은 고장난 그래프처럼 보이고
  // 아무 말도 하지 않는다(hasForecastCurve 주석의 실측 참조).
  if (!hasForecastCurve(forecast)) return null

  const values = days.map(holding)
  const max = Math.max(...values, 1)
  const pad = 3
  const w = width - pad * 2
  const h = height - pad * 2
  const x = (i: number) => pad + (i / (days.length - 1)) * w
  // 0 이 바닥에 붙지 않게 max 기준으로만 잡는다 — 바닥에 붙으면 "다 잃었다" 로 읽힌다.
  const y = (v: number) => pad + h - (v / max) * h

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  // 오늘 수준의 수평선과 실제 곡선 사이 = 이번 주에 흐려지는 양.
  const today = values[0]
  const lost = `${line} L${x(values.length - 1).toFixed(1)},${y(today).toFixed(1)} Z`

  const label =
    `앞으로 ${forecast.horizonDays}일 기억 예보 — 오늘 ${today}개가 자리를 지키고 있고, ` +
    `${forecast.horizonDays}일 뒤에는 ${values[values.length - 1]}개예요.`

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
    >
      {/* 흐려지는 영역 — 옅게. 이 면적이 곧 "이번 주에 잃는 것" 이다 */}
      <path d={lost} fill="var(--memory-risk)" opacity="0.14" />
      {/* 오늘 수준 기준선 — 점선이라 곡선과 혼동되지 않는다 */}
      <line
        x1={pad}
        y1={y(today)}
        x2={width - pad}
        y2={y(today)}
        stroke="var(--t4)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path d={line} fill="none" stroke="var(--t2)" strokeWidth="1.5" strokeLinecap="round" />
      {/* 오늘 — 점 하나. 시작점이 어디인지 모르면 곡선이 방향을 잃는다 */}
      <circle cx={x(0)} cy={y(today)} r="2.5" fill="var(--p)" />
    </svg>
  )
}
