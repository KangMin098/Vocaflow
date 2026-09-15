// apps/web/src/lib/csat/__tests__/skeleton.test.ts

import { describe, expect, it } from 'vitest'

import { loadItemSkeleton, skeletonExams } from '../skeleton'

describe('loadItemSkeleton', () => {
  it('구워 둔 문항을 찾는다', () => {
    const s = loadItemSkeleton('M2309#42')
    expect(s).not.toBeNull()
    expect(s!.no).toBe(42)
    expect(s!.sentences.length).toBeGreaterThan(0)
    expect(s!.anchors.length).toBeGreaterThan(0)
  })

  it('안 구운 문항에 빈 골격을 지어내지 않는다 — null 이다', () => {
    // 막대 0개를 그리면 "지문이 없는 문항" 으로 읽힌다. 그건 거짓이고,
    // 거짓인 화면은 오류 화면보다 나쁘다.
    expect(loadItemSkeleton('M2309#999')).toBeNull()
  })

  it('없는 회차에 null', () => {
    expect(loadItemSkeleton('NOPE#1')).toBeNull()
  })

  it('경로 조작을 막는다', () => {
    expect(loadItemSkeleton('../../../etc/passwd#1')).toBeNull()
    expect(loadItemSkeleton('..#1')).toBeNull()
  })

  it('id 가 이상해도 던지지 않는다', () => {
    expect(loadItemSkeleton('')).toBeNull()
    expect(loadItemSkeleton('#')).toBeNull()
    expect(loadItemSkeleton('nohash')).toBeNull()
  })

  it('두 번 불러도 같은 것을 준다 (캐시가 값을 바꾸지 않는다)', () => {
    expect(loadItemSkeleton('M2309#42')).toEqual(loadItemSkeleton('M2309#42'))
  })
})

describe('skeletonExams', () => {
  it('구워 둔 회차를 센다', () => {
    const ex = skeletonExams()
    expect(ex.length).toBeGreaterThan(0)
    for (const e of ex) expect(e.items).toBeGreaterThan(0)
  })
})
