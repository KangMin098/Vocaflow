// apps/web/src/app/admin/csat/sourcing/BandStrip.tsx
//
// **단계 밴드 재고 띠 — 「어느 단계에 지문이 없나」를 표 여섯 열 대신 한 줄로.**
//
// ── 왜 그림인가 ──────────────────────────────────────────────────────
// 이 화면이 답해야 하는 질문은 하나다: **"어느 단계 책을 지금 못 만드나."** 그런데 표는
// 단계·수준·지문·쓸 수 있는 것·라이선스·CEFR 여섯 열이라, 그 하나를 알려면 여섯 열을 읽고
// 밴드별로 머릿속에서 합쳐야 한다. 밴드는 다섯뿐이고 비교하는 것은 **양 하나**이므로,
// 나란한 막대가 그 질문에 곧바로 답한다.
//
// 조판 화면의 사다리 띠(`LadderFill`)와 같은 모양으로 그린다 — 공장 안에서 「칸이 찼나 비었나」는
// 늘 같은 그림이어야 관리자가 매번 새로 배우지 않는다.
//
// ── 색만으로 말하지 않는다 ───────────────────────────────────────────
// 상태는 셋 — 재고 있음 · 게이트는 있는데 0편 · 게이트 없음. 색(초록/빨강/회색)에 더해
// 채움(칠함/점선/옅음)과 글자(편 수 · 「0편」 · 「게이트 없음」)를 함께 싣는다.
// 화면 전용 지문은 **막대에서 뺀다** — 문항으로 못 쓰는 것을 재고로 세면 있지도 않은 여유를 믿는다.

import type { SourceView } from '@/lib/csat/factory-line-model'

const BAND_KO: Record<string, string> = {
  S1: '입문 다독',
  S2: '자동화 다독',
  S3: '논증 정독',
  S4: '킬러 정독',
  S5: '병행 듣기',
}

interface BandSum {
  band: string
  usable: number
  displayOnly: number
  gated: boolean
}

/** 밴드별로 접는다 — 표는 (밴드 × 수준) 행이라 밴드 하나가 여러 줄에 흩어져 있다. */
export function foldBands(rows: SourceView['rows'], gateBands: string[]): BandSum[] {
  const m = new Map<string, BandSum>()
  for (const b of gateBands) m.set(b, { band: b, usable: 0, displayOnly: 0, gated: true })
  for (const r of rows) {
    const cur = m.get(r.band) ?? { band: r.band, usable: 0, displayOnly: 0, gated: false }
    cur.usable += r.count - r.displayOnly
    cur.displayOnly += r.displayOnly
    m.set(r.band, cur)
  }
  return [...m.values()].sort((a, b) => a.band.localeCompare(b.band))
}

export function BandStrip({ rows, gateBands }: { rows: SourceView['rows']; gateBands: string[] }) {
  const bands = foldBands(rows, gateBands)
  const max = bands.reduce((m, b) => Math.max(m, b.usable), 0)
  const empty = bands.filter((b) => b.gated && b.usable === 0).length

  return (
    <div className="flex flex-col gap-2">
      <ol
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${bands.length || 1}, minmax(0, 1fr))` }}
        aria-label={`단계 밴드 ${bands.length}개 중 지문이 없는 밴드 ${empty}개`}
      >
        {bands.map((b) => {
          const blocked = b.gated && b.usable === 0
          // 재고 차이가 커서(15편 ~ 260편) 선형이면 작은 밴드가 안 보인다. 제곱근으로 누른다 —
          // 로그는 15와 260을 너무 붙여 놓아 "비슷하다" 로 읽힌다.
          const fill = max > 0 ? Math.round(100 * Math.sqrt(b.usable / max)) : 0
          return (
            <li
              key={b.band}
              className={`flex flex-col rounded-[var(--r-md)] border p-2 ${
                blocked ? 'border-dashed border-[#9C3A30]' : b.gated ? 'border-[var(--bd)]' : 'border-[var(--bd)] opacity-60'
              }`}
            >
              <span className="break-keep font-display text-[11.5px] font-[600] text-[var(--t1)]">
                {b.band}
                <span className="ml-1 font-body text-[10.5px] font-[400] text-[var(--t3)]">
                  {BAND_KO[b.band] ?? ''}
                </span>
              </span>

              {/* 막대 — 세로로 세워 「차오름」이 사다리 띠와 같은 방향으로 읽히게 */}
              <div className="mt-1.5 flex h-12 items-end rounded-[var(--r-sm)] bg-[var(--bg2)]">
                <div
                  className="w-full rounded-[var(--r-sm)] transition-[height] duration-[var(--dur-normal)] ease-[var(--ease)]"
                  style={{
                    height: `${blocked ? 0 : Math.max(fill, 6)}%`,
                    background: blocked ? 'transparent' : '#2E7D5A',
                  }}
                  aria-hidden
                />
              </div>

              <span
                className="mt-1 break-keep font-mono text-[11.5px] tabular-nums"
                style={{ color: blocked ? '#9C3A30' : 'var(--t1)' }}
              >
                {b.usable.toLocaleString()}편
                <span className="ml-1 font-body text-[10px] font-[400] text-[var(--t3)]">
                  {blocked
                    ? '게이트 있는데 0편'
                    : !b.gated
                      ? '게이트 없음'
                      : b.displayOnly
                        ? `화면 전용 −${b.displayOnly}`
                        : ''}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="break-keep font-body text-[11px] text-[var(--t3)]">
        막대는 <strong>문항으로 쓸 수 있는 지문</strong>만이다 — 화면 전용은 뺐다. 높이는 제곱근
        눈금이라 작은 밴드도 보인다(선형이면 15편이 260편 옆에서 사라진다).
      </p>
    </div>
  )
}
