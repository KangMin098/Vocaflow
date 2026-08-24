// apps/web/src/lib/game/__tests__/sets.test.ts
//
// 자료별 게임 세트 회귀.
//
// 이 테스트가 지키는 것은 하나다 — **코스가 성립하지 않는 링크를 광고하지 않는다.**
// 실측(2026-08-25)상 도서 챕터의 41.6% · 스크립트의 44.1% 가 4단어 미만이라,
// 고정 추천 목록을 내놓으면 그 절반에서 링크가 전부 죽은 채로 노출된다.

import { describe, expect, it } from 'vitest'

import { GAME_BY_SLUG, GAME_CATALOG } from '@/lib/game/catalog'
import {
  GAME_COURSES,
  courseMinWords,
  resolveCourse,
  resourceKindFromScope,
  type ResourceKind,
} from '@/lib/game/sets'

const KINDS: ResourceKind[] = ['book', 'script', 'wordset', 'mine']

describe('게임 코스 정의', () => {
  it('모든 코스의 후보 slug 가 카탈로그에 실재한다', () => {
    for (const kind of KINDS) {
      const c = GAME_COURSES[kind]
      for (const s of c.stages) {
        expect(s.candidates.length, `${kind}/${s.role} 후보가 비었다`).toBeGreaterThan(0)
        for (const slug of s.candidates) {
          expect(GAME_BY_SLUG[slug], `${kind}/${s.role} → ${slug} 없음`).toBeDefined()
        }
      }
      for (const slug of c.extras) expect(GAME_BY_SLUG[slug], `${kind} extras → ${slug} 없음`).toBeDefined()
    }
  })

  it('각 단계의 후보에는 그 자료의 최소 풀에서 도는 것이 하나는 있다', () => {
    // 후보 목록이 전부 minWords 8 이면 그 단계는 자료의 절반에서 영영 열리지 않는다.
    // 자료별 "현실적 하한"(실측 중앙값)에서 적어도 warmup 은 서야 한다.
    const floor: Record<ResourceKind, number> = { book: 4, script: 4, wordset: 8, mine: 6 }
    for (const kind of KINDS) {
      const r = resolveCourse(kind, floor[kind])
      expect(r.stages[0].game, `${kind}: 중앙값 풀에서 워밍업이 서지 않는다`).not.toBeNull()
    }
  })

  it('한 코스 안에서 같은 게임이 두 번 나오지 않는다', () => {
    for (const kind of KINDS) {
      for (const pool of [1, 4, 5, 6, 8, 20, 200]) {
        const slugs = resolveCourse(kind, pool).stages.map((s) => s.game?.slug).filter(Boolean)
        expect(new Set(slugs).size, `${kind}@${pool} 중복 단계`).toBe(slugs.length)
      }
    }
  })

  it('extras 는 코스 단계와 겹치지 않는다', () => {
    for (const kind of KINDS) {
      const r = resolveCourse(kind, 200)
      const staged = new Set(r.stages.map((s) => s.game?.slug))
      for (const e of r.extras) expect(staged.has(e.slug), `${kind}: ${e.slug} 중복 노출`).toBe(false)
    }
  })
})

