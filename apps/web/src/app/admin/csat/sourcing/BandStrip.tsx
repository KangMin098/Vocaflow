// apps/web/src/app/admin/csat/sourcing/BandStrip.tsx
//
// **단계 밴드 재고 띠 — 「어느 단계에 지문이 없나」를 표 여섯 열 대신 한 줄로.**
//
// ── 왜 그림인가 ──────────────────────────────────────────────────────
// 이 화면이 답해야 하는 질문은 하나다: **"어느 단계 책을 지금 못 만드나."** 밴드는 다섯뿐이고
// 비교하는 것은 **양 하나**이므로, 나란한 막대가 그 질문에 곧바로 답한다.
// 조판 화면의 사다리 띠(`LadderFill`)와 같은 모양으로 그린다 — 공장 안에서 「칸이 찼나 비었나」는
// 늘 같은 그림이어야 관리자가 매번 새로 배우지 않는다.
//
// ── 빨간 칸이 하나 줄었다 (2026-09-15) ───────────────────────────────
// 예전에는 **합격선이 있는데 지문 0편**이면 무조건 빨갛게 칠했다. 그래서 S5(병행 듣기)가
// 늘 빨갛게 서 있었는데, S5 의 합격선은 `listening` 하나뿐이다 — **지문을 수확해서 채우는
// 칸이 아니다.** 수확을 아무리 해도 안 꺼지는 빨간불은 경보가 아니라 소음이고, 소음은
// 옆에 있는 진짜 경보까지 안 보이게 만든다. 지금은 세 상태가 아니라 넷이다:
// 재고 있음 · **지문으로 채워야 하는데 0편** · 오디오 축(지문 재고가 아님) · 합격선 없음.
//
// ── 색만으로 말하지 않는다 ───────────────────────────────────────────
// 색(초록/빨강/보라/회색)에 더해 채움(칠함/점선/옅음)과 글자를 함께 싣는다.

import type { BandStock } from '@/lib/csat/source-console'

const BAND_KO: Record<string, string> = {
  S1: '입문 다독',
  S2: '자동화 다독',
  S3: '논증 정독',
  S4: '킬러 정독',
  S5: '병행 듣기',
  미분류: '수준 미부여',
}

/** 한 칸이 무엇을 말하는가 — 색보다 먼저 이것을 정한다. */
export type BandState = 'stocked' | 'blocked' | 'audio' | 'ungated'

export function bandState(b: BandStock): BandState {
  if (b.audioOnly) return 'audio'
  if (b.gated && b.n === 0) return 'blocked'
  if (!b.gated) return 'ungated'
  return 'stocked'
}

const NOTE: Record<BandState, string> = {
  stocked: '',
  blocked: '지문 0편 — 이 단계 책은 못 만든다',
  audio: '오디오 축 — 지문 재고가 아니다',
  ungated: '합격선 없음',
}

export function BandStrip({ bands }: { bands: BandStock[] }) {
  const max = bands.reduce((m, b) => Math.max(m, b.n), 0)
  const blocked = bands.filter((b) => bandState(b) === 'blocked').length

  return (
    <div className="flex flex-col gap-2">
      <ol
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${bands.length || 1}, minmax(0, 1fr))` }}
        aria-label={`단계 밴드 ${bands.length}개 중 지문이 없는 밴드 ${blocked}개`}
      >
        {bands.map((b) => {
          const st = bandState(b)
          // 재고 차이가 커서(0편 ~ 4만편) 선형이면 작은 밴드가 안 보인다. 제곱근으로 누른다 —
          // 로그는 작은 것과 큰 것을 너무 붙여 놓아 "비슷하다" 로 읽힌다.
          const fill = max > 0 ? Math.round(100 * Math.sqrt(b.n / max)) : 0
          const border =
            st === 'blocked'
              ? 'border-dashed border-[var(--memory-risk)]'
              : st === 'audio'
                ? 'border-dashed border-[var(--p)]'
                : st === 'ungated'
                  ? 'border-[var(--bd)] opacity-60'
                  : 'border-[var(--bd)]'
          return (
            <li key={b.band} className={`flex flex-col rounded-[var(--r-md)] border p-2 ${border}`}>
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
                    height: `${b.n === 0 ? 0 : Math.max(fill, 6)}%`,
                    background: st === 'audio' ? 'var(--p)' : 'var(--memory-stable)',
                  }}
                  aria-hidden
                />
              </div>

              <span
                className="mt-1 break-keep font-mono text-[11.5px] tabular-nums"
                style={{ color: st === 'blocked' ? 'var(--memory-risk)' : 'var(--t1)' }}
              >
                {b.n.toLocaleString()}편
                <span className="ml-1 font-body text-[10px] font-[400] text-[var(--t3)]">
                  {NOTE[st] || (b.inMarket ? `규격 안 ${b.inMarket.toLocaleString()}` : '')}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="break-keep font-body text-[11px] text-[var(--t3)]">
        막대는 <strong>조판 후보</strong>다 — 화면 전용은 빠졌지만 <strong>적격 판정 전</strong>이라,
        조판기가 실제로 싣는 것은 그중 원문 적격 화면의 「조판 가능」뿐이다. 높이는 제곱근
        눈금이라 작은 밴드도 보인다. <strong>규격 안</strong>은 시중 지문 어수창(40–250어)에
        드는 편수로, 나머지는 조판이 잘라 써야 한다.
      </p>
    </div>
  )
}
