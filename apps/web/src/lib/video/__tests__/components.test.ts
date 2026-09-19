// apps/web/src/lib/video/__tests__/components.test.ts
//
// **앱이 세는 구성요소와 공장이 찍은 영상이 갈리지 않는지.**
//
// 둘은 서로 다른 것을 읽는다 — 앱은 커밋된 원천을, 공장은 그날 뽑은 번들을. 그래서
// 갈릴 수 있고, 갈리면 Admin 이 거짓말을 한다("안 만듦"이라는데 실은 만들었거나 그 반대).
//
// 번들이 운영에 없으므로 공장 쪽을 직접 셀 수는 없다. 대신 **발행본(manifest)** 과 대조한다 —
// 그게 실제로 찍혀 올라간 것의 기록이고, 갈림은 거기서 드러난다.

import { describe, expect, it } from 'vitest'

import { componentCountByKind, platformComponents } from '../components'
import manifest from '../manifest.json'

const components = platformComponents()
const published = new Set((manifest.videos as { id: string }[]).map((v) => v.id))

describe('구성요소 목록', () => {
  it('id 가 겹치지 않는다', () => {
    expect(new Set(components.map((c) => c.id)).size).toBe(components.length)
  })

  it('모든 구성요소에 출처가 적혀 있다 — "왜 이게 목록에 있나" 의 답', () => {
    for (const c of components) expect(c.source.trim(), c.id).not.toBe('')
  })

  it('종류별 합이 전체와 같다', () => {
    const byKind = componentCountByKind()
    expect(Object.values(byKind).reduce((a, b) => a + b, 0)).toBe(components.length)
  })

  it('소개·커리큘럼은 각 한 편이다', () => {
    const byKind = componentCountByKind()
    expect(byKind.intro).toBe(1)
    expect(byKind.curriculum).toBe(1)
  })
})

describe('앱과 공장이 같은 id 를 말한다', () => {
  it('발행된 영상은 전부 구성요소 목록에 있다 — 없으면 Admin 이 「고아」로 오탐한다', () => {
    const ids = new Set(components.map((c) => c.id))
    const orphan = [...published].filter((id) => !ids.has(id)).sort()
    expect(orphan).toEqual([])
  })

  it('구성요소 수가 발행 편수보다 적지 않다 — 적으면 목록이 낡은 것이다', () => {
    expect(components.length).toBeGreaterThanOrEqual(published.size)
  })
})
