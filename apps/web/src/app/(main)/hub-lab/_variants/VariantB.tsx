// apps/web/src/app/(main)/hub-lab/_variants/VariantB.tsx
//
// 후보 B — "학습 지형도" (Spatial Map).
//
// A 와 정반대의 전제에서 출발한다.
//   A: 진입면이 답할 질문은 "지금 뭘 하지" 하나다.
//   B: 진입면이 답할 질문은 **"나는 지금 어디에 있나"** 다. 할 일은 그 지형에서 파생된다.
//
// 무엇을 공간화하는가 — 이 프로젝트가 이미 갖고 있으면서 **어느 화면도 보여주지 않던 것**:
//   `lib/framework/axes.ts` 는 Stage(얼마나 깊이 아나)와 Memory state(지금 기억하나)가
//   직교한다고 못박고, "같은 단어가 Stage=Recalled 이면서 Memory=risk 일 수 있다 —
//   이 조합이 처방의 가장 값나가는 신호다" 라고 적어 뒀다.
//   그런데 화면들은 두 축을 각각 막대로만 그렸다. 교차가 신호인데 교차가 사라진 것이다.
//
// 그래서 B 의 본체는 5×4 격자다: 가로 = Stage(Met→Fluent), 세로 = Memory(stable→new).
// 칸의 진하기 = 그 칸의 단어 수. 강조 = "깊이 배웠는데 흐려진" 칸(우상단 블록).
// 카드 스택은 없다. 이 화면에는 카드가 하나도 없다.
//
// Implicit Progress 의 극단 해석 — 숫자 게이지 대신 지형의 모양이 성장을 말한다.

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { FACETS, STAGES, STAGE_ORDER, type StageId } from '@/lib/framework/axes'
import type { MemoryState } from '@/lib/framework/flow'
import type { StageMemoryGrid } from '@/lib/framework/word-progress-query'

/** 세로축 — 위가 선명하고 아래로 갈수록 흐려진다. 아래쪽이 할 일이 있는 곳이다. */
const MEMORY_ROWS: { id: MemoryState; label: string; color: string }[] = [
  { id: 'stable', label: 'Stable', color: 'var(--success)' },
  { id: 'shaky', label: 'Shaky', color: 'var(--warning)' },
  { id: 'risk', label: 'Risk', color: 'var(--error)' },
  { id: 'new', label: 'New', color: 'var(--t3)' },
]

/** 깊이 배운 것으로 보는 단계 — 이 열들과 흐려진 행이 만나는 곳이 오늘의 표적이다. */
const DEEP_STAGES: StageId[] = ['recalled', 'applied', 'fluent']