describe('풀 크기에 따른 내려앉기', () => {
  it('뽑힌 게임은 항상 minWords 를 만족한다 — 죽은 링크를 만들지 않는다', () => {
    for (const kind of KINDS) {
      for (let pool = 0; pool <= 30; pool++) {
        for (const s of resolveCourse(kind, pool).stages) {
          if (!s.game) continue
          expect(s.game.minWords, `${kind}@${pool} ${s.game.slug}`).toBeLessThanOrEqual(pool)
        }
      }
    }
  })

  it('extras 도 minWords 를 만족한다', () => {
    for (const kind of KINDS) {
      for (const pool of [0, 4, 6, 8, 12]) {
        for (const g of resolveCourse(kind, pool).extras) {
          expect(g.minWords).toBeLessThanOrEqual(pool)
        }
      }
    }
  })

  it('풀이 커질수록 플레이 가능 단계 수는 줄지 않는다 (단조)', () => {
    for (const kind of KINDS) {
      let prev = -1
      for (let pool = 0; pool <= 30; pool++) {
        const n = resolveCourse(kind, pool).playable
        expect(n, `${kind}@${pool} 가 ${pool - 1} 보다 줄었다`).toBeGreaterThanOrEqual(prev)
        prev = n
      }
    }
  })

  it('풀 0 이면 어떤 단계도 서지 않는다 — 0개로 여는 코스는 거짓말이다', () => {
    for (const kind of KINDS) {
      expect(resolveCourse(kind, 0).playable, kind).toBe(0)
    }
  })

  it('스크립트 코스는 실측 중앙값 4단어에서 최소 2단계가 선다', () => {
    // 스크립트 59개 중 44.1% 가 4단어 미만 · 중앙값 4. 여기서 1단계만 서면 코스가 아니다.
    expect(resolveCourse('script', 4).playable).toBeGreaterThanOrEqual(2)
  })

  it('도서 코스는 8단어에서 3단계가 전부 선다 — 챕터의 46.6% 가 여기 해당', () => {
    expect(resolveCourse('book', 8).playable).toBe(3)
  })

  it('단어장 코스는 실측 중앙값 21단어에서 3단계가 전부 선다', () => {
    expect(resolveCourse('wordset', 21).playable).toBe(3)
  })
})

describe('unlockAt — 코스가 열리는 지점', () => {
  it('전부 서면 null, 아니면 그 수만큼 모으면 실제로 더 열린다', () => {
    for (const kind of KINDS) {
      for (let pool = 0; pool <= 12; pool++) {
        const r = resolveCourse(kind, pool)
        if (r.playable === r.course.stages.length) {
          expect(r.unlockAt, `${kind}@${pool}`).toBeNull()
          continue
        }
        expect(r.unlockAt, `${kind}@${pool} unlockAt 없음`).not.toBeNull()
        expect(r.unlockAt!).toBeGreaterThan(pool)
        expect(resolveCourse(kind, r.unlockAt!).playable).toBeGreaterThan(r.playable)
      }
    }
  })
})

describe('스코프 → 자료 종류', () => {
  it('챕터가 붙은 세트는 도서 코스다', () => {
    expect(resourceKindFromScope({ set: 'a', chapter: 3 })).toBe('book')
    expect(resourceKindFromScope({ set: 'a', chapter: null })).toBe('wordset')
  })
  it('book · text · 무스코프', () => {
    expect(resourceKindFromScope({ book: 'b' })).toBe('book')
    expect(resourceKindFromScope({ text: 't' })).toBe('script')
    expect(resourceKindFromScope({})).toBe('mine')
  })
  it('book 이 set 보다 우선한다 — 도서에서 들어오면 도서 코스', () => {
    expect(resourceKindFromScope({ book: 'b', set: 's' })).toBe('book')
  })
})

describe('courseMinWords', () => {
  it('그 수만큼 있으면 모든 단계가 선다', () => {
    for (const kind of KINDS) {
      const n = courseMinWords(kind)
      expect(resolveCourse(kind, n).playable, `${kind}@${n}`).toBe(GAME_COURSES[kind].stages.length)
    }
  })
  it('그보다 하나 적으면 한 단계 이상 빈다', () => {
    for (const kind of KINDS) {
      const n = courseMinWords(kind)
      expect(resolveCourse(kind, n - 1).playable, `${kind}@${n - 1}`).toBeLessThan(
        GAME_COURSES[kind].stages.length,
      )
    }
  })
})

describe('카탈로그 커버리지', () => {
  it('19종 중 코스·extras 어디에도 안 실린 게임을 드러낸다', () => {
    const listed = new Set<string>()
    for (const kind of KINDS) {
      for (const s of GAME_COURSES[kind].stages) s.candidates.forEach((c) => listed.add(c))
      GAME_COURSES[kind].extras.forEach((c) => listed.add(c))
    }
    const orphans = GAME_CATALOG.filter((g) => !listed.has(g.slug)).map((g) => g.slug)
    // 3D(pirate-quest)는 모바일 번들 때문에 코스에서 뺀다 — 그 외에는 전부 실려야 한다.
    expect(orphans).toEqual(['pirate-quest'])
  })
})
