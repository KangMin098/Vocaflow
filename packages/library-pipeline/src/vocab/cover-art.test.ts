// packages/library-pipeline/src/vocab/cover-art.test.ts
//
// 표지 도판이 **손잡이 노릇을 하는가**.
//
// 세 가지가 동시에 참이어야 한다:
//   ① 같은 권은 언제나 같은 그림 (아니면 손잡이가 아니고, hydration 도 깨진다)
//   ② 같은 계열의 다른 권은 다른 그림 (아니면 28권이 한 그림이 된다 — 사진 수집 방식의 실패)
//   ③ 계열이 다르면 문법이 다르다 (아니면 서가에서 계열이 안 보인다)

import { describe, expect, it } from 'vitest'
import { coverArtFor, seedOf } from './cover-art'
import { FAMILY_DUOTONE, type CoverFamily } from './brand'

const FAMILIES = Object.keys(FAMILY_DUOTONE.light) as CoverFamily[]

describe('결정성 — 같은 권은 언제나 같은 그림', () => {
  it('같은 슬러그를 두 번 그리면 완전히 같다', () => {
    const a = coverArtFor('list', 'cat-csat-core-2k')
    const b = coverArtFor('list', 'cat-csat-core-2k')
    expect(a).toEqual(b)
  })

  it('시드는 계열까지 섞어 뽑는다 — 같은 슬러그라도 계열이 다르면 다른 판이다', () => {
    expect(coverArtFor('list', 'x').seed).not.toBe(coverArtFor('structure', 'x').seed)
  })

  it('시드 함수 자체가 안정적이다', () => {
    expect(seedOf('cat-topic-health')).toBe(seedOf('cat-topic-health'))
    expect(seedOf('cat-topic-health')).not.toBe(seedOf('cat-topic-travel'))
  })
})

describe('변주 — 같은 계열의 다른 권은 다른 그림', () => {
  it('주제별 17권만큼 뽑아도 도판이 겹치지 않는다', () => {
    // 사진 수집 방식이 실패한 바로 그 경우다 — 17권이 검색어 하나를 두고 다퉜다.
    const slugs = Array.from({ length: 17 }, (_, i) => `cat-topic-${i}`)
    const drawn = slugs.map((s) => JSON.stringify(coverArtFor('structure', s).paths))
    expect(new Set(drawn).size).toBe(17)
  })

  it('계열 다섯 전부에서 변주가 일어난다', () => {
    for (const f of FAMILIES) {
      const a = JSON.stringify(coverArtFor(f, 'one'))
      const b = JSON.stringify(coverArtFor(f, 'two'))
      expect(a, `${f} 이 권마다 같은 그림을 낸다`).not.toBe(b)
    }
  })
})

describe('계열 문법 — 서가에서 계열이 보인다', () => {
  it('계열마다 그리는 것이 다르다', () => {
    const shapes = FAMILIES.map((f) => JSON.stringify(coverArtFor(f, 'same-slug').paths))
    expect(new Set(shapes).size).toBe(FAMILIES.length)
  })

  it('전부 선화다 — 색을 담지 않는다 (색은 토큰이 정본)', () => {
    for (const f of FAMILIES) {
      const art = coverArtFor(f, 'k')
      const blob = JSON.stringify(art)
      expect(blob, `${f} 에 색 값이 들어 있다`).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i)
    }
  })

  it('빈 도판을 내지 않는다 — 빈 표지는 그라디언트 상자와 같다', () => {
    for (const f of FAMILIES) {
      const art = coverArtFor(f, 'k')
      expect(art.paths.length, `${f} 이 비었다`).toBeGreaterThanOrEqual(3)
      expect(art.viewBox).toBe('0 0 212 172')
    }
  })

  it('좌표가 판 밖으로 나가지 않는다 — 잘린 도판은 결이 깨진다', () => {
    for (const f of FAMILIES) {
      for (const slug of ['a', 'bb', 'ccc', 'dddd', 'eeeee']) {
        const art = coverArtFor(f, slug)
        const nums = art.paths.join(' ').match(/-?\d+(\.\d+)?/g) ?? []
        for (const n of nums.map(Number)) {
          expect(n, `${f}/${slug} 좌표 ${n}`).toBeGreaterThanOrEqual(-70)
          expect(n).toBeLessThanOrEqual(280)
        }
        for (const d of art.dots) {
          expect(d.cx).toBeGreaterThanOrEqual(0)
          expect(d.cx).toBeLessThanOrEqual(212)
          expect(d.cy).toBeGreaterThanOrEqual(0)
          expect(d.cy).toBeLessThanOrEqual(172)
        }
      }
    }
  })
})
