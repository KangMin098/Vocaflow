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
