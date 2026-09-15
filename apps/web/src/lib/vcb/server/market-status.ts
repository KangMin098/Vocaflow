// apps/web/src/lib/vcb/server/market-status.ts
//
// **시중 대비 지수를 Admin 이 읽는 곳.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 세 자(내용·선택·지면)와 종합은 `docs/reports/*.json` 에만 있었다. 그 말은 **관리자가
// 콘솔에서는 우위 여부를 알 수 없다**는 뜻이고, 이 저장소가 반복해서 지적받은 형태다
// (산출물은 로컬 파일이 아니라 Admin 모니터에서 콘텐츠별로 보여야 한다).
//
// 값을 여기서 다시 계산하지 않는다 — **리포트를 읽는다.** 계산을 두 벌 두면 화면과 리포트가
// 다른 수를 말하게 되고, 그때 어느 쪽이 맞는지 알 방법이 없다. 낡았는지는 `generatedAt` 으로
// 화면이 판단한다.
//
// 재실행 안전: 파일을 읽기만 한다.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 저장소 뿌리 — `docs/reports/` 가 있는 곳까지 올라간다.
 *
 * cwd 를 상수로 가정하면 안 된다: `next dev` 는 `apps/web`, vitest 는 `apps/web`,
 * 스크립트는 뿌리에서 돈다. (`lib/csat/order-view.ts` 와 같은 이유·같은 방법.)
 */
function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    try {
      readFileSync(resolve(dir, 'docs/reports/vocab-overall-benchmark.json'))
      return dir
    } catch {
      const up = resolve(dir, '..')
      if (up === dir) break
      dir = up
    }
  }
  return process.cwd()
}

export interface MarketAxis {
  id: string
  label: string
  says: string
  index: number
  /** 천장이 있는 축이면 그 값. 없으면 null — 원리상 더 오를 수 있다. */
  ceiling: number | null
  /** 이 축이 할 수 있는 만큼 했는가. 천장이 있으면 천장 대비, 없으면 1.20 대비. */
  ok: boolean
}

export interface VcbMarketStatus {
  /** 리포트를 못 읽으면 null — **0 을 내지 않는다.** 0 은 "졌다" 로 읽힌다. */
  overall: number | null
  goal: number
  pass: boolean
  axes: MarketAxis[]
  generatedAt: string | null
  /** 지면·선택 지수를 **무엇에서 쟀나** — 렌더된 화면인가 DB 조건인가. */
  choiceBasis: 'rendered' | 'catalog' | null
  /** 지면 표본 수 — 적으면 화면이 그렇게 말해야 한다. */
  sheetsMeasured: number | null
  /** 리포트가 없거나 깨졌을 때 관리자에게 할 말. */
  problem: string | null
}

const GOAL = 1.2

export function readVcbMarketStatus(): VcbMarketStatus {
  const empty: VcbMarketStatus = {
    overall: null,
    goal: GOAL,
    pass: false,
    axes: [],
    generatedAt: null,
    choiceBasis: null,
    sheetsMeasured: null,
    problem: null,
  }
  try {
    const root = repoRoot()
    const overall = JSON.parse(
      readFileSync(resolve(root, 'docs/reports/vocab-overall-benchmark.json'), 'utf8'),
    ) as {
      overall?: number
      pass?: boolean
      generatedAt?: string
      axes?: Array<{ id: string; label: string; says: string; index: number; ceiling: number | null }>
    }
    if (typeof overall.overall !== 'number' || !Array.isArray(overall.axes)) {
      return { ...empty, problem: '종합 리포트 형식이 바뀌었다 — overall-benchmark 를 다시 돌릴 것' }
    }

    // 무엇을 잰 값인지는 선택 지수 리포트만 안다. 없으면 null 로 두고 화면이 그렇게 말한다.
    let choiceBasis: VcbMarketStatus['choiceBasis'] = null
    let sheetsMeasured: number | null = null
    try {
      const choice = JSON.parse(
        readFileSync(resolve(root, 'docs/reports/vocab-choice-benchmark.json'), 'utf8'),
      ) as { basis?: string; renderedSignals?: { sheets?: number } }
      if (choice.basis === 'rendered' || choice.basis === 'catalog') choiceBasis = choice.basis
      sheetsMeasured = choice.renderedSignals?.sheets ?? null
    } catch {
      /* 선택 리포트가 없어도 종합은 보여 준다 — 없는 것은 없다고 적는다 */
    }

    return {
      overall: overall.overall,
      goal: GOAL,
      pass: overall.overall >= GOAL,
      axes: overall.axes.map((a) => ({
        id: a.id,
        label: a.label,
        says: a.says,
        index: a.index,
        ceiling: a.ceiling,
        // 천장이 있는 축에 1.20 을 요구하면 영원히 미달로 남는다 — 그 축의 목표는 천장이다.
        ok: a.ceiling == null ? a.index >= GOAL : a.index >= a.ceiling - 0.02,
      })),
      generatedAt: overall.generatedAt ?? null,
      choiceBasis,
      sheetsMeasured,
      problem: null,
    }
  } catch {
    return {
      ...empty,
      problem:
        '벤치마크 리포트를 못 읽었다 — docs/reports/vocab-overall-benchmark.json 이 없거나 깨졌다. '
        + 'overall-benchmark 를 먼저 돌린다',
    }
  }
}

/** 며칠 지났나. 리포트가 낡으면 화면이 그렇게 말해야 한다. */
export function ageInDays(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / 86_400_000)
}
