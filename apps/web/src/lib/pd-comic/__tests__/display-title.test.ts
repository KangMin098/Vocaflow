// apps/web/src/lib/pd-comic/__tests__/display-title.test.ts
//
// 실제로 DB 에 있던 문자열로 고정한다 — 지어낸 예시로는 이 규칙이 왜 있는지 알 수 없다.

import { describe, expect, it } from 'vitest'

import { pdComicDisplayTitle, pdComicDisplayTitleWithYear } from '../display-title'

describe('복원 만화 표시 제목', () => {
  it('시리즈 정본을 쓴다 — 아카이브 쪽 오타가 검색 결과로 나가지 않는다', () => {
    expect(
      pdComicDisplayTitle({
        title: 'Bafflng Mysteries (Ace Comics) Issue #18', // 아카이브 원본 (오타)
        seriesTitle: 'Baffling Mysteries', // pd_comic_series 정본
        issueNo: 18,
      }),
    ).toBe('Baffling Mysteries #18')
  })

  it('제목이 이미 호수를 품고 있으면 또 붙이지 않는다', () => {
    // 실제로 `… Issue #18 #18 (1953)` 이 나갔다.
    expect(
      pdComicDisplayTitle({
        title: 'Atomic War Issue #1 (Ace Comics)',
        seriesTitle: 'Atomic War Issue #1 (Ace Comics)',
        issueNo: 1,
      }),
    ).toBe('Atomic War Issue #1 (Ace Comics)')
  })

  it('시리즈 정본이 없으면 아카이브 제목으로 떨어진다 — 빈 이름표를 만들지 않는다', () => {
    expect(
      pdComicDisplayTitle({
        title: 'ATOMIC WAR! No. 1 - Comic Book, 1952',
        seriesTitle: null,
        issueNo: null,
      }),
    ).toBe('ATOMIC WAR! No. 1 - Comic Book, 1952')
  })

  it('호수가 없는 시리즈도 있다 — super-mystery-comics 33호는 전부 null 이다', () => {
    expect(
      pdComicDisplayTitle({ title: 'x', seriesTitle: 'Super-Mystery Comics', issueNo: null }),
    ).toBe('Super-Mystery Comics')
  })

  it('연도는 요청할 때만 붙는다', () => {
    const p = { title: 'x', seriesTitle: 'Baffling Mysteries', issueNo: 18, publishedYear: 1953 }
    expect(pdComicDisplayTitle(p)).toBe('Baffling Mysteries #18')
    expect(pdComicDisplayTitleWithYear(p)).toBe('Baffling Mysteries #18 (1953)')
    expect(pdComicDisplayTitleWithYear({ ...p, publishedYear: null })).toBe('Baffling Mysteries #18')
  })
})
