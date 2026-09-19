// apps/web/src/lib/textbook/__tests__/type-guide.test.ts
//
// 유형 설명 레지스트리 — **서가·상세 두 화면이 같은 이름을 쓰는지** 지킨다.
//
// 이 저장소는 같은 대상을 화면마다 다르게 부르다 여러 번 갈렸다(자료 유형·표면 이름).
// 유형 이름도 같은 길을 갈 수 있어, 사다리(`SERIES_SPINE`)가 쓰는 유형이 전부 여기 있는지
// 기계로 확인한다 — 빠지면 화면에 raw 코드(`vocab_choice`)가 그대로 노출된다.

import { SERIES_SPINE } from '@vocaflow/library-pipeline'
import { describe, expect, it } from 'vitest'

import snapshot from '../type-inventory-snapshot.json'
import { TYPE_GUIDE } from '../type-guide'

describe('사다리가 쓰는 유형은 전부 설명이 있다', () => {
  it('SERIES_SPINE 의 모든 유형이 레지스트리에 있다', () => {
    const used = new Set(SERIES_SPINE.flatMap((r) => r.types))
    for (const t of used) {
      expect(TYPE_GUIDE[t], `유형 '${t}' 설명 누락 — 화면에 raw 코드가 노출된다`).toBeDefined()
    }
  })

  it('라벨과 설명이 비어 있지 않다', () => {
    for (const [key, g] of Object.entries(TYPE_GUIDE)) {
      expect(g.label.trim().length, `${key}.label`).toBeGreaterThan(0)
      expect(g.says.trim().length, `${key}.says`).toBeGreaterThan(0)
    }
  })

  it('설명은 유형 코드를 한국어로 옮기기만 하지 않는다 — 무엇을 시키는지 말한다', () => {
    // 서점 교재의 구성란이 하는 일은 "이 코너가 무슨 능력을 요구하는가" 를 알리는 것이다.
    for (const [key, g] of Object.entries(TYPE_GUIDE)) {
      expect(g.says.length, `${key}.says 가 너무 짧다`).toBeGreaterThan(15)
    }
  })
})

describe('재고가 있는 유형은 전부 설명이 있다 — 사다리 밖도 포함', () => {
  // 왜 사다리만으로는 모자랐나 (실측 2026-09-13):
  //   위 검사는 `SERIES_SPINE` 이 쓰는 유형만 봤다. 그런데 DB 에는 **25유형**이 있고
  //   사다리는 그중 10개만 쓴다 — 나머지 15개는 재고가 수천~수십만인데 설명이 없었다.
  //   화면에서 안 보인 이유는 그 유형이 아직 어느 권에도 안 실려서고, 그건 "없다" 가 아니라
  //   "아직 안 꺼냈다" 다. 영상 공장이 유형마다 한 편을 찍으려 하면서 드러났다.
  //
  // 분모는 **실측 스냅샷**이다(`type-inventory-snapshot.json` — DB 에서 생성).
  // 문서가 아니라 계측값을 쓰는 것이 이 저장소의 규칙이다.
  it('재고 스냅샷의 모든 유형이 레지스트리에 있다', () => {
    const inventory = snapshot as { bands: { types: { type: string }[] }[] }
    const measured = new Set(inventory.bands.flatMap((b) => b.types.map((t) => t.type)))
    const missing = [...measured].filter((t) => !TYPE_GUIDE[t]).sort()
    expect(
      missing,
      `재고는 있는데 설명이 없다 — 서가·상세·영상에 raw 코드가 나간다: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('라벨이 서로 겹치지 않는다 — 같은 이름 둘이면 매대에서 구별되지 않는다', () => {
    const labels = Object.values(TYPE_GUIDE).map((g) => g.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
