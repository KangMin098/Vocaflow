// apps/web/src/lib/csat/market-gate.ts
//
// **② 기획 게이트 — 판정할 수 있는 출판사와 없는 출판사를 가른다.** 순수 함수.
//
// ── 왜 (감사 2026-09-16 · T2) ────────────────────────────────────────
// 게이트는 「구속 출판사 지수 ≥ 1.200」 하나였고, 구속점은 EBS 1.199 였다. 그런데 EBS 는
// 7축 중 **5축을 잴 수 없다** — 코퍼스에 EBS 정답해설 문서가 0건이라 해설 축 A1~A4 가 비고,
// A5(유형 다양성)는 어느 출판사에서도 못 잰다. 그 결과 `reachableMax`(못 잰 축을 전부 이겨도
// 낼 수 있는 최대)가 **1.199** 였다. 목표보다 0.001 낮은 **천장**이다.
//
// 즉 ②는 집필·해설·조판을 아무리 돌려도 통과할 수 없었고, 화면은 그것을 「몫 남음」(생산이
// 모자람)으로 말했다. 늘 울리는 경보는 아무도 안 보고, 옆의 진짜 경보까지 가린다.
// `factory-bench.ts` 는 이 구분을 위해 `targetReachable` 을 이미 계산해 두는데 게이트가 안 봤다.
//
// ── 판정 규칙 ────────────────────────────────────────────────────────
//   · 지수가 있고 목표에 **닿을 수 있는** 출판사 중 가장 낮은 것 → **판정 구속점**(목표와 견준다)
//   · 지수가 있는데 **구조적으로 못 닿는** 출판사 → 「못 잼」 — 막는 것은 생산이 아니라 **증거**다
//   · 지수 자체가 없는 출판사(잰 축 0) → 원래도 구속점 계산에서 빠져 있었다. 이름만 적는다.
//
// 「못 잼」은 `judgeStage` 에서 「몫 남음」보다 약하게 접힌다. 그래서 판정 가능한 출판사가 실제로
// 미달이면 그 「몫 남음」이 이긴다 — **진짜 미달은 가려지지 않는다.**

import type { BenchFile, BenchPublisher } from './factory-bench'

export interface MarketGate {
  /** 판정 가능한 출판사 중 최저 지수. 판정 가능한 출판사가 없으면 null. */
  judged: { publisher: string; index: number } | null
  /** 지수는 있으나 목표에 구조적으로 못 닿는 출판사. */
  unreachable: {
    publisher: string
    index: number
    reachableMax: number | null
    axesMeasured: number
    axesTotal: number
    gaps: string[]
  }[]
  /** 지수 자체가 없는 출판사(잰 축 0 등). */
  unindexed: string[]
}

/**
 * 목표에 닿을 수 있는가 — 리포트의 `targetReachable` 을 쓰되, 없으면 `reachableMax` 로 판단한다.
 * 둘 다 없으면 **닿을 수 있다고 본다** — 모르는 것을 「못 닿음」으로 빼면 진짜 미달이 사라진다.
 */
function reachable(p: BenchPublisher, target: number): boolean {
  if (p.reachableMax != null) return p.reachableMax >= target
  return p.targetReachable !== false
}

export function splitMarketGate(bench: BenchFile, target: number): MarketGate {
  const indexed = bench.publishers.filter((p) => p.overallIndex != null)
  const ok = indexed.filter((p) => reachable(p, target))
  const judged = ok.reduce<MarketGate['judged']>(
    (min, p) =>
      min == null || (p.overallIndex as number) < min.index
        ? { publisher: p.publisher, index: p.overallIndex as number }
        : min,
    null,
  )
  return {
    judged,
    unreachable: indexed
      .filter((p) => !reachable(p, target))
      .map((p) => ({
        publisher: p.publisher,
        index: p.overallIndex as number,
        reachableMax: p.reachableMax,
        axesMeasured: p.axesMeasured,
        axesTotal: p.axesTotal,
        gaps: p.gaps,
      })),
    unindexed: bench.publishers.filter((p) => p.overallIndex == null).map((p) => p.publisher),
  }
}

/** 리포트가 며칠 전에 만들어졌는가 — 소수 첫째 자리. 시각이 없으면 null. */
export function reportAgeDays(generatedAt: string, now = new Date()): number | null {
  const t = Date.parse(generatedAt)
  if (!Number.isFinite(t)) return null
  return Math.round(((now.getTime() - t) / 864e5) * 10) / 10
}
