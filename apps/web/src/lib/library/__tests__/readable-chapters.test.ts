// apps/web/src/lib/library/__tests__/readable-chapters.test.ts
//
// 회귀 고정: **책 라벨이 가리는 진입로를 챕터 단위로 연다.**
//
// 2026-08-30 실측 — 발행 316권의 책 단위 난이도는 V8~V9(대학·대학원)가 187권(59%)이고
// 고1(V5) 은 2권뿐이었다. 같은 날 챕터로 재니 V5 챕터가 **87권에 걸쳐 263개** 있었다.
// 책 라벨은 p75(상위 25% 어휘)라 책 안의 쉬운 챕터를 가린다.
//
// 판정 규칙은 글(article) 버전과 **같아야 한다** — gap ≤ 0 수월 · +1 딱 맞음.
// 갈리면 같은 학습자에게 자료 종류마다 다른 기준이 적용된다.

import { describe, it, expect } from 'vitest'

import { countReadableChapters, judgeArticleIPlusOne } from '../i-plus-one'
import type { PublishedBook } from '../published-book'
import { rankStartHereBooks, scoreBook } from '../recommend-books'

describe('countReadableChapters', () => {
  it('히스토그램이 없으면 null — 0개와 "모른다" 는 다르다', () => {
    expect(countReadableChapters(null, 5)).toBeNull()
    expect(countReadableChapters(undefined, 5)).toBeNull()
    expect(countReadableChapters({}, 5)).toBeNull()
  })

  it('내 수준 이하 + 한 단계 위까지 센다 (gap ≤ +1)', () => {
    // 고1(V5) 학습자: V3·V4·V5 는 수월, V6 은 딱 맞음, V7 이상은 제외.
    const hist = { '3': 2, '4': 3, '5': 10, '6': 20, '7': 40, '8': 100 }
    const r = countReadableChapters(hist, 5)
    expect(r).not.toBeNull()
    expect(r?.count).toBe(2 + 3 + 10 + 20)
    expect(r?.ideal).toBe(20)
    expect(r?.effectiveUserVLevel).toBe(5)
  })

  it('대학원 라벨(V9) 책에서도 고1이 읽을 장을 찾아낸다 — 이 기능의 존재 이유', () => {
    // 책 라벨은 p75 라 V9 로 붙지만, 실제 챕터는 아래로 흩어져 있다.
    const v9Book = { '5': 4, '6': 9, '7': 30, '8': 40, '9': 25 }
    expect(countReadableChapters(v9Book, 5)?.count).toBe(13)
    // 같은 책이 대학생(V8)에게는 훨씬 넓게 열린다.
    expect(countReadableChapters(v9Book, 8)?.count).toBe(4 + 9 + 30 + 40 + 25)
  })

  it('미진단(0)은 한국 학습자 baseline V5 로 판정한다', () => {
    const hist = { '5': 3, '6': 7, '7': 11 }
    const r = countReadableChapters(hist, 0)
    expect(r?.effectiveUserVLevel).toBe(5)
    expect(r?.count).toBe(10)
  })

  it('망가진 값은 무시한다 — 0·음수·숫자가 아닌 키', () => {
    const hist = { '5': 0, '6': -3, abc: 5, '7': 2 } as Record<string, number>
    expect(countReadableChapters(hist, 6)?.count).toBe(2)
  })

  it('글(article) 판정과 같은 경계를 쓴다', () => {
    // gap ≤ +1 이 "지금 읽을 수 있다" 인지, 두 판정이 같은 말을 하는지 확인.
    for (const gap of [-1, 0, 1, 2, 3]) {
      const level = 5 + gap
      const included = (countReadableChapters({ [String(level)]: 1 }, 5)?.count ?? 0) > 0
      const tier = judgeArticleIPlusOne(level, 5)?.tier
      const articleReadable = tier === 'easy' || tier === 'ideal'
      expect(included, `gap ${gap} 에서 책 챕터와 글 판정이 갈렸다`).toBe(articleReadable)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 추천 점수와의 연결 — 배지가 "읽을 장 13" 이라 말하는데 추천이 그 책을 바닥에 깔면
// 두 화면이 서로 다른 말을 한다. 그래서 같은 파일에서 함께 못 박는다.
// ─────────────────────────────────────────────────────────────


/** hard 판정을 받도록 커버리지를 낮게 준 책. 챕터 분포만 바꿔 가며 비교한다. */
function hardBook(hist: Record<string, number> | null): PublishedBook {
  return {
    id: 'b',
    title: 'T',
    author: null,
    cefr_level: 'C1',
    cefr_band: 'B2',
    book_v_level: 9,
    word_count: 100000,
    chapter_count: 50,
    reading_minutes: 600,
    lexical_coverage: { '5': 70 }, // V5 학습자 기준 70% → hard
    chapter_v_hist: hist,
  }
}

const ctx = { userVLevel: 5, userMastery: 'warm' as const }

describe('추천 점수 — 챕터 진입로', () => {
  it('읽을 장이 없으면 hard 감점을 그대로 받는다', () => {
    const none = scoreBook(hardBook({ '8': 25, '9': 25 }), ctx)
    const noHist = scoreBook(hardBook(null), ctx)
    expect(none.score).toBeCloseTo(noHist.score, 5)
  })

  it('읽을 장이 많을수록 감점이 완화된다 — 지워지지는 않는다', () => {
    const noHist = scoreBook(hardBook(null), ctx)
    const some = scoreBook(hardBook({ '5': 10, '9': 40 }), ctx) // 20%
    const many = scoreBook(hardBook({ '5': 30, '9': 20 }), ctx) // 60%
    expect(some.score).toBeGreaterThan(noHist.score)
    expect(many.score).toBeGreaterThan(some.score)
    // 완화의 상한은 hard 감점 자체(25) — 그 이상으로 가산되지 않는다.
    expect(many.score).toBeLessThanOrEqual(noHist.score + 25)
  })

  it('대작에서 몇 장만 열린 것은 진입로로 치지 않는다 — 비율로 판단', () => {
    // 500장 중 4장(0.8%) — 개수만 보면 MIN 을 넘지만 비율이 미미하다.
    const epic = scoreBook(hardBook({ '5': 4, '9': 496 }), ctx)
    const noHist = scoreBook(hardBook(null), ctx)
    expect(epic.score - noHist.score).toBeLessThan(1)
  })

  it('한두 장은 진입로가 아니다 (MIN_ENTRY_CHAPTERS)', () => {
    const two = scoreBook(hardBook({ '5': 2, '9': 8 }), ctx)
    const noHist = scoreBook(hardBook(null), ctx)
    expect(two.score).toBeCloseTo(noHist.score, 5)
    expect(two.reasons.join()).not.toContain('읽을 수 있는 장')
  })

  it('완화될 때는 그 이유를 학습자에게 말한다', () => {
    const r = scoreBook(hardBook({ '5': 20, '9': 30 }), ctx)
    expect(r.reasons.join()).toContain('읽을 수 있는 장 20개')
  })

  it('미진단 학습자에게는 챕터 진입로를 적용하지 않는다 — 수준을 모른다', () => {
    const undiagnosed = { userVLevel: 0, userMastery: 'cold' as const }
    const withHist = scoreBook(hardBook({ '5': 30, '9': 20 }), undiagnosed)
    const noHist = scoreBook(hardBook(null), undiagnosed)
    expect(withHist.score).toBeCloseTo(noHist.score, 5)
  })
})

describe('rankStartHereBooks — "이 책은 여기부터" 레일', () => {
  const mk = (
    id: string,
    title: string,
    hist: Record<string, number> | null,
    coverage = 70,
  ): PublishedBook => ({
    id,
    title,
    author: null,
    cefr_level: null,
    cefr_band: null,
    book_v_level: 9,
    word_count: null,
    chapter_count: null,
    reading_minutes: null,
    lexical_coverage: { '5': coverage },
    chapter_v_hist: hist,
  })
  const ctx5 = { userVLevel: 5, userMastery: 'cold' as const }

  it('책 전체가 hard 인 것만 담는다 — "딱 맞아요" 레일과 겹치지 않는다', () => {
    // coverage 96 = ideal → 이 레일에 오면 안 된다(그 레일이 따로 있다).
    const ideal = mk('a', 'Ideal', { '5': 20, '9': 5 }, 96)
    const hard = mk('b', 'Hard', { '5': 20, '9': 5 }, 70)
    const out = rankStartHereBooks([ideal, hard], ctx5)
    expect(out.map((b) => b.id)).toEqual(['b'])
  })

  it('읽을 장이 3개 미만이면 담지 않는다', () => {
    const out = rankStartHereBooks([mk('a', 'A', { '5': 2, '9': 30 })], ctx5)
    expect(out).toEqual([])
  })

  it('비율만으로 줄 세우지 않는다 — 짧은 책이 긴 책을 무조건 이기지 않는다', () => {
    const tiny = mk('tiny', 'Tiny', { '5': 3 }) // 3/3 = 100%
    const solid = mk('solid', 'Solid', { '5': 24 }) // 24/24 = 100%
    const out = rankStartHereBooks([tiny, solid], ctx5)
    expect(out[0]!.id, '같은 비율이면 열린 장이 많은 쪽이 앞').toBe('solid')
  })

  it('개수만으로 줄 세우지도 않는다 — 대작의 일부가 항상 이기지 않는다', () => {
    const epic = mk('epic', 'Epic', { '5': 20, '9': 480 }) // 4%
    const focused = mk('focused', 'Focused', { '5': 12, '9': 4 }) // 75%
    const out = rankStartHereBooks([epic, focused], ctx5)
    expect(out[0]!.id).toBe('focused')
  })

  it('미진단 학습자에게는 빈 목록 — 수준을 모르면 "여기부터" 를 말할 수 없다', () => {
    const books = [mk('a', 'A', { '5': 20, '9': 5 })]
    expect(rankStartHereBooks(books, { userVLevel: 0, userMastery: 'cold' })).toEqual([])
  })

  it('히스토그램이 없는 책은 조용히 빠진다 — 배지도 안 뜨는 책이다', () => {
    expect(rankStartHereBooks([mk('a', 'A', null)], ctx5)).toEqual([])
  })
})