export function VariantB({ terrain }: { terrain: StageMemoryGrid | null }) {
  // 지형이 없으면 격자를 그리지 않는다. 0 으로 찬 격자는 "아직 없음" 과 구별되지 않는다.
  if (!terrain) return <NoTerrain />

  const { grid, total, deepButFading } = terrain

  // 진하기의 기준 — 최대 칸을 1로 둔다. 총합으로 나누면 대부분의 칸이 구별되지 않는다.
  let peak = 0
  for (const s of STAGE_ORDER) for (const m of MEMORY_ROWS) peak = Math.max(peak, grid[s][m.id])

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="내 어휘 지형"
        className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
      >
        <header className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
              내 어휘 지형
            </p>
            <h1 className="mt-1 font-editorial text-[26px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)] [word-break:keep-all] md:text-[32px]">
              깊이는 가로로, 선명함은 세로로
            </h1>
          </div>
          <p className="ml-auto font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
            단어 {total}개
          </p>
        </header>

        {/* ── 격자 ──
            헤더 행/열은 축 이름이고, 칸은 개수다. 개수는 색 진하기 + 숫자 2중 부호
            (색만으로 전달 금지 — 색맹 대응). */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-1">
            <caption className="sr-only">
              단계별·기억 상태별 단어 수. 가로는 얼마나 깊이 아는가, 세로는 지금 얼마나 선명한가.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[74px]">
                  <span className="sr-only">기억 상태</span>
                </th>
                {STAGE_ORDER.map((s) => (
                  <th key={s} scope="col" className="pb-1 text-center">
                    <span className="block font-display text-[11.5px] font-[700] text-[var(--t1)]">
                      {STAGES[s].name}
                    </span>
                    <span className="block font-mono text-[9.5px] text-[var(--t3)]">
                      {STAGES[s].code}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEMORY_ROWS.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="pr-2 text-right align-middle">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: row.color }}
                        aria-hidden
                      />
                      <span className="font-display text-[11px] font-[700] text-[var(--t2)]">
                        {row.label}
                      </span>
                    </span>
                  </th>
                  {STAGE_ORDER.map((s) => (
                    <Cell
                      key={s}
                      count={grid[s][row.id]}
                      peak={peak}
                      color={row.color}
                      target={DEEP_STAGES.includes(s) && (row.id === 'risk' || row.id === 'shaky')}
                      label={`${STAGES[s].name} · ${row.label}`}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 축 설명 — 격자는 처음 보는 표현이라 한 줄 해설이 필요하다(Progressive Disclosure). */}
        {/* 레지스트리 문구를 문장 중간에 끼워 넣지 않는다. C3 에서 `STAGES.recalled.says`
            ("직접 쓸 수 있어요")를 그대로 삽입했다가 "…깊이 아는 단어예요. 직접 쓸 수 있어요
            위쪽일수록…" 이라는 비문이 화면에 나갔다. 레지스트리 문구는 그 자체로 한 문장이다. */}
        <p className="mt-4 max-w-[62ch] font-body text-[12px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          오른쪽으로 갈수록 깊이 아는 단어예요. 위쪽일수록 지금 선명하고, 아래로 내려갈수록
          흐려진 상태예요. 두 축은 서로 다른 것을 말해요 — 깊이 배웠는데 흐려질 수도 있어요.
        </p>
      </section>

      {/* ── 지형에서 파생된 오늘 ──
          할 일 목록을 따로 두지 않는다. 지형에서 가장 값나가는 칸이 그대로 오늘이 된다. */}
      <TerrainAction deepButFading={deepButFading} total={total} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 격자 한 칸
// ────────────────────────────────────────────────────────────
function Cell({
  count,
  peak,
  color,
  target,
  label,
}: {
  count: number
  peak: number
  color: string
  target: boolean
  label: string
}) {
  // 0 은 진하기 0. 1 이상은 최소 가시성(0.14)을 보장한다 — 1개짜리 칸이 빈 칸으로
  // 보이면 "아직 없다" 는 거짓 정보가 된다.
  const intensity = count === 0 ? 0 : 0.14 + 0.86 * (peak > 1 ? (count - 1) / (peak - 1) : 1)

  return (
    <td className="p-0">
      <span
        className="flex h-[46px] items-center justify-center rounded-[var(--r-md)] md:h-[54px]"
        style={{
          background:
            count === 0
              ? 'var(--bg2)'
              : `color-mix(in srgb, ${color} ${Math.round(intensity * 100)}%, var(--bg))`,
          boxShadow: target && count > 0 ? `inset 0 0 0 2px var(--active)` : undefined,
        }}
        aria-label={`${label} ${count}개`}
      >
        <span
          className="font-mono text-[13px] font-[700] tabular-nums"
          style={{ color: count === 0 ? 'var(--t4)' : intensity > 0.55 ? 'var(--ti)' : 'var(--t1)' }}
        >
          {count}
        </span>
      </span>
    </td>
  )
}

// ────────────────────────────────────────────────────────────
// 지형이 지시하는 한 걸음
// ────────────────────────────────────────────────────────────
function TerrainAction({ deepButFading, total }: { deepButFading: number; total: number }) {
  if (deepButFading > 0) {
    return (
      <section
        aria-label="오늘의 한 걸음"
        className="flex flex-wrap items-center gap-4 rounded-ios-2xl px-5 py-5 text-[var(--ti)] shadow-ios-2 md:px-8"
        style={{ backgroundImage: 'linear-gradient(135deg, var(--p-dark) 0%, var(--p) 70%)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] opacity-70">
            지형이 가리키는 곳
          </p>
          <p className="mt-1.5 max-w-[34ch] font-editorial text-[19px] font-[500] leading-[1.35] [word-break:keep-all] md:text-[22px]">
            깊이 배운 {deepButFading}개가 흐려지고 있어요
          </p>
          <p className="mt-1.5 font-body text-[12px] leading-[1.6] opacity-75 [word-break:keep-all]">
            새로 배우는 것보다 이쪽이 먼저예요. 여기서 잃으면 다시 쌓는 비용이 훨씬 커요.
          </p>
        </div>
        <Link
          href="/flashcard/play"
          className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline shadow-[0_4px_18px_rgb(0_0_0_/_0.22)] motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ background: 'var(--active)', color: 'var(--p-dark)' }}
        >
          되찾기
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>
    )
  }

  // 흐려진 깊은 단어가 없다 = 지형의 아래쪽이 비었다. 그러면 폭을 넓힐 차례다.
  return (
    <section
      aria-label="오늘의 한 걸음"
      className="flex flex-wrap items-center gap-4 rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-8"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          지형이 가리키는 곳
        </p>
        <p className="mt-1.5 max-w-[36ch] font-editorial text-[19px] font-[500] leading-[1.35] text-[var(--t1)] [word-break:keep-all] md:text-[22px]">
          흐려진 단어가 없어요. 폭을 넓힐 때예요
        </p>
        <p className="mt-1.5 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          {FACETS.use.says} — 지금은 {total}개를 들고 있어요.
        </p>
      </div>
      <Link
        href="/library/books"
        className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        읽을 것 고르기
        <ArrowRight size={15} aria-hidden />
      </Link>
    </section>
  )
}

// ────────────────────────────────────────────────────────────
function NoTerrain() {
  return (
    <section
      aria-label="지형 없음"
      className="rounded-ios-2xl bg-[var(--bg)] px-6 py-10 text-center shadow-ios-2"
    >
      <p className="font-editorial text-[22px] font-[500] leading-[1.35] text-[var(--t1)] [word-break:keep-all]">
        아직 지형이 그려지지 않았어요
      </p>
      <p className="mx-auto mt-2 max-w-[40ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        단어를 모으기 시작하면 여기에 내가 어디까지 왔는지가 지도처럼 나타나요.
      </p>
      <Link
        href="/library/books"
        className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        읽을 것 고르기
        <ArrowRight size={15} aria-hidden />
      </Link>
    </section>
  )
}
