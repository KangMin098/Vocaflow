// apps/web/src/app/admin/csat/strategy/AxisBullet.tsx
//
// **축별 우위 지수 — 표 네 칸 대신 한 줄 그림.**
//
// ── 왜 그림인가 ──────────────────────────────────────────────────────
// 「우리 / 시장 / 지수」 세 숫자를 나란히 적으면 **읽어서 나눠야** 이기는지 지는지 안다. 축이
// 일곱이고 출판사가 넷이면 스물여덟 번 나눠야 한다. 지수는 본래 **1.000 을 기준으로 좌우**인
// 값이므로, 그 기준선을 그려 두면 나눗셈 없이 방향이 먼저 보인다.
//
// ── 어떤 그림인가 (`dataviz` 발산형) ─────────────────────────────────
// 중립점 **1.000(대등)** 을 가운데 두고 오른쪽은 이김(초록), 왼쪽은 짐(빨강). 목표 1.200 은
// 눈금으로 세운다 — 「이기고는 있지만 목표엔 못 미침」이 한눈에 갈린다. 발산형의 중간은
// 색이 아니라 **중립 회색**이어야 한다(무지개 금지).
//
// ⚠️ **색만으로 말하지 않는다.** 막대 옆에 지수를 숫자로 적고, 못 잰 축은 빈 막대가 아니라
//   「못 잼」이라는 글자와 그 이유를 싣는다 — 빈 막대는 「0」처럼 읽힌다.

import type { BenchAxis } from '@/lib/csat/factory-bench'

/** 그림의 가로 범위. 지수 1.0 이 가운데, 0.6~2.0 을 담는다(실측 최대 1.996). */
const DOMAIN = { min: 0.6, mid: 1, max: 2 } as const

/** 지수를 0~100% 위치로. 범위 밖은 끝에 붙인다(잘렸다는 것은 막대 끝 모양으로 보인다). */
function posOf(v: number): number {
  const clamped = Math.min(DOMAIN.max, Math.max(DOMAIN.min, v))
  return ((clamped - DOMAIN.min) / (DOMAIN.max - DOMAIN.min)) * 100
}

const MID = posOf(DOMAIN.mid)

export function AxisBullet({ axis, target }: { axis: BenchAxis; target: number }) {
  const v = axis.index
  const measured = v != null
  const win = measured && v > DOMAIN.mid
  const p = measured ? posOf(v) : MID
  const left = win ? MID : p
  const width = Math.abs(p - MID)

  return (
    <li className="flex flex-col gap-1 border-b border-[var(--bd)] py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 break-keep font-body text-[11.5px] text-[var(--t2)]">
          <span className="mr-1 font-mono text-[10px] text-[var(--t3)]">{axis.id}</span>
          {axis.name}
        </span>
        <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-[var(--t1)]">
          {measured ? v.toFixed(3) : <span className="text-[#8A8278]">못 잼</span>}
        </span>
      </div>

      {measured ? (
        <div
          className="relative h-3 rounded-[var(--r-sm)] bg-[var(--bg2)]"
          role="img"
          aria-label={`${axis.name} 지수 ${v.toFixed(3)} — 대등 1.000 · 목표 ${target.toFixed(3)}`}
        >
          {/* 중립선 1.000 — 발산형의 중간은 색이 아니라 회색 눈금이다 */}
          <span
            aria-hidden
            className="absolute top-0 h-full w-px bg-[var(--t3)]"
            style={{ left: `${MID}%` }}
          />
          {/* 목표 눈금 — 「이기고는 있지만 목표엔 못 미침」이 여기서 갈린다 */}
          <span
            aria-hidden
            className="absolute -top-0.5 h-4 w-px bg-[#8B5CF6]"
            style={{ left: `${posOf(target)}%` }}
          />
          <span
            aria-hidden
            className="absolute top-[3px] h-1.5 rounded-full transition-[width,left] duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{
              left: `${left}%`,
              width: `${Math.max(width, 0.4)}%`,
              background: win ? '#2E7D5A' : '#9C3A30',
            }}
          />
        </div>
      ) : (
        <p className="break-keep font-body text-[10.5px] leading-snug text-[#8A8278]">
          {axis.insufficient ?? '이 축은 아직 재지 않았다'}
        </p>
      )}
    </li>
  )
}

/** 그림이 무엇을 뜻하는지 한 줄. 축 목록 위에 한 번만 둔다. */
export function AxisBulletLegend({ target }: { target: number }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[10.5px] text-[var(--t3)]">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-1.5 w-4 rounded-full bg-[#2E7D5A]" aria-hidden />
        이김
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-1.5 w-4 rounded-full bg-[#9C3A30]" aria-hidden />
        짐
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-px bg-[var(--t3)]" aria-hidden />
        대등 1.000
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-px bg-[#8B5CF6]" aria-hidden />
        목표 {target.toFixed(3)}
      </span>
    </p>
  )
}
