// apps/web/src/lib/csat/__tests__/eval-dimensions.test.ts
//
// **평가 요소 15 와 실측 7축이 같은 것을 두 번 말하지 않는지** 본다.
//
// 두 표가 있다. 하나는 코퍼스에서 잰 벤치마크(`textbook-publisher-benchmark*.json`), 다른 하나는
// 사람이 판정한 평가 요소표(`evaluation.ts`). 2026-09-06 이전에는 두 표가 **다른 화면에서 각자
// 우위를 주장**했다 — TBP 콘솔은 「평가 우위 33% (5/15)」, 공장 기획은 「구속점 1.199」. 같은
// 제품의 우위가 두 근거로 두 번 나오면, 값이 어긋날 때 **손으로 적은 쪽을 믿게 된다.**
//
// 그래서 겹치는 요소에 `benchAxis` 를 달아 화면에서 빼고, 남는 것만 「벤치마크가 안 보는 축」으로
// 건다. 이 회귀는 그 분리가 **말이 아니라 사실**인지 확인한다:
//
//   1. `benchAxis` 가 가리키는 축이 리포트에 실제로 있는가 — 없는 축을 가리키면 그 요소는
//      "벤치마크가 잰다" 며 숨었는데 아무도 안 재는 것이 된다(조용한 구멍).
//   2. 화면에 거는 목록이 `benchAxis === null` 인 것과 정확히 같은가.
//   3. **지고 있는 요소가 하나도 안 빠졌는가** — TBP 콘솔을 지울 때 잃으면 안 되는 것이 이것이다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  EVAL_DIMENSIONS,
  measureEvaluation,
  unbenchedDimensions,
} from '@vocaflow/library-pipeline/textbook-evaluation'
import { describe, expect, it } from 'vitest'

import { BENCH_FILES } from '@/lib/csat/factory-bench'

/** 리포트가 실제로 가진 축 번호. 리포트가 없으면 빈 배열 — 그때는 대조를 건너뛴다. */
function benchAxisIds(): string[] {
  const p = join(process.cwd(), '..', '..', 'docs', 'reports', BENCH_FILES.warehouse)
  let raw: string
  try {
    raw = readFileSync(p, 'utf8')
  } catch {
    return []
  }
  const j = JSON.parse(raw) as { publishers?: { axes?: { id?: string }[] }[] }
  const ids = new Set<string>()
  for (const pub of j.publishers ?? []) for (const a of pub.axes ?? []) if (a.id) ids.add(a.id)
  return [...ids].sort()
}

describe('평가 요소 15 ↔ 실측 7축', () => {
  it('`benchAxis` 는 리포트에 실제로 있는 축만 가리킨다', () => {
    const ids = benchAxisIds()
    // 리포트가 없는 환경에서는 대조 자체가 불가능하다 — 통과시키지 말고 그 사실을 남긴다.
    expect(ids.length, '벤치마크 리포트를 못 읽었다 — market-benchmark 를 먼저 돌린다').toBeGreaterThan(0)
    const claimed = EVAL_DIMENSIONS.filter((d) => d.benchAxis !== null).map((d) => d.benchAxis!)
    expect(claimed.length, '겹친다고 표시된 요소가 하나도 없다 — 매핑을 빠뜨렸나').toBeGreaterThan(0)
    for (const a of claimed) expect(ids, `${a} 축이 리포트에 없다`).toContain(a)
  })

  it('화면에 거는 목록 = `benchAxis` 가 null 인 것 전부', () => {
    const shown = unbenchedDimensions()
    expect(shown.map((d) => d.key).sort()).toEqual(
      EVAL_DIMENSIONS.filter((d) => d.benchAxis === null)
        .map((d) => d.key)
        .sort(),
    )
    // 15 를 다 걸면 겹침을 안 걷어낸 것이고, 0 이면 표가 통째로 사라진 것이다.
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(EVAL_DIMENSIONS.length)
  })

  it('지고 있는 요소는 하나도 안 걸러진다 — 걸러지면 지운 화면과 함께 사라진다', () => {
    const losing = measureEvaluation(EVAL_DIMENSIONS).losing
    const shown = new Set(unbenchedDimensions().map((d) => d.key))
    for (const d of losing) {
      // 겹치는 요소가 열위라면 벤치마크 축이 그것을 **수치로** 말하고 있어야 한다.
      if (d.benchAxis === null) {
        expect(shown, `${d.label} 이 어느 화면에도 없다`).toContain(d.key)
      } else {
        expect(benchAxisIds(), `${d.label} 은 ${d.benchAxis} 가 대신 재야 한다`).toContain(d.benchAxis)
      }
    }
  })
})
