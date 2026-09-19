// apps/web/src/lib/library/__tests__/book-composer-sets.test.ts
//
// 도서 페이지의 "왜 이 단어장이 있나" 문구 계약.
//
// 어드민 채점 화면은 대조군 수치("해금 문장 201 vs 빈도순 23")를 보지만, 학습자에게 필요한 것은
// 대조군이 아니라 **이걸 하면 무엇이 달라지는지**다. 그래서 증거 중 학습자가 체감하는 값 하나만
// 문장에 넣고, 나머지는 넣지 않는다 — 여기서 그 선을 고정한다.

import { describe, expect, it } from 'vitest'
import { composerSetWhy } from '../books/queries'

describe('composerSetWhy — 학습자 말로 옮긴 근거', () => {
  it('unlock 은 열리는 문장 수를 말한다 (그것이 이 유형의 값이다)', () => {
    const why = composerSetWhy('unlock', 200, {
      evidence: { sentence_unlock: { ours: 201, baseline: 23, total: 1769, budget: 200 } },
    })
    expect(why).toContain('200단어')
    expect(why).toContain('201개')
    // 대조군(빈도순 23)은 학습자에게 의미 없다 — 노출하지 않는다.
    expect(why).not.toContain('23')
    expect(why).not.toMatch(/빈도순/)
  })

  it('unlock 에 해금 증거가 없으면 커버리지로, 그것도 없으면 원리만 말한다', () => {
    expect(composerSetWhy('unlock', 100, { coverage: { achieved: 0.903 } })).toContain('90%')
    expect(composerSetWhy('unlock', 100, {})).toMatch(/빨리 읽히/)
  })

  it('recycle 은 재등장 평균을 숫자로 내걸지 않는다', () => {
    const why = composerSetWhy('recycle', 80, {
      evidence: { future_encounters: { ours_mean: 143.43, baseline_mean: 94.05, population_mean: 32.2 } },
    })
    expect(why).toMatch(/다시 만나/)
    // 실측 평균 143 을 그대로 쓰면 "143번 더 만나요" 가 되어 과장처럼 읽힌다.
    expect(why).not.toMatch(/143|94|번 더/)
  })

  it('코퍼스 동반 유형은 예문 출처가 그 책임을 말한다', () => {
    expect(composerSetWhy('book-companion', 300, {})).toMatch(/이 책의 문장/)
    expect(composerSetWhy('chapter-companion', 60, {})).toMatch(/챕터/)
  })

  it('모르는 blueprint 도 빈 문구를 내지 않는다', () => {
    expect(composerSetWhy('something-new', 10, {}).length).toBeGreaterThan(0)
  })

  it('어느 문구에도 압박 어휘를 쓰지 않는다 (CLAUDE.md 학습 UX 금지)', () => {
    const all = ['unlock', 'recycle', 'book-companion', 'chapter-companion', 'x'].map((b) =>
      composerSetWhy(b, 100, {}),
    )
    for (const why of all) {
      expect(why).not.toMatch(/잠김|불가|금지|차단|실패|부족/)
    }
  })
})
